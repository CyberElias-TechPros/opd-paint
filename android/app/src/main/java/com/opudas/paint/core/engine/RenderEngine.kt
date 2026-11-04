package com.opudas.paint.core.engine

import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/** Which of the two looks the preview offers. The website calls them matt and silk. */
enum class FinishLook(val id: String) {
    MATT("matt"),
    SILK("silk"),
}

/**
 * Turning a photograph and a selection into a preview of that wall in that paint.
 *
 * A port of `app/src/lib/render.ts`. The idea it is built on is one line of the original
 * and it is the reason the preview is worth looking at: hue and saturation come from the
 * paint, luminance comes from the photograph. Highlights stay highlights, shadows stay
 * shadows, and the window light does not turn into a flat block of pigment.
 *
 * Canvas does that with blend modes; there are no blend modes here, so each one is written
 * out from the W3C Compositing and Blending specification and applied per pixel. What that
 * buys is testability — [colorBlend], [multiplyBlend] and [softLightBlend] are pure
 * functions of two colours and can be checked against the specification's own definitions,
 * which is more than the canvas version can do, since a browser will not tell you what it
 * did.
 *
 * **Equivalent, not identical.** Two places cannot be reproduced exactly and do not pretend
 * to be. The silk sheen is a canvas linear gradient, and a gradient's stops are interpolated
 * in premultiplied space by the browser while this interpolates them straight; and every
 * step here rounds to eight bits per channel where the canvas accumulates in floats. Both
 * differences are below what anybody can see in a preview whose own interface says it is a
 * simulation. The blend formulae themselves are exact.
 *
 * The matt pass is applied to the whole frame and not to the mask, because that is what
 * `source-atop` does over an opaque canvas: five per cent of black or white across
 * everything, which reads as the flatness of a matt film rather than as a selected region.
 * It looks like a bug next to the silk pass, which is masked, and it is not.
 */
object RenderEngine {

    /**
     * Compose one frame.
     *
     * @param source ARGB pixels of the photograph, at the working size.
     * @param mask   ARGB pixels whose alpha channel is the selection: 255 selected, 0 not.
     * @param hex    the paint, as `#RRGGBB`.
     * @param output written into rather than allocated, because a brush stroke composes a
     *               frame per pointer event and two frame-sized allocations per event is
     *               how a 1400px preview turns a drag into a stutter. The website's
     *               `Scratch` exists for the same reason.
     */
    fun composeFrame(
        source: IntArray,
        mask: IntArray,
        width: Int,
        height: Int,
        hex: String,
        finish: FinishLook,
        output: IntArray,
    ): IntArray {
        val pigment = parseHex(hex) ?: return source.copyInto(output)
        val mattVeil = if (pigment.r + pigment.g + pigment.b > MATT_VEIL_THRESHOLD) Rgb(0, 0, 0) else Rgb(255, 255, 255)
        val size = min(min(source.size, output.size), width * height)

        for (i in 0 until size) {
            val x = i % width
            val y = i / width
            var backdrop = Rgb((source[i] shr 16) and 0xFF, (source[i] shr 8) and 0xFF, source[i] and 0xFF)
            val maskAlpha = ((mask[i] ushr 24) and 0xFF) / 255.0

            if (maskAlpha > 0.0) {
                // 1. The pigment, restricted to the selection, recolouring rather than
                //    covering: the canvas `color` blend mode.
                backdrop = over(backdrop, colorBlend(backdrop, pigment), maskAlpha)

                // 2. A low-alpha multiply of the same pigment, so the colour reaches into
                //    the darker half of the wall instead of only tinting the lit half.
                backdrop = over(backdrop, multiplyBlend(backdrop, pigment), MULTIPLY_ALPHA * maskAlpha)
            }

            backdrop = if (finish == FinishLook.SILK) {
                // 3. Sheen from the top-left, which is where the light usually falls in an
                //    interior photograph, and only where the wall is selected.
                val sheen = sheenAt(x, y, width, height)
                val alpha = SOFT_LIGHT_ALPHA * sheen.second * maskAlpha
                if (alpha > 0.0) over(backdrop, softLightBlend(backdrop, sheen.first), alpha) else backdrop
            } else {
                // 3. Matt: five per cent of black or white over the whole frame, chosen by
                //    whether the paint is light or dark.
                over(backdrop, mattVeil, MATT_ALPHA)
            }

            output[i] = (0xFF shl 24) or (backdrop.r shl 16) or (backdrop.g shl 8) or backdrop.b
        }
        return output
    }

