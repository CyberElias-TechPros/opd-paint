package com.opudas.paint.feature.quote

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.OutboxItem
import com.opudas.paint.core.data.SubmissionRepository
import com.opudas.paint.core.data.local.SubmissionState
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.remote.ApiConfig
import com.opudas.paint.core.data.remote.QuantityLine
import com.opudas.paint.core.data.remote.QuotePayload
import com.opudas.paint.core.data.remote.QuoteResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

/** One project type: the value the service routes on, and the words a person reads. */
data class ProjectType(val value: String, val label: String)

/**
 * The eight project types the enquiry form offers.
 *
 * Ported from the website's form rather than invented here, and the values matter:
 * `routeFor()` in `server/index.mjs` switches on them to decide which desk an
 * enquiry lands on and how many hours that desk has. `trade` goes to the trade and
 * contracts desk, `sample` to the sample and colour desk, `dealer` to the
 * commercial team with forty-eight hours, `exterior` to the technical desk. A value
 * spelled differently here would still be accepted — the service only requires that
 * one is present — and would silently fall through to the default desk, so an
 * exterior specification would be answered by the colour desk in Port Harcourt
 * instead of the people who specify exteriors.
 */
val PROJECT_TYPES: List<ProjectType> = listOf(
    ProjectType("interior-whole", "Whole interior"),
    ProjectType("interior-room", "One or two rooms"),
    ProjectType("exterior", "Exterior / facade"),
    ProjectType("new-build", "New build or first decoration"),
    ProjectType("trade", "Trade, contract or bulk"),
    ProjectType("sample", "Sample pots / colour chips"),
    ProjectType("dealer", "Dealer or distributor enquiry"),
    ProjectType("other", "Something else"),
)

/** What is typed into the form. */
data class QuoteForm(
    val name: String = "",
    val phone: String = "",
    val email: String = "",
    val city: String = "",
    val projectType: String = "",
    val rooms: String = "",
    val message: String = "",
    val consent: Boolean = false,
)

/** Where a submission has got to, as the screen understands it. */
enum class QuotePhase {
    /** Being written. */
    EDITING,

    /**
     * Saved on this device, not yet accepted by the service.
     *
     * This is a real state rather than a spinner: it is what a person sees when
     * they send from somewhere with no signal, and the wording has to say the
     * enquiry is safe and still going, not that it failed.
     */
    QUEUED,

    /** Accepted. The reference, the desk and the deadline are all known. */
    ACCEPTED,

    /** Refused with reasons, or never delivered. Nothing was sent. */
    REFUSED,
}

data class QuoteUiState(
    val isLoading: Boolean = true,
    val contact: BrandContact? = null,
    val form: QuoteForm = QuoteForm(),
    val errors: Map<String, String> = emptyMap(),
    val phase: QuotePhase = QuotePhase.EDITING,
    val trackedId: Long? = null,
    val attempts: Int = 0,
    val lastError: String? = null,
    val reference: String? = null,
    val routedTo: String? = null,
    val slaHours: Int? = null,
    /** Context carried in from a colour, a product or a calculation. */
    val colourIds: List<String> = emptyList(),
    val productSkus: List<String> = emptyList(),
    val quantities: List<QuantityLine> = emptyList(),
) {
    val projectTypeLabel: String?
        get() = PROJECT_TYPES.firstOrNull { it.value == form.projectType }?.label

    /** One line describing what is attached, or null if nothing is. */
    val attachedSummary: String?
        get() {
            val parts = buildList {
                if (colourIds.size == 1) add("1 colour")
                if (colourIds.size > 1) add("${colourIds.size} colours")
                if (productSkus.size == 1) add("1 product")
                if (productSkus.size > 1) add("${productSkus.size} products")
                if (quantities.isNotEmpty()) add("${quantities.size} measured quantity")
            }
            return if (parts.isEmpty()) null else parts.joinToString(", ")
        }
}

/**
 * Writing an enquiry, and knowing what became of it.
 *
 * The submission is written to the outbox and the tap returns. That is not a
 * shortcut — it is the design. The screen then observes that one outbox entry and
 * reports whatever happens to it: accepted, still waiting for a network, or
 * refused with the service's own words. So the confirmation a person eventually
 * sees is the service's answer, not an optimistic guess, and an enquiry written in
 * a basement is neither lost nor falsely acknowledged.
 *
 * Validation is ported field for field from the website's form, with the same
 * messages. It is a courtesy, not a boundary: the service validates the same
 * fields and its per-field replies are stored and shown when it disagrees.
 */
