package com.opudas.paint.core.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The masking engine, against numbers lifted from running `app/src/lib/mask.ts` itself.
 *
 * Every expected value in the fill, coverage, stroke and scaling tests came out of a probe
 * that called the real TypeScript on the fixture below and printed the result. They are not
 * reasoned about and they are not rounded: a flood fill that stops one pixel short of a
 * doorway looks almost right on a wall and is wrong on every wall, so the assertions are
 * pixel patterns and counts rather than "it filled something".
 *
 * The brush is tested differently, and deliberately so. A canvas radial gradient is
 * rasterised by the browser with its own anti-aliasing, so there is no reference output to
 * lift. What is asserted instead is the behaviour the gradient exists to produce: full
 * strength at the centre, nothing outside the radius, a monotonic falloff between, and an
 * erase that feathers an edge rather than cutting a hole in it.
 */
class MaskEngineTest {

    /* The fixture: 6x4, a light plaster wall on the left, a dark door on the right, and
       one pixel at (3, 1) that is close to the wall but not the wall. That pixel is what
       separates a tolerance of 0 from a tolerance of 12, so the fixture is built around it. */
    private fun source(): IntArray {
        val pixels = IntArray(WIDTH * HEIGHT)
        for (y in 0 until HEIGHT) {
            for (x in 0 until WIDTH) {
                val rgb = when {
                    x >= 4 -> 0x281E19 // the door: 40, 30, 25
                    x == 3 && y == 1 -> 0xE2DCCD // near the wall: 226, 220, 205
                    else -> 0xE8E2D2 // the wall: 232, 226, 210
                }
                pixels[y * WIDTH + x] = (0xFF shl 24) or rgb
            }
        }
        return pixels
    }

    private fun mask(): IntArray = IntArray(WIDTH * HEIGHT)

    private fun alpha(mask: IntArray) = mask.map { (it ushr 24) and 0xFF }

    /** The selection as a picture, one row per line: '#' selected, '.' not. */
    private fun picture(mask: IntArray): List<String> =
        (0 until HEIGHT).map { y ->
            (0 until WIDTH).map { x ->
                if (((mask[y * WIDTH + x] ushr 24) and 0xFF) > 8) '#' else '.'
            }.joinToString("")
        }

    private fun fill(tolerance: Int, seedX: Double, seedY: Double, add: Boolean = true): Triple<FillResult, IntArray, IntArray> {
        val source = source()
        val mask = mask()
        val result = MaskEngine.floodFill(source, mask, WIDTH, HEIGHT, seedX, seedY, tolerance, add)
        return Triple(result, mask, source)
    }

    @Test
    fun `a tap on the wall selects the wall and stops at the door`() {
        val (result, mask, _) = fill(tolerance = 12, seedX = 0.0, seedY = 0.0)
        assertTrue(result.changed)
        assertEquals(16, result.pixels)
        assertEquals(listOf("####..", "####..", "####..", "####.."), picture(mask))
    }

    @Test
    fun `the pixel that is near the wall is only inside at a tolerance that reaches it`() {
        // At 0 the fill takes the wall's exact colour and the near pixel at (3, 1) stays
        // out, which is the whole reason the fixture has one. At 12 it is close enough.
        val (zero, zeroMask, _) = fill(tolerance = 0, seedX = 0.0, seedY = 0.0)
        assertEquals(15, zero.pixels)
        assertEquals(listOf("####..", "###...", "####..", "####.."), picture(zeroMask))

        val (twelve, _, _) = fill(tolerance = 12, seedX = 0.0, seedY = 0.0)
        assertEquals(16, twelve.pixels)
    }

    @Test
    fun `a generous tolerance does not leak through a real edge`() {
        // 40 is close to what somebody drags the slider to in frustration. It still stops
        // at the door, because the door is 190 units of RGB distance away and 40 maps to
        // about 104.
        val (result, mask, _) = fill(tolerance = 40, seedX = 0.0, seedY = 0.0)
        assertEquals(16, result.pixels)
        assertEquals(listOf("####..", "####..", "####..", "####.."), picture(mask))
    }

    @Test
    fun `a tap on the door selects the door`() {
        val (result, mask, _) = fill(tolerance = 12, seedX = 5.0, seedY = 3.0)
        assertEquals(8, result.pixels)
        assertEquals(listOf("....##", "....##", "....##", "....##"), picture(mask))
    }

    @Test
    fun `a seed outside the image is clamped to its edge, not rejected`() {
        // Somebody dragging off the side of a wall lifts their thumb outside the canvas.
        // (-4, 99) becomes (0, 3), which is the wall, and the fill behaves as if the tap
        // had landed there.
        val (result, mask, _) = fill(tolerance = 12, seedX = -4.0, seedY = 99.0)
        assertEquals(16, result.pixels)
        assertEquals(listOf("####..", "####..", "####..", "####.."), picture(mask))
    }

    @Test
    fun `erasing walks the same region and clears it`() {
        val source = source()
        val mask = mask()
        MaskEngine.floodFill(source, mask, WIDTH, HEIGHT, 0.0, 0.0, 12, add = true)
        val erased = MaskEngine.floodFill(source, mask, WIDTH, HEIGHT, 0.0, 0.0, 12, add = false)
        assertTrue(erased.changed)
        assertEquals(16, erased.pixels)
        assertEquals(listOf("......", "......", "......", "......"), picture(mask))
        // Erase writes transparent white, not transparent black: the same bytes the canvas
        // version writes, so a mask saved from either is the same mask.
        assertEquals(0x00FFFFFF, mask[0])
    }

