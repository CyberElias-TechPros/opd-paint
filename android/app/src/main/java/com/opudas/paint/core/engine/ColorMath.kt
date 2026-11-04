package com.opudas.paint.core.engine

import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/*
 * Colour arithmetic, ported from `app/src/lib/color.ts`.
 *
 * This is not a helper library, it is the reason the app can say anything at all
 * about a colour: whether text on it is legible, whether it is light enough for a
 * ceiling, how much of it a room needs, and what it looks like under a different
 * light. The website computes the same answers from the same source, and the two
 * implementations are tested against the same numbers — a contrast ratio that
 * differs between the site and the app is a lie told twice.
 *
 * Everything here is pure: no Android types, no Context, no framework imports, so
 * it runs on the JVM in a unit test in milliseconds. That is deliberate. The
 * visualiser's bitmap work needs Android; the arithmetic underneath it does not,
 * and arithmetic that can be tested is arithmetic that gets tested.
 */

/** A colour as three 0-255 channels. Kept separate from `androidx.compose.ui.graphics.Color` so nothing here needs Compose. */
data class Rgb(val r: Int, val g: Int, val b: Int) {
    /** `#RRGGBB`, upper case, the way the data files and the printed books write it. */
    fun toHex(): String = "#%02X%02X%02X".format(r, g, b)
}

/**
 * Parse `#rgb`, `#rrggbb` or a bare `rrggbb`.
 *
 * Returns null rather than throwing: a colour is content, content is edited by
 * people, and a malformed hex in one entry should cost that entry its swatch, not
 * the whole library. The content test fails the build on a bad hex anyway, so
 * null here means somebody shipped data the tests did not cover.
 */
fun parseHex(value: String): Rgb? {
    val cleaned = value.trim().removePrefix("#")
    val expanded = when (cleaned.length) {
        3 -> cleaned.map { "$it$it" }.joinToString("")
        6, 8 -> cleaned
        else -> return null
    }
    // An 8-digit hex is RGBA on the web; the alpha is dropped because every
    // surface in this app paints an opaque chip.
    val body = expanded.take(6)
    val r = body.substring(0, 2).toIntOrNull(16) ?: return null
    val g = body.substring(2, 4).toIntOrNull(16) ?: return null
    val b = body.substring(4, 6).toIntOrNull(16) ?: return null
    return Rgb(r, g, b)
}

/**
 * Relative luminance, WCAG 2.2 §relative luminance.
 *
 * The sRGB channels are linearised before being weighted, because the eye's
 * response is not linear and a plain average of the channels would call a
 * mid-yellow and a mid-blue the same brightness.
 */
fun luminance(color: Rgb): Double {
    fun channel(value: Int): Double {
        val c = value.toDouble() / 255.0
        return if (c <= 0.04045) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
    }
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

/**
 * Contrast ratio between two colours, from 1 (identical) to 21 (black on white).
 *
 * 4.5 is the WCAG AA threshold for body text and 3.0 for large text and for the
 * boundary of a form control; those numbers appear in the design tokens' own
 * comments, which record where the brand palette was adjusted to clear them.
 */
fun contrast(a: Rgb, b: Rgb): Double {
    val la = luminance(a)
    val lb = luminance(b)
    val lighter = max(la, lb)
    val darker = min(la, lb)
    return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Whether black or white text is more legible on [background].
 *
 * Used for the colour chips: a name printed on a swatch has to be readable on a
 * deep green and on an off-white, and picking by luminance rather than by
 * hand-assigned colour is what keeps a newly added colour legible without
 * anybody remembering to set it.
 */
fun readableInkOn(background: Rgb): Rgb =
    if (contrast(background, Rgb(255, 255, 255)) >= contrast(background, Rgb(0, 0, 0))) {
        Rgb(255, 255, 255)
    } else {
        Rgb(0, 0, 0)
    }

/**
 * Light reflectance value as a percentage, the way a paint label prints it.
 *
 * LRV is luminance expressed against a perfect diffuser, so it is the same
 * calculation scaled to 0-100. A ceiling wants a high LRV; a feature wall in a
 * dark room wants a low one, and the app says so on the colour's own page.
 */
fun lrv(color: Rgb): Int = (luminance(color) * 100.0).roundToInt()

/**
 * The colour's family in the sense a decorator means it: warm, cool or neutral.
 *
 * Derived rather than stored, because the library already carries a curated
 * `undertone` per colour and this is only for the cases where one is missing —
 * a swatch grid sorted by temperature reads better than one sorted by name.
 */
enum class Temperature { WARM, COOL, NEUTRAL }

fun temperature(color: Rgb): Temperature {
    val spread = max(max(color.r, color.g), color.b) - min(min(color.r, color.g), color.b)
    // A grey has almost no spread, so it is neutral whatever its hue.
    if (spread < 12) return Temperature.NEUTRAL
    return if (color.r > color.b) Temperature.WARM else Temperature.COOL
}

/**
 * Mix two colours, as paint mixes rather than as light mixes.
 *
 * Subtractive mixing is what happens in a tin: two colours combine toward the
 * darker of the two, unlike averaging RGB values, which brightens. The website's
 * "one colour under four lights" panel and the visualiser's matt-versus-silk
 * difference both depend on getting this the way a decorator would expect it.
 */
fun mixPaint(a: Rgb, b: Rgb, weightOfB: Double): Rgb {
    val w = weightOfB.coerceIn(0.0, 1.0)
    fun channel(x: Int, y: Int): Int {
        // Multiply the normalised channels (absorption), then take the complement.
        val absorbed = (1.0 - x / 255.0) * (1.0 - w) + (1.0 - y / 255.0) * w
        return ((1.0 - absorbed) * 255.0).roundToInt().coerceIn(0, 255)
    }
    return Rgb(channel(a.r, b.r), channel(a.g, b.g), channel(a.b, b.b))
}

/**
 * A colour under a light source, as a multiplier on each channel.
 *
 * The four lights are the ones the printed colour book shows — morning, midday,
 * tungsten and evening — because "how will this look in my sitting room" is the
 * question behind most colour anxiety, and the honest answer is that it depends
 * on the light rather than on the swatch.
 */
enum class Light(val label: String, val r: Double, val g: Double, val b: Double) {
    MORNING("Morning light", 1.00, 0.99, 0.94),
    MIDDAY("Midday", 1.00, 1.00, 1.00),
    TUNGSTEN("Tungsten bulb", 1.00, 0.90, 0.76),
    EVENING("Evening, no lamp", 0.82, 0.84, 0.95),
}

fun underLight(color: Rgb, light: Light): Rgb = Rgb(
    (color.r * light.r).roundToInt().coerceIn(0, 255),
    (color.g * light.g).roundToInt().coerceIn(0, 255),
    (color.b * light.b).roundToInt().coerceIn(0, 255),
)

/**
 * Darken or lighten toward black or white by [amount] (0-1).
 *
 * Used for the visualiser's shading: a wall in shadow is the same colour
 * multiplied down, not a different colour, and painting the shadow as a different
 * chip is what makes a preview look like a sticker.
 */
fun shade(color: Rgb, amount: Double): Rgb {
    val target = if (amount < 0) 0 else 255
    val w = kotlin.math.abs(amount).coerceIn(0.0, 1.0)
    return Rgb(
        (color.r + (target - color.r) * w).roundToInt().coerceIn(0, 255),
        (color.g + (target - color.g) * w).roundToInt().coerceIn(0, 255),
        (color.b + (target - color.b) * w).roundToInt().coerceIn(0, 255),
    )
}
