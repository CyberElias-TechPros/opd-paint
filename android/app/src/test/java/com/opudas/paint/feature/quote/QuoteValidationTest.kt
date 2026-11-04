package com.opudas.paint.feature.quote

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/*
 * The six rules the enquiry form applies, ported from the website.
 *
 * These are worth testing on their own rather than through a ViewModel because
 * they are the difference between an enquiry that reaches a desk and one that
 * comes back refused: the service validates the same fields, and a rule that is
 * stricter here than there wastes the person's time, while one that is looser
 * here sends something the service will reject after the app has already said
 * "saved".
 */
class QuoteValidationTest {

    private val complete = QuoteForm(
        name = "Ada Obi",
        phone = "+234 803 000 0000",
        email = "ada@example.com",
        city = "Port Harcourt",
        projectType = "interior-whole",
        consent = true,
    )

    @Test
    fun `a complete form has no errors`() {
        assertTrue(validate(complete).isEmpty())
    }

    @Test
    fun `email is optional and blank means absent`() {
        assertTrue(validate(complete.copy(email = "")).isEmpty())
        assertTrue(validate(complete.copy(email = "   ")).isEmpty())
    }

    @Test
    fun `a name of one character is not a name to reply to`() {
        assertEquals("Please give us a name to reply to.", validate(complete.copy(name = "A"))["name"])
    }

    @Test
    fun `whitespace around a name does not count towards it`() {
        assertEquals("Please give us a name to reply to.", validate(complete.copy(name = "  A  "))["name"])
        assertNull(validate(complete.copy(name = "  Ada  "))["name"])
    }

    @Test
    fun `a phone number needs seven digits`() {
        assertEquals(
            "Enter a phone number we can reach you on.",
            validate(complete.copy(phone = "0803 00"))["phone"],
        )
    }

    @Test
    fun `punctuation and country codes are not counted as digits`() {
        // Thirteen digits here, once the plus, the spaces and the parentheses go.
        assertNull(validate(complete.copy(phone = "+234 (803) 000-0000"))["phone"])
        // Six digits: the same shape, and short of the seven the rule needs.
        assertEquals(
            "Enter a phone number we can reach you on.",
            validate(complete.copy(phone = "+234 (80) 0"))["phone"],
        )
        // Seven exactly, with punctuation the rule must look past.
        assertNull(validate(complete.copy(phone = "(0803) 00-0"))["phone"])
    }

    @Test
    fun `a number longer than fifteen digits is probably a mistake`() {
        assertEquals(
            "That number looks too long — check the country code.",
            validate(complete.copy(phone = "0".repeat(16)))["phone"],
        )
    }

    @Test
    fun `fifteen digits is still accepted`() {
        assertNull(validate(complete.copy(phone = "0".repeat(15)))["phone"])
    }

    @Test
    fun `an incomplete email is refused but an absent one is not`() {
        assertEquals("That email address looks incomplete.", validate(complete.copy(email = "ada@"))["email"])
        assertEquals("That email address looks incomplete.", validate(complete.copy(email = "ada@example"))["email"])
        assertEquals(
            "That email address looks incomplete.",
            validate(complete.copy(email = "ada @example.com"))["email"],
        )
        assertNull(validate(complete.copy(email = "ada@example.com"))["email"])
    }

    @Test
    fun `a city needs two characters`() {
        assertEquals("Which city or area is the project in?", validate(complete.copy(city = "P"))["city"])
        assertNull(validate(complete.copy(city = "PH"))["city"])
    }

    @Test
    fun `a project type is required because it decides who answers`() {
        assertEquals(
            "Choose the closest project type.",
            validate(complete.copy(projectType = ""))["projectType"],
        )
    }

    @Test
    fun `consent is required before anything is stored`() {
        assertEquals(
            "We need your agreement before we can store and reply to your enquiry.",
            validate(complete.copy(consent = false))["consent"],
        )
    }

    @Test
    fun `an empty form reports every rule it breaks, in field order`() {
        val errors = validate(QuoteForm())
        // Name, phone, city, project type, consent — and not email, which is
        // optional. The order matters: the website focuses the first one.
        assertEquals(
            listOf("name", "phone", "city", "projectType", "consent"),
            errors.keys.toList(),
        )
    }

    /*
     * The routing contract.
     *
     * `routeFor()` in server/index.mjs switches on four of these values and
     * defaults everything else to the colour desk in Port Harcourt. The service
     * only validates that *a* project type is present, so renaming one of these
     * would not fail a build or refuse a submission — an exterior specification
     * would simply stop reaching the technical desk, and a dealer enquiry would
     * stop getting its forty-eight hours. Nothing else in the app would notice.
     */
    @Test
    fun `the project types the service routes on are still offered`() {
        val values = PROJECT_TYPES.map { it.value }
        assertTrue("exterior must be offered: it routes to the technical desk", values.contains("exterior"))
        assertTrue("trade must be offered: it routes to the trade desk", values.contains("trade"))
        assertTrue("sample must be offered: it routes to the sample desk", values.contains("sample"))
        assertTrue("dealer must be offered: it routes with 48 hours", values.contains("dealer"))
    }

    @Test
    fun `every project type has a value and a label a person can read`() {
        assertEquals(8, PROJECT_TYPES.size)
        PROJECT_TYPES.forEach { option ->
            assertTrue(option.value.isNotBlank())
            assertTrue(option.label.isNotBlank())
            // The value goes to a service and into a CSV a person reads; the label
            // goes on a screen. They are different jobs and neither may be empty.
            assertTrue(option.value.none { it.isWhitespace() })
        }
    }

    @Test
    fun `no two project types share a value`() {
        val values = PROJECT_TYPES.map { it.value }
        assertEquals(values.size, values.toSet().size)
    }
}
