package com.opudas.paint.feature.inbox

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.remote.InboxEnquiry
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.formatDateTime
import com.opudas.paint.core.util.sendEmail

/*
 * One enquiry, in full.
 *
 * The list has to be scannable, so it truncates; this does not. The message is shown
 * as it was written, because a person describing a damp wall in their own words is
 * worth more to the desk than any summary of it, and the phone number and email address
 * are here to be used rather than copied out by hand.
 *
 * The colour codes and product references are shown as the enquiry recorded them. They
 * are codes and SKUs, not names, and turning them into names would mean resolving what
 * a customer typed against what the catalogue currently holds — which is a different
 * claim from "this is what they sent".
 */

@Composable
private fun rememberInboxDetailViewModel(reference: String): InboxDetailViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { InboxDetailViewModel(context.container.admin, reference) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxDetailScreen(
    reference: String,
    onBack: () -> Unit,
    viewModel: InboxDetailViewModel = rememberInboxDetailViewModel(reference),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text(reference, style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
            state.isLoading -> LoadingState(
                Modifier.fillMaxSize(),
                label = "Reading $reference",
            )

            state.needsSignIn -> EmptyState(
                title = "That session has ended",
                body = "The service no longer accepts this device's session, so the enquiry " +
                    "cannot be shown. Sign in again and it will be where it was.",
                action = { SecondaryAction(text = "Back to the inbox", onClick = onBack) },
            )

            state.notFound -> EmptyState(
                title = "Not in the most recent ${state.searchedCount}",
                body = "There are ${state.totalCount} enquiries in the log and this reference " +
                    "is not among the most recent ${state.searchedCount} of them. It has not " +
                    "been deleted — the page this screen reads is not the whole log.",
                action = { SecondaryAction(text = "Try again", onClick = viewModel::refresh) },
            )

            else -> {
                val enquiry = state.enquiry
                if (enquiry == null) {
                    EmptyState(
                        title = "Nothing to show",
                        body = state.error ?: "That enquiry could not be read.",
                        action = { SecondaryAction(text = "Try again", onClick = viewModel::refresh) },
                    )
                } else {
                    Detail(enquiry = enquiry, error = state.error)
                }
            }
        }
    }
}

@Composable
private fun Detail(enquiry: InboxEnquiry, error: String?) {
    val context = LocalContext.current
    val email = enquiry.email

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
    ) {
        item {
            val errorText = error
            if (errorText != null) {
                Text(
                    errorText,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
                Spacer(Modifier.height(10.dp))
            }

            SectionHeader(
                title = enquiry.name,
                subtitle = listOf(enquiry.city, enquiry.projectType).joinToString(" · "),
            )

            FactRow(
                label = "Received",
                value = formatDateTime(enquiry.receivedAt.orEmpty()) ?: enquiry.receivedAt.orEmpty(),
            )
            FactRow(label = "Reference", value = enquiry.reference)
            val routed = enquiry.routedTo
            if (routed != null) {
                FactRow(label = "Routed to", value = routed)
            }
            val sla = enquiry.slaHours
            if (sla != null) {
                FactRow(label = "Answer within", value = "$sla hours")
            }
            val rooms = enquiry.rooms
            if (!rooms.isNullOrBlank()) {
                FactRow(label = "Rooms", value = rooms)
            }
            val source = enquiry.source
            if (source != null) {
                FactRow(label = "Came from", value = source)
            }
        }

        item {
            Spacer(Modifier.height(14.dp))
            Text("Reach them", style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(8.dp))
            PrimaryAction(
                text = "Call ${enquiry.phone}",
                onClick = { context.dial(enquiry.phone) },
            )
            if (email != null) {
                Spacer(Modifier.height(8.dp))
                SecondaryAction(
                    text = "Email $email",
                    onClick = {
                        context.sendEmail(
                            email,
                            "Your enquiry ${enquiry.reference} — OPUDA'S PAINT",
                            "",
                        )
                    },
                )
            } else {
                Spacer(Modifier.height(6.dp))
                Text(
                    "No email address was given, so the answer goes by phone.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        val message = enquiry.message
        if (!message.isNullOrBlank()) {
            item {
                Spacer(Modifier.height(16.dp))
                SectionHeader(title = "What they wrote")
                Text(message, style = MaterialTheme.typography.bodyMedium)
            }
        }

        if (enquiry.colors.isNotEmpty()) {
            item {
                Spacer(Modifier.height(16.dp))
                SectionHeader(
                    title = "Colours named",
                    subtitle = "As the enquiry recorded them, by code",
                )
                enquiry.colors.forEach { code ->
                    Text(
                        "·  $code",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(bottom = 4.dp),
                    )
                }
            }
        }

        if (enquiry.products.isNotEmpty()) {
            item {
                Spacer(Modifier.height(16.dp))
                SectionHeader(
                    title = "Products named",
                    subtitle = "As the enquiry recorded them, by reference",
                )
                enquiry.products.forEach { sku ->
                    Text(
                        "·  $sku",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(bottom = 4.dp),
                    )
                }
            }
        }

        if (enquiry.quantities.isNotEmpty()) {
            item {
                Spacer(Modifier.height(16.dp))
                SectionHeader(
                    title = "Quantities they measured",
                    subtitle = "From the calculator, so the desk can see the reasoning",
                )
                enquiry.quantities.forEach { line ->
                    FactRow(
                        label = line.label,
                        value = "${line.amount} ${line.unit}",
                    )
                }
            }
        }

        item {
            Spacer(Modifier.height(16.dp))
            HonestNote(
                "This is personal data: a name, a phone number, and what somebody wrote about " +
                    "their own home. Reading it is logged against the account that read it. " +
                    "Nothing about it is stored on this phone, and it does not come back from a " +
                    "backup or a device transfer.",
            )
        }
    }
}