    /**
     * The canvas `color` blend mode: the luminance of [backdrop] with the hue and
     * saturation of [pigment].
     *
     * `SetLum(Cs, Lum(Cb))` in the specification's notation, including `ClipColor`, which
     * pushes a channel back inside 0..1 along the line towards the target luminance rather
     * than clamping it — clamping would change the luminance the whole mode exists to
     * preserve, and a bright pigment on a dark wall would go grey instead of deep.
     */
    fun colorBlend(backdrop: Rgb, pigment: Rgb): Rgb = setLuminance(pigment, blendLuminance(backdrop))

    /** The canvas `multiply` blend mode: `Cb * Cs`. */
    fun multiplyBlend(backdrop: Rgb, pigment: Rgb): Rgb = Rgb(
        r = channel(backdrop.r, pigment.r) { b, s -> b * s },
        g = channel(backdrop.g, pigment.g) { b, s -> b * s },
        b = channel(backdrop.b, pigment.b) { b, s -> b * s },
    )

    /**
     * The canvas `soft-light` blend mode, from the specification's piecewise definition.
     *
     * A mid-grey source is the identity, which is the property that makes it usable for a
     * sheen: the gradient's pale middle leaves the photograph alone and only its bright and
     * dark ends do anything.
     */
    fun softLightBlend(backdrop: Rgb, sheen: Rgb): Rgb = Rgb(
        r = channel(backdrop.r, sheen.r, ::softLightChannel),
        g = channel(backdrop.g, sheen.g, ::softLightChannel),
        b = channel(backdrop.b, sheen.b, ::softLightChannel),
    )

    /** `source-over` for two opaque colours: a straight cross-fade by [alpha]. */
    private fun over(backdrop: Rgb, source: Rgb, alpha: Double): Rgb {
        val a = alpha.coerceIn(0.0, 1.0)
        if (a == 0.0) return backdrop
        if (a == 1.0) return source
        return Rgb(
            r = (backdrop.r + (source.r - backdrop.r) * a).roundToInt().coerceIn(0, 255),
            g = (backdrop.g + (source.g - backdrop.g) * a).roundToInt().coerceIn(0, 255),
            b = (backdrop.b + (source.b - backdrop.b) * a).roundToInt().coerceIn(0, 255),
        )
    }

    private inline fun channel(cb: Int, cs: Int, blend: (Double, Double) -> Double): Int =
        (blend(cb / 255.0, cs / 255.0) * 255.0).roundToInt().coerceIn(0, 255)

    private fun softLightChannel(b: Double, s: Double): Double = if (s <= 0.5) {
        b - (1.0 - 2.0 * s) * b * (1.0 - b)
    } else {
        b + (2.0 * s - 1.0) * (screenOf(b) - b)
    }

    /** `D(Cb)` in the specification: a cubic below a quarter, a square root above it. */
    private fun screenOf(b: Double): Double =
        if (b <= 0.25) ((16.0 * b - 12.0) * b + 4.0) * b else sqrt(b)

    /**
     * `Lum(C) = 0.3Cr + 0.59Cg + 0.11Cb`.
     *
     * Not the WCAG relative luminance that `ColorMath.luminance` computes: that one
     * linearises the sRGB channels first, because it answers a question about legibility.
     * This one does not, because the blend specification defines it this way and using the
     * other would make every preview slightly darker than the website's.
     */
    private fun blendLuminance(color: Rgb): Double =
        0.30 * (color.r / 255.0) + 0.59 * (color.g / 255.0) + 0.11 * (color.b / 255.0)

