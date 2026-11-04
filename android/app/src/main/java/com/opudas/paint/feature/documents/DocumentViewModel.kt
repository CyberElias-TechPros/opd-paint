package com.opudas.paint.feature.documents

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import java.io.File
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

data class DocumentUiState(
    val isLoading: Boolean = true,
    val title: String = "",
    val pageCount: Int = 0,
    val pageIndex: Int = 0,
    val page: Bitmap? = null,
    val error: String? = null,
) {
    val canGoBack: Boolean
        get() = pageIndex > 0

    val canGoForward: Boolean
        get() = pageCount > 0 && pageIndex < pageCount - 1

    /** "Page 3 of 12", or nothing while there is no document to count. */
    val position: String
        get() = if (pageCount == 0) "" else "Page ${pageIndex + 1} of $pageCount"
}

/**
 * One bundled PDF, a page at a time.
 *
 * A data sheet is the document somebody reads at a counter, mid-conversation, about a
 * product they are holding — which is exactly where a phone has no signal. The website
 * opens these in a new tab; the app renders them itself from the copy inside the APK, so
 * the answer does not depend on the network.
 *
 * [PdfRenderer] is the platform's own, which is why this is not a large piece of code:
 * it wants a file descriptor, it opens one page at a time, and it renders into a bitmap
 * the caller owns. Three consequences shape this class:
 *
 *  - **Assets are streams, not files.** `AssetManager` cannot hand over a descriptor, so
 *    the document is copied to the cache directory on first open and read from there.
 *    That copy is a cache in the honest sense — the APK still holds the original, and
 *    losing it costs one copy, not a download.
 *  - **One page open at a time, and not from two threads.** The renderer is neither
 *    thread-safe nor willing to hold two pages, so rendering happens under a [Mutex] and
 *    each page is closed by `use` before the next is opened.
 *  - **The descriptor and the renderer are closed in [onCleared].** A leaked file
 *    descriptor is not a visible bug until the process runs out of them.
 *
 * The path arrives from a navigation argument, which means it can arrive from a deep
 * link, which means it is untrusted: [copyToCache] refuses anything but a bare filename
 * before it goes anywhere near the filesystem.
 */
class DocumentViewModel(
    private val context: Context,
    private val path: String,
    title: String?,
) : ViewModel() {

    private val mutableState = MutableStateFlow(DocumentUiState(title = title.orEmpty()))
    val uiState: StateFlow<DocumentUiState> = mutableState.asStateFlow()

    private val renderLock = Mutex()

    private var renderer: PdfRenderer? = null
    private var descriptor: ParcelFileDescriptor? = null

    init {
        viewModelScope.launch { open() }
    }

    fun previous() {
        val current = mutableState.value
        if (current.canGoBack) viewModelScope.launch { render(current.pageIndex - 1) }
    }

    fun next() {
        val current = mutableState.value
        if (current.canGoForward) viewModelScope.launch { render(current.pageIndex + 1) }
    }

    private suspend fun open() {
        val pdf = withContext(Dispatchers.IO) {
            try {
                val file = copyToCache(path)
                val fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                PdfRenderer(fd).also {
                    descriptor = fd
                    renderer = it
                }
            } catch (error: IOException) {
                null
            } catch (error: SecurityException) {
                null
            } catch (error: IllegalArgumentException) {
                // PdfRenderer throws this for a file that is not a PDF, which is what a
                // truncated copy or a wrong asset looks like from here.
                null
            }
        }

        if (pdf == null) {
            mutableState.update { it.copy(isLoading = false, error = NOT_BUNDLED) }
            return
        }

        mutableState.update { it.copy(isLoading = false, pageCount = pdf.pageCount) }
        if (pdf.pageCount > 0) render(0)
    }

    private suspend fun render(index: Int) {
        val pdf = renderer ?: return
        val bitmap = withContext(Dispatchers.IO) {
            renderLock.withLock {
                try {
                    pdf.openPage(index).use { page ->
                        val scale = (MAX_WIDTH.toDouble() / page.width).coerceIn(1.0, MAX_SCALE)
                        val width = (page.width * scale).toInt().coerceAtLeast(1)
                        val height = (page.height * scale).toInt().coerceAtLeast(1)
                        Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also { bmp ->
                            // The renderer only writes the marks: without this a page
                            // arrives transparent and reads as white-on-white.
                            bmp.eraseColor(android.graphics.Color.WHITE)
                            page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        }
                    }
                } catch (error: IOException) {
                    null
                } catch (error: IllegalStateException) {
                    null
                } catch (error: OutOfMemoryError) {
                    null
                }
            }
        }

        mutableState.update { current ->
            if (bitmap == null) {
                current.copy(error = PAGE_FAILED)
            } else {
                current.copy(pageIndex = index, page = bitmap, error = null)
            }
        }
    }

    /**
     * Put the asset somewhere a file descriptor can be opened on.
     *
     * Only a bare filename is accepted. The path comes from a route argument, so a deep
     * link could hand this `../../databases/opudas.db`; without this check that string
     * would be joined onto the cache directory and opened. Refusing it is cheaper than
     * reasoning about every caller that might one day pass something else.
     */
    private fun copyToCache(name: String): File {
        if (name.isEmpty() || name.contains('/') || name.contains('\\') || name.contains("..")) {
            throw IOException("Not a document name: $name")
        }
        val target = File(context.cacheDir, name)
        if (target.exists() && target.length() > 0) return target
        context.assets.open("$DOCUMENTS_DIR/$name").use { input ->
            target.outputStream().use { output -> input.copyTo(output) }
        }
        return target
    }

    override fun onCleared() {
        // Page first, then the renderer, then the descriptor: each owns the one below it.
        try {
            renderer?.close()
        } catch (error: IllegalStateException) {
            // Already closed. Nothing useful to do with that on the way out.
        }
        try {
            descriptor?.close()
        } catch (error: IOException) {
            // Same.
        }
        renderer = null
        descriptor = null
    }

    companion object {
        const val DOCUMENTS_DIR = "documents"

        /** Wide enough to read a data sheet's tables, small enough not to exhaust memory. */
        private const val MAX_WIDTH = 1200
        private const val MAX_SCALE = 3.0

        const val NOT_BUNDLED =
            "This document is not inside the app. It is offered on the website instead — " +
                "the full catalogue is 126 pages, which is not something to carry in a " +
                "pocket or read on a phone."
        const val PAGE_FAILED = "That page would not render. The rest of the document is still readable."
    }
}
