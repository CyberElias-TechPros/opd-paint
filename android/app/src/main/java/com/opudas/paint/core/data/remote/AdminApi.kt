package com.opudas.paint.core.data.remote

import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.Credentials
import okhttp3.FormBody
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * How far a sign-in got.
 *
 * Four outcomes rather than a boolean, because the honest answer to "did that work"
 * depends on what the person can do next: a code they can enter, a password they got
 * wrong, and an inbox that is not configured are three different instructions.
 */
sealed interface AdminOutcome {
    /** Credentials accepted and no second factor on the account: signed in. */
    data object Ready : AdminOutcome

    /** Credentials accepted, and a six-digit code is now required. */
    data object NeedsCode : AdminOutcome

    /** The service answered and said no. Repeating it will get the same answer. */
    data class Refused(val message: String) : AdminOutcome

    /** The inbox could not be reached, or is not there at all. Worth another try later. */
    data class Unavailable(val reason: String) : AdminOutcome
}

/**
 * Cookies for one sign-in, held in memory and nowhere else.
 *
 * The session cookie is a signed token that opens an inbox full of other people's
 * names, phone numbers and messages. A phone is handed to somebody else, is lost, and
 * is backed up to a cloud account nobody at this business controls — so the token is
 * not written to disk, not put in DataStore, and not left for a restore to bring back.
 * Navigating away keeps it; the process ending clears it.
 *
 * Expiry is honoured on the way out as well as in, so a cookie the service cleared with
 * Max-Age=0 is dropped rather than replayed.
 *
 * The lists are plain ArrayLists guarded by synchronized, not concurrent collections,
 * and that is not a stylistic preference. Pruning an expired cookie needs
 * MutableList.removeAll with a predicate, whose Kotlin implementation removes through
 * a ListIterator — and CopyOnWriteArrayList's iterator throws
 * UnsupportedOperationException from remove. A concurrent collection here would have
 * been a crash on the first response that set a cookie, which is to say the first time
 * anybody signed in.
 */
class MemoryCookieJar : CookieJar {

    private val store = HashMap<String, MutableList<Cookie>>()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val now = System.currentTimeMillis()
        synchronized(this) {
            val forHost = store.getOrPut(url.host) { ArrayList() }
            cookies.forEach { cookie ->
                forHost.removeAll { it.name == cookie.name }
                if (cookie.expiresAt > now) {
                    forHost.add(cookie)
                }
            }
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        synchronized(this) {
            val forHost = store[url.host] ?: return emptyList()
            forHost.removeAll { it.expiresAt <= now }
            return forHost.filter { url.encodedPath.startsWith(it.path) }
        }
    }

    /** Whether a live cookie with this name is being held. */
    fun has(name: String): Boolean = synchronized(this) {
        store.values.any { list -> list.any { it.name == name } }
    }

    fun clear() {
        synchronized(this) {
            store.clear()
        }
    }
}

/**
 * The admin inbox over HTTP.
 *
 * The flow is the one the service already had, driven from a phone instead of a
 * browser: credentials to `GET /admin`, which either signs an account with no second
 * factor straight in or hands back a five-minute challenge cookie; a form-encoded code
 * to `POST /admin/second-factor`, which exchanges that for the signed session cookie;
 * then `GET /admin/enquiries.json`, a page of the enquiries in the same envelope every
 * other route uses.
 *
 * Those endpoints live under `/admin` because the session cookie is scoped to that
 * path. Putting the JSON under `/api/` instead would have meant either a cookie the
 * browser and OkHttp would never send there, or widening the cookie's path and
 * exposing it to the rest of the service to suit one endpoint.
 *
 * Redirects are not followed. A `303` from the second-factor post *is* the success
 * signal, and a client that followed it would see a `200` and be unable to tell that
 * from a page it was never authorised to see.
 */
