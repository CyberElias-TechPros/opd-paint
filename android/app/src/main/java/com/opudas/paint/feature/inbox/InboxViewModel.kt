package com.opudas.paint.feature.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.remote.AdminApi
import com.opudas.paint.core.data.remote.AdminOutcome
import com.opudas.paint.core.data.remote.ApiResult
import com.opudas.paint.core.data.remote.InboxPage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Where a sign-in has got to. */
enum class InboxPhase {
    /** No credentials accepted yet. */
    SIGNED_OUT,

    /** Credentials accepted; a six-digit code is outstanding. */
    AWAITING_CODE,

    /** A session is held, and the inbox may be read. */
    READY,
}

data class InboxUiState(
    val phase: InboxPhase = InboxPhase.SIGNED_OUT,
    val name: String = "",
    val password: String = "",
    val code: String = "",
    val busy: Boolean = false,
    val error: String? = null,
    val page: InboxPage? = null,
    val refreshing: Boolean = false,
) {
    val canSignIn: Boolean
        get() = !busy && name.trim().length >= 2 && password.isNotEmpty()

    val canUnlock: Boolean
        get() = !busy && code.trim().length == InboxViewModel.CODE_LENGTH

    val isSignedIn: Boolean
        get() = phase == InboxPhase.READY

    val isEmpty: Boolean
        get() = page != null && page.enquiries.isEmpty()
}

/**
 * The enquiries inbox.
 *
 * The part of the product that is not for customers: the names, phone numbers and
 * messages people sent when they wanted paint, and which desk each one landed at.
 *
 * Three rules shaped it:
 *
 * **Nothing is written down.** The password leaves this class as soon as the service
 * has answered it, the code is cleared the same way, and the session cookie lives in
 * [AdminApi]'s in-memory jar. A phone is handed to somebody else, is lost, and is
 * backed up to a cloud account nobody here controls, so the token that opens other
 * people's personal data does not go to disk and does not come back from a restore.
 * Signing out resets the whole state, including the page already loaded: leaving the
 * inbox should leave nothing behind in memory either.
 *
 * **A refusal is reported as the service worded it.** The service says whether a
 * password was wrong, a code did not match, six attempts have been used up, or there is
 * no inbox at this address at all. Those need different responses from the person
 * reading them, so they are not collapsed into "sign-in failed".
 *
 * **A viewer may read this.** The endpoint is the JSON page added for exactly that
 * reason; the bulk CSV export stays restricted to the exporter role, because a phone
 * that wanted to read one enquiry should not have to download every customer's phone
 * number to do it.
 */
class InboxViewModel(private val admin: AdminApi) : ViewModel() {

    private val mutableState = MutableStateFlow(InboxUiState())
    val uiState: StateFlow<InboxUiState> = mutableState.asStateFlow()

    init {
        // A session that outlived a configuration change but not a process restart
        // cannot happen, so this only ever fires when the process is still the one
        // that signed in — which is when the inbox should already be open.
        if (admin.isSignedIn) {
            mutableState.update { it.copy(phase = InboxPhase.READY) }
            load()
        }
    }

    fun onNameChange(value: String) {
        mutableState.update { it.copy(name = value, error = null) }
    }

    fun onPasswordChange(value: String) {
        mutableState.update { it.copy(password = value, error = null) }
    }

    fun onCodeChange(value: String) {
        mutableState.update { it.copy(code = value, error = null) }
    }

    fun dismissError() {
        mutableState.update { it.copy(error = null) }
    }

    /** Present credentials. Either a session, or a code to ask for. */
    fun signIn() {
        val current = mutableState.value
        if (!current.canSignIn) return
        val name = current.name.trim()
        val password = current.password
        mutableState.update { it.copy(busy = true, error = null) }

        viewModelScope.launch {
            when (val outcome = admin.signIn(name, password)) {
                AdminOutcome.Ready -> {
                    // The password is dropped here rather than kept for a retry: the
                    // service has answered, and holding it longer is holding it for
                    // no reason.
                    mutableState.update {
                        it.copy(busy = false, password = "", phase = InboxPhase.READY, error = null)
                    }
                    load()
                }

                AdminOutcome.NeedsCode -> mutableState.update {
                    it.copy(busy = false, password = "", phase = InboxPhase.AWAITING_CODE)
                }

                is AdminOutcome.Refused -> mutableState.update {
                    it.copy(busy = false, error = outcome.message)
                }

                is AdminOutcome.Unavailable -> mutableState.update {
                    it.copy(busy = false, error = unreachable(outcome.reason))
                }
            }
        }
    }

