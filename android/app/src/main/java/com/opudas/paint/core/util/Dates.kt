package com.opudas.paint.core.util

import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

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

private const val TIMESTAMP_PATTERN = "yyyy-MM-dd'T'HH:mm:ss"
private const val TIMESTAMP_LENGTH = 19

/**
 * A moment, in the reader's own time zone: "3 November 2026 at 14:31".
 *
 * The service writes UTC and always will (`toISOString`), so the timestamp is parsed
 * as UTC and formatted in the device's zone. Parsing it in the local zone instead
 * would not crash and would not look wrong — it would show an enquiry arriving four
 * hours earlier than it did, on a screen whose whole job is telling somebody whether
 * a 24-hour service level has been met. That is the kind of error worth four extra
 * lines.
 *
 * Returns null for anything that is not a full timestamp, so a caller can fall back to
 * the raw string rather than showing a time it made up.
 */
fun formatDateTime(iso: String): String? {
    val text = iso.trim()
    if (text.length < TIMESTAMP_LENGTH) return null
    return try {
        val parsed = SimpleDateFormat(TIMESTAMP_PATTERN, Locale.US).apply {
            isLenient = false
            timeZone = TimeZone.getTimeZone("UTC")
        }.parse(text.substring(0, TIMESTAMP_LENGTH)) ?: return null
        SimpleDateFormat("d MMM yyyy 'at' HH:mm", Locale.getDefault()).format(parsed)
    } catch (error: ParseException) {
        null
    }
}
