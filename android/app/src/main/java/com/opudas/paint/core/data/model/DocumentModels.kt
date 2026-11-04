package com.opudas.paint.core.data.model

import kotlinx.serialization.Serializable

/**
 * A downloadable document: the brand books and the specification sheet.
 *
 * The technical and safety data sheets are not here. They belong to their products and
 * travel inside [Product.tds], so a sheet is listed beside the thing it specifies and a
 * product that gains one gains its link in the same edit.
 */
@Serializable
data class BrandDocument(
    /** The filename in `app/public/documents`, and the asset path inside the APK. */
    val file: String,
    /** The website's path for it, with the leading slash already stripped. */
    val href: String,
    val title: String,
    /** The format, and a page count where one is known: "PDF · 32pp". */
    val detail: String,
    /**
     * The job the document does, in the words the website already used. Absent for the
     * specification sheet, which the site never describes beyond its own detail line.
     */
    val purpose: String? = null,
    /**
     * False for the master catalogue: 6.2 MB and 126 pages, which the Gradle build
     * leaves out of the APK. A row that says `false` offers the website and says why,
     * rather than opening a viewer with nothing in it.
     */
    val bundled: Boolean = true,
)

@Serializable
data class DocumentsBundle(
    val documents: List<BrandDocument>,
)
