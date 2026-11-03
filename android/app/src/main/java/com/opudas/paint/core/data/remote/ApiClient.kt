package com.opudas.paint.core.data.remote

import com.opudas.paint.BuildConfig
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor

/**
 * Where the app talks to, and how it identifies itself.
 *
 * The base URL is the production origin. It is a constant rather than a build
 * field because there is exactly one service and no staging environment yet —
 * when one exists, this becomes a build config field per build type, and until
 * then pretending there are two would only mean a flag nobody tests.
 *
 * Worth saying plainly: the service may not be reachable from a phone at all
 * until it is deployed, which is a documented gate rather than a defect. That is
 * precisely why submissions go to the local outbox first — the app is honest
 * about "queued, will send when there is a connection" instead of showing an
 * error for something the person cannot fix.
 */
object ApiConfig {
    const val BASE_URL = "https://opudapaint.com"

    /** The same twelve seconds the website's client allows. */
    const val TIMEOUT_SECONDS = 12L

    /**
     * Sent as `source` on submissions, so the desk can tell a phone from a
     * browser. Not a tracking id: no device identifier, no account, nothing that
     * follows a person between sessions.
     */
    const val SOURCE = "android-app"

    val USER_AGENT: String = "opudas-paint-android/${BuildConfig.VERSION_NAME}"
}

/** What the service did with a request. */
sealed interface ApiResult<out T> {

    data class Success<T>(val value: T) : ApiResult<T>

    /**
     * The service answered and refused.
     *
     * [fields] holds its per-field messages, keyed by the field name the form
     * uses, so a refusal can be put back on the input that caused it rather than
     * collapsed into one banner. Retrying the same bytes will get the same answer,
     * so the outbox does not retry these.
     */
    data class Rejected(
        val message: String,
        val fields: Map<String, String>,
        val status: Int,
    ) : ApiResult<Nothing>

    /**
     * The service could not be reached, or is not answering properly: no signal,
     * a timeout, a 5xx, a rate limit, or a reply that is not the envelope. Worth
     * trying again later, which is what the outbox does.
     */
    data class Unreachable(val reason: String) : ApiResult<Nothing>
}

/**
 * The service's HTTP surface.
 *
 * Calls are synchronous OkHttp on [Dispatchers.IO] rather than an async callback
 * chain: the only caller is a coroutine, either from a ViewModel or from the
 * worker draining the outbox, and suspending is the shape both want.
 */
