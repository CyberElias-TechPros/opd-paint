package com.opudas.paint.core.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The compositor, against numbers computed independently from the blend specification.
 *
 * There is no reference output to lift here and that is worth being precise about: the
 * website's `composeFrame` runs on a canvas, and a canvas needs a browser, which a JVM test
 * does not have. So each expected value below was produced by a separate transcription of
 * the W3C Compositing and Blending formulae — not by this code, and not by reading this
 * code — and the two agreed. Where the browser and a per-pixel port can legitimately differ
 * (gradient interpolation in premultiplied space, eight-bit rounding between passes) the
 * assertions are about whole composed pixels rather than intermediate floats, which is the
 * level the difference lives at.
 *
 * One check caught a real bug while these numbers were being produced, in the reference
 * rather than in the engine: normalising a shift against 0-255 channels instead of 0..1 made
 * every blend come out black. A blend that returns black for every input is the kind of
 * mistake that survives a glance at a preview, because a dark room looks plausible.
 */
class RenderEngineTest {

    private fun red(pixel: Int) = (pixel shr 16) and 0xFF
    private fun green(pixel: Int) = (pixel shr 8) and 0xFF
    private fun blue(pixel: Int) = pixel and 0xFF

    private fun assertRgb(expected: Triple<Int, Int, Int>, actual: Rgb, note: String) {
        assertEquals("$note: red", expected.first, actual.r)
        assertEquals("$note: green", expected.second, actual.g)
        assertEquals("$note: blue", expected.third, actual.b)
    }

    private fun image(width: Int, height: Int, pixel: Int) = IntArray(width * height) { pixel }

    private fun wall(width: Int = WIDTH, height: Int = HEIGHT) =
        image(width, height, (0xFF shl 24) or (200 shl 16) or (190 shl 8) or 170)

    @Test
    fun `the colour blend takes the backdrop's luminance and the pigment's hue`() {
        assertRgb(Triple(255, 74, 74), RenderEngine.colorBlend(Rgb(128, 128, 128), Rgb(255, 0, 0)), "grey wall, red paint")
        assertRgb(Triple(216, 246, 226), RenderEngine.colorBlend(Rgb(240, 235, 220), Rgb(60, 90, 70)), "light wall, green paint")
        assertRgb(Triple(37, 31, 15), RenderEngine.colorBlend(Rgb(30, 30, 40), Rgb(232, 226, 210)), "dark wall, light paint")
    }

    @Test
    fun `the colour blend leaves the luminance it was given alone`() {
        // This is the whole reason the preview is believable: a highlight stays a highlight.
        // ClipColor preserves luminance by construction, so what is asserted is that the
        // eight-bit result is within a rounding step of the luminance it started with.
        val backdrop = Rgb(240, 235, 220)
        val blended = RenderEngine.colorBlend(backdrop, Rgb(60, 90, 70))
        val before = 0.30 * backdrop.r + 0.59 * backdrop.g + 0.11 * backdrop.b
        val after = 0.30 * blended.r + 0.59 * blended.g + 0.11 * blended.b
        assertTrue("luminance moved from $before to $after", kotlin.math.abs(before - after) <= 2.0)
    }

    @Test
    fun `multiply is a product, with white as the identity and black as the floor`() {
        assertRgb(Triple(47, 64, 44), RenderEngine.multiplyBlend(Rgb(200, 180, 160), Rgb(60, 90, 70)), "wall times pigment")
        assertEquals(Rgb(60, 90, 70), RenderEngine.multiplyBlend(Rgb(255, 255, 255), Rgb(60, 90, 70)))
        assertEquals(Rgb(0, 0, 0), RenderEngine.multiplyBlend(Rgb(0, 0, 0), Rgb(60, 90, 70)))
    }

