package com.opudas.paint.core.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * What kind of submission is waiting to be delivered.
 *
 * One table for all four rather than four tables: they share a lifecycle (queued,
 * attempted, accepted or refused), they share a retry policy, and the desk-facing
 * question "what has this phone tried to send?" has one answer. The [id] is what
 * goes over the wire as the discriminator, so it is part of the contract with the
 * server's routes and not a display detail.
 */
enum class SubmissionKind(val id: String, val label: String) {
    QUOTE("quote", "Quote request"),
    PRIVACY("privacy", "Privacy request"),
    SUBSCRIBE("subscribe", "Newsletter sign-up"),
    UNSUBSCRIBE("unsubscribe", "Opt-out"),
    ;

    companion object {
        fun fromId(id: String): SubmissionKind = entries.firstOrNull { it.id == id } ?: QUOTE
    }
}

/** Where a submission has got to. */
enum class SubmissionState(val id: String) {
    /** Written locally, not yet accepted by the service. */
    PENDING("pending"),

    /** Accepted: the service returned a reference. */
    SENT("sent"),

    /**
     * Refused, or never reached.
     *
     * Deliberately not retried forever: a 422 with per-field messages means the
     * submission is wrong, not that the network is bad, and retrying it every
     * fifteen minutes would keep knocking on a door that has said no with reasons.
     * A refused submission stays visible to the person who made it, with the
     * reason, and the app offers the phone and WhatsApp routes instead.
     */
    FAILED("failed"),
    ;

    companion object {
        fun fromId(id: String): SubmissionState = entries.firstOrNull { it.id == id } ?: PENDING
    }
}

/**
 * One submission, held on the device until the service accepts it.
 *
 * This is the offline-first half of the promise. A quote written in a basement
 * with no signal is not lost and is not silently discarded: it is written here
 * first, on the same transaction as the tap, and delivered later by
 * [com.opudas.paint.core.sync.OutboxWorker] when there is a network.
 *
 * [payload] is the request body already serialised — the exact JSON the server
 * expects, including the honeypot field left empty. Serialising at write time
 * rather than at send time means the bytes that go out are the bytes the person
 * approved on screen, and a later change to a model class cannot quietly rewrite
 * a submission that has been sitting in the queue for two days.
 *
 * Timestamps are epoch millis rather than formatted strings: this is a queue, and
 * ordering and retention arithmetic are what it needs them for. Formatting is the
 * presentation layer's job, in the visitor's locale.
 */
@Entity(tableName = "outbox")
data class OutboxEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val kind: String,
    val payload: String,
    val createdAt: Long,
    val attempts: Int = 0,
    val state: String = "pending",
    /** The service's own explanation of the last refusal, shown to the person verbatim. */
    val lastError: String? = null,
    /** Per-field refusals, as JSON: `{"phone":"Enter a phone number"}`. */
    val fieldErrors: String? = null,
    /** The service's reference once accepted — `OPD-…` or `DSAR-…`. */
    val reference: String? = null,
    val sentAt: Long? = null,
)
