package com.opudas.paint.feature.privacy

import com.opudas.paint.core.data.remote.DataRight
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/*
 * The two rules the data-request form applies, and the list of rights it offers.
 *
 * The rights are tested as a contract rather than as copy: `server/index.mjs`
 * refuses any `type` outside its own `RIGHTS`, so a renamed or dropped value here
 * would not fail a build — it would fail a customer's request, at the moment they
 * are trying to exercise a statutory right, with a 422 they have no way to
 * interpret.
 */
class PrivacyValidationTest {

    private val complete = PrivacyForm(
        right = DataRight.ACCESS,
        email = "ada@example.com",
        enquiryReference = "",
        note = "The phone number on my enquiry from March is no longer mine.",
    )

    @Test
    fun `a complete request has no errors`() {
        assertTrue(validate(complete).isEmpty())
    }

    @Test
    fun `an email address is required, because it is where the answer goes`() {
        assertEquals(
            "Enter an email address we can answer at, for example name@example.com.",
            validate(complete.copy(email = ""))["email"],
        )
        assertEquals(
            "Enter an email address we can answer at, for example name@example.com.",
            validate(complete.copy(email = "   "))["email"],
        )
    }

    @Test
    fun `an incomplete email is refused`() {
        val message = "Enter an email address we can answer at, for example name@example.com."
        assertEquals(message, validate(complete.copy(email = "ada@"))["email"])
        assertEquals(message, validate(complete.copy(email = "ada@example"))["email"])
        assertEquals(message, validate(complete.copy(email = "ada @example.com"))["email"])
        assertEquals(message, validate(complete.copy(email = "ada@@example.com"))["email"])
        assertNull(validate(complete.copy(email = "  ada@example.com  "))["email"])
    }

    @Test
    fun `a note may be absent but not endless`() {
        assertTrue(validate(complete.copy(note = "")).isEmpty())
        assertNull(validate(complete.copy(note = "a".repeat(2000)))["note"])
        assertEquals(
            "That is longer than 2,000 characters. The short version is enough to start.",
            validate(complete.copy(note = "a".repeat(2001)))["note"],
        )
    }

    @Test
    fun `the note limit counts the trimmed text, not the padding around it`() {
        // 2000 characters of note inside 40 characters of whitespace: allowed,
        // because what is sent is the trimmed text.
        val padded = " ".repeat(20) + "a".repeat(2000) + " ".repeat(20)
        assertNull(validate(complete.copy(note = padded))["note"])
    }

    @Test
    fun `errors come back in field order`() {
        val errors = validate(PrivacyForm(email = "", note = "a".repeat(2001)))
        assertEquals(listOf("email", "note"), errors.keys.toList())
    }

    @Test
    fun `the default right is the one most people want first`() {
        assertEquals(DataRight.ACCESS, PrivacyForm().right)
    }

    /*
     * The server's RIGHTS list, verbatim.
     *
     * These five ids are what `POST /api/privacy` accepts. Anything else is a 422.
     */
    @Test
    fun `the rights offered are exactly the ones the service accepts`() {
        assertEquals(
            listOf("access", "correction", "erasure", "objection", "portability"),
            DataRight.entries.map { it.id }.sorted(),
        )
    }

    @Test
    fun `every right explains itself, because a right nobody understands is not exercised`() {
        DataRight.entries.forEach { right ->
            assertTrue("${right.id} needs a label", right.label.isNotBlank())
            assertTrue("${right.id} needs an explanation", right.detail.isNotBlank())
            assertEquals(right, DataRight.fromId(right.id))
        }
    }

    @Test
    fun `an id the service does not accept resolves to nothing rather than to a guess`() {
        assertNull(DataRight.fromId("marketing"))
        assertNull(DataRight.fromId(""))
        assertNull(DataRight.fromId("ACCESS"))
    }
}
