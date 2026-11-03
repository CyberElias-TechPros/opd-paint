package com.opudas.paint.core.engine

import com.opudas.paint.core.util.roundTo
import kotlin.math.abs
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/*
 * The calculator's worked examples, ported from `app/scripts/calculator.test.ts`.
 *
 * The numbers here were computed by hand on the website side, not by the
 * implementation, which is the only reason they are worth repeating: a test that
 * asks the code what the answer is and then asserts that answer blesses a
 * regression instead of catching one. Both platforms now assert the same worked
 * examples, so a port that quietly diverges — a different rounding mode, a
 * repair pass that trades packs the other way — fails here rather than in front
 * of a customer holding a tin that does not cover the wall.
 *
 * Assertions carry a delta because JUnit refuses to compare doubles without one.
 * The delta is far below a rounding step: these values are compared after
 * rounding to two places, so anything other than an exact match is a real
 * difference.
 */
class QuantityEngineTest {

    private companion object {
        const val TOLERANCE = 1e-9

        /** 4.2 x 3.6 x 2.9 m, two coats, 8% trim, 11 m²/L, packs of 20/10/4/1. */
        val BASE = CalculationInput(
            roomLength = 4.2,
            roomWidth = 3.6,
            wallHeight = 2.9,
            coats = 2,
            includeCeiling = false,
            trimAllowancePct = 8.0,
            coveragePerUnit = 11.0,
            packSizes = listOf(20.0, 10.0, 4.0, 1.0),
            system = MeasureSystem.METRIC,
        )

        val PACK_SIZES = listOf(20.0, 10.0, 4.0, 1.0)
    }

    @Test
    fun `worked example - 4_2 by 3_6 by 2_9 room`() {
        val result = calculate(
            BASE.copy(
                openings = listOf(
                    Opening(id = "d", kind = OpeningKind.DOOR, width = 0.9, height = 2.1, count = 1),
                    Opening(id = "w", kind = OpeningKind.WINDOW, width = 1.2, height = 1.2, count = 2),
                ),
            ),
        )
        // Perimeter 15.6 m x 2.9 m = 45.24; openings 1.89 + 2.88 = 4.77;
        // net 40.47; trim 8% = 3.2376; paintable 43.7076.
        assertEquals(45.24, result.wallArea, TOLERANCE)
        assertEquals(4.77, result.openingsArea, TOLERANCE)
        assertEquals(43.71, result.paintableArea, TOLERANCE)
        assertEquals(3.97, result.amountPerCoat, TOLERANCE)
        assertEquals(8.34, result.amountWithAllowance, TOLERANCE)
        assertEquals(9.0, result.amountBought, TOLERANCE)
        assertEquals(
            listOf(PackChoice(size = 4.0, count = 2, amount = 8.0), PackChoice(size = 1.0, count = 1, amount = 1.0)),
            result.packs,
        )
    }

    @Test
    fun `ceiling adds length times width and leaves the walls alone`() {
        val withCeiling = calculate(BASE.copy(openings = emptyList(), includeCeiling = true))
        val withoutCeiling = calculate(BASE.copy(openings = emptyList(), includeCeiling = false))
        assertEquals(0.0, (withCeiling.wallArea - withoutCeiling.wallArea).roundTo(), TOLERANCE)
        assertEquals(15.12, withCeiling.ceilingArea, TOLERANCE)
        assertTrue(withCeiling.paintableArea > withoutCeiling.paintableArea)
    }

    @Test
    fun `a directly measured wall area bypasses the perimeter calculation`() {
        val result = calculate(BASE.copy(totalWallArea = 100.0, openings = emptyList()))
        assertEquals(100.0, result.wallArea, TOLERANCE)
        // 100 m² plus 8% trim.
        assertEquals(108.0, result.paintableArea, TOLERANCE)
    }

