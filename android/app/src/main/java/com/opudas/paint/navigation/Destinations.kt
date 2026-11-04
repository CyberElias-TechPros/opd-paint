package com.opudas.paint.navigation

import android.net.Uri
import com.opudas.paint.core.designsystem.TabGlyphKind

/**
 * Every route in the app, in one file.
 *
 * A route string typed at a call site is a route string that can be wrong, and
 * Navigation's failure mode for a wrong route is an exception at the moment the
 * user taps — not at compile time. Constants plus a builder per argument means
 * the compiler checks the shape and only the argument value is left to get wrong.
 *
 * The paths mirror the website's URLs on purpose (`colours/{id}`, `guides/{id}`,
 * `dealers`, `quote`), so a deep link from the site, a shared project token and a
 * notification all resolve to the same screen the same way, and a support
 * conversation can use one vocabulary for both platforms.
 */
object Destinations {

    const val HOME = "home"

    const val COLOURS = "colours"
    const val COLOUR_DETAIL = "colours/{colourId}"
    fun colour(id: String) = "colours/$id"

    const val PRODUCTS = "products"
    const val PRODUCT_DETAIL = "products/{productId}"
    fun product(id: String) = "products/$id"

    const val PALETTES = "palettes"
    const val PALETTE_DETAIL = "palettes/{paletteId}"
    fun palette(id: String) = "palettes/$id"

    const val PROJECTS = "projects"
    const val PROJECT_DETAIL = "projects/{projectId}"
    fun project(id: String) = "projects/$id"

    const val GUIDES = "guides"
    const val GUIDE_DETAIL = "guides/{guideId}"
    fun guide(id: String) = "guides/$id"

    const val TOOLS = "tools"
    const val FINISH_FINDER = "tools/finish-finder"
    const val SURFACE_PREP = "tools/surface-prep"
    const val SURFACE_PREP_DETAIL = "tools/surface-prep/{situationId}"
    fun prepSituation(id: String) = "tools/surface-prep/$id"

    const val CALCULATOR = "calculator"

    /**
     * The calculator with a product already chosen.
     *
     * Registered with `productId` nullable and defaulted, so the bare `calculator`
     * route resolves here too — one destination handles both, which is why there is
     * no second `composable(CALCULATOR)` block in the graph.
     */
    const val CALCULATOR_WITH_PRODUCT = "calculator?productId={productId}"

    fun calculator(productId: String? = null): String =
        if (productId == null) CALCULATOR else "calculator?productId=$productId"

    const val VISUALISER = "visualiser?colourId={colourId}"

    /**
     * The room preview, optionally starting on one colour.
     *
     * The website takes `?colour=`; a colour page that offers "see it on your wall" is
     * answering a question somebody already asked, so the answer arrives pre-selected
     * rather than making them find the same colour again in a strip of 59.
     */
    fun visualiser(colourId: String?): String =
        if (colourId.isNullOrEmpty()) "visualiser" else "visualiser?colourId=$colourId"

    const val DEALERS = "dealers"
    const val DEALER_DETAIL = "dealers/{dealerId}"
    fun dealer(id: String) = "dealers/$id"

    const val BOARD = "board"
    const val CHECKLIST = "board/checklist"

    const val QUOTE = "quote"
    /** A quote started from a colour or a calculator result, with its context pre-filled. */
    const val QUOTE_WITH_CONTEXT =
        "quote?colourId={colourId}&productId={productId}&quantity={quantity}&projectType={projectType}"

    /** The project type that routes an enquiry to the sample and colour desk. */
    const val SAMPLE_PROJECT_TYPE = "sample"

    /**
     * The enquiry form with a project type already chosen.
     *
     * The checklist's "confirm the colour against a real sample" line comes here rather
     * than to a bare form, because the type is what routes the enquiry: a sample request
     * belongs at the sample and colour desk, and arriving untyped would put it in the
     * general queue and cost the customer a day.
     */
    fun quoteForProjectType(type: String) = "quote?projectType=$type"
    fun quote(colourId: String? = null, productId: String? = null, quantity: String? = null): String {
        val params = buildList {
            colourId?.let { add("colourId=$it") }
            productId?.let { add("productId=$it") }
            quantity?.let { add("quantity=${it.replace(" ", "%20")}") }
        }
        return if (params.isEmpty()) QUOTE else "quote?${params.joinToString("&")}"
    }

    const val PRIVACY_REQUEST = "legal/privacy-request"

    /**
     * The three notices, under a segment of their own.
     *
     * Not `legal/{slug}`, which is what this said before anything was wired to it:
     * that pattern also matches `legal/privacy-request`, leaving two routes for one
     * path and a specificity rule to decide between them. Distinct prefixes remove
     * the question instead of answering it.
     */
    const val LEGAL = "legal/notices"
    const val LEGAL_DOC = "legal/notices/{slug}"
    fun legal(slug: String) = "legal/notices/$slug"

    const val DOCUMENTS = "documents"
    const val DOCUMENT_VIEWER = "documents/{path}?title={title}"

    /**
     * A bundled document, by the filename it has inside the APK.
     *
     * The title rides along encoded because the viewer has no other way to know what it
     * is showing: a rendered PDF page carries no name the platform will hand back, and
     * deriving one from `opudas-matt-tds.pdf` would mean inventing a label for a document
     * the product data already labels properly.
     */
    fun document(path: String, title: String?): String =
        if (title.isNullOrEmpty()) {
            "documents/$path"
        } else {
            "documents/$path?title=${Uri.encode(title)}"
        }
    fun document(path: String) = "documents/$path"

    const val INBOX = "inbox"
    const val INBOX_DETAIL = "inbox/{reference}"

    /**
     * One enquiry, named in the path.
     *
     * A reference is `OPD-YYMMDD-XXXX` — letters, digits and hyphens — so there is
     * nothing here to escape, and putting it in the path rather than a query means the
     * detail screen cannot be opened without naming exactly one enquiry.
     */
    fun inboxDetail(reference: String) = "inbox/$reference"
    fun inboxEntry(reference: String) = "inbox/$reference"

    const val MORE = "more"
    const val SETTINGS = "settings"
}

/**
 * The bottom bar.
 *
 * Three items now, five when the tools and the project board land — a bar grows
 * by earning a place on it, and nothing gets a tab until there is something
 * behind the tab. The order is the order a customer thinks in: what have I got,
 * what colour, and who do I talk to.
 */
enum class TopLevelDestination(
    val route: String,
    val label: String,
    val glyph: TabGlyphKind,
) {
    HOME(Destinations.HOME, "Home", TabGlyphKind.HOME),
    COLOURS(Destinations.COLOURS, "Colours", TabGlyphKind.COLOURS),
    MORE(Destinations.MORE, "More", TabGlyphKind.MORE),
}
