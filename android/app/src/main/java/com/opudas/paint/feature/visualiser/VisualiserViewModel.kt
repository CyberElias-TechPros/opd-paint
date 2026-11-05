package com.opudas.paint.feature.visualiser

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.engine.BrushStamp
import com.opudas.paint.core.engine.FinishLook
import com.opudas.paint.core.engine.MaskEngine
import com.opudas.paint.core.engine.RenderEngine
import com.opudas.paint.core.util.previewFile
import java.io.File
import java.io.IOException
import java.io.OutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** What the next touch does. */
enum class VisualiserTool(val label: String) {
    FILL("Tap a wall"),
    BRUSH("Brush it in"),
    ERASE("Brush it out"),
}

data class VisualiserUiState(
    val isDecoding: Boolean = false,
    val width: Int = 0,
    val height: Int = 0,
    val preview: Bitmap? = null,
    /**
     * Bumped every time [preview]'s pixels are rewritten.
     *
     * The bitmap is reused rather than reallocated, because a 1400px frame is several
     * megabytes and a brush stroke redraws it — and Compose skips recomposition when a
     * state object compares equal, which a reused bitmap does. Without this the preview
     * would update and the screen would not.
     */
    val revision: Int = 0,
    val colours: List<PaintColor> = emptyList(),
    val colour: PaintColor? = null,
    val finish: FinishLook = FinishLook.MATT,
    val tool: VisualiserTool = VisualiserTool.FILL,
    // Qualified, and not because it reads well: these defaults belong to the view model's
    // companion, which is declared after this class, and a default value cannot see an
    // unqualified name from a class it is not inside. The compiler says "unresolved
    // reference" and gives no hint that the constant exists three screens down the file.
    val tolerance: Int = VisualiserViewModel.DEFAULT_TOLERANCE,
    val brushRadius: Int = VisualiserViewModel.DEFAULT_BRUSH_RADIUS,
    val coverage: Double = 0.0,
    val canUndo: Boolean = false,
    val failure: String? = null,
) {
    val hasImage: Boolean
        get() = preview != null

    val coveragePercent: Int
        get() = (coverage * 100).toInt()
}

/**
 * Your photograph, one wall, one colour.
 *
 * The privacy position is the website's, and it is the reason this class has this shape:
 * **the photograph never leaves the device.** It is decoded from a content URI the picker
 * handed over, scaled down, and turned into an `IntArray` the engines work on. There is no
 * upload path here to disable, no queue to drain and no server to trust, because nothing in
 * this file can reach a network.
 *
 * The segmentation is deliberately simple — a tolerance flood fill plus a brush, not a
 * machine-learning model — for the reasons `app/src/lib/mask.ts` gives: the visitor stays in
 * control, a failure is obvious and instantly correctable, and there is no inference cost and
 * no retention window. A design decision, not a shortcut, and the screen says so.
 *
 * Two compromises, each with its reason attached:
 *
 *  - **The frame is composed when a gesture ends, not during it.** The website composes on
 *    every pointer event, which a GPU-backed canvas can afford. A per-pixel blend over 1.5
 *    million pixels in Kotlin cannot, sixty times a second, on the device this is likeliest
 *    to be used on. So a drag paints the mask and shows the result when the finger lifts.
 *  - **Sharing and saving are hand-offs, and either can be refused.** An empty share sheet, a
 *    cancelled picker, a full disk. Both report what happened in words rather than doing
 *    nothing visibly, because a button that appears dead is the failure this app's own intent
 *    helpers call the worst one on a screen that matters.
 */