    @Test
    fun `imperial input is converted rather than treated as metres`() {
        val result = calculate(
            BASE.copy(
                system = MeasureSystem.IMPERIAL,
                roomLength = 14.0,
                roomWidth = 12.0,
                wallHeight = 9.0,
                openings = emptyList(),
            ),
        )
        // 14 ft = 4.2672 m, 12 ft = 3.6576 m, 9 ft = 2.7432 m.
        assertEquals(
            (2 * (4.2672 + 3.6576) * 2.7432).roundTo(),
            result.wallArea,
            TOLERANCE,
        )
        assertEquals(3.048, toMetres(10.0, MeasureSystem.IMPERIAL), TOLERANCE)
        assertEquals(0.09290304, toSquareMetres(1.0, MeasureSystem.IMPERIAL), TOLERANCE)
        assertEquals(1.0, toMetres(1.0, MeasureSystem.METRIC), TOLERANCE)
    }

    @Test
    fun `converting to metres and back returns the original length`() {
        // The inverse exists so the calculator's unit switch can convert the
        // numbers rather than silently relabelling them: 4.2 m read as 4.2 ft is
        // a third of the wall, and a third of the paint.
        listOf(0.0, 1.0, 4.2, 2.9, 13.7795).forEach { value ->
            val there = toMetres(value, MeasureSystem.IMPERIAL)
            assertEquals(value, fromMetres(there, MeasureSystem.IMPERIAL), TOLERANCE)
            assertEquals(value, fromMetres(toMetres(value, MeasureSystem.METRIC), MeasureSystem.METRIC), TOLERANCE)
        }
        val area = 12.5
        assertEquals(area, fromSquareMetres(toSquareMetres(area, MeasureSystem.IMPERIAL), MeasureSystem.IMPERIAL), TOLERANCE)
        // 14 ft is 4.2672 m, so 4.2672 m is 14 ft.
        assertEquals(14.0, fromMetres(4.2672, MeasureSystem.IMPERIAL), TOLERANCE)
        assertEquals(4.2672, toMetres(14.0, MeasureSystem.IMPERIAL), TOLERANCE)
    }

    @Test
    fun `opening area respects count`() {
        val area = openingArea(
            Opening(id = "x", kind = OpeningKind.WINDOW, width = 1.2, height = 1.2, count = 3),
            MeasureSystem.METRIC,
        )
        assertEquals(4.32, area.roundTo(), TOLERANCE)
    }

    @Test
    fun `a negative count deducts nothing`() {
        val area = openingArea(
            Opening(id = "x", kind = OpeningKind.DOOR, width = 1.0, height = 2.0, count = -4),
            MeasureSystem.METRIC,
        )
        assertEquals(0.0, area, TOLERANCE)
    }

    @Test
    fun `openings cannot push the paintable area below zero`() {
        val result = calculate(
            BASE.copy(openings = listOf(Opening(id = "huge", kind = OpeningKind.OTHER, width = 50.0, height = 50.0, count = 1))),
        )
        assertEquals(0.0, result.paintableArea, TOLERANCE)
        assertEquals(0.0, result.amountTotal, TOLERANCE)
        assertTrue(result.packs.isEmpty())
        assertEquals(0.0, result.amountBought, TOLERANCE)
    }

    @Test
    fun `one coat costs about half of two`() {
        val one = calculate(BASE.copy(openings = emptyList(), coats = 1))
        val two = calculate(BASE.copy(openings = emptyList(), coats = 2))
        assertTrue(abs(two.amountTotal - one.amountTotal * 2) < 0.02)
    }

    @Test
    fun `coat count is clamped to at least one`() {
        val result = calculate(BASE.copy(openings = emptyList(), coats = 0))
        assertTrue(result.amountTotal > 0)
        // Clamped to one, and the formula says "1 coat", not "1 coats".
        assertTrue(result.formula.any { it.contains("for 1 coat +") })
    }