    @Test
    fun `soft light with a mid-grey sheen changes nothing`() {
        // The property the sheen gradient depends on: its pale middle leaves the photograph
        // alone and only the bright and dark ends do anything.
        assertEquals(Rgb(128, 128, 128), RenderEngine.softLightBlend(Rgb(128, 128, 128), Rgb(128, 128, 128)))
        assertRgb(Triple(160, 160, 160), RenderEngine.softLightBlend(Rgb(100, 100, 100), Rgb(255, 255, 255)), "a white sheen lifts")
        assertRgb(Triple(157, 157, 157), RenderEngine.softLightBlend(Rgb(200, 200, 200), Rgb(0, 0, 0)), "a black sheen drops")
    }

    @Test
    fun `with nothing selected, silk leaves the photograph exactly alone`() {
        val source = wall()
        val output = IntArray(WIDTH * HEIGHT)
        RenderEngine.composeFrame(source, IntArray(WIDTH * HEIGHT), WIDTH, HEIGHT, "#3C5A46", FinishLook.SILK, output)
        assertTrue(output.all { it == source[0] })
        assertEquals(200, red(output[0]))
        assertEquals(190, green(output[0]))
        assertEquals(170, blue(output[0]))
    }

    @Test
    fun `with nothing selected, matt still veils the whole frame`() {
        // Not a bug and not a masked region: `source-atop` over an opaque canvas covers
        // everything, so a matt preview is five per cent flatter across the whole
        // photograph. The pigment here is dark, so the veil is white and the wall lifts.
        val output = IntArray(WIDTH * HEIGHT)
        RenderEngine.composeFrame(wall(), IntArray(WIDTH * HEIGHT), WIDTH, HEIGHT, "#3C5A46", FinishLook.MATT, output)
        assertEquals(203, red(output[0]))
        assertEquals(193, green(output[0]))
        assertEquals(174, blue(output[0]))
    }

    @Test
    fun `a light paint veils matt the other way, towards black`() {
        val output = IntArray(WIDTH * HEIGHT)
        RenderEngine.composeFrame(wall(), IntArray(WIDTH * HEIGHT), WIDTH, HEIGHT, "#E8E2D2", FinishLook.MATT, output)
        assertEquals(190, red(output[0]))
        assertEquals(181, green(output[0]))
        assertEquals(162, blue(output[0]))
    }

    @Test
    fun `a fully selected wall composes to the expected pixel in each finish`() {
        val mask = IntArray(WIDTH * HEIGHT) { 0xFFFFFFFF.toInt() }

        val silk = IntArray(WIDTH * HEIGHT)
        RenderEngine.composeFrame(wall(), mask, WIDTH, HEIGHT, "#3C5A46", FinishLook.SILK, silk)
        val at = 10 * WIDTH + 10
        assertEquals(163, red(silk[at]))
        assertEquals(191, green(silk[at]))
        assertEquals(172, blue(silk[at]))

        val matt = IntArray(WIDTH * HEIGHT)
        RenderEngine.composeFrame(wall(), mask, WIDTH, HEIGHT, "#3C5A46", FinishLook.MATT, matt)
        assertEquals(159, red(matt[at]))
        assertEquals(188, green(matt[at]))
        assertEquals(169, blue(matt[at]))
    }

    @Test
    fun `a pigment it cannot parse leaves the photograph alone rather than guessing`() {
        val source = wall()
        val output = IntArray(WIDTH * HEIGHT)
        RenderEngine.composeFrame(source, IntArray(WIDTH * HEIGHT) { 0xFFFFFFFF.toInt() }, WIDTH, HEIGHT, "not-a-colour", FinishLook.SILK, output)
        assertTrue(output.all { it == source[0] })
    }

    @Test
    fun `the frame is written into the caller's array, which is the point of passing one`() {
        // A brush stroke composes a frame per pointer event. Allocating inside would mean
        // two frame-sized allocations per event, which is how a drag becomes a stutter.
        val output = IntArray(WIDTH * HEIGHT)
        val returned = RenderEngine.composeFrame(wall(), IntArray(WIDTH * HEIGHT), WIDTH, HEIGHT, "#3C5A46", FinishLook.SILK, output)
        assertSame(output, returned)
    }

    private companion object {
        const val WIDTH = 100
        const val HEIGHT = 80
    }
}
