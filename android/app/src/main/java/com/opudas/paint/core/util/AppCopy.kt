package com.opudas.paint.core.util

/*
 * The literals the app repeats, in one place.
 *
 * Every screen that offers a human route needs the same website, the same privacy
 * address and the same legal paths. Held privately in one screen they get copied
 * into the next, and the copies drift: a support address that is right on the
 * "more" screen and stale on the privacy form is worse than one that is
 * consistently wrong, because it looks maintained.
 *
 * What is deliberately NOT here: the phone number and the WhatsApp number. Those
 * come from the content bundle (`dealers.json` -> `contact`), generated from the
 * same TypeScript the website renders, so the business can change them without an
 * app release. A hardcoded number in this file would survive a rebrand and keep
 * ringing a line nobody answers.
 */
object AppCopy {

    /** The brand, as it is written. The apostrophe is part of the name, not a typo. */
    const val BRAND_NAME = "OPUDA'S PAINT"

    const val WEBSITE = "https://opudapaint.com"

    /**
     * The address every written request goes to — DSARs, corrections, complaints.
     * The same address the website's privacy notice publishes.
     */
    const val PRIVACY_EMAIL = "hello@opudapaint.com"

    const val PRIVACY_NOTICE_PATH = "/legal/privacy"
    const val TERMS_PATH = "/legal/terms"
    const val COOKIES_PATH = "/legal/cookies"

    val privacyNoticeUrl: String get() = url(PRIVACY_NOTICE_PATH)
    val termsUrl: String get() = url(TERMS_PATH)
    val cookiesUrl: String get() = url(COOKIES_PATH)

    /**
     * A path from the content bundle as something a browser can open.
     *
     * The bundle carries web paths (`/documents/opudas-matt-tds.pdf`) because that
     * is what the website's data modules contain. Where the app has the same file
     * bundled, it opens the bundled copy instead and never calls this — this is
     * for the paths it does not carry, and it needs a connection.
     */
    fun url(path: String): String = when {
        path.startsWith("http://") || path.startsWith("https://") -> path
        path.startsWith("/") -> WEBSITE + path
        else -> "$WEBSITE/$path"
    }
}
