package com.opudas.paint.feature.privacy

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.OutboxItem
import com.opudas.paint.core.data.SubmissionRepository
import com.opudas.paint.core.data.local.SubmissionState
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.remote.ApiConfig
import com.opudas.paint.core.data.remote.DataRight
import com.opudas.paint.core.data.remote.PrivacyPayload
import com.opudas.paint.core.data.remote.PrivacyResponse
import com.opudas.paint.core.util.formatLongDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

/** What is typed into the request. */
data class PrivacyForm(
    val right: DataRight = DataRight.ACCESS,
    val email: String = "",
    val enquiryReference: String = "",
    val note: String = "",
)

/** Where the request has got to. */
enum class PrivacyPhase {
    EDITING,

    /** Saved on this device, waiting for a connection. */
    QUEUED,

    /** Logged by the service: it has a reference and a deadline. */
    ACCEPTED,

    /** Refused, or never delivered. Nothing was logged. */
    REFUSED,
}

data class PrivacyUiState(
    val isLoading: Boolean = true,
    val contact: BrandContact? = null,
    val form: PrivacyForm = PrivacyForm(),
    val errors: Map<String, String> = emptyMap(),
    val phase: PrivacyPhase = PrivacyPhase.EDITING,
    val trackedId: Long? = null,
    val attempts: Int = 0,
    val lastError: String? = null,
    val reference: String? = null,
    val receivedAt: String? = null,
    val dueBy: String? = null,
) {
    /**
     * The deadline in words.
     *
     * Falls back to the raw date rather than showing nothing: a statutory deadline
     * that fails to render is worse than one that renders as `2026-12-03`.
     */
    val dueByDisplay: String?
        get() = dueBy?.let { raw -> formatLongDate(raw) ?: raw }

    val noteLength: Int
        get() = form.note.length
}

/**
 * Exercising a right over your own data, from a phone.
 *
 * The privacy notice has always promised this by email. An intake that gives the
 * request a reference and a deadline is the difference between a promise and a
 * process — an email can be read and forgotten, a `DSAR-` reference is on a clock
 * somebody can be asked about.
 *
 * That is also why this screen is offline-first rather than best-effort. A right
 * that can only be exercised while a form is reachable is not a right, and the
 * honest fallback the website shows — write to the address, the thirty days starts
 * when you write, not when the form works — is kept here too. With an outbox the
 * request is written down first, so the fallback is for a service that has refused
 * it rather than for a moment without signal.
 */
class PrivacyRequestViewModel(
    private val content: ContentRepository,
    private val submissions: SubmissionRepository,
    private val json: Json,
) : ViewModel() {

    private val mutableState = MutableStateFlow(PrivacyUiState())
    val uiState: StateFlow<PrivacyUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            val contact = content.contact()
            mutableState.update { it.copy(isLoading = false, contact = contact) }
        }

        viewModelScope.launch {
            submissions.observeOutbox().collect { items ->
                val tracked = mutableState.value.trackedId ?: return@collect
                val item = items.firstOrNull { it.id == tracked } ?: return@collect
                mutableState.update { current -> current.fromOutbox(item) }
            }
        }
    }

    fun onRightSelect(right: DataRight) {
        mutableState.update { it.copy(form = it.form.copy(right = right)) }
    }

    fun onEmailChange(value: String) = mutateForm("email") { it.copy(email = value) }

    fun onReferenceChange(value: String) = mutateForm("enquiryReference") { it.copy(enquiryReference = value) }

    fun onNoteChange(value: String) = mutateForm("note") { it.copy(note = value) }

    /** Write the request down and ask for delivery. */
    fun onSubmit() {
        val current = mutableState.value
        if (current.phase == PrivacyPhase.QUEUED || current.phase == PrivacyPhase.ACCEPTED) return

        val found = validate(current.form)
        if (found.isNotEmpty()) {
            mutableState.update { it.copy(errors = found) }
            return
        }

        val form = current.form
        val payload = PrivacyPayload(
            type = form.right.id,
            email = form.email.trim(),
            enquiryReference = form.enquiryReference.trim().ifEmpty { null },
            note = form.note.trim().ifEmpty { null },
            // Not rendered anywhere in this app, so there is nothing to leave
            // empty: the honeypot exists for bots that fill every input in a form.
            company = null,
            source = ApiConfig.SOURCE,
        )

        viewModelScope.launch {
            val id = submissions.enqueuePrivacy(payload)
            mutableState.update {
                it.copy(
                    errors = emptyMap(),
                    phase = PrivacyPhase.QUEUED,
                    trackedId = id,
                    attempts = 0,
                    lastError = null,
                    reference = null,
                    receivedAt = null,
                    dueBy = null,
                )
            }
        }
    }

    fun onRetry() {
        val id = mutableState.value.trackedId ?: return
        viewModelScope.launch {
            submissions.retry(id)
            mutableState.update { it.copy(phase = PrivacyPhase.QUEUED, lastError = null) }
        }
    }

    fun onDiscard() {
        val id = mutableState.value.trackedId ?: return
        viewModelScope.launch {
            submissions.discard(id)
            mutableState.update {
                PrivacyUiState(isLoading = false, contact = it.contact)
            }
        }
    }

    private fun mutateForm(field: String, change: (PrivacyForm) -> PrivacyForm) {
        mutableState.update { current ->
            current.copy(
                form = change(current.form),
                errors = current.errors - field,
            )
        }
    }

    private fun PrivacyUiState.fromOutbox(item: OutboxItem): PrivacyUiState = when (item.state) {
        SubmissionState.SENT -> {
            val response = decodeResponse(item.responseJson)
            copy(
                phase = PrivacyPhase.ACCEPTED,
                reference = item.reference ?: response?.reference,
                receivedAt = response?.receivedAt,
                dueBy = response?.dueBy,
                attempts = item.attempts,
                lastError = null,
            )
        }

        SubmissionState.FAILED -> copy(
            phase = PrivacyPhase.REFUSED,
            attempts = item.attempts,
            lastError = item.lastError,
            errors = decodeFieldErrors(item.fieldErrors) + errors,
        )

        SubmissionState.PENDING -> copy(
            phase = PrivacyPhase.QUEUED,
            attempts = item.attempts,
            lastError = item.lastError,
        )
    }

    private fun decodeResponse(raw: String?): PrivacyResponse? {
        if (raw == null) return null
        return try {
            json.decodeFromString(PrivacyResponse.serializer(), raw)
        } catch (error: SerializationException) {
            null
        }
    }

    private fun decodeFieldErrors(raw: String?): Map<String, String> {
        if (raw.isNullOrBlank()) return emptyMap()
        return try {
            json.decodeFromString(MapSerializer(String.serializer(), String.serializer()), raw)
        } catch (error: SerializationException) {
            emptyMap()
        }
    }
}

/**
 * The two rules the website's request form applies, with its wording.
 *
 * Top-level and pure, like the quote form's, so it can be tested without a
 * repository or a database.
 */
fun validate(form: PrivacyForm): Map<String, String> {
    val errors = LinkedHashMap<String, String>()

    if (!EMAIL.matches(form.email.trim())) {
        errors["email"] = "Enter an email address we can answer at, for example name@example.com."
    }
    if (form.note.trim().length > MAX_NOTE) {
        errors["note"] = "That is longer than 2,000 characters. The short version is enough to start."
    }
    return errors
}

/*
 * File-private thresholds. `validate` is a top-level function so a JVM test can
 * call it without constructing a ViewModel, and a top-level function cannot read a
 * class's private companion.
 */
private val EMAIL = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}$")
private const val MAX_NOTE = 2000
