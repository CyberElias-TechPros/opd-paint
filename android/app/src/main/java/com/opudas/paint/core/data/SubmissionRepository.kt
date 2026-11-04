package com.opudas.paint.core.data

import com.opudas.paint.core.data.local.OutboxDao
import com.opudas.paint.core.data.local.OutboxEntity
import com.opudas.paint.core.data.local.SubmissionKind
import com.opudas.paint.core.data.local.SubmissionState
import com.opudas.paint.core.data.remote.DataRight
import com.opudas.paint.core.data.remote.PrivacyPayload
import com.opudas.paint.core.data.remote.QuotePayload
import com.opudas.paint.core.data.remote.SubscribePayload
import com.opudas.paint.core.data.remote.UnsubscribePayload
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * One entry in the queue, ready for a screen.
 *
 * [summary] is a sentence rather than a payload because the thing a person needs
 * from a queue is "which of my enquiries is this?", not JSON. [attempts] is shown
 * too: a submission that has been tried eleven times is a different situation from
 * one that has never had a signal, and pretending they are the same is how an app
 * ends up telling somebody to "check your connection" about a request the service
 * has already refused three times with reasons.
 */
data class OutboxItem(
    val id: Long,
    val kind: SubmissionKind,
    val state: SubmissionState,
    val summary: String,
    val createdAt: Long,
    val attempts: Int,
    val lastError: String?,
    /** Per-field refusals as JSON, so they can go back on the inputs that caused them. */
    val fieldErrors: String?,
    val reference: String?,
    /** The service's reply as JSON, for an accepted submission. */
    val responseJson: String?,
    val sentAt: Long?,
) {
    val isPending: Boolean
        get() = state == SubmissionState.PENDING

    val isSent: Boolean
        get() = state == SubmissionState.SENT
}

/**
 * Writing submissions down, and knowing what happened to them.
 *
 * Every write here is local and immediate: the tap that sends a quote returns as
 * soon as the row is committed, whether or not there is a network, and delivery
 * happens afterwards. That ordering is the whole point. A form that waits for the
 * service before it tells the person anything is a form that loses enquiries in
 * basements, on site, and anywhere else the signal is worse than the person
 * expected — and the failure looks identical to "nothing happened".
 *
 * Nothing in this class talks to the network. The worker does, so the queue can be
 * drained on a schedule, on a connection change, or from a test, without a screen
 * being involved.
 */
class SubmissionRepository(
    private val dao: OutboxDao,
    private val json: Json,
    private val scheduler: OutboxScheduler,
) {

    suspend fun enqueueQuote(payload: QuotePayload): Long =
        enqueue(SubmissionKind.QUOTE, json.encodeToString(QuotePayload.serializer(), payload))

    suspend fun enqueuePrivacy(payload: PrivacyPayload): Long =
        enqueue(SubmissionKind.PRIVACY, json.encodeToString(PrivacyPayload.serializer(), payload))

    suspend fun enqueueSubscribe(payload: SubscribePayload): Long =
        enqueue(SubmissionKind.SUBSCRIBE, json.encodeToString(SubscribePayload.serializer(), payload))

    suspend fun enqueueUnsubscribe(payload: UnsubscribePayload): Long =
        enqueue(SubmissionKind.UNSUBSCRIBE, json.encodeToString(UnsubscribePayload.serializer(), payload))

    fun observeOutbox(): Flow<List<OutboxItem>> =
        dao.observeAll().map { entries -> entries.map { it.toItem() } }

    fun observePendingCount(): Flow<Int> = dao.observePendingCount()

    /** Ask for another delivery attempt on one entry, without counting the tap as an attempt. */
    suspend fun retry(id: Long) {
        dao.markPending(id)
        scheduler.requestSync()
    }

    /**
     * Drop an entry.
     *
     * Only offered for something the person decided not to send, or something the
     * service refused and they have since phoned in. It is a deletion of their own
     * draft on their own device, which is theirs to make.
     */
    suspend fun discard(id: Long) = dao.delete(id)

    /** Ask for a delivery attempt on everything pending. */
    fun requestSync() = scheduler.requestSync()

    private suspend fun enqueue(kind: SubmissionKind, payload: String): Long {
        val id = dao.insert(
            OutboxEntity(
                kind = kind.id,
                payload = payload,
                createdAt = System.currentTimeMillis(),
                state = SubmissionState.PENDING.id,
            ),
        )
        // Asked for after the insert commits, never before: scheduling first could
        // have the worker run and find nothing, then report the queue as empty
        // while the entry it was meant to send is still being written.
        scheduler.requestSync()
        return id
    }

    private fun OutboxEntity.toItem(): OutboxItem = OutboxItem(
        id = id,
        kind = SubmissionKind.fromId(kind),
        state = SubmissionState.fromId(state),
        summary = summarize(SubmissionKind.fromId(kind), payload),
        createdAt = createdAt,
        attempts = attempts,
        lastError = lastError,
        fieldErrors = fieldErrors,
        reference = reference,
        responseJson = responseJson,
        sentAt = sentAt,
    )

    /**
     * A line of text for the queue.
     *
     * Reads the stored payload back rather than keeping a second copy of the
     * summary in its own column: the payload is the source of truth for what was
     * submitted, and a denormalised summary is a field that can disagree with it.
     * If the payload cannot be read — a hand-edited database, a schema from an
     * older build — the entry still appears, described by its kind, because hiding
     * a queued submission is worse than describing it roughly.
     */
    private fun summarize(kind: SubmissionKind, payload: String): String = try {
        when (kind) {
            SubmissionKind.QUOTE -> {
                val quote = json.decodeFromString(QuotePayload.serializer(), payload)
                "Quote for ${quote.name} in ${quote.city} — ${quote.projectType}"
            }

            SubmissionKind.PRIVACY -> {
                val request = json.decodeFromString(PrivacyPayload.serializer(), payload)
                val right = DataRight.fromId(request.type)?.label ?: request.type
                "$right for ${request.email}"
            }

            SubmissionKind.SUBSCRIBE -> {
                val signUp = json.decodeFromString(SubscribePayload.serializer(), payload)
                "Newsletter sign-up for ${signUp.email}"
            }

            SubmissionKind.UNSUBSCRIBE -> {
                val optOut = json.decodeFromString(UnsubscribePayload.serializer(), payload)
                "Opt-out for ${optOut.email}"
            }
        }
    } catch (error: SerializationException) {
        kind.label
    }
}
