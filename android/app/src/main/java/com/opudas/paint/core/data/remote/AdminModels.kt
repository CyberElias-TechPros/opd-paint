package com.opudas.paint.core.data.remote

import kotlinx.serialization.Serializable

/**
 * One enquiry, as the inbox may show it.
 *
 * This is the field list `publicEnquiry` in `server/index.mjs` returns, and the two
 * are held in step by a server test that fails if that key set changes in either
 * direction. Nothing here is optional because the app would like it to be: `email`,
 * `rooms` and `message` are genuinely absent from plenty of enquiries, and the lists
 * are empty rather than missing when a customer named no colours.
 *
 * The quantities reuse [QuantityLine] rather than declaring a second shape for the
 * same three fields. The calculator writes them, the enquiry carries them, and the
 * desk reads them back — one type is the only way those stay the same thing.
 */
@Serializable
data class InboxEnquiry(
    val reference: String,
    val receivedAt: String?,
    val name: String,
    val phone: String,
    val email: String?,
    val city: String,
    val projectType: String,
    val rooms: String?,
    val colors: List<String>,
    val products: List<String>,
    val quantities: List<QuantityLine>,
    val routedTo: String?,
    val slaHours: Int?,
    val message: String?,
    val source: String?,
)

/**
 * One page of the inbox, with the summary the page above the table already carries.
 *
 * `total` is the whole log and `returned` is this page, so a screen can say "50 of
 * 213" without counting anything itself, and can tell an empty inbox from a page that
 * ran out — which are different things to tell a person.
 */
@Serializable
data class InboxPage(
    val enquiries: List<InboxEnquiry>,
    val returned: Int,
    val total: Int,
    val limit: Int,
    /** Enquiries per desk, as the routing put them there. */
    val desks: Map<String, Int>,
    val receivedToday: Int,
)
