package com.opudas.paint.core.engine

import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.PrepSituation
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.data.model.SavedEstimate
import com.opudas.paint.core.util.plain

/**
 * Where a checklist line takes you, as a decision rather than a string.
 *
 * The website's builder writes web paths into its items — `/tools/surface-prep`,
 * `/products/matt` — and then its own screens parse those paths back apart to work out
 * where to navigate. The app does not inherit that. A path belonging to another
 * platform is not a route table, and reading one to choose a destination means the day
 * somebody renames a URL, a phone navigates somewhere wrong without anything failing.
 *
 * So the link is the thing being linked to: a fixed place, or a product by its id. A
 * [Product] link carries the id it needs and cannot be constructed without one, which
 * is the point of making it a class rather than a target plus a nullable field.
 */
sealed interface ChecklistLink {
    data object Calculator : ChecklistLink
    data object SampleRequest : ChecklistLink
    data object SurfacePrep : ChecklistLink
    data object Dealers : ChecklistLink
    data object Colours : ChecklistLink
    data class Product(val id: String) : ChecklistLink
}

data class ChecklistItem(
    val id: String,
    val label: String,
    val detail: String? = null,
    val link: ChecklistLink? = null,
)

data class ChecklistGroup(
    val id: String,
    val title: String,
    val note: String? = null,
    val items: List<ChecklistItem>,
)

/** What the checklist is built from: the board, with its ids already resolved. */
data class ChecklistInput(
    val projectName: String,
    val colours: List<PaintColor>,
    val products: List<Product>,
    val estimates: List<SavedEstimate>,
    val prep: List<PrepSituation>,
)

/**
 * Turn a saved project into the order of work.
 *
 * Ported from `buildChecklist` in `app/src/lib/advisor.ts`, and the sequence is the one
 * the guides publish — measure, confirm, buy, prepare, apply, cure — not an invention of
 * either implementation. Items appear only when the project actually contains them, so
 * an empty board produces an empty checklist rather than a wall of generic advice.
 *
 * The wording is the website's, character for character, including the middle dots and
 * the warning sign. This is specification advice a supplier wrote: rewording it would
 * make the phone and the printed checklist disagree about how to treat a damp wall, and
 * "the app says it slightly differently" is not an answer a contractor accepts.
 *
 * [catalogue] is every product, because estimates and preparation situations refer to
 * products by id and those ids have to be looked up. It is a parameter rather than a
 * global so this stays a pure function a test can drive with three products and no
 * Android.
 */
object ChecklistEngine {

    fun build(input: ChecklistInput, catalogue: List<Product>): List<ChecklistGroup> {
        val colours = input.colours
        val products = input.products
        val estimates = input.estimates
        val prep = input.prep
        val groups = mutableListOf<ChecklistGroup>()

        groups += beforeYouBuy(colours, products, estimates, prep)
        groups += whatToBuy(colours, products, estimates, prep, catalogue)
        groups += prepareTheSurface(prep)
        groups += apply(products)
        groups += afterTheLastCoat(products, estimates)

        return groups.filter { it.items.isNotEmpty() }
    }

    /**
     * Whether there is anything to plan yet.
     *
     * Preparation situations are deliberately not counted: a board with a damp wall
     * named on it has work to do, but nothing measured and nothing to buy, and "empty"
     * is what the screen says to somebody who has not started.
     */
    fun isEmpty(
        colours: List<PaintColor>,
        products: List<Product>,
        estimates: List<SavedEstimate>,
    ): Boolean = colours.isEmpty() && products.isEmpty() && estimates.isEmpty()

