package com.opudas.paint.feature.quote

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openWhatsApp

/*
 * The enquiry form: the one place in this app where a person gives the business
 * something, and therefore the one place where what happens next has to be said
 * exactly.
 *
 * Three things about it are not negotiable.
 *
 * Sending never blocks on the network. The tap writes the enquiry to the outbox
 * and the screen says so — "saved on this device" — rather than showing a spinner
 * until a service answers or a timeout expires. Somebody on a building site with
 * one bar of signal gets the same response as somebody on fibre, and neither is
 * left guessing whether the enquiry exists.
 *
 * The confirmation is the service's, not an optimistic one. When the worker
 * delivers it, this screen shows the reference, the desk it was routed to and the
 * hours that desk has — read back from the reply the service actually sent. An app
 * that shows "sent!" the moment a button is tapped is an app that can lie.
 *
 * Consent is a checkbox with the privacy notice reachable from it, and the
 * wording under it says what will not happen: no selling, no marketing lists
 * without a separate opt-in. There is no hidden field here either; the honeypot
 * the service uses to discard bots is not rendered, because rendering it would
 * mean a person could fill it in.
 */

@Composable
private fun rememberQuoteViewModel(
    colourId: String?,
    productId: String?,
    quantity: String?,
): QuoteViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer {
                QuoteViewModel(
                    content = context.container.content,
                    submissions = context.container.submissions,
                    json = context.container.json,
                    colourId = colourId,
                    productId = productId,
                    quantity = quantity,
                )
            }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuoteScreen(
    onBack: () -> Unit,
    onOpenPrivacyNotice: () -> Unit,
    colourId: String? = null,
    productId: String? = null,
    quantity: String? = null,
    viewModel: QuoteViewModel = rememberQuoteViewModel(colourId, productId, quantity),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text(
                    "Ask for a quote",
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                )
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.background,
                titleContentColor = MaterialTheme.colorScheme.onBackground,
            ),
        )

        when {
            state.isLoading -> LoadingState(Modifier.fillMaxSize(), label = "Preparing the form")

            state.phase == QuotePhase.ACCEPTED -> Confirmation(
                state = state,
                onCall = { state.contact?.let { contact -> context.dial(contact.phoneTel) } },
                onWhatsApp = {
                    state.contact?.let { contact ->
                        context.openWhatsApp(
                            contact.whatsapp,
                            "Hello OPUDA'S PAINT — I have just sent an enquiry from the app " +
                                "(reference ${state.reference.orEmpty()}) and wanted to follow up.",
                        )
                    }
                },
                onOpenPrivacyNotice = onOpenPrivacyNotice,
            )

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 32.dp),
            ) {
                item {
                    SectionHeader(
                        title = "Tell us about the job",
                        subtitle = "A person at the desk reads this and replies. There is no checkout and no account.",
                    )
                }

                item {
                    val attached = state.attachedSummary
                    if (attached != null) {
                        HonestNote("Attached to this enquiry: $attached.")
                    }
                }

                if (state.phase == QuotePhase.QUEUED || state.phase == QuotePhase.REFUSED) {
                    item { QueueStatus(state = state, onRetry = viewModel::onRetry, onDiscard = viewModel::onDiscard) }
                }

                item {
                    FormField(
                        label = "Your name",
                        value = state.form.name,
                        onValueChange = viewModel::onNameChange,
                        error = state.errors["name"],
                        keyboard = KeyboardType.Text,
                    )
                }

                item {
                    FormField(
                        label = "Phone",
                        value = state.form.phone,
                        onValueChange = viewModel::onPhoneChange,
                        error = state.errors["phone"],
                        keyboard = KeyboardType.Phone,
                    )
                }

                item {
                    FormField(
                        label = "Email",
                        value = state.form.email,
                        onValueChange = viewModel::onEmailChange,
                        error = state.errors["email"],
                        optional = true,
                        keyboard = KeyboardType.Email,
                    )
                }

                item {
                    FormField(
                        label = "City or area",
                        value = state.form.city,
                        onValueChange = viewModel::onCityChange,
                        error = state.errors["city"],
                        keyboard = KeyboardType.Text,
                    )
                }

                item {
                    ProjectTypeField(
                        label = state.projectTypeLabel,
                        error = state.errors["projectType"],
                        onSelect = viewModel::onProjectTypeChange,
                    )
                }

                item {
                    FormField(
                        label = "Rooms or surfaces",
                        value = state.form.rooms,
                        onValueChange = viewModel::onRoomsChange,
                        error = state.errors["rooms"],
                        optional = true,
                        keyboard = KeyboardType.Text,
                    )
                }

                item {
                    FormField(
                        label = "Anything else we should know",
                        value = state.form.message,
                        onValueChange = viewModel::onMessageChange,
                        error = state.errors["message"],
                        optional = true,
                        keyboard = KeyboardType.Text,
                        singleLine = false,
                    )
                }

                item {
                    ConsentField(
                        checked = state.form.consent,
                        onCheckedChange = viewModel::onConsentChange,
                        error = state.errors["consent"],
                        onOpenPrivacyNotice = onOpenPrivacyNotice,
                    )
                }

                item {
                    HonestNote(
                        "Your enquiry is written to this device first and delivered when there is a " +
                            "connection, so nothing is lost if the signal goes. It is used only to answer " +
                            "you, and it is not added to a marketing list without a separate opt-in.",
                    )
                }

                item {
                    PrimaryAction(
                        text = "Send the enquiry",
                        onClick = viewModel::onSubmit,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                val contact = state.contact
                if (contact != null) {
                    item {
                        Column(Modifier.padding(top = 16.dp)) {
                            SectionHeader(
                                title = "Or reach the desk directly",
                                subtitle = "If you would rather not fill in a form at all",
                            )
                            ContactActions(
                                phoneDisplay = contact.phoneDisplay,
                                phoneTel = contact.phoneTel,
                                whatsapp = contact.whatsapp,
                                onCall = { context.dial(contact.phoneTel) },
                                onWhatsApp = {
                                    context.openWhatsApp(
                                        contact.whatsapp,
                                        "Hello OPUDA'S PAINT — I am using the app and would like a quote.",
                                    )
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * What has happened to the enquiry that is already saved.
 *
 * Shown above the fields rather than instead of them: the person can still read
 * what they typed, correct a phone number the service objected to, and send again.
 */
@Composable
private fun QueueStatus(state: QuoteUiState, onRetry: () -> Unit, onDiscard: () -> Unit) {
    val refused = state.phase == QuotePhase.REFUSED
    val title = if (refused) {
        "Not delivered yet"
    } else {
        "Saved on this device"
    }
    val body = if (refused) {
        state.lastError ?: "The enquiry service could not accept it."
    } else if (state.attempts == 0) {
        "Waiting for a connection. It will be sent as soon as there is one."
    } else {
        "Waiting for a connection after ${state.attempts} attempt" +
            (if (state.attempts == 1) "" else "s") + ". Nothing has been lost."
    }

    Column(Modifier.padding(bottom = 8.dp)) {
        HonestNote("$title — $body")
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SecondaryAction(text = "Try to send now", onClick = onRetry)
            if (refused) {
                SecondaryAction(text = "Delete this draft", onClick = onDiscard)
            }
        }
    }
}

/** The service's own answer, read back from what it sent. */
@Composable
private fun Confirmation(
    state: QuoteUiState,
    onCall: () -> Unit,
    onWhatsApp: () -> Unit,
    onOpenPrivacyNotice: () -> Unit,
) {
    val contact = state.contact
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
    ) {
        item {
            SectionHeader(
                title = "Received. We will come back to you.",
                subtitle = "Your enquiry is logged and has been routed to the desk that handles " +
                    "this kind of work. Keep the reference: it is how we find your file if you call.",
            )
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                val reference = state.reference
                if (reference != null) {
                    FactBlock(label = "Reference", value = reference)
                }
                val routedTo = state.routedTo
                if (routedTo != null) {
                    FactBlock(label = "Routed to", value = routedTo)
                }
                val hours = state.slaHours
                if (hours != null) {
                    FactBlock(label = "We aim to reply within", value = "$hours working hours")
                }
            }
        }

        item {
            Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "If it is urgent, call and quote your reference.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    "Your details are used only to answer this enquiry. They are not added to " +
                        "marketing lists without a separate opt-in.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                SecondaryAction(text = "Read the privacy notice", onClick = onOpenPrivacyNotice)
            }
        }

        if (contact != null) {
            item {
                Column(Modifier.padding(top = 20.dp)) {
                    SectionHeader(title = "Talk to the desk")
                    ContactActions(
                        phoneDisplay = contact.phoneDisplay,
                        phoneTel = contact.phoneTel,
                        whatsapp = contact.whatsapp,
                        onCall = onCall,
                        onWhatsApp = onWhatsApp,
                    )
                }
            }
        }
    }
}

@Composable
private fun FactBlock(label: String, value: String) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.surfaceVariant,
                MaterialTheme.shapes.medium,
            )
            .padding(14.dp),
    ) {
        Text(label.uppercase(), style = MaterialTheme.typography.labelSmall)
        Spacer(Modifier.height(4.dp))
        Text(value, style = MaterialTheme.typography.titleMedium)
    }
}

/**
 * One labelled input.
 *
 * The error is the service's message when the service produced one, and the
 * website's message when the app caught it first — the two are the same text, on
 * purpose, so a person moving between the site and the app is not given two
 * vocabularies for one rule.
 */
@Composable
private fun FormField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    error: String? = null,
    optional: Boolean = false,
    singleLine: Boolean = true,
    keyboard: KeyboardType = KeyboardType.Text,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        label = { Text(if (optional) "$label (optional)" else label) },
        isError = error != null,
        singleLine = singleLine,
        minLines = if (singleLine) 1 else 3,
        supportingText = if (error == null) null else {
            { Text(error, color = MaterialTheme.colorScheme.error) }
        },
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
    )
}