class QuoteViewModel(
    private val content: ContentRepository,
    private val submissions: SubmissionRepository,
    private val json: Json,
    colourId: String?,
    productId: String?,
    quantity: String?,
    /** Already chosen by whoever sent the person here, as the website's `?type=` does. */
    projectType: String?,
) : ViewModel() {

    private val mutableState = MutableStateFlow(QuoteUiState())
    val uiState: StateFlow<QuoteUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            val contact = content.contact()
            // A product is identified to the desk by its SKU, which is what is
            // printed on the tin and what the website sends. An app-internal id
            // would be a number only this app understands.
            val skus = listOfNotNull(productId).mapNotNull { id -> content.product(id)?.sku }
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    contact = contact,
                    colourIds = listOfNotNull(colourId),
                    productSkus = skus,
                    // A calculation arrives as a sentence rather than a number:
                    // "9 tins for 43.7 m², 2 coats". Put where the person can read
                    // it, edit it, and delete it before sending.
                    form = current.form.copy(
                        message = quantity.orEmpty(),
                        projectType = projectType.orEmpty(),
                    ),
                )
            }
        }

        viewModelScope.launch {
            submissions.observeOutbox().collect { items ->
                val tracked = mutableState.value.trackedId ?: return@collect
                val item = items.firstOrNull { it.id == tracked } ?: return@collect
                mutableState.update { current -> current.fromOutbox(item) }
            }
        }
    }

    fun onNameChange(value: String) = mutateForm("name") { it.copy(name = value) }

    fun onPhoneChange(value: String) = mutateForm("phone") { it.copy(phone = value) }

    fun onEmailChange(value: String) = mutateForm("email") { it.copy(email = value) }

    fun onCityChange(value: String) = mutateForm("city") { it.copy(city = value) }

    fun onProjectTypeChange(value: String) = mutateForm("projectType") { it.copy(projectType = value) }

    fun onRoomsChange(value: String) = mutateForm("rooms") { it.copy(rooms = value) }

    fun onMessageChange(value: String) = mutateForm("message") { it.copy(message = value) }

    fun onConsentChange(value: Boolean) = mutateForm("consent") { it.copy(consent = value) }

    /**
     * Save the enquiry and ask for delivery.
     *
     * Returns as soon as the row is committed, whatever the network is doing. The
     * phase moves to [QuotePhase.QUEUED] and the outbox collector reports the rest.
     */
    fun onSubmit() {
        val current = mutableState.value
        if (current.phase == QuotePhase.QUEUED || current.phase == QuotePhase.ACCEPTED) return

        val found = validate(current.form)
        if (found.isNotEmpty()) {
            mutableState.update { it.copy(errors = found) }
            return
        }

        val form = current.form
        val payload = QuotePayload(
            name = form.name.trim(),
            phone = form.phone.trim(),
            city = form.city.trim(),
            projectType = form.projectType,
            // Validated above: the form cannot reach this line without agreement,
            // and the service stores the enquiry only because it was given.
            consent = true,
            email = form.email.trim().ifEmpty { null },
            rooms = form.rooms.trim().ifEmpty { null },
            message = form.message.trim().ifEmpty { null },
            colors = current.colourIds.ifEmpty { null },
            products = current.productSkus.ifEmpty { null },
            quantities = current.quantities.ifEmpty { null },
            // The honeypot field is deliberately absent. It exists for bots that
            // fill every input in a form; there is no input here to fill, and
            // sending a value would make the service discard a real enquiry.
            company = null,
            source = ApiConfig.SOURCE,
        )

        viewModelScope.launch {
            val id = submissions.enqueueQuote(payload)
            mutableState.update {
                it.copy(
                    errors = emptyMap(),
                    phase = QuotePhase.QUEUED,
                    trackedId = id,
                    attempts = 0,
                    lastError = null,
                    reference = null,
                    routedTo = null,
                    slaHours = null,
                )
            }
        }
    }

    /** Ask for another delivery attempt on the enquiry already saved. */
    fun onRetry() {
        val id = mutableState.value.trackedId ?: return
        viewModelScope.launch {
            submissions.retry(id)
            mutableState.update { it.copy(phase = QuotePhase.QUEUED, lastError = null) }
        }
    }

    /**
     * Throw the saved enquiry away and start again.
     *
     * Offered only when something is refused: a person whose phone number the
     * service will not accept needs to be able to delete that draft rather than
     * keep retrying it, and it is their draft on their device.
     */
    fun onDiscard() {
        val id = mutableState.value.trackedId ?: return
        viewModelScope.launch {
            submissions.discard(id)
            mutableState.update {
                QuoteUiState(
                    isLoading = false,
                    contact = it.contact,
                    colourIds = it.colourIds,
                    productSkus = it.productSkus,
                    quantities = it.quantities,
                )
            }
        }
    }

    private fun mutateForm(field: String, change: (QuoteForm) -> QuoteForm) {
        mutableState.update { current ->
            current.copy(
                form = change(current.form),
                // Clear this field's complaint only. Wiping every error on every
                // keystroke would make the form appear to agree with itself while
                // the person is still typing, then disagree all at once.
                errors = current.errors - field,
            )
        }
    }

    private fun QuoteUiState.fromOutbox(item: OutboxItem): QuoteUiState = when (item.state) {
        SubmissionState.SENT -> {
            val response = decodeResponse(item.responseJson)
            copy(
                phase = QuotePhase.ACCEPTED,
                reference = item.reference ?: response?.reference,
                routedTo = response?.routedTo,
                slaHours = response?.slaHours,
                attempts = item.attempts,
                lastError = null,
            )
        }

        SubmissionState.FAILED -> copy(
            phase = QuotePhase.REFUSED,
            attempts = item.attempts,
            lastError = item.lastError,
            // A refusal from the service about specific fields goes back on those
            // fields, which is where the person can do something about it.
            errors = decodeFieldErrors(item.fieldErrors) + errors,
        )

        SubmissionState.PENDING -> copy(
            phase = QuotePhase.QUEUED,
            attempts = item.attempts,
            lastError = item.lastError,
        )
    }

    private fun decodeResponse(raw: String?): QuoteResponse? {
        if (raw == null) return null
        return try {
            json.decodeFromString(QuoteResponse.serializer(), raw)
        } catch (error: SerializationException) {
            null
        }
    }

    /**
     * Per-field messages stored by the worker.
     *
     * [OutboxItem] carries them as one JSON object; this turns them back into the
     * map the form indexes by field name. Anything unreadable yields nothing, and
     * the general message is still shown.
     */
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
 * The same six rules the website applies, with the same wording.
 *
 * Deliberately a top-level function rather than a method: it is pure, it is the
 * kind of thing worth testing directly, and a JVM test can call it without a
 * repository, a database or a scheduler.
 */