class VisualiserViewModel(
    private val context: Context,
    private val content: ContentRepository,
    initialColourId: String?,
) : ViewModel() {

    private val mutableState = MutableStateFlow(VisualiserUiState())
    val uiState: StateFlow<VisualiserUiState> = mutableState.asStateFlow()

    private var source: IntArray? = null
    private var mask: IntArray = IntArray(0)
    private var output: IntArray = IntArray(0)
    private var frame: Bitmap? = null
    private var pendingStrokeFrom: Pair<Float, Float>? = null

    /** Mask snapshots, oldest first. Ten deep, the same as the website's undo. */
    private val undo = ArrayDeque<IntArray>()

    init {
        viewModelScope.launch {
            val colours = content.colors()
            val chosen = colours.firstOrNull { it.id == initialColourId } ?: colours.firstOrNull()
            mutableState.update { it.copy(colours = colours, colour = chosen) }
            recompose()
        }
    }

    /**
     * A photograph the picker returned.
     *
     * Decoded twice on purpose: once for the dimensions only, so a sample size can be chosen
     * before any pixels are allocated, and once for real. A 48-megapixel photograph decoded
     * at full size is an out-of-memory error on a cheap device, and the working image is at
     * most 1400px on its longest edge anyway.
     */
    fun onPhotoPicked(uri: Uri?) {
        if (uri == null) return
        mutableState.update { it.copy(isDecoding = true, failure = null) }
        viewModelScope.launch {
            val decoded = withContext(Dispatchers.IO) { decode(uri) }
            if (decoded == null) {
                mutableState.update { it.copy(isDecoding = false, failure = DECODE_FAILED) }
                return@launch
            }
            source = decoded.pixels
            mask = IntArray(decoded.width * decoded.height)
            output = IntArray(decoded.width * decoded.height)
            frame?.recycle()
            frame = null
            undo.clear()
            mutableState.update {
                it.copy(
                    isDecoding = false,
                    width = decoded.width,
                    height = decoded.height,
                    failure = null,
                    canUndo = false,
                )
            }
            recompose()
        }
    }

    fun selectColour(id: String) {
        val colour = mutableState.value.colours.firstOrNull { it.id == id } ?: return
        mutableState.update { it.copy(colour = colour) }
        viewModelScope.launch { recompose() }
    }

    fun setFinish(finish: FinishLook) {
        mutableState.update { it.copy(finish = finish) }
        viewModelScope.launch { recompose() }
    }

    fun setTool(tool: VisualiserTool) {
        mutableState.update { it.copy(tool = tool) }
    }

    fun setTolerance(value: Int) {
        mutableState.update { it.copy(tolerance = value.coerceIn(0, 100)) }
    }

    fun setBrushRadius(value: Int) {
        mutableState.update { it.copy(brushRadius = value.coerceIn(MIN_BRUSH_RADIUS, MAX_BRUSH_RADIUS)) }
    }

    /**
     * A touch that began, in image coordinates.
     *
     * With the fill tool this is the whole gesture. With a brush it is the first stamp of a
     * stroke, and the position is kept so the drag that follows interpolates from here rather
     * than from wherever the first move event happens to land.
     */
    fun onGestureStart(x: Float, y: Float) {
        val state = mutableState.value
        if (!state.hasImage) return
        val pixels = source ?: return
        when (state.tool) {
            VisualiserTool.FILL -> {
                pushUndo()
                MaskEngine.floodFill(
                    source = pixels,
                    mask = mask,
                    width = state.width,
                    height = state.height,
                    seedX = x.toDouble(),
                    seedY = y.toDouble(),
                    tolerance = state.tolerance,
                    add = true,
                )
                pendingStrokeFrom = null
                viewModelScope.launch { recompose() }
            }
            VisualiserTool.BRUSH, VisualiserTool.ERASE -> {
                pushUndo()
                pendingStrokeFrom = x to y
                stamp(x, y)
            }
        }
    }

    /** A drag, in image coordinates. The fill tool has nothing to do with one. */
    fun onGestureDrag(x: Float, y: Float) {
        val state = mutableState.value
        if (!state.hasImage || state.tool == VisualiserTool.FILL) return
        val from = pendingStrokeFrom
        if (from == null) {
            stamp(x, y)
        } else {
            MaskEngine.stroke(
                from = BrushStamp(from.first.toDouble(), from.second.toDouble()),
                to = BrushStamp(x.toDouble(), y.toDouble()),
                radius = state.brushRadius.toDouble(),
            ).forEach { stamp(it.x.toFloat(), it.y.toFloat()) }
        }
        pendingStrokeFrom = x to y
        mutableState.update {
            it.copy(coverage = MaskEngine.coverage(mask, state.width, state.height))
        }
    }

    /** The finger lifted: the mask is settled, so this is when the frame is composed. */
    fun onGestureEnd() {
        pendingStrokeFrom = null
        if (mutableState.value.tool == VisualiserTool.FILL) return
        viewModelScope.launch { recompose() }
    }

    /**
     * The composed frame as a PNG in the cache's preview directory.
     *
     * PNG, not JPEG, because `shareImage` already declares `image/png` and because a
     * preview somebody hands to a painter may be printed: JPEG would put blocking
     * artefacts along exactly the edge between the painted wall and the ceiling line,
     * which is the edge the whole exercise is about.
     *
     * Null means there is no frame — no photograph yet, or one that failed to decode.
     * The caller says so in words rather than showing a share sheet with nothing in it.
     */
    suspend fun exportPng(): File? {
        val bitmap = frame ?: return null
        return withContext(Dispatchers.IO) {
            try {
                val file = context.previewFile("opudas-room-preview-${System.currentTimeMillis()}.png")
                file.outputStream().use { stream ->
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
                }
                file
            } catch (error: IOException) {
                // A full disk or a cache cleared mid-write. Reproducible in a second
                // from the photograph and the colour, so this is a shrug, not a loss.
                null
            }
        }
    }

    /**
     * The composed frame written into a stream the caller opened.
     *
     * This is the save path: the system file picker hands back a content URI and an
     * output stream, and writing straight into it means the photograph is never copied
     * into a place another app could later find. Same reason the cache copy is a cache.
     */
    suspend fun writeTo(stream: OutputStream): Boolean {
        val bitmap = frame ?: return false
        return withContext(Dispatchers.IO) {
            try {
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            } catch (error: IOException) {
                false
            }
        }
    }

    /**
     * What the shared preview says about itself.
     *
     * Carries the disclaimer, because a preview that reaches a painter's phone without
     * it stops being a simulation and becomes an instruction — and the colour name is
     * there so the recipient knows which of 59 this was, without having to ask.
     */
    fun shareCaption(): String {
        val colour = mutableState.value.colour
        val finish = mutableState.value.finish.name.lowercase()
        val name = colour?.let { "${it.name} (${it.code})" } ?: "an OPUDA'S colour"
        return "OPUDA'S PAINT — $name on my wall, $finish finish. " +
            "A simulation on screen: confirm with a sample pot or a dealer chip."
    }

    fun undo() {
        val previous = undo.removeLastOrNull() ?: return
        mask = previous
        mutableState.update { it.copy(canUndo = undo.isNotEmpty()) }
        viewModelScope.launch { recompose() }
    }

    fun clearSelection() {
        val state = mutableState.value
        if (!state.hasImage) return
        pushUndo()
        mask = IntArray(state.width * state.height)
        viewModelScope.launch { recompose() }
    }

    private fun stamp(x: Float, y: Float) {
        val state = mutableState.value
        MaskEngine.stamp(
            mask = mask,
            width = state.width,
            height = state.height,
            centre = BrushStamp(x.toDouble(), y.toDouble()),
            radius = state.brushRadius.toDouble(),
            add = state.tool != VisualiserTool.ERASE,
        )
    }

    private fun pushUndo() {
        if (mask.isEmpty()) return
        undo.addLast(mask.copyOf())
        while (undo.size > UNDO_DEPTH) undo.removeFirst()
        mutableState.update { it.copy(canUndo = true) }
    }

    private suspend fun recompose() {
        val state = mutableState.value
        val pixels = source ?: return
        val hex = state.colour?.hex ?: return
        if (output.size != pixels.size || state.width <= 0 || state.height <= 0) return

        withContext(Dispatchers.Default) {
            RenderEngine.composeFrame(
                source = pixels,
                mask = mask,
                width = state.width,
                height = state.height,
                hex = hex,
                finish = state.finish,
                output = output,
            )
        }

        val bitmap = frame?.takeIf { it.width == state.width && it.height == state.height }
            ?: Bitmap.createBitmap(state.width, state.height, Bitmap.Config.ARGB_8888)
                .also { frame = it }
        bitmap.setPixels(output, 0, state.width, 0, 0, state.width, state.height)

        mutableState.update { current ->
            current.copy(
                preview = bitmap,
                revision = current.revision + 1,
                coverage = MaskEngine.coverage(mask, state.width, state.height),
                canUndo = undo.isNotEmpty(),
            )
        }
    }

    private class Decoded(val width: Int, val height: Int, val pixels: IntArray)

    private fun decode(uri: Uri): Decoded? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        try {
            context.contentResolver.openInputStream(uri)?.use {
                BitmapFactory.decodeStream(it, null, bounds)
            }
        } catch (error: IOException) {
            return null
        } catch (error: SecurityException) {
            // A permission the app was given and then lost, which a picker can do.
            return null
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        val target = MaskEngine.scaledSize(bounds.outWidth, bounds.outHeight)
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= target.width &&
            bounds.outHeight / (sample * 2) >= target.height
        ) {
            sample *= 2
        }

        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        val decoded = try {
            context.contentResolver.openInputStream(uri)?.use {
                BitmapFactory.decodeStream(it, null, options)
            }
        } catch (error: IOException) {
            null
        } catch (error: OutOfMemoryError) {
            null
        } ?: return null

        val bitmap = if (decoded.width == target.width && decoded.height == target.height) {
            decoded
        } else {
            Bitmap.createScaledBitmap(decoded, target.width, target.height, true)
        }
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        if (bitmap !== decoded) decoded.recycle()
        bitmap.recycle()
        return Decoded(target.width, target.height, pixels)
    }

    override fun onCleared() {
        frame?.recycle()
        frame = null
        source = null
        mask = IntArray(0)
        output = IntArray(0)
        undo.clear()
    }

    companion object {
        const val DEFAULT_TOLERANCE = 12
        const val DEFAULT_BRUSH_RADIUS = 28
        const val MIN_BRUSH_RADIUS = 8
        const val MAX_BRUSH_RADIUS = 90
        private const val UNDO_DEPTH = 10

        const val DECODE_FAILED =
            "That photograph could not be opened. It may be damaged, or in a format this " +
                "device cannot decode — a phone camera's own JPEG or PNG always works."
    }
}
