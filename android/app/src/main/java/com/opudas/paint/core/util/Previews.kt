package com.opudas.paint.core.util

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File

/*
 * Where a room preview is written, and how another app is allowed to read it.
 *
 * Three small functions rather than a class, because there is nothing to hold: the
 * cache directory belongs to the OS, the provider is declared once in the manifest,
 * and the authority string has to match that declaration exactly. Keeping the string
 * here is the point — a typo in an authority does not fail at compile time or at
 * launch, it fails the first time somebody taps Share, with an
 * IllegalArgumentException from a framework class that has no idea what a preview is.
 */

/** The subdirectory of the cache that `res/xml/preview_paths.xml` exposes. */
const val PREVIEW_DIR = "previews"

/**
 * The authority of this app's FileProvider.
 *
 * Must equal the `android:authorities` in the manifest, which is written as
 * `${applicationId}.fileprovider`. `packageName` is the same value at runtime; using it
 * rather than a literal means a debug build with an application-id suffix still resolves.
 */
fun Context.previewAuthority(): String = "$packageName.fileprovider"

/**
 * A content URI another app can be granted read access to.
 *
 * @throws IllegalArgumentException if [file] is not under a path the provider declares.
 *   That is a programming error and not a device condition, so it is not swallowed here:
 *   a preview written anywhere but [previewFile] should fail loudly in a test, not
 *   quietly at the customer's fingertip.
 */
fun Context.previewUri(file: File): Uri = FileProvider.getUriForFile(this, previewAuthority(), file)

/**
 * A file in the shared preview directory, creating the directory if this is the first
 * preview since the OS last cleared the cache.
 */
fun Context.previewFile(name: String): File {
    /*
     * A bare filename, and nothing else — the same rule `DocumentViewModel.copyToCache`
     * applies, for a related reason. This directory is the one the FileProvider exposes
     * to other apps, so a name carrying a separator would let a caller reach outside it.
     * No caller does today; the preview name is a timestamp. The guard is here because
     * the exposure is here.
     */
    require(name.isNotEmpty() && name != "." && name != ".." &&
        !name.contains('/') && !name.contains('\\')) {
        "a preview name must be a bare filename"
    }

    val directory = File(cacheDir, PREVIEW_DIR)
    if (!directory.exists()) directory.mkdirs()
    return File(directory, name)
}
