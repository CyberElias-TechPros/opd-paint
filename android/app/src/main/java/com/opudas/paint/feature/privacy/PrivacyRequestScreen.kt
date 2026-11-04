package com.opudas.paint.feature.privacy

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.remote.DataRight
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.FormField
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.AppCopy
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openWhatsApp

/*
 * Exercising a right over your own data.
 *
 * The privacy notice has always promised this by email. What makes it a process
 * rather than a promise is the reference and the deadline: an email can be read
 * and forgotten, a `DSAR-` reference is on a clock somebody can be asked about.
 *
 * So the confirmation states the deadline in full, in the reader's own locale, and
 * the screen keeps the website's honest fallback — if this cannot be delivered,
 * write to the address or call, because the thirty days starts when you write, not
 * when a form works. With an outbox underneath, that fallback is now for a service
 * that has refused the request rather than for a moment without signal, which is
 * the whole reason a right like this gets queued locally instead of posted.
 */

@Composable
private fun rememberPrivacyRequestViewModel(): PrivacyRequestViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer {
                PrivacyRequestViewModel(
                    content = context.container.content,
                    submissions = context.container.submissions,
                    json = context.container.json,
                )
            }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrivacyRequestScreen(
    onBack: () -> Unit,
    viewModel: PrivacyRequestViewModel = rememberPrivacyRequestViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading how to reach the desk")
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text(
                    "Ask us about your data",
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

        if (state.phase == PrivacyPhase.ACCEPTED) {
            Confirmation(state = state)
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
            ) {
                item {
                    SectionHeader(
                        title = "Ask us about your data",
                        subtitle = "This goes to the same place an email would, with a reference " +
                            "attached so it cannot be quietly dropped. We answer within 30 days.",
                    )
                }

                if (state.phase == PrivacyPhase.QUEUED || state.phase == PrivacyPhase.REFUSED) {
                    item {
                        QueueStatus(
                            state = state,
                            onRetry = viewModel::onRetry,
                            onDiscard = viewModel::onDiscard,
                        )
                    }
                }

                item {
                    Text("What you are asking for", style = MaterialTheme.typography.labelLarge)
                    Spacer(Modifier.height(4.dp))
                }

                items(DataRight.entries.toList()) { right ->
                    RightRow(
                        right = right,
                        selected = state.form.right == right,
                        onSelect = { viewModel.onRightSelect(right) },
                    )
                }

                item {
                    Spacer(Modifier.height(12.dp))
                    FormField(
                        label = "Email we should answer at",
                        value = state.form.email,
                        onValueChange = viewModel::onEmailChange,
                        error = state.errors["email"],
                        keyboard = KeyboardType.Email,
                    )
                    FormField(
                        label = "Enquiry reference",
                        value = state.form.enquiryReference,
                        onValueChange = viewModel::onReferenceChange,
                        error = state.errors["enquiryReference"],
                        optional = true,
                        supporting = "For example OPD-260101-1A2B, if this is about an enquiry",
                    )
                    FormField(
                        label = "Anything we should know",
                        value = state.form.note,
                        onValueChange = viewModel::onNoteChange,
                        error = state.errors["note"],
                        optional = true,
                        singleLine = false,
                        supporting = "${state.noteLength} of 2,000 characters",
                    )
                }

                item {
                    HonestNote(
                        "Your request is written to this device first and delivered when there is a " +
                            "connection. Answering it may mean confirming who you are first — that is " +
                            "not obstruction, it is how we avoid handing your data to somebody else.",
                    )
                    Spacer(Modifier.height(8.dp))
                    HonestNote(
                        "If it cannot be delivered at all, write to ${AppCopy.PRIVACY_EMAIL} or call " +
                            "instead — the thirty days starts when you write, not when this form works.",
                    )
                }

                item {
                    Spacer(Modifier.height(12.dp))
                    PrimaryAction(
                        text = "Send the request",
                        onClick = viewModel::onSubmit,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                val contact = state.contact
                if (contact != null) {
                    item {
                        Column(Modifier.padding(top = 20.dp)) {
                            SectionHeader(
                                title = "Or write to us directly",
                                subtitle = "The same request, with no form in between",
                            )
                            ContactActions(
                                phoneDisplay = contact.phoneDisplay,
                                phoneTel = contact.phoneTel,
                                whatsapp = contact.whatsapp,
                                onCall = { context.dial(contact.phoneTel) },
                                onWhatsApp = {
                                    context.openWhatsApp(
                                        contact.whatsapp,
                                        "Hello OPUDA'S PAINT — I would like to make a request " +
                                            "about my personal data.",
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
 * The five rights, as a list rather than a menu.
 *
 * Each one carries the sentence explaining what it means, because "object to a
 * use" is not self-describing and a right nobody understands is a right nobody
 * exercises.
 */
@Composable
private fun RightRow(right: DataRight, selected: Boolean, onSelect: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clickable(onClickLabel = right.label, role = Role.RadioButton, onClick = onSelect),
        verticalAlignment = Alignment.Top,
    ) {
        RadioButton(selected = selected, onClick = null)
        Column(Modifier.padding(top = 8.dp)) {
            Text(right.label, style = MaterialTheme.typography.titleSmall)
            Text(
                right.detail,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun QueueStatus(state: PrivacyUiState, onRetry: () -> Unit, onDiscard: () -> Unit) {
    val refused = state.phase == PrivacyPhase.REFUSED
    val title = if (refused) "Not delivered yet" else "Saved on this device"
    val body = if (refused) {
        state.lastError ?: "The service could not accept it."
    } else if (state.attempts == 0) {
        "Waiting for a connection. It will be sent as soon as there is one, and the " +
            "thirty days runs from when the service receives it."
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
                SecondaryAction(text = "Delete this request", onClick = onDiscard)
            }
        }
    }
}

/** The service's answer: a reference, and a deadline in words. */
@Composable
private fun Confirmation(state: PrivacyUiState) {
    val context = LocalContext.current
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
    ) {
        item {
            SectionHeader(
                title = "Your request is logged.",
                subtitle = "It has a reference and a deadline now, and both are below. Answering " +
                    "it may mean confirming who you are first — that is not obstruction, it is " +
                    "how we avoid handing your data to somebody else.",
            )
        }

        item {
            Column {
                val reference = state.reference
                if (reference != null) {
                    FactRow(label = "Reference", value = reference)
                }
                val dueBy = state.dueByDisplay
                if (dueBy != null) {
                    FactRow(label = "Answer by", value = dueBy)
                }
                val received = state.receivedAt
                if (received != null) {
                    FactRow(label = "Received", value = received.take(10))
                }
            }
        }

        item {
            Spacer(Modifier.height(14.dp))
            Text(
                "Nothing further will be sent to your address because of this request. If the " +
                    "deadline passes without an answer, you may complain to the Nigeria Data " +
                    "Protection Commission — and we would rather you called first.",
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        val contact = state.contact
        if (contact != null) {
            item {
                Column(Modifier.padding(top = 20.dp)) {
                    SectionHeader(title = "Chase it, or ask a question")
                    ContactActions(
                        phoneDisplay = contact.phoneDisplay,
                        phoneTel = contact.phoneTel,
                        whatsapp = contact.whatsapp,
                        onCall = { context.dial(contact.phoneTel) },
                        onWhatsApp = {
                            context.openWhatsApp(
                                contact.whatsapp,
                                "Hello OPUDA'S PAINT — I am following up on data request " +
                                    "${state.reference.orEmpty()}.",
                            )
                        },
                    )
                }
            }
        }
    }
}