    private fun beforeYouBuy(
        colours: List<PaintColor>,
        products: List<Product>,
        estimates: List<SavedEstimate>,
        prep: List<PrepSituation>,
    ): ChecklistGroup {
        val items = mutableListOf<ChecklistItem>()

        if (estimates.isNotEmpty() || colours.isNotEmpty()) {
            items += ChecklistItem(
                id = "measure",
                label = "Measure every room again on site",
                detail = "The calculator works from the numbers you type. Confirm them against " +
                    "the wall before anyone buys paint.",
                link = ChecklistLink.Calculator,
            )
        }

        if (colours.isNotEmpty()) {
            items += ChecklistItem(
                id = "sample",
                label = "Confirm the colour against a real sample",
                detail = "${colours.size} colour${plural(colours.size)} on the board are digital " +
                    "proofs. Order a sample pot or ask a dealer for a chip, and look at it in the " +
                    "room at the time of day you use the room.",
                link = ChecklistLink.SampleRequest,
            )
        }

        if (prep.isNotEmpty()) {
            items += ChecklistItem(
                id = "survey",
                label = "Walk the surface and confirm its condition",
                // Spaced, as the website joins it: "Damp · Flaking". A bare middle dot
                // reads as one compound word rather than two conditions.
                detail = prep.joinToString(" $SEPARATOR ") { it.label },
                link = ChecklistLink.SurfacePrep,
            )
        } else if (products.isNotEmpty() || estimates.isNotEmpty()) {
            items += ChecklistItem(
                id = "survey",
                label = "Check what condition the walls are in",
                detail = "New render, flaking, chalky, uneven or damp each need a different " +
                    "sequence before any finish coat.",
                link = ChecklistLink.SurfacePrep,
            )
        }

        // Only when there is something to confirm: an empty project gets an empty
        // checklist rather than a wall of generic advice.
        if (estimates.isNotEmpty() || colours.isNotEmpty() ||
            products.isNotEmpty() || prep.isNotEmpty()
        ) {
            items += ChecklistItem(
                id = "confirm-packs",
                label = "Confirm pack sizes and availability with a dealer",
                detail = "Stock varies by counter. Call ahead with the quantities below rather " +
                    "than travelling hopeful.",
                link = ChecklistLink.Dealers,
            )
        }

        return ChecklistGroup(id = "before", title = "Before you buy", items = items)
    }

    private fun whatToBuy(
        colours: List<PaintColor>,
        products: List<Product>,
        estimates: List<SavedEstimate>,
        prep: List<PrepSituation>,
        catalogue: List<Product>,
    ): ChecklistGroup {
        val items = estimates.map { estimate ->
            val product = catalogue.firstOrNull { it.id == estimate.productId }
            ChecklistItem(
                id = "buy-${estimate.id}",
                label = "${estimate.packs} of ${product?.shortName ?: estimate.productId}",
                detail = buildString {
                    append(estimate.label)
                    append(" $SEPARATOR ")
                    append(estimate.area.plain())
                    append(" m² $SEPARATOR ")
                    append(estimate.coats)
                    append(" coat")
                    append(plural(estimate.coats))
                    if (product != null) {
                        append(" $SEPARATOR ")
                        append(product.sku)
                    }
                },
                link = product?.let { ChecklistLink.Product(it.id) },
            )
        }.toMutableList()

        for (product in products) {
            if (estimates.any { it.productId == product.id }) continue
            items += ChecklistItem(
                id = "buy-${product.id}",
                label = product.name,
                detail = product.finish + " $SEPARATOR pack sizes " +
                    product.packs.joinToString(", ") { "${it.size.plain()} ${it.unit}" },
                link = ChecklistLink.Product(product.id),
            )
        }

        for (situation in prep) {
            for (id in situation.products) {
                val product = catalogue.firstOrNull { it.id == id } ?: continue
                // Already on the list under its own name or as somebody's estimate: a
                // primer needed for flaking paint is the same primer, not a second line.
                val already = items.any {
                    it.label.contains(product.shortName) || it.label == product.name
                }
                if (already) continue
                items += ChecklistItem(
                    id = "buy-prep-${situation.id}-${product.id}",
                    label = product.name,
                    detail = "Needed for ${situation.label.lowercase()}",
                    link = ChecklistLink.Product(product.id),
                )
            }
        }

        if (colours.isNotEmpty()) {
            items += ChecklistItem(
                id = "buy-colours",
                label = "Colours: " + colours.joinToString(", ") { "${it.name} (${it.code})" },
                detail = "Quote the code, not the name $EM_DASH the code is what the fan deck " +
                    "and the dealer use.",
                link = ChecklistLink.Colours,
            )
        }

        return ChecklistGroup(
            id = "buy",
            title = "What to buy",
            note = "Pricing is not published on this site: send this list to a dealer or to the " +
                "colour desk and they will quote against real stock.",
            items = items,
        )
    }

    private fun prepareTheSurface(prep: List<PrepSituation>): ChecklistGroup {
        val items = mutableListOf<ChecklistItem>()
        for (situation in prep) {
            situation.steps.forEachIndexed { index, step ->
                items += ChecklistItem(
                    id = "prep-${situation.id}-$index",
                    label = "${situation.label}: ${step.step}",
                    detail = step.detail,
                )
            }
            for (warning in situation.warnings) {
                items += ChecklistItem(
                    id = "warn-${situation.id}-${warning.take(WARNING_ID_PREFIX)}",
                    label = "$WARNING_SIGN $warning",
                )
            }
        }
        return ChecklistGroup(id = "prepare", title = "Prepare the surface", items = items)
    }

