package com.opudas.paint.navigation

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

    const val VISUALISER = "visualiser"

    const val DEALERS = "dealers"
    const val DEALER_DETAIL = "dealers/{dealerId}"
    fun dealer(id: String) = "dealers/$id"

    const val BOARD = "board"
    const val CHECKLIST = "board/checklist"

    const val QUOTE = "quote"
    /** A quote started from a colour or a calculator result, with its context pre-filled. */
    const val QUOTE_WITH_CONTEXT = "quote?colourId={colourId}&productId={productId}&quantity={quantity}"
    fun quote(colourId: String? = null, productId: String? = null, quantity: String? = null): String {
        val params = buildList {
            colourId?.let { add("colourId=$it") }
            productId?.let { add("productId=$it") }
            quantity?.let { add("quantity=${it.replace(" ", "%20")}") }
        }
        return if (params.isEmpty()) QUOTE else "quote?${params.joinToString("&")}"
    }

    const val PRIVACY_REQUEST = "legal/privacy-request"
    const val LEGAL = "legal/{slug}"
    fun legal(slug: String) = "legal/$slug"

    const val DOCUMENTS = "documents"
    const val DOCUMENT_VIEWER = "documents/{path}"
    fun document(path: String) = "documents/$path"

    const val INBOX = "inbox"
    const val INBOX_DETAIL = "inbox/{reference}"
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