    @Test
    fun `selecting writes opaque white, so the mask is a real ARGB image`() {
        val (_, mask, _) = fill(tolerance = 12, seedX = 0.0, seedY = 0.0)
        assertEquals(-1, mask[0]) // 0xFFFFFFFF
        assertEquals(255, (mask[0] ushr 24) and 0xFF)
        assertEquals(255, (mask[0] shr 16) and 0xFF)
    }

    @Test
    fun `coverage samples every eighth pixel and reports the share selected`() {
        val (_, mask, _) = fill(tolerance = 12, seedX = 0.0, seedY = 0.0)
        // 24 pixels, sampled at 0, 8 and 16: two of the three are wall.
        assertEquals(2.0 / 3.0, MaskEngine.coverage(mask, WIDTH, HEIGHT), 1e-9)
    }

    @Test
    fun `coverage of an empty mask is zero, not a division by zero`() {
        assertEquals(0.0, MaskEngine.coverage(mask(), WIDTH, HEIGHT), 1e-9)
    }

    @Test
    fun `a drag interpolates enough stamps to leave no gap`() {
        val stamps = MaskEngine.stroke(BrushStamp(10.0, 20.0), BrushStamp(40.0, 20.0), radius = 12.0)
        // step = max(1, 12 * 0.35) = 4.2; steps = ceil(30 / 4.2) = 8; i = 0..8.
        assertEquals(9, stamps.size)
        assertEquals(10.0, stamps.first().x, 1e-9)
        assertEquals(13.75, stamps[1].x, 1e-9)
        assertEquals(40.0, stamps.last().x, 1e-9)
        assertEquals(20.0, stamps.last().y, 1e-9)
    }

    @Test
    fun `a tap that does not move still stamps, twice, in the same place`() {
        // `steps` has a floor of one, so the loop runs for i = 0 and i = 1. That is the
        // website's behaviour, reproduced because a single tap with the brush has to do
        // something, and doing it twice at full strength is the same as doing it once.
        val stamps = MaskEngine.stroke(BrushStamp(5.0, 5.0), BrushStamp(5.0, 5.0), radius = 8.0)
        assertEquals(2, stamps.size)
        assertEquals(BrushStamp(5.0, 5.0), stamps[0])
        assertEquals(BrushStamp(5.0, 5.0), stamps[1])
    }

    @Test
    fun `a photograph is scaled down to the working edge and never scaled up`() {
        assertEquals(WorkingSize(1400, 1050), MaskEngine.scaledSize(4000, 3000))
        assertEquals(WorkingSize(1400, 1400), MaskEngine.scaledSize(1400, 1400))
        assertEquals(WorkingSize(800, 600), MaskEngine.scaledSize(800, 600))
        assertEquals(WorkingSize(1, 1400), MaskEngine.scaledSize(1, 5000))
        assertEquals(WorkingSize(1050, 1400), MaskEngine.scaledSize(3000, 4000))
    }

    @Test
    fun `a stamp is full strength at the centre and nothing outside the radius`() {
        val mask = mask()
        MaskEngine.stamp(mask, WIDTH, HEIGHT, BrushStamp(1.0, 1.0), radius = 3.0, add = true)
        assertEquals(255, (mask[1 * WIDTH + 1] ushr 24) and 0xFF)
        // (5, 3) is more than three pixels from (1, 1) and must be untouched.
        assertEquals(0, (mask[3 * WIDTH + 5] ushr 24) and 0xFF)
    }

    @Test
    fun `a stamp falls off monotonically between the hard core and its edge`() {
        val size = 40
        val mask = IntArray(size * size)
        MaskEngine.stamp(mask, size, size, BrushStamp(20.0, 20.0), radius = 10.0, add = true)
        var previous = 256
        for (offset in 0..10) {
            val alpha = (mask[20 * size + (20 + offset)] ushr 24) and 0xFF
            assertTrue("alpha fell then rose at $offset", alpha <= previous)
            previous = alpha
        }
        assertEquals(0, (mask[20 * size + 31] ushr 24) and 0xFF)
    }

    @Test
    fun `an erasing stamp feathers an edge instead of cutting a hole in it`() {
        val size = 40
        val mask = IntArray(size * size) { 0xFFFFFFFF.toInt() }
        MaskEngine.stamp(mask, size, size, BrushStamp(20.0, 20.0), radius = 10.0, add = false)
        val centre = (mask[20 * size + 20] ushr 24) and 0xFF
        val midway = (mask[20 * size + 27] ushr 24) and 0xFF
        val outside = (mask[20 * size + 35] ushr 24) and 0xFF
        assertEquals(0, centre)
        assertTrue("the edge should be partly erased, got $midway", midway in 1..254)
        assertEquals(255, outside)
    }

    @Test
    fun `a stamp of zero radius does nothing rather than dividing by zero`() {
        val mask = mask()
        MaskEngine.stamp(mask, WIDTH, HEIGHT, BrushStamp(2.0, 2.0), radius = 0.0, add = true)
        assertEquals(0, (mask[2 * WIDTH + 2] ushr 24) and 0xFF)
    }

    @Test
    fun `filling a degenerate image changes nothing`() {
        val result = MaskEngine.floodFill(IntArray(0), IntArray(0), 0, 0, 0.0, 0.0, 12, add = true)
        assertFalse(result.changed)
        assertEquals(0, result.pixels)
    }

    private companion object {
        const val WIDTH = 6
        const val HEIGHT = 4
    }
}