    private fun apply(products: List<Product>): ChecklistGroup {
        val items = mutableListOf<ChecklistItem>()
        for (product in products) {
            product.application.forEachIndexed { index, step ->
                items += ChecklistItem(
                    id = "apply-${product.id}-$index",
                    label = "${product.shortName}: ${step.step}",
                    detail = "${step.detail} Touch dry ${product.touchDryHours} h $SEPARATOR " +
                        "recoat ${product.recoatHours} h.",
                    link = ChecklistLink.Product(product.id),
                )
            }
        }
        return ChecklistGroup(
            id = "paint",
            title = "Apply",
            note = "Steps and intervals are transcribed from the product data sheet. In the " +
                "rainy season, humidity can double the recoat time.",
            items = items,
        )
    }

    private fun afterTheLastCoat(
        products: List<Product>,
        estimates: List<SavedEstimate>,
    ): ChecklistGroup {
        val items = mutableListOf<ChecklistItem>()
        for (product in products) {
            /*
             * Greater than zero, not "not null". These are non-null Ints here and were
             * optional numbers on the website, where `if (product.guaranteeYears)` skips a
             * zero — and two of the six products carry exactly that, because no guarantee
             * is published for a primer or a screeding compound. Printing "0-year
             * guarantee" would invent a term the supplier never offered.
             */
            if (product.fullCureDays > 0) {
                items += ChecklistItem(
                    id = "cure-${product.id}",
                    label = "Let ${product.shortName} cure for ${product.fullCureDays} days",
                    detail = "Do not wash or scrub the film before it has cured.",
                )
            }
            if (product.guaranteeYears > 0) {
                items += ChecklistItem(
                    id = "guarantee-${product.id}",
                    label = "Keep the till slip $EM_DASH ${product.guaranteeYears}-year guarantee",
                    detail = "The guarantee on this product is under the terms printed on the pail.",
                    link = ChecklistLink.Product(product.id),
                )
            }
        }
        if (estimates.isNotEmpty()) {
            items += ChecklistItem(
                id = "leftovers",
                label = "Store the surplus properly",
                detail = "Decant into a smaller, sealed container, label it with the colour code " +
                    "and the room, and keep it for touch-ups.",
            )
        }
        return ChecklistGroup(id = "after", title = "After the last coat", items = items)
    }

    /**
     * Plain text, for the clipboard and for sending to a desk.
     *
     * Byte-for-byte the website's `checklistToText`: the curly apostrophe in the
     * company name, the four spaces before a detail line, the uppercase group titles and
     * the closing reminder that a screen is not a colour chip. Somebody pastes this into
     * a message to a dealer, and a dealer who receives two different formats from the
     * same company has been given a reason to phone instead of ordering.
     *
     * An empty project name falls back to "My project" the way the website's `||` does —
     * on an empty string, and not on a name that is only spaces, which is a name somebody
     * typed.
     */
    fun toText(projectName: String, groups: List<ChecklistGroup>): String {
        val lines = mutableListOf("OPUDA${RIGHT_SINGLE_QUOTE}S PAINT $EM_DASH ${projectName.ifEmpty { DEFAULT_PROJECT_NAME }}", "")
        for (group in groups) {
            lines += group.title.uppercase()
            group.note?.let { lines += it }
            for (item in group.items) {
                lines += "[ ] ${item.label}"
                item.detail?.let { lines += "    $it" }
            }
            lines += ""
        }
        lines += "Colours on screen are digital proofs. Confirm with a sample pot or a dealer chip."
        return lines.joinToString("\n")
    }

    /** "coat" or "coats" — the website's own ternary, kept rather than pluralised by a library. */
    private fun plural(count: Int): String = if (count == 1) "" else "s"

    private const val SEPARATOR = "·"
    private const val EM_DASH = "—"
    private const val WARNING_SIGN = "⚠"
    private const val RIGHT_SINGLE_QUOTE = "’"
    private const val DEFAULT_PROJECT_NAME = "My project"

    /** How much of a warning becomes part of its id, as the website slices it. */
    private const val WARNING_ID_PREFIX = 12
}
