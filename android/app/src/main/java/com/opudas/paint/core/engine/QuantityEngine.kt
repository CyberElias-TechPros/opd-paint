package com.opudas.paint.core.engine

import com.opudas.paint.core.util.plain
import com.opudas.paint.core.util.roundTo
import kotlin.math.floor
import kotlin.math.max

/*
 * Paint quantity engine, ported from `app/src/lib/calculator.ts`.
 *
 * The rules encode how a Nigerian contractor actually budgets, and they are the
 * website's rules, not new ones:
 *
 *   - Coverage is quoted per coat, per litre (or kg), per product.
 *   - Doors and windows are deducted as measured opening areas.
 *   - Skirting, reveals and cutting-in are added as a percentage allowance,
 *     because they are cut in from the same bucket.
 *   - Paint is sold in fixed pack sizes, so the answer is the cheapest
 *     combination of whole packs that covers the requirement, plus a 5% site
 *     handling allowance. You cannot buy 3.4 litres.
 *
 * Everything here is pure — no Android types, no clock, no locale — so it runs
 * unchanged on the JVM, and `QuantityEngineTest` exercises it with the same
 * hand-computed worked examples as the website's own suite. Where the two
 * disagree, one of them is wrong about a customer's money.
 *
 * Ported deliberately literally, including two details that look like sloppiness
 * and are not: the repair pass in [choosePacks] can drive a count negative (the
 * pack list then drops it, and the larger pack takes its place), and the coverage
 * fallback of 10 m² per unit is a guard against a data file that says zero, which
 * would otherwise divide by zero and quote an infinite amount of paint.
 */

/** Whether the room was measured in metres or in feet. */
enum class MeasureSystem(val label: String, val lengthUnit: String) {
    METRIC("Metric", "m"),
    IMPERIAL("Imperial", "ft"),
}

/**
 * What the product is sold by. Textured and floor coatings are weighed, so a
 * kilogram figure beside a litre figure on the same screen would be a lie about
 * one of them.
 */
enum class PaintUnit(val symbol: String) {
    LITRES("L"),
    KILOGRAMS("kg"),
}

/** A door, window or other opening, measured in the selected [MeasureSystem]. */
enum class OpeningKind(val id: String, val label: String) {
    DOOR("door", "Door"),
    WINDOW("window", "Window"),
    OTHER("other", "Other"),
    ;

    companion object {
        /** Unknown ids become [OTHER] rather than throwing: a measurement is not a reason to crash. */
        fun fromId(id: String): OpeningKind = entries.firstOrNull { it.id == id } ?: OTHER
    }
}

/** One measured opening, and how many of them there are. */
data class Opening(
    val id: String,
    val kind: OpeningKind,
    /** Width in the selected unit system. */
    val width: Double,
    /** Height in the selected unit system. */
    val height: Double,
    val count: Int,
)

/**
 * Everything the calculation needs.
 *
 * [totalWallArea] overrides the perimeter calculation when someone has measured
 * the walls directly rather than the room — common on a job with alcoves, and the
 * reason the field exists at all.
 *
 * [coats] is a whole number. The website accepted a float and rounded it; the app
 * offers a stepper, so rounding a value that cannot be fractional would only hide
 * a bug in the control that produced it.
 */
data class CalculationInput(
    val roomLength: Double,
    val roomWidth: Double,
    val wallHeight: Double,
    val openings: List<Opening> = emptyList(),
    val coats: Int = 2,
    val system: MeasureSystem = MeasureSystem.METRIC,
    val totalWallArea: Double? = null,
    val includeCeiling: Boolean = false,
    /** Extra allowance for skirting, reveals and cutting-in, as a percentage. */
    val trimAllowancePct: Double = 8.0,
    /** Square metres covered by one litre (or kg) in a single coat. */
    val coveragePerUnit: Double = 11.0,
    /** Pack sizes, in litres or kg, that the product is actually sold in. */
    val packSizes: List<Double> = emptyList(),
    val unit: PaintUnit = PaintUnit.LITRES,
)

