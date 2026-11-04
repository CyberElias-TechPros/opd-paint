package com.opudas.paint.core.data.remote

import kotlinx.serialization.Serializable

/*
 * The service's request and response shapes, as types.
 *
 * Ported from `app/src/lib/api.ts`, which is the website's client and therefore
 * the contract as it is actually exercised in production. The envelope, the field
 * names, the honeypot and the five data rights are all the server's, not new
 * decisions: `server/index.mjs` refuses anything outside them, so a payload that
 * drifts by one field name is a 422 rather than a bug report.
 *
 * Two serialisation details carry weight:
 *
 *  - Optional fields default to null and the app's Json is configured with
 *    `encodeDefaults = false`, so an absent email is omitted from the body rather
 *    than sent as `null`. That is what the browser does with `undefined`, and the
 *    server's per-field validation is written against it.
 *  - Required fields carry no default. Giving `consent` a default of false would
 *    omit it from the body whenever it was false, and the server would refuse a
 *    submission for a field the app believed it had sent.
 */

/**
 * Every response the service sends, success or failure.
 *
 * One shape for both is the server's design and it is a good one: the caller
 * checks [ok] before touching [data], and a failure carries [error] plus
 * per-field [fields] that can be put back on the inputs that caused them.
 */
@Serializable
data class ApiEnvelope<T>(
    val ok: Boolean = false,
    val data: T? = null,
    val error: String? = null,
    val fields: Map<String, String>? = null,
)

/** A line of the calculation, sent with a quote so the desk can see the reasoning. */
@Serializable
data class QuantityLine(
    val label: String,
    val amount: Double,
    val unit: String,
)

/**
 * A quote request.
 *
 * [company] is a honeypot and must stay empty. The service accepts the submission
 * and replies normally while storing nothing, so a bot filling every field gets a
 * reference number and no queue entry — the point being that the bot cannot tell
 * it failed, and a human never sees the field at all.
 */
@Serializable
data class QuotePayload(
    val name: String,
    val phone: String,
    val city: String,
    val projectType: String,
    val consent: Boolean,
    val email: String? = null,
    val rooms: String? = null,
    val message: String? = null,
    val colors: List<String>? = null,
    val products: List<String>? = null,
    val quantities: List<QuantityLine>? = null,
    val company: String? = null,
    val source: String? = null,
)

@Serializable
data class QuoteResponse(
    val reference: String,
    val receivedAt: String,
    /** Which desk it went to, and therefore who is responsible for answering. */
    val routedTo: String,
    /** The promise, in hours, stated rather than implied. */
    val slaHours: Int,
)

/**
 * A right exercised over one's own data.
 *
 * The five values are the server's `RIGHTS` list; it refuses anything else. The
 * labels and details are the wording the website's form uses, so a request made
 * from a phone and one made from a browser describe the same thing in the same
 * words — which matters when somebody at the desk is reading both.
 */
enum class DataRight(val id: String, val label: String, val detail: String) {
    ACCESS(
        id = "access",
        label = "See what you hold",
        detail = "A copy of the personal data we hold about you, and why we hold it.",
    ),
    CORRECTION(
        id = "correction",
        label = "Correct something",
        detail = "A wrong name, number, address or measurement, put right.",
    ),
    ERASURE(
        id = "erasure",
        label = "Delete my data",
        detail = "Delete what we hold, except anything the law requires us to keep.",
    ),
    OBJECTION(
        id = "objection",
        label = "Object to a use",
        detail = "Stop a use of your data that you did not agree to.",
    ),
    PORTABILITY(
        id = "portability",
        label = "Take it elsewhere",
        detail = "Your data in a machine-readable form you can hand to another company.",
    ),
    ;

    companion object {
        fun fromId(id: String): DataRight? = entries.firstOrNull { it.id == id }
    }
}

@Serializable
data class PrivacyPayload(
    val type: String,
    val email: String,
    val enquiryReference: String? = null,
    val note: String? = null,
    val company: String? = null,
    val source: String? = null,
)

@Serializable
data class PrivacyResponse(
    val reference: String,
    val receivedAt: String,
    /** The statutory deadline, stated rather than implied. */
    val dueBy: String,
)

@Serializable
data class SubscribePayload(
    val email: String,
    val interest: String,
    val company: String? = null,
    val source: String? = null,
)

@Serializable
data class SubscribeResponse(
    val email: String,
    val resubscribed: Boolean? = null,
)

@Serializable
data class UnsubscribePayload(
    val email: String,
    val source: String? = null,
)

@Serializable
data class UnsubscribeResponse(val email: String)

/** One hit from the service's colour index. */
@Serializable
data class ColourHit(
    val id: String,
    val name: String,
    val code: String,
    val hex: String? = null,
    val family: String? = null,
)

@Serializable
data class ColourSearchResponse(val results: List<ColourHit> = emptyList())

/** `GET /api/health`, which is what the app pings to decide whether to try at all. */
@Serializable
data class HealthResponse(
    val ok: Boolean = false,
    val service: String? = null,
    val time: String? = null,
)