    /** Exchange the code for a session. */
    fun unlock() {
        val current = mutableState.value
        if (!current.canUnlock) return
        val code = current.code.trim()
        mutableState.update { it.copy(busy = true, error = null) }

        viewModelScope.launch {
            when (val outcome = admin.unlock(code)) {
                AdminOutcome.Ready -> {
                    mutableState.update {
                        it.copy(
                            busy = false,
                            code = "",
                            password = "",
                            phase = InboxPhase.READY,
                            error = null,
                        )
                    }
                    load()
                }

                AdminOutcome.NeedsCode -> mutableState.update {
                    it.copy(busy = false, code = "", error = AdminApi.CODE_REFUSED)
                }

                is AdminOutcome.Refused -> mutableState.update {
                    // A code is single use and rotates every thirty seconds, so the
                    // field is cleared: what is on screen is now a code that cannot
                    // work, and leaving it there invites submitting it again.
                    it.copy(busy = false, code = "", error = outcome.message)
                }

                is AdminOutcome.Unavailable -> mutableState.update {
                    it.copy(busy = false, code = "", error = unreachable(outcome.reason))
                }
            }
        }
    }

    /** Take the second factor back and ask for credentials again. */
    fun backToSignIn() {
        mutableState.update {
            it.copy(phase = InboxPhase.SIGNED_OUT, code = "", error = null, busy = false)
        }
    }

    fun refresh() {
        if (mutableState.value.busy) return
        load()
    }

    fun signOut() {
        viewModelScope.launch {
            admin.signOut()
            // The whole state, not just the phase: a page of other people's names and
            // phone numbers should not sit in memory after the person who read it has
            // said they are finished.
            mutableState.update { InboxUiState() }
        }
    }

    private fun load() {
        viewModelScope.launch {
            mutableState.update { it.copy(refreshing = true, error = null) }
            when (val result = admin.enquiries()) {
                is ApiResult.Success -> mutableState.update {
                    it.copy(refreshing = false, phase = InboxPhase.READY, page = result.value)
                }

                is ApiResult.Rejected -> mutableState.update { current ->
                    if (result.status == HTTP_UNAUTHORISED) {
                        // The session ended underneath the screen. Back to signing in,
                        // with the page gone: showing enquiries after the service has
                        // said this device may no longer read them would be showing
                        // data that is not this session's to show.
                        current.copy(
                            refreshing = false,
                            phase = InboxPhase.SIGNED_OUT,
                            page = null,
                            password = "",
                            code = "",
                            error = result.message,
                        )
                    } else {
                        current.copy(refreshing = false, error = result.message)
                    }
                }

                is ApiResult.Unreachable -> mutableState.update {
                    it.copy(refreshing = false, error = unreachable(result.reason))
                }
            }
        }
    }

    /**
     * A reason the person reading it can act on.
     *
     * The transport produces exception class names, which are useful in a log and
     * useless on a screen. The service's own sentences are passed through unchanged,
     * because they were written to be read.
     */
    private fun unreachable(reason: String): String = when (reason) {
        AdminApi.NOT_AVAILABLE,
        AdminApi.SERVICE_DOWN,
        AdminApi.TOO_MANY_ATTEMPTS,
        AdminApi.SESSION_ENDED,
        -> reason

        else -> "The inbox could not be reached ($reason). Nothing was read and nothing " +
            "was sent; the enquiries are still on the service."
    }

    companion object {
        const val CODE_LENGTH = 6
        private const val HTTP_UNAUTHORISED = 401
    }
}