/** A whole number of one pack size. */
data class PackChoice(val size: Double, val count: Int, val amount: Double)

/** What to buy, and how much that comes to. */
data class PackSelection(val packs: List<PackChoice>, val amountBought: Double)

/**
 * The answer, with every intermediate figure kept.
 *
 * [formula] is the point of the exercise: a contractor who is told "9 litres"
 * needs to be able to see how, and argue with a step. Each line is one step, in
 * the order the arithmetic happens, in the unit system the room was measured in.
 */
data class CalculationResult(
    val wallArea: Double,
    val ceilingArea: Double,
    val openingsArea: Double,
    val trimArea: Double,
    val paintableArea: Double,
    val amountPerCoat: Double,
    val amountTotal: Double,
    val amountWithAllowance: Double,
    val packs: List<PackChoice>,
    val amountBought: Double,
    val surplus: Double,
    val unit: PaintUnit,
    val formula: List<String>,
)

/** Exact, because it is a definition: a foot is 0.3048 m since 1959. */
private const val METRES_PER_FOOT = 0.3048
private const val M2_PER_FT2 = 0.09290304

/** Site handling: spillage, roller retention, the last of the bucket. */
private const val HANDLING_ALLOWANCE = 1.05

/** Below this, a remainder is floating-point noise rather than paint. */
private const val EPSILON = 1e-9

/** Used when a product's coverage is missing or zero, so nothing divides by zero. */
private const val FALLBACK_COVERAGE = 10.0

fun toMetres(value: Double, system: MeasureSystem): Double =
    if (system == MeasureSystem.IMPERIAL) value * METRES_PER_FOOT else value

fun toSquareMetres(value: Double, system: MeasureSystem): Double =
    if (system == MeasureSystem.IMPERIAL) value * M2_PER_FT2 else value

/** A negative count is treated as zero: two of nothing is nothing. */
fun openingArea(opening: Opening, system: MeasureSystem): Double =
    toSquareMetres(opening.width * opening.height, system) * max(0, opening.count)

/**
 * Largest-first pack selection with a single repair pass.
 *
 * Whole packs only, and never short: the remainder after the largest sizes are
 * taken is topped up with one more of the smallest, because being a third of a
 * litre short on site costs a journey. The repair pass then trades two or more
 * small packs for one larger where the larger covers them, which is both cheaper
 * and one less tin to carry.
 *
 * Sizes that are zero or negative are dropped first. A pack size of zero would
 * otherwise loop the division into nonsense, and a negative one is a data error
 * that should not reach a customer's quote.
 */
fun choosePacks(amount: Double, packSizes: List<Double>): PackSelection {
    val sizes = packSizes.filter { it > 0 }.sortedDescending()
    if (sizes.isEmpty()) return PackSelection(emptyList(), 0.0)

    val counts = mutableMapOf<Double, Int>()
    var remaining = max(0.0, amount)

    for (size in sizes) {
        if (remaining <= EPSILON) break
        val count = floor(remaining / size + EPSILON).toInt()
        if (count > 0) {
            counts[size] = count
            remaining -= count * size
        }
    }

    if (remaining > EPSILON) {
        val smallest = sizes.last()
        counts[smallest] = (counts[smallest] ?: 0) + 1
    }

    // Repair pass: if two or more small packs would cover a larger one, take the
    // larger. The count can go negative here when the larger pack covers more
    // than the small ones did, which is the intended outcome — the pack list
    // below drops anything that is not a positive count.
    for (index in 0 until sizes.size - 1) {
        val big = sizes[index]
        val small = sizes[index + 1]
        val smallCount = counts[small] ?: 0
        val bigCount = counts[big] ?: 0
        if (smallCount > 1 && smallCount * small >= big) {
            counts[small] = smallCount - floor(big / small).toInt()
            counts[big] = bigCount + 1
        }
    }

    val packs = sizes.mapNotNull { size ->
        val count = counts[size] ?: 0
        if (count > 0) PackChoice(size = size, count = count, amount = size * count) else null
    }
    return PackSelection(packs = packs, amountBought = packs.sumOf { it.amount })
}

