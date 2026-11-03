package com.opudas.paint.core.util

import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.round

/*
 * Number handling shared by the engines.
 *
 * Both behaviours here exist because the website already has them, and the app
 * must show the same numbers as the site for the same inputs. Someone comparing
 * a phone against a printed quote should not find two different litre counts,
 * and "the app rounds differently" is not an answer a contractor accepts.
 *
 *  - [roundTo] mirrors `Math.round(n * 10^p) / 10^p` from the website's
 *    calculator. `kotlin.math.round` and `Math.round` agree on the case that
 *    matters here: both round a positive half away from zero.
 *  - [plain] mirrors how JavaScript renders a number inside a template literal.
 *    Kotlin's `Double.toString()` always keeps a decimal point, so a whole
 *    number would print as "100.0" where the site prints "100" — visible in the
 *    calculator's worked formula, which is the one place the arithmetic is shown
 *    rather than just asserted.
 */

/** Rounds to [places] decimal places, defaulting to the two the site uses. */
fun Double.roundTo(places: Int = 2): Double {
    val factor = 10.0.pow(places)
    return round(this * factor) / factor
}

/**
 * Renders the way JavaScript does: no trailing ".0" on a whole number, and no
 * switch to exponent form at the sizes a paint job reaches.
 *
 * Beyond about 1e15 a Double has no exact Long equivalent, so those fall back to
 * [toString] rather than being mangled. NaN and the infinities are spelled the
 * way JavaScript spells them, so a bug reads the same on both platforms instead
 * of arriving as "NaN" on one and something else on the other.
 */
fun Double.plain(): String {
    if (isNaN()) return "NaN"
    if (isInfinite()) return if (this > 0) "Infinity" else "-Infinity"
    if (abs(this) >= 1e15) return toString()
    val whole = toLong()
    return if (whole.toDouble() == this) whole.toString() else toString()
}
