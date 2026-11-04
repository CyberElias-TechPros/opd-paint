package com.opudas.paint.core.engine

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Where a brush stamp lands. Canvas coordinates, so fractional. */
data class BrushStamp(val x: Double, val y: Double)

/** What a fill did: whether anything changed, and how many pixels it changed. */
data class FillResult(val changed: Boolean, val pixels: Int)

/** A working size in pixels. Kept apart from android.util.Size so this stays JVM-testable. */
data class WorkingSize(val width: Int, val height: Int)

/**
 * Wall masking: pick a wall with a tap, correct the edges with a brush.
 *
 * A port of `app/src/lib/mask.ts`, which is the part of the visualiser that is an
 * algorithm rather than a canvas. Three rules decided its shape:
 *
 * **No Android types in here.** Pixels are `IntArray` of ARGB, so every function is
 * testable on the JVM without Robolectric, a device or an emulator — and this is the
 * code most likely to be subtly wrong, because a fill that stops one pixel short looks
 * almost right and is wrong everywhere.
 *
 * **The mask is an ARGB image whose alpha is the selection.** That is what the canvas
 * version does, and keeping it means `floodFill` writes the same bytes: opaque white to
 * select, transparent white to erase. A `BooleanArray` would be smaller and would quietly
 * make the soft brush impossible, because a brush edge is not on or off.
 *
 * **The fill is exact; the brush is equivalent.** [floodFill], [coverage], [stroke] and
 * [scaledSize] are arithmetic, and they reproduce the TypeScript pixel for pixel — the
 * tests in `MaskEngineTest` assert values lifted from running the real thing. [stamp] is
 * not: a canvas radial gradient is rasterised by the browser with its own anti-aliasing,
 * and there is no honest way to reproduce that from a spec. It implements the same
 * falloff and the same composite operations, so a stroke behaves the same way and does
 * not claim to be the same bytes.
 *
 * A visitor's photograph never leaves the device, here exactly as on the website: these
 * functions are pure, and nothing in this file can reach a network.
 */
object MaskEngine {

    /**
     * The longest edge of the working image.
     *
     * A phone camera delivers 4000px and nobody needs 4000px to see whether a wall is
     * the wrong green. Capping it is what keeps a flood fill under a frame and a bitmap
     * under the memory budget of a cheap device.
     */
    const val MAX_EDGE = 1400

    /**
     * The working size for a photograph, scaled so its longest edge is at most [maxEdge].
     *
     * Small images are left alone rather than enlarged: upscaling a 800px photograph
     * would invent detail for the fill to find.
     */
    fun scaledSize(width: Int, height: Int, maxEdge: Int = MAX_EDGE): WorkingSize {
        val longest = max(width, height)
        if (longest <= 0) return WorkingSize(1, 1)
        val scale = min(1.0, maxEdge.toDouble() / longest)
        // floor(x + 0.5) is JavaScript's Math.round, which is what the website uses.
        // Kotlin's roundToInt agrees, but writing it out keeps the port readable next to
        // the line it came from and survives a change of rounding mode in either language.
        return WorkingSize(
            width = max(1, floor(width * scale + 0.5).toInt()),
            height = max(1, floor(height * scale + 0.5).toInt()),
        )
    }

    /**
     * Connected flood fill with a colour tolerance.
     *
     * Scanline rather than per-pixel recursion, for the reason the TypeScript gives: it
     * cannot blow the call stack on a 1400px wall, it is much faster on flat plaster, and
     * its extra memory is one visited array.
     *
     * [tolerance] is 0..100 and maps to a Euclidean RGB distance, where 100 is
     * deliberately generous — about 260, against a maximum possible distance of 441.
     *
     * @param source ARGB pixels of the photograph.
     * @param mask   ARGB pixels of the selection, modified in place. Its alpha channel is
     *               the selection: 255 where the wall is, 0 where it is not.
     * @param add    true to select, false to erase. Erase is not "fill with 0"; it walks
     *               the same region and clears it, so a mistake is removable by dragging
     *               over it rather than by starting again.
     */
    fun floodFill(
        source: IntArray,
        mask: IntArray,
        width: Int,
        height: Int,
        seedX: Double,
        seedY: Double,
        tolerance: Int,
        add: Boolean,
    ): FillResult {
        if (width <= 0 || height <= 0) return FillResult(changed = false, pixels = 0)

        // Clamped first, then read: a tap outside the image is a tap on its edge, which
        // is what somebody dragging off the side of a wall expects.
        val x0 = max(0, min(width - 1, seedX.roundToInt()))
        val y0 = max(0, min(height - 1, seedY.roundToInt()))
        val seed = source[y0 * width + x0]
        val sr = (seed shr 16) and 0xFF
        val sg = (seed shr 8) and 0xFF
        val sb = seed and 0xFF

        val maxDist = tolerance / 100.0 * 260.0
        val maxDistSq = maxDist * maxDist
        val target = if (add) 255 else 0

        val size = width * height
        val visited = BooleanArray(size)
        val stack = IntArray(size)
        var top = 0
        stack[top++] = y0 * width + x0
        var painted = 0

        fun matches(index: Int): Boolean {
            val pixel = source[index]
            val dr = ((pixel shr 16) and 0xFF) - sr
            val dg = ((pixel shr 8) and 0xFF) - sg
            val db = (pixel and 0xFF) - sb
            return (dr * dr + dg * dg + db * db).toDouble() <= maxDistSq
        }

        while (top > 0) {
            val index = stack[--top]
            if (visited[index]) continue
            val y = index / width
            var left = index
            var right = index

            while (left % width > 0 && !visited[left - 1] && matches(left - 1)) left -= 1
            while (right % width < width - 1 && !visited[right + 1] && matches(right + 1)) right += 1

            for (i in left..right) {
                if (visited[i]) continue
                if (!matches(i)) continue
                visited[i] = true
                val alpha = (mask[i] ushr 24) and 0xFF
                if (alpha != target) {
                    mask[i] = (target shl 24) or 0xFFFFFF
                    painted += 1
                }
                if (y > 0) {
                    val up = i - width
                    if (!visited[up] && matches(up)) stack[top++] = up
                }
                if (y < height - 1) {
                    val down = i + width
                    if (!visited[down] && matches(down)) stack[top++] = down
                }
            }
        }

        return FillResult(changed = painted > 0, pixels = painted)
    }