    private fun blendLuminanceOf(channels: DoubleArray): Double =
        0.30 * channels[0] + 0.59 * channels[1] + 0.11 * channels[2]

    /** `SetLum(C, l)`, with `ClipColor` folded in. */
    private fun setLuminance(color: Rgb, target: Double): Rgb {
        val shift = target - blendLuminance(color)
        val shifted = doubleArrayOf(
            color.r / 255.0 + shift,
            color.g / 255.0 + shift,
            color.b / 255.0 + shift,
        )
        val luminance = blendLuminanceOf(shifted)
        val min = minOf(shifted[0], shifted[1], shifted[2])
        val max = maxOf(shifted[0], shifted[1], shifted[2])

        if (min < 0.0) {
            val span = luminance - min
            if (span > 0.0) {
                for (i in 0..2) shifted[i] = luminance + (shifted[i] - luminance) * luminance / span
            }
        }
        if (max > 1.0) {
            val span = max - luminance
            if (span > 0.0) {
                for (i in 0..2) shifted[i] = luminance + (shifted[i] - luminance) * (1.0 - luminance) / span
            }
        }
        return Rgb(
            r = (shifted[0] * 255.0).roundToInt().coerceIn(0, 255),
            g = (shifted[1] * 255.0).roundToInt().coerceIn(0, 255),
            b = (shifted[2] * 255.0).roundToInt().coerceIn(0, 255),
        )
    }

    /**
     * The silk sheen at one pixel: a colour and an alpha, from the same three stops the
     * website's linear gradient uses, running from the top-left corner to nine tenths of
     * the width and the full height.
     *
     * @return the sheen colour and its strength, 0..1.
     */
    private fun sheenAt(x: Int, y: Int, width: Int, height: Int): Pair<Rgb, Double> {
        val vx = width * SHEEN_RUN
        val vy = height.toDouble()
        val lengthSquared = vx * vx + vy * vy
        if (lengthSquared <= 0.0) return Pair(Rgb(255, 255, 255), 0.0)
        val t = ((x * vx + y * vy) / lengthSquared).coerceIn(0.0, 1.0)
        return if (t <= SHEEN_MID_STOP) {
            val span = SHEEN_MID_STOP
            val f = if (span <= 0.0) 0.0 else t / span
            Pair(Rgb(255, 255, 255), SHEEN_TOP_ALPHA + (SHEEN_MID_ALPHA - SHEEN_TOP_ALPHA) * f)
        } else {
            val span = 1.0 - SHEEN_MID_STOP
            val f = (t - SHEEN_MID_STOP) / span
            // White to black is the colour change; the alpha carries on falling and then
            // rises slightly at the corner, exactly as the three stops describe.
            val channel = (255.0 * (1.0 - f)).roundToInt().coerceIn(0, 255)
            Pair(Rgb(channel, channel, channel), SHEEN_MID_ALPHA + (SHEEN_BOTTOM_ALPHA - SHEEN_MID_ALPHA) * f)
        }
    }

    /** The gradient runs to nine tenths of the width, so the sheen arrives at an angle. */
    private const val SHEEN_RUN = 0.9
    private const val SHEEN_MID_STOP = 0.42
    private const val SHEEN_TOP_ALPHA = 0.55
    private const val SHEEN_MID_ALPHA = 0.08
    private const val SHEEN_BOTTOM_ALPHA = 0.12
    private const val SOFT_LIGHT_ALPHA = 0.5
    private const val MULTIPLY_ALPHA = 0.14
    private const val MATT_ALPHA = 0.05

    /**
     * A paint whose channels sum above this is light enough that a matt film should read as
     * a shade darker, so the veil is black; below it, white. The website's threshold, kept
     * as a sum of three 0-255 channels rather than a luminance because that is what it is.
     */
    private const val MATT_VEIL_THRESHOLD = 600
}
