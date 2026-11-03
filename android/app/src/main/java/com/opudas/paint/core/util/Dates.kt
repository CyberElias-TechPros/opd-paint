package com.opudas.paint.core.util

import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * An ISO date written out in full, in the reader's own locale.
 *
 * The bundle and the service both carry dates as `yyyy-MM-dd` — a guide's
 * `updated`, a data request's `dueBy`. Rendering `2026-08-12` on a screen is
 * machine output in a place where a person is reading, and the one that matters
 * most is a statutory deadline, which is exactly the string nobody should have to
 * translate in their head.
 *
 * Parsing uses a fixed locale and is not lenient: `2026-13-45` is bad data and
 * should render as nothing rather than roll over into a date in 2027 that looks
 * plausible. Formatting uses the device locale, because that half is for the
 * reader.
 *
 * The formatters are built per call rather than shared. [SimpleDateFormat] is not
 * thread-safe, and a static instance here would be read from the main thread and
 * from background coroutines in the same process — the corruption that causes is
 * intermittent and produces a wrong date rather than a crash, which is the worst
 * outcome available for a deadline.
 *
 * Returns null for anything that is not a parseable day, so callers can fall back
 * to showing the raw string rather than a blank.
 */
fun formatLongDate(iso: String): String? {
    val day = iso.trim().take(10)
    if (day.length < 10) return null
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }
        val parsed = parser.parse(day) ?: return null
        SimpleDateFormat("d MMMM yyyy", Locale.getDefault()).format(parsed)
    } catch (error: ParseException) {
        null
    }
}

/**
 * The same date, short form, for places where the long one will not fit.
 *
 * `12 Aug 2026` rather than `2026-08-12`: still a date a person reads, still in
 * their locale, but narrow enough for a list row.
 */
fun formatShortDate(iso: String): String? {
    val day = iso.trim().take(10)
    if (day.length < 10) return null
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }
        val parsed = parser.parse(day) ?: return null
        SimpleDateFormat("d MMM yyyy", Locale.getDefault()).format(parsed)
    } catch (error: ParseException) {
        null
    }
}