    /**
     * The share of the image that is selected, for the read-out beside the brush.
     *
     * Sampled every eighth pixel, as the website does. A coverage figure is a hint about
     * whether you have missed a corner, not a measurement, and reading every pixel of a
     * 1400px image to produce one decimal place is a stall on the frame you are drawing.
     */
    fun coverage(mask: IntArray, width: Int, height: Int): Double {
        val size = min(mask.size, width * height)
        var covered = 0
        var total = 0
        var i = 0
        while (i < size) {
            total += 1
            if (((mask[i] ushr 24) and 0xFF) > 8) covered += 1
            i += 8
        }
        return if (total == 0) 0.0 else covered.toDouble() / total
    }

    /**
     * Where to stamp between two pointer positions, so a fast drag leaves no gaps.
     *
     * Positions only — rasterising them is [stamp]. Returning the list keeps the part
     * that has to agree with the website (how many stamps, and where) separate from the
     * part that cannot (what the browser's gradient anti-aliasing did to each one).
     *
     * A stroke that does not move still stamps, twice, at the same point: `steps` has a
     * floor of one, so the loop runs for i = 0 and i = 1. That is the website's behaviour
     * and it is not a bug worth fixing here — a single tap with the brush should do
     * something, and doing it twice at full opacity is the same as doing it once.
     */
    fun stroke(from: BrushStamp, to: BrushStamp, radius: Double): List<BrushStamp> {
        val dx = to.x - from.x
        val dy = to.y - from.y
        val distance = hypot(dx, dy)
        val step = max(1.0, radius * 0.35)
        val steps = max(1, ceil(distance / step).toInt())
        return (0..steps).map { i ->
            BrushStamp(from.x + dx * i / steps, from.y + dy * i / steps)
        }
    }

    /**
     * One soft-edged stamp onto the mask.
     *
     * Equivalent to the canvas version rather than identical to it. The falloff is linear
     * from full strength at `radius * hardness` to nothing at `radius`, which is what a
     * two-stop radial gradient describes; the compositing is the same two operations the
     * canvas uses — source-over to select, destination-out to erase — done per pixel on
     * the mask's alpha channel, which is the only channel the selection lives in.
     *
     * Erase multiplies rather than overwrites. That is what makes a soft eraser feel
     * right: dragging it across the edge of a selection feathers the edge instead of
     * cutting a hard hole in it.
     */
    fun stamp(
        mask: IntArray,
        width: Int,
        height: Int,
        centre: BrushStamp,
        radius: Double,
        add: Boolean,
        hardness: Double = DEFAULT_HARDNESS,
    ) {
        if (radius <= 0) return
        val inner = radius * hardness.coerceIn(0.0, 1.0)
        val span = radius - inner
        val x0 = max(0, floor(centre.x - radius).toInt())
        val x1 = min(width - 1, ceil(centre.x + radius).toInt())
        val y0 = max(0, floor(centre.y - radius).toInt())
        val y1 = min(height - 1, ceil(centre.y + radius).toInt())

        for (y in y0..y1) {
            for (x in x0..x1) {
                val distance = hypot(x - centre.x, y - centre.y)
                if (distance > radius) continue
                val strength = if (span <= 0 || distance <= inner) {
                    1.0
                } else {
                    1.0 - (distance - inner) / span
                }
                val index = y * width + x
                val alpha = ((mask[index] ushr 24) and 0xFF) / 255.0
                val result = if (add) {
                    // source-over: the brush lays down over what is already selected.
                    strength + alpha * (1.0 - strength)
                } else {
                    // destination-out: the brush removes a share of what is there.
                    alpha * (1.0 - strength)
                }
                val out = (result * 255.0).roundToInt().coerceIn(0, 255)
                mask[index] = (out shl 24) or 0xFFFFFF
            }
        }
    }

    /** The brush's default hardness: full strength to 55% of the radius, then falloff. */
    const val DEFAULT_HARDNESS = 0.55
}
