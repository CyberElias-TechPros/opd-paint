package com.opudas.paint.core.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log

/*
 * The ways this app hands a customer to a human.
 *
 * Every journey in the product ends in a phone call, a WhatsApp message, a dealer
 * visit or a written enquiry — there is no cart and no checkout, which is a scope
 * decision recorded in `docs/adr/0003-no-e-commerce-at-launch.md`. So these few
 * functions are the conversion path, and each one returns whether it worked
 * rather than throwing, because "the button did nothing" is the worst possible
 * failure on the one screen that matters.
 *
 * Every intent used here is declared in the manifest's `<queries>` block. Without
 * that, Android 11 and newer report no activity found even when WhatsApp is
 * installed, and the failure looks like a missing app rather than a missing
 * declaration.
 */

private const val TAG = "Intents"

/** Open the dialler with the number already typed. Never places the call itself. */
fun Context.dial(number: String): Boolean {
    val digits = number.filter { it.isDigit() || it == '+' }
    return startActivitySafely(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits")))
}

/**
 * Open WhatsApp with a message already written.
 *
 * Tries the app first, then `wa.me` in a browser, then gives up and reports
 * failure so the caller can show the number to copy instead. Two of the three
 * paths need no WhatsApp install, which matters because the fallback has to work
 * on the phone the customer is actually holding.
 */
fun Context.openWhatsApp(number: String, message: String): Boolean {
    val digits = number.filter { it.isDigit() }
    val encoded = Uri.encode(message)
    val candidates = listOf(
        Intent(Intent.ACTION_VIEW, Uri.parse("whatsapp://send?phone=$digits&text=$encoded")),
        Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$digits?text=$encoded")),
    )
    return candidates.any { startActivitySafely(it) }
}

fun Context.sendEmail(address: String, subject: String, body: String = ""): Boolean {
    val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$address")).apply {
        putExtra(Intent.EXTRA_SUBJECT, subject)
        putExtra(Intent.EXTRA_TEXT, body)
    }
    return startActivitySafely(intent)
}

/**
 * Open a map app at a dealer's coordinates.
 *
 * A `geo:` URI rather than a Google Maps URL, so whichever map the customer has
 * is the one that opens — and so a dealer visit is not routed through a third
 * party's web redirect.
 */
fun Context.openDirections(lat: Double, lng: Double, label: String): Boolean {
    val geo = Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng(${Uri.encode(label)})"))
    if (startActivitySafely(geo)) return true
    // A device with no map app at all falls back to the web directions link,
    // which is the same URL the website's dealer page offers.
    val web = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$lat,$lng"),
    )
    return startActivitySafely(web)
}

fun Context.openWeb(url: String): Boolean =
    startActivitySafely(Intent(Intent.ACTION_VIEW, Uri.parse(url)))

/** Hand a project checklist or a colour list to any app that takes text. */
fun Context.shareText(subject: String, text: String): Boolean {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, subject)
        putExtra(Intent.EXTRA_TEXT, text)
    }
    return startActivitySafely(Intent.createChooser(intent, subject))
}

/**
 * A saved PNG from the visualiser, offered to any app that takes an image.
 *
 * Takes a content URI rather than a file path: sharing a `file://` URI to another
 * app throws `FileUriExposedException` on API 24 and above, which is every device
 * this app supports.
 */
fun Context.shareImage(uri: Uri, caption: String): Boolean {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "image/png"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_TEXT, caption)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    return startActivitySafely(Intent.createChooser(intent, caption))
}

private fun Context.startActivitySafely(intent: Intent): Boolean = try {
    startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    true
} catch (error: ActivityNotFoundException) {
    // Not a bug in the app: the phone has nothing that handles this. The caller
    // says so in words and offers the alternative — a number to copy, a website.
    Log.w(TAG, "no activity for ${intent.action} ${intent.data}")
    false
} catch (error: SecurityException) {
    Log.w(TAG, "refused ${intent.action} ${intent.data}", error)
    false
}