    @Test
    fun `coverage of zero falls back to a safe default instead of dividing by zero`() {
        val result = calculate(BASE.copy(openings = emptyList(), coveragePerUnit = 0.0))
        assertTrue(result.amountPerCoat.isFinite())
        assertTrue(result.amountPerCoat > 0)
    }

    @Test
    fun `packs are only offered in real sizes and never fall short`() {
        val selection = choosePacks(8.34, PACK_SIZES)
        assertTrue(selection.amountBought >= 8.34)
        selection.packs.forEach { assertTrue(PACK_SIZES.contains(it.size)) }
        selection.packs.forEach { assertTrue(it.count > 0) }
    }

    @Test
    fun `the smallest pack is added when the requirement does not quite reach`() {
        val selection = choosePacks(4.1, PACK_SIZES)
        assertTrue(selection.amountBought >= 4.1)
        assertTrue(selection.packs.any { it.size == 1.0 })
    }

    @Test
    fun `a very large job uses the largest packs available`() {
        val selection = choosePacks(210.0, PACK_SIZES)
        val twenty = selection.packs.first { it.size == 20.0 }
        assertEquals(10, twenty.count)
    }

    @Test
    fun `pack sizes that are zero or negative are ignored`() {
        val selection = choosePacks(5.0, listOf(0.0, -4.0, 4.0, 1.0))
        assertTrue(selection.packs.isNotEmpty())
        selection.packs.forEach { assertTrue(it.size > 0) }
        assertTrue(selection.amountBought >= 5.0)
    }

    @Test
    fun `no usable pack sizes gives nothing to buy rather than an invented amount`() {
        val selection = choosePacks(5.0, emptyList())
        assertTrue(selection.packs.isEmpty())
        assertEquals(0.0, selection.amountBought, TOLERANCE)
    }

    @Test
    fun `a weighed product reports its own unit`() {
        val result = calculate(
            BASE.copy(
                openings = emptyList(),
                coveragePerUnit = 1.6,
                packSizes = listOf(25.0, 10.0),
                unit = PaintUnit.KILOGRAMS,
            ),
        )
        assertEquals(PaintUnit.KILOGRAMS, result.unit)
        assertTrue(result.formula.any { it.contains("kg") })
        assertTrue(result.formula.none { it.contains(" L ") })
    }

    @Test
    fun `the formula is readable and shows every step including the division`() {
        val result = calculate(BASE.copy(openings = emptyList()))
        assertTrue(result.formula.size >= 6)
        assertTrue(result.formula.any { it.contains("÷") })
        assertTrue(result.formula.any { it.startsWith("Perimeter = 2 × (4.2 m + 3.6 m)") })
        assertTrue(result.formula.contains("Ceiling excluded"))
    }

    @Test
    fun `whole numbers are rendered without a decimal point`() {
        // The website prints "100 m²", not "100.0 m²". Kotlin's Double.toString
        // would print the latter, so the formula is rendered through the same
        // formatting JavaScript uses inside a template literal.
        val result = calculate(BASE.copy(totalWallArea = 100.0, openings = emptyList()))
        assertTrue(result.formula.any { it.contains("height = 100 m²") })
        assertTrue(result.formula.none { it.contains("100.0") })
    }

    @Test
    fun `the surplus is what is bought minus what is needed`() {
        val result = calculate(BASE.copy(openings = emptyList()))
        // The engine subtracts before rounding; these fields are already rounded.
        // The two can differ by a rounding step, so the comparison allows one —
        // asserting exact equality here would test the order of the rounding
        // rather than the surplus.
        val fromRoundedFields = result.amountBought - result.amountWithAllowance
        assertTrue(
            "surplus ${result.surplus} should be near $fromRoundedFields",
            abs(result.surplus - fromRoundedFields) <= 0.011,
        )
        assertTrue(result.surplus >= 0.0)
        assertTrue(result.amountBought >= result.amountWithAllowance)
    }
}