/**
 * The project type, as a button that opens a menu.
 *
 * Not a chip row: eight options, several of them five words long, and the choice
 * decides which desk answers. A menu that shows the whole label beats a row of
 * chips that truncate it.
 */
@Composable
private fun ProjectTypeField(
    label: String?,
    error: String?,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
    ) {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = label ?: "Choose the closest project type",
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    style = MaterialTheme.typography.bodyLarge,
                )
                Spacer(Modifier.width(8.dp))
                Text("▾", style = MaterialTheme.typography.bodyLarge)
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            PROJECT_TYPES.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option.label) },
                    onClick = {
                        onSelect(option.value)
                        expanded = false
                    },
                )
            }
        }
        if (error != null) {
            Spacer(Modifier.height(4.dp))
            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
}

/**
 * Agreement, with the notice beside it.
 *
 * A checkbox and a sentence about what will not happen. The privacy notice is one
 * tap away because the wording refers to it, and a reference to a document nobody
 * can open is not a reference.
 */
@Composable
private fun ConsentField(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    error: String?,
    onOpenPrivacyNotice: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Checkbox(checked = checked, onCheckedChange = onCheckedChange)
            Column(Modifier.padding(top = 10.dp)) {
                Text(
                    "I agree that OPUDA'S PAINT may use these details to reply to my enquiry, " +
                        "as described in the privacy notice.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "We do not sell or share your details. We do not add you to marketing lists " +
                        "without a separate opt-in.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(6.dp))
                SecondaryAction(text = "Read the privacy notice", onClick = onOpenPrivacyNotice)
            }
        }
        if (error != null) {
            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
}