/*
 * The thresholds, file-private rather than class-private: `validate` is a
 * top-level function so a JVM test can call it without constructing a ViewModel,
 * and a top-level function cannot read a class's private companion.
 */
private val EMAIL = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}$")
private const val MIN_NAME = 2
private const val MIN_CITY = 2
private const val MIN_PHONE_DIGITS = 7
private const val MAX_PHONE_DIGITS = 15

fun validate(form: QuoteForm): Map<String, String> {
    val errors = LinkedHashMap<String, String>()

    if (form.name.trim().length < MIN_NAME) {
        errors["name"] = "Please give us a name to reply to."
    }

    val digits = form.phone.filter { it.isDigit() }
    if (digits.length < MIN_PHONE_DIGITS) {
        errors["phone"] = "Enter a phone number we can reach you on."
    } else if (digits.length > MAX_PHONE_DIGITS) {
        errors["phone"] = "That number looks too long — check the country code."
    }

    val email = form.email.trim()
    if (email.isNotEmpty() && !EMAIL.matches(email)) {
        errors["email"] = "That email address looks incomplete."
    }

    if (form.city.trim().length < MIN_CITY) {
        errors["city"] = "Which city or area is the project in?"
    }

    if (form.projectType.isEmpty()) {
        errors["projectType"] = "Choose the closest project type."
    }

    if (!form.consent) {
        errors["consent"] = "We need your agreement before we can store and reply to your enquiry."
    }

    return errors
}