class AdminApi(
    private val baseUrl: String = ApiConfig.BASE_URL,
    private val cookies: MemoryCookieJar = MemoryCookieJar(),
    private val client: OkHttpClient = buildClient(cookies),
) {

    /**
     * The same JSON configuration every other route uses, rather than a second one.
     *
     * The settings are the contract — unknown keys ignored so a service that adds a
     * field does not break an installed build, defaults and explicit nulls not written
     * — and a contract with two owners is a contract that drifts.
     */
    private val json = ApiClient.defaultJson()

    /** Whether the service still holds a session for this process. */
    val isSignedIn: Boolean
        get() = cookies.has(SESSION_COOKIE)

    /**
     * Present credentials.
     *
     * Any cookie from a previous attempt is dropped first: a stale challenge would
     * otherwise let a code unlock an account whose password was typed wrong the second
     * time, which is not a state anybody intended to reach.
     */
    suspend fun signIn(name: String, password: String): AdminOutcome = withContext(Dispatchers.IO) {
        cookies.clear()
        val request = Request.Builder()
            .url(baseUrl.trimEnd('/') + ADMIN_PATH)
            .header("Authorization", Credentials.basic(name, password))
            .header("Accept", "text/html")
            .build()
        try {
            client.newCall(request).execute().use { response ->
                when {
                    response.code == 404 -> AdminOutcome.Unavailable(NOT_AVAILABLE)
                    response.code == 401 -> AdminOutcome.Refused(CREDENTIALS_REFUSED)
                    response.code == 429 -> AdminOutcome.Refused(TOO_MANY_ATTEMPTS)
                    response.code >= 500 -> AdminOutcome.Unavailable(SERVICE_DOWN)
                    !response.isSuccessful -> AdminOutcome.Refused(refusedWith(response.code))
                    cookies.has(SESSION_COOKIE) -> AdminOutcome.Ready
                    cookies.has(CHALLENGE_COOKIE) -> AdminOutcome.NeedsCode
                    else -> AdminOutcome.Refused(NO_CHALLENGE)
                }
            }
        } catch (error: IOException) {
            AdminOutcome.Unavailable(error.javaClass.simpleName)
        }
    }

    /** Exchange a six-digit code for the session. Needs the challenge from [signIn]. */
    suspend fun unlock(code: String): AdminOutcome = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(baseUrl.trimEnd('/') + SECOND_FACTOR_PATH)
            .post(FormBody.Builder().add("code", code).build())
            .build()
        try {
            client.newCall(request).execute().use { response ->
                when {
                    // The service clears the challenge and sets the session in the
                    // same response it redirects with.
                    response.code == 303 && cookies.has(SESSION_COOKIE) -> AdminOutcome.Ready
                    response.code == 401 -> AdminOutcome.Refused(CODE_REFUSED)
                    response.code == 429 -> AdminOutcome.Refused(TOO_MANY_ATTEMPTS)
                    response.code == 404 -> AdminOutcome.Unavailable(NOT_AVAILABLE)
                    response.code >= 500 -> AdminOutcome.Unavailable(SERVICE_DOWN)
                    cookies.has(SESSION_COOKIE) -> AdminOutcome.Ready
                    else -> AdminOutcome.Refused(refusedWith(response.code))
                }
            }
        } catch (error: IOException) {
            AdminOutcome.Unavailable(error.javaClass.simpleName)
        }
    }

    /** One page of the inbox, newest first. */
    suspend fun enquiries(limit: Int = DEFAULT_PAGE): ApiResult<InboxPage> =
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url(
                    baseUrl.trimEnd('/') + ENQUIRIES_PATH +
                        "?limit=" + limit.coerceIn(1, MAX_PAGE),
                )
                .header("Accept", "application/json")
                .build()
            try {
                client.newCall(request).execute().use { response ->
                    interpret(response.code, response.body?.string().orEmpty())
                }
            } catch (error: IOException) {
                ApiResult.Unreachable(error.javaClass.simpleName)
            }
        }

    /**
     * Tell the service to clear the session, then drop the local copy.
     *
     * The local clear happens whether or not the call reached anything: a sign-out that
     * failed because there was no signal still has to leave this phone holding nothing.
     */
    suspend fun signOut() {
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url(baseUrl.trimEnd('/') + SIGN_OUT_PATH)
                .post(FormBody.Builder().build())
                .build()
            try {
                client.newCall(request).execute().use { }
            } catch (error: IOException) {
                // Nothing to do: the cookies are cleared below either way.
            }
        }
        cookies.clear()
    }

    /**
     * Read one inbox reply.
     *
     * The transport rules are the app's, not [ApiClient]'s private business, so they
     * are stated here as well: a 5xx or a 429 is worth trying again, a 4xx is an answer
     * and repeating it would be noise. A 401 on this route means the session ended,
     * which the caller turns into a sign-in rather than an error banner.
     */
    private fun interpret(status: Int, text: String): ApiResult<InboxPage> {
        if (status == 401) {
            return ApiResult.Rejected(SESSION_ENDED, emptyMap(), status)
        }
        if (status == 403) {
            return ApiResult.Rejected(ROLE_REFUSED, emptyMap(), status)
        }
        if (status >= 500 || status == 429) {
            return ApiResult.Unreachable(SERVICE_DOWN)
        }

        val envelope = try {
            json.decodeFromString(ApiEnvelope.serializer(InboxPage.serializer()), text)
        } catch (error: SerializationException) {
            null
        }

        if (envelope == null) {
            return ApiResult.Rejected(UNREADABLE, emptyMap(), status)
        }
        val data = envelope.data
        if (!envelope.ok || data == null) {
            return ApiResult.Rejected(envelope.error ?: refusedWith(status), emptyMap(), status)
        }
        return ApiResult.Success(data)
    }

    private fun refusedWith(status: Int): String = "The inbox refused that request ($status)."

    companion object {
        const val ADMIN_PATH = "/admin"
        const val SECOND_FACTOR_PATH = "/admin/second-factor"
        const val ENQUIRIES_PATH = "/admin/enquiries.json"
        const val SIGN_OUT_PATH = "/admin/sign-out"
        const val SESSION_COOKIE = "opd_admin"
        const val CHALLENGE_COOKIE = "opd_mfa"

        const val DEFAULT_PAGE = 50
        const val MAX_PAGE = 200

        /** Codes rotate every thirty seconds; the challenge lives for five minutes. */
        const val CODE_REFUSED =
            "That code did not match, or the unlock expired. Codes last thirty seconds and " +
                "the unlock lasts five minutes — sign in again for a fresh one."
        const val CREDENTIALS_REFUSED =
            "Those credentials were refused. The attempt has been written to the inbox's " +
                "access log, as every attempt is."
        const val TOO_MANY_ATTEMPTS =
            "Too many attempts from this address. Wait ten minutes, then sign in again."
        const val NOT_AVAILABLE =
            "There is no inbox here. It is optional by design, and it only answers addresses " +
                "on its allowlist — from anywhere else it does not exist."
        const val SERVICE_DOWN = "The inbox service is not answering right now."
        const val SESSION_ENDED = "That session has ended. Sign in again."
        const val ROLE_REFUSED = "This account may not read that."
        const val UNREADABLE = "The inbox sent a reply this app could not read."
        const val NO_CHALLENGE =
            "The service accepted those credentials but gave this app nothing to continue " +
                "with. That is a shape it has not been taught, not a wrong password."

        /**
         * The shared transport, plus the two things an inbox needs that a submission
         * does not: cookies, and redirects left alone.
         *
         * Built from [ApiClient.defaultClient] rather than a fresh client so the
         * timeouts, the disabled connection retry and the logging level all carry over
         * — including the rule that logging is BASIC and never BODY, which matters more
         * here than anywhere else in the app, because these bodies are other people's
         * phone numbers.
         */
        fun buildClient(jar: CookieJar): OkHttpClient = ApiClient.defaultClient()
            .newBuilder()
            .cookieJar(jar)
            .followRedirects(false)
            .followSslRedirects(false)
            .build()
    }
}
