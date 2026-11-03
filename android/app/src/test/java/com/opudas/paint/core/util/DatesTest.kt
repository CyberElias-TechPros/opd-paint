package com.opudas.paint.core.util

import java.util.Locale
import java.util.TimeZone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/*
 * Dates that a person reads.
 *
 * The one that matters most is a data request's statutory deadline: `dueBy` comes
 * back from the service as an ISO day, and a screen that renders `2026-12-03` for
 * a date somebody may have to complain to a regulator about is asking them to
 * translate machine output in their head. These tests are mostly about the
 * failure modes that would be silent — a date rolled over into the following year
 * by lenient parsing, a parse that works in English and fails in French, and a
 * formatter shared between threads that corrupts intermittently rather than
 * crashing.
 */
class DatesTest {

    @Test
    fun `a day from the bundle is written out in full`() {
        val written = formatLongDate("2026-08-12")
        assertNotNull(written)
        assertTrue(written!!.contains("2026"))
        assertTrue(written.contains("12"))
        // The whole point: not the machine's own ordering.
        assertTrue(written != "2026-08-12")
    }

    @Test
    fun `a full timestamp is read as the day it falls on`() {
        assertEquals(formatLongDate("2026-12-03"), formatLongDate("2026-12-03T00:00:00.000Z"))
        assertEquals(formatShortDate("2026-12-03"), formatShortDate("2026-12-03T14:31:09Z"))
    }

    @Test
    fun `a date that does not exist is refused rather than rolled over`() {
        // Lenient parsing would turn 2026-13-45 into a plausible day in 2027.
        assertNull(formatLongDate("2026-13-45"))
        assertNull(formatLongDate("2026-02-30"))
        assertNull(formatShortDate("2026-02-30"))
        assertNull(formatLongDate("0000-00-00"))
    }

    @Test
    fun `anything that is not a day renders as nothing, so callers can fall back`() {
        assertNull(formatLongDate(""))
        assertNull(formatLongDate("   "))
        assertNull(formatLongDate("not-a-date"))
        assertNull(formatLongDate("2026-08"))
        assertNull(formatShortDate("twelve of august"))
    }

    @Test
    fun `parsing does not depend on the device locale, formatting does`() {
        val original = Locale.getDefault()
        try {
            Locale.setDefault(Locale.FRANCE)
            val french = formatLongDate("2026-08-12")
            assertNotNull("a French phone still parses an ISO day", french)
            assertTrue(french!!.contains("2026"))

            Locale.setDefault(Locale.US)
            val english = formatLongDate("2026-08-12")
            assertNotNull(english)

            // Same day, two readers. The month name is the reader's; the day and
            // the year are the data's.
            assertTrue("$english vs $french should differ by language", english != french)
        } finally {
            Locale.setDefault(original)
        }
    }

    @Test
    fun `the short form is no longer than the long one`() {
        val long = formatLongDate("2026-08-12")!!
        val short = formatShortDate("2026-08-12")!!
        // Not strictly shorter: in some locales an abbreviated month is the same
        // word as the full one, and a test that demanded it would be testing the
        // locale rather than the function.
        assertTrue(short.length <= long.length)
        assertTrue(short.contains("2026"))
    }

    @Test
    fun `the same input gives the same output on every call`() {
        // SimpleDateFormat is not thread-safe, so the formatters are built per
        // call. Two calls in a row is the cheapest way to catch a shared instance
        // that has been corrupted by one of them.
        assertEquals(formatLongDate("2026-08-12"), formatLongDate("2026-08-12"))
        assertEquals(formatShortDate("2026-08-12"), formatShortDate("2026-08-12"))
    }

    @Test
    fun `surrounding whitespace and a trailing time do not matter`() {
        assertEquals(formatLongDate("2026-08-12"), formatLongDate("  2026-08-12  "))
    }

    /*
     * The inbox shows when an enquiry arrived next to the hours a desk has to answer
     * it, so the time zone is not a detail. These read the service's UTC and assert
     * the wall clock in three zones, including one where the date changes.
     */
    @Test
    fun `a moment from the service is read as UTC and shown in the reader's zone`() {
        val originalLocale = Locale.getDefault()
        val originalZone = TimeZone.getDefault()
        try {
            Locale.setDefault(Locale.UK)
            val stamp = "2026-11-03T14:31:09.123Z"

            TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
            assertEquals("3 Nov 2026 at 14:31", formatDateTime(stamp))

            TimeZone.setDefault(TimeZone.getTimeZone("GMT+1"))
            assertEquals("3 Nov 2026 at 15:31", formatDateTime(stamp))

            TimeZone.setDefault(TimeZone.getTimeZone("GMT-5"))
            assertEquals("3 Nov 2026 at 09:31", formatDateTime(stamp))
        } finally {
            Locale.setDefault(originalLocale)
            TimeZone.setDefault(originalZone)
        }
    }

    @Test
    fun `a late arrival crosses the date in a zone ahead of UTC`() {
        val originalLocale = Locale.getDefault()
        val originalZone = TimeZone.getDefault()
        try {
            Locale.setDefault(Locale.UK)
            TimeZone.setDefault(TimeZone.getTimeZone("GMT+1"))
            // Parsing this in the local zone instead of UTC would not crash. It would
            // quietly put the enquiry on the wrong day, on a screen whose job is to say
            // whether a 24-hour service level has been met.
            assertEquals("4 Nov 2026 at 00:30", formatDateTime("2026-11-03T23:30:00.000Z"))
        } finally {
            Locale.setDefault(originalLocale)
            TimeZone.setDefault(originalZone)
        }
    }

    @Test
    fun `anything short of a full timestamp renders as nothing`() {
        assertNull(formatDateTime(""))
        assertNull(formatDateTime("2026-11-03"))
        assertNull(formatDateTime("2026-11-03T14:31"))
        assertNull(formatDateTime("not a timestamp at all"))
        assertNull(formatDateTime("2026-13-45T99:99:99Z"))
    }

    @Test
    fun `a timestamp without milliseconds or a zone is still a timestamp`() {
        val originalLocale = Locale.getDefault()
        val originalZone = TimeZone.getDefault()
        try {
            Locale.setDefault(Locale.UK)
            TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
            assertEquals("3 Nov 2026 at 14:31", formatDateTime("2026-11-03T14:31:09"))
        } finally {
            Locale.setDefault(originalLocale)
            TimeZone.setDefault(originalZone)
        }
    }
}