class ApiClient(
    private val baseUrl: String = ApiConfig.BASE_URL,
    private val client: OkHttpClient = defaultClient(),
    private val json: Json = defaultJson(),
) {

    suspend fun submitQuote(payload: QuotePayload): ApiResult<QuoteResponse> =
        post("/api/quotes", json.encodeToString(QuotePayload.serializer(), payload), QuoteResponse.serializer())

    suspend fun submitPrivacy(payload: PrivacyPayload): ApiResult<PrivacyResponse> =
        post("/api/privacy", json.encodeToString(PrivacyPayload.serializer(), payload), PrivacyResponse.serializer())

    suspend fun subscribe(payload: SubscribePayload): ApiResult<SubscribeResponse> =
        post("/api/subscribe", json.encodeToString(SubscribePayload.serializer(), payload), SubscribeResponse.serializer())

    suspend fun unsubscribe(payload: UnsubscribePayload): ApiResult<UnsubscribeResponse> =
        post(
            "/api/unsubscribe",
            json.encodeToString(UnsubscribePayload.serializer(), payload),
            UnsubscribeResponse.serializer(),
        )

    /**
     * Server-side colour search.
     *
     * Not on the critical path: the app indexes the bundled library itself and
     * searches it offline. This exists for the case the bundle cannot cover, and
     * a failure is indistinguishable from "no results" by design — search must
     * never break a screen.
     */
    suspend fun searchColours(query: String): List<ColourHit> = withContext(Dispatchers.IO) {
        val url = (baseUrl.trimEnd('/') + "/api/search/colours").toHttpUrlOrNull()
            ?.newBuilder()
            ?.addQueryParameter("q", query)
            ?.build()
            ?: return@withContext emptyList()

        val request = Request.Builder().url(url).header("Accept", "application/json").get().build()
        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                val text = response.body?.string().orEmpty()
                val parsed = try {
                    json.decodeFromString(ColourSearchResponse.serializer(), text)
                } catch (error: SerializationException) {
                    null
                }
                parsed?.results ?: emptyList()
            }
        } catch (error: IOException) {
            emptyList()
        }
    }

    /**
     * Whether the service is answering at all.
     *
     * Used to decide between "queued" and "sending" wording, never to decide
     * whether to keep a submission: the outbox keeps it either way.
     */
    suspend fun isReachable(): Boolean = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(baseUrl.trimEnd('/') + "/api/health")
            .header("Accept", "application/json")
            .get()
            .build()
        try {
            client.newCall(request).execute().use { response -> response.isSuccessful }
        } catch (error: IOException) {
            false
        }
    }

    private suspend fun <T> post(path: String, body: String, dataSerializer: KSerializer<T>): ApiResult<T> =
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url(baseUrl.trimEnd('/') + path)
                .post(body.toRequestBody(JSON_MEDIA_TYPE))
                .header("Accept", "application/json")
                .build()
            try {
                client.newCall(request).execute().use { response ->
                    interpret(response.code, response.body?.string().orEmpty(), dataSerializer)
                }
            } catch (error: IOException) {
                // No route, DNS failure, TLS failure, timeout. The message is the
                // exception's own class name: a phone's network stack produces
                // text a customer should not be shown verbatim.
                ApiResult.Unreachable(error.javaClass.simpleName)
            }
        }

    /**
     * Read one reply.
     *
     * A 5xx or a 429 is [ApiResult.Unreachable] rather than a refusal: the
     * submission is fine and the moment is not, so the outbox keeps it pending and
     * WorkManager's backoff decides when to try again. A 4xx is a refusal with
     * reasons, and repeating it would be noise.
     */
    private fun <T> interpret(status: Int, text: String, dataSerializer: KSerializer<T>): ApiResult<T> {
        if (status >= 500 || status == HTTP_TOO_MANY_REQUESTS) {
            return ApiResult.Unreachable(reasonFor(status))
        }

        val envelope = try {
            json.decodeFromString(ApiEnvelope.serializer(dataSerializer), text)
        } catch (error: SerializationException) {
            null
        }

        if (envelope == null) {
            // A captive portal, a proxy error page, or a service that changed
            // shape. Not retried: retrying would loop against something that is
            // not going to become the envelope on its own.
            return ApiResult.Rejected(
                message = "The service sent a reply this app could not read.",
                fields = emptyMap(),
                status = status,
            )
        }

        val data = envelope.data
        if (!envelope.ok || data == null) {
            return ApiResult.Rejected(
                message = envelope.error ?: reasonFor(status),
                fields = envelope.fields ?: emptyMap(),
                status = status,
            )
        }
        return ApiResult.Success(data)
    }

    private fun reasonFor(status: Int): String = when (status) {
        HTTP_TOO_MANY_REQUESTS -> "Too many requests from this device. Wait a little and try again."
        in 500..599 -> "The enquiry service is not available right now ($status)."
        413 -> "That message is longer than the service accepts."
        400 -> "The service could not read that request."
        else -> "The service refused the request ($status)."
    }

    companion object {
        private const val HTTP_TOO_MANY_REQUESTS = 429
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

        /**
         * OkHttp's own connection retry is off, and that is deliberate.
         *
         * Retry policy belongs to the outbox, which knows whether a submission has
         * already been attempted, how many times, and whether the service refused
         * it with reasons. A transport layer retrying underneath that turns "three
         * attempts" into nine and makes the backoff meaningless.
         */
        fun defaultClient(): OkHttpClient {
            val builder = OkHttpClient.Builder()
                .callTimeout(ApiConfig.TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .connectTimeout(ApiConfig.TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .readTimeout(ApiConfig.TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .writeTimeout(ApiConfig.TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .retryOnConnectionFailure(false)

            if (BuildConfig.DEBUG) {
                /*
                 * BASIC, never BODY: the bodies are names, phone numbers, email
                 * addresses and the contents of somebody's privacy request. A
                 * debug log on a shared test phone is still a record of personal
                 * data written somewhere nobody reviewed, and the method, URL and
                 * status are all anyone debugging a transport problem needs.
                 */
                builder.addInterceptor(
                    HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC },
                )
            }
            return builder.build()
        }

        /**
         * Lenient on the way in, strict on the way out.
         *
         * Unknown keys are ignored so a service that adds a field does not break
         * installed builds. Defaults are not encoded and explicit nulls are not
         * written, so an absent optional field is omitted from the body exactly as
         * the browser omits an `undefined` one — which is what the server's
         * per-field validation is written against.
         */
        fun defaultJson(): Json = Json {
            ignoreUnknownKeys = true
            encodeDefaults = false
            explicitNulls = false
            isLenient = false
        }
    }
}