fun calculate(input: CalculationInput): CalculationResult {
    val unit = input.unit.symbol
    val unitLabel = input.system.lengthUnit

    val lengthM = toMetres(input.roomLength, input.system)
    val widthM = toMetres(input.roomWidth, input.system)
    val heightM = toMetres(input.wallHeight, input.system)

    val direct = input.totalWallArea
    val wallArea = if (direct != null && direct > 0) direct else 2 * (lengthM + widthM) * heightM
    val ceilingArea = if (input.includeCeiling) lengthM * widthM else 0.0
    val openingsArea = input.openings.sumOf { openingArea(it, input.system) }

    // Openings bigger than the walls — a typo, or a room that is mostly glass —
    // must not produce a negative area and therefore a negative quantity.
    val netArea = max(0.0, wallArea + ceilingArea - openingsArea)
    val trimArea = netArea * max(0.0, input.trimAllowancePct) / 100.0
    val paintableArea = netArea + trimArea

    val effectiveCoats = max(1, input.coats)
    val safeCoverage = if (input.coveragePerUnit > 0) input.coveragePerUnit else FALLBACK_COVERAGE
    val amountPerCoat = paintableArea / safeCoverage
    val amountTotal = amountPerCoat * effectiveCoats
    val amountWithAllowance = amountTotal * HANDLING_ALLOWANCE

    val selection = choosePacks(amountWithAllowance, input.packSizes)

    return CalculationResult(
        wallArea = wallArea.roundTo(),
        ceilingArea = ceilingArea.roundTo(),
        openingsArea = openingsArea.roundTo(),
        trimArea = trimArea.roundTo(),
        paintableArea = paintableArea.roundTo(),
        amountPerCoat = amountPerCoat.roundTo(),
        amountTotal = amountTotal.roundTo(),
        amountWithAllowance = amountWithAllowance.roundTo(),
        packs = selection.packs,
        amountBought = selection.amountBought.roundTo(),
        surplus = (selection.amountBought - amountWithAllowance).roundTo(),
        unit = input.unit,
        formula = listOf(
            "Perimeter = 2 × (${input.roomLength.roundTo().plain()} $unitLabel + " +
                "${input.roomWidth.roundTo().plain()} $unitLabel)",
            "Wall area = perimeter × ${input.wallHeight.roundTo().plain()} $unitLabel " +
                "height = ${wallArea.roundTo().plain()} m²",
            if (input.includeCeiling) {
                "Ceiling = ${lengthM.roundTo().plain()} m × ${widthM.roundTo().plain()} m = " +
                    "${ceilingArea.roundTo().plain()} m²"
            } else {
                "Ceiling excluded"
            },
            "Openings deducted = ${openingsArea.roundTo().plain()} m²",
            "Trim & cutting-in allowance ${input.trimAllowancePct.plain()}% = " +
                "${trimArea.roundTo().plain()} m²",
            "Paintable area = ${paintableArea.roundTo().plain()} m²",
            "$unit per coat = ${paintableArea.roundTo().plain()} m² ÷ ${safeCoverage.plain()} " +
                "m²/$unit = ${amountPerCoat.roundTo().plain()} $unit",
            "$unit for $effectiveCoats coat${if (effectiveCoats > 1) "s" else ""} + 5% " +
                "handling = ${amountWithAllowance.roundTo().plain()} $unit",
            "Packs = ${packSummary(selection.packs, unit)} = " +
                "${selection.amountBought.roundTo().plain()} $unit",
        ),
    )
}

/** "2 × 4 L + 1 × 1 L", or "none" when there is nothing to buy. */
private fun packSummary(packs: List<PackChoice>, unit: String): String =
    if (packs.isEmpty()) {
        "none"
    } else {
        packs.joinToString(" + ") { "${it.count} × ${it.size.plain()} $unit" }
    }
