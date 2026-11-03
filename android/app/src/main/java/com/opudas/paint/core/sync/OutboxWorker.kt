package com.opudas.paint.core.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.opudas.paint.container
import com.opudas.paint.core.data.local.OutboxDao
import com.opudas.paint.core.data.local.OutboxEntity
import com.opudas.paint.core.data.local.SubmissionKind
import com.opudas.paint.core.data.local.SubmissionState
import com.opudas.paint.core.data.remote.ApiClient
import com.opudas.paint.core.data.remote.ApiResult
import com.opudas.paint.core.data.remote.PrivacyPayload
import com.opudas.paint.core.data.remote.PrivacyResponse
import com.opudas.paint.core.data.remote.QuotePayload
import com.opudas.paint.core.data.remote.QuoteResponse
import com.opudas.paint.core.data.remote.SubscribePayload
import com.opudas.paint.core.data.remote.SubscribeResponse
import com.opudas.paint.core.data.remote.UnsubscribePayload
import com.opudas.paint.core.data.remote.UnsubscribeResponse
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

/** What one delivery attempt concluded. */
private sealed interface Delivery {

    /** The service accepted it. [reference] is the service's own, shown to the person. */
    data class Accepted(val reference: String?) : Delivery

    /**
     * The service refused it, with reasons.
     *
     * Terminal. The bytes will not become acceptable by being sent again, so the
     * entry leaves the queue as failed and the person is told what the service
     * said, field by field, alongside the phone and WhatsApp routes that do work.
     */
    data class Refused(val message: String, val fieldErrors: String?) : Delivery

    /** Nothing got through. The entry stays pending and is worth trying again. */
    data class Unreachable(val reason: String) : Delivery
}

/**
 * Drains the outbox.
 *
 * Runs when WorkManager says there is a network, which is the whole of the sync
 * design: a submission written in a basement with no signal sits in the queue, and
 * the same bytes go out when connectivity returns — hours later if need be, and
 * after a process death or a reboot, because WorkManager persists the request.
 *
 * Three rules shape it:
 *
 *  - Oldest first, and a refusal of one entry does not stop the others. A queue
 *    that gives up on the second item because the first was rejected is a queue
 *    that loses everything behind one bad phone number.
 *  - Unreachable stays pending; refused becomes failed. Retrying what the service
 *    explained is noise, and giving up on a timeout loses real enquiries.
 *  - Attempts are capped. An undeployed service, or one behind a captive portal,
 *    would otherwise keep this worker alive forever in the background, draining a
 *    battery to accomplish nothing. At the cap the entry fails with wording that
 *    says the service could not be reached rather than that the submission was
 *    wrong, and offers the desk's phone number.
 */
class OutboxWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val container = applicationContext.container
        val dao = container.database.outboxDao()
        val api = container.api
        val json = container.json

        val entries = dao.pending()
        if (entries.isEmpty()) {
            prune(dao)
            return Result.success()
        }

        var anyUnreachable = false
        for (entry in entries) {
            when (val outcome = deliver(api, json, entry)) {
                is Delivery.Accepted ->
                    dao.markSent(entry.id, outcome.reference, System.currentTimeMillis())

                is Delivery.Refused ->
                    dao.markAttempted(entry.id, SubmissionState.FAILED.id, outcome.message, outcome.fieldErrors)

                is Delivery.Unreachable -> {
                    val attemptsAfter = entry.attempts + 1
                    if (attemptsAfter >= MAX_DELIVERY_ATTEMPTS) {
                        dao.markAttempted(
                            entry.id,
                            SubmissionState.FAILED.id,
                            "The enquiry service could not be reached after $attemptsAfter attempts. " +
                                "Please call or WhatsApp the desk instead — nothing has been sent.",
                            null,
                        )
                    } else {
                        dao.markAttempted(entry.id, SubmissionState.PENDING.id, outcome.reason, null)
                        anyUnreachable = true
                    }
                }
            }
        }

        prune(dao)
        // Retry only if something is still waiting because of the network. A run
        // where every entry was accepted or refused is finished, and asking
        // WorkManager to come back would wake the radio for nothing.
        return if (anyUnreachable) Result.retry() else Result.success()
    }

    private suspend fun deliver(api: ApiClient, json: Json, entry: OutboxEntity): Delivery {
        val kind = SubmissionKind.fromId(entry.kind)
        return when (kind) {
            SubmissionKind.QUOTE -> {
                val payload = decode(json, QuotePayload.serializer(), entry.payload)
                    ?: return unreadable()
                toDelivery(json, api.submitQuote(payload))
            }

            SubmissionKind.PRIVACY -> {
                val payload = decode(json, PrivacyPayload.serializer(), entry.payload)
                    ?: return unreadable()
                toDelivery(json, api.submitPrivacy(payload))
            }

            SubmissionKind.SUBSCRIBE -> {
                val payload = decode(json, SubscribePayload.serializer(), entry.payload)
                    ?: return unreadable()
                toDelivery(json, api.subscribe(payload))
            }

            SubmissionKind.UNSUBSCRIBE -> {
                val payload = decode(json, UnsubscribePayload.serializer(), entry.payload)
                    ?: return unreadable()
                toDelivery(json, api.unsubscribe(payload))
            }
        }
    }

    private fun toDelivery(json: Json, result: ApiResult<*>): Delivery = when (result) {
        is ApiResult.Success<*> -> Delivery.Accepted(referenceOf(result.value))
        is ApiResult.Rejected -> Delivery.Refused(result.message, encodeFields(json, result.fields))
        is ApiResult.Unreachable -> Delivery.Unreachable(result.reason)
    }

    /**
     * A payload that cannot be read back is refused, not retried.
     *
     * The bytes were written by this app and are corrupt or from a schema this
     * build does not understand. Sending them again will fail the same way
     * forever, and the person should be told rather than left watching a spinner.
     */
    private fun unreadable(): Delivery = Delivery.Refused(
        message = "This submission could not be read back from the queue on this device.",
        fieldErrors = null,
    )

    /**
     * Which reference to show, per kind.
     *
     * Quote and privacy requests get one from the service (`OPD-…`, `DSAR-…`).
     * Sign-ups and opt-outs get no reference, so the address stands in for it: the
     * question those answer is "was it this email?", not "which ticket?".
     */
    private fun referenceOf(value: Any?): String? = when (value) {
        is QuoteResponse -> value.reference
        is PrivacyResponse -> value.reference
        is SubscribeResponse -> value.email
        is UnsubscribeResponse -> value.email
        else -> null
    }

    private fun encodeFields(json: Json, fields: Map<String, String>): String? =
        if (fields.isEmpty()) {
            null
        } else {
            json.encodeToString(
                MapSerializer(String.serializer(), String.serializer()),
                fields,
            )
        }

    private fun <T> decode(json: Json, serializer: KSerializer<T>, payload: String): T? = try {
        json.decodeFromString(serializer, payload)
    } catch (error: SerializationException) {
        null
    }

    /**
     * Forget accepted submissions older than [SENT_RETENTION_DAYS].
     *
     * This is the phone's own scratch copy of a conversation it has finished
     * having — the enquiry itself is retained by the service under its own
     * documented schedule. Keeping it here for a month answers "did that go
     * through, and what was the reference?"; keeping it for two years would be
     * personal data on a device with no reason left to hold it.
     */
    private suspend fun prune(dao: OutboxDao) {
        val cutoff = System.currentTimeMillis() - SENT_RETENTION_DAYS * MILLIS_PER_DAY
        dao.deleteSentBefore(cutoff)
    }

    companion object {
        private const val MAX_DELIVERY_ATTEMPTS = 20
        private const val SENT_RETENTION_DAYS = 30L
        private const val MILLIS_PER_DAY = 24L * 60 * 60 * 1000
    }
}
