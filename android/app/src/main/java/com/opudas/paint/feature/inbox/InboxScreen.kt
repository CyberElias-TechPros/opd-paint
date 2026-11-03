package com.opudas.paint.feature.inbox

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.remote.ApiConfig
import com.opudas.paint.core.data.remote.InboxEnquiry
import com.opudas.paint.core.data.remote.InboxPage
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.FormField
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.formatDateTime

/*
 * The enquiries inbox.
 *
 * This is the part of the app that is not for customers: the names, phone numbers and
 * messages people sent when they wanted paint, and the desk each one was routed to.
 * It is here because the owner asked for the whole product on a phone, and because the
 * desk that answers an enquiry is not always at a desk.
 *
 * Two things follow from whose data this is. Nothing is written to the device — not the
 * password, not the code, not the session cookie, not the page already read — so signing
 * out leaves nothing behind on a phone that gets handed to somebody else. And a refusal
 * is reported in the service's own words, because "wrong password", "that code has been
 * used" and "there is no inbox at this address" need three different responses from the
 * person reading them.
 */

@Composable
private fun rememberInboxViewModel(): InboxViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { InboxViewModel(context.container.admin) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(
    onBack: () -> Unit,
    onOpenEnquiry: (String) -> Unit,
    viewModel: InboxViewModel = rememberInboxViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text(
                    if (state.isSignedIn) "Enquiries" else "Sign in to the inbox",
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

        when (state.phase) {
            InboxPhase.SIGNED_OUT -> SignIn(state = state, viewModel = viewModel)
            InboxPhase.AWAITING_CODE -> Unlock(state = state, viewModel = viewModel)
            InboxPhase.READY -> Enquiries(
                state = state,
                onOpenEnquiry = onOpenEnquiry,
                onRefresh = viewModel::refresh,
                onSignOut = viewModel::signOut,
            )
        }
    }
}

@Composable
private fun SignIn(state: InboxUiState, viewModel: InboxViewModel) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
    ) {
        item {
            SectionHeader(
                title = "Sign in to the enquiries inbox",
                subtitle = "For the people who answer enquiries. Nothing is written to this phone.",
            )
            FormField(
                label = "Account name",
                value = state.name,
                onValueChange = viewModel::onNameChange,
                supporting = "The name this account was created with.",
            )
            FormField(
                label = "Password",
                value = state.password,
                onValueChange = viewModel::onPasswordChange,
                keyboard = KeyboardType.Password,
                secret = true,
            )
            val error = state.error
            if (error != null) {
                Refusal(message = error)
            }
            Spacer(Modifier.height(10.dp))
            PrimaryAction(
                text = if (state.busy) "Signing in" else "Sign in",
                onClick = viewModel::signIn,
                enabled = state.canSignIn,
            )
            Spacer(Modifier.height(16.dp))
            HonestNote(
                "Every attempt is written to the inbox's access log, including the ones that " +
                    "fail. The inbox only answers addresses on its allowlist — from anywhere " +
                    "else it does not exist, and this screen will say that rather than leaving " +
                    "you guessing whether it was the password.",
            )
        }
    }
}

@Composable
private fun Unlock(state: InboxUiState, viewModel: InboxViewModel) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
    ) {
        item {
            SectionHeader(
                title = "Enter your code",
                subtitle = "Six digits from your authenticator. A code lasts thirty seconds " +
                    "and the unlock lasts five minutes.",
            )
            FormField(
                label = "Code",
                value = state.code,
                onValueChange = viewModel::onCodeChange,
                keyboard = KeyboardType.Number,
                // Readable on purpose, unlike the password: a code that cannot be read
                // back is a code that cannot be corrected, and it expires in thirty
                // seconds whatever happens on this screen.
                supporting = "${state.code.length} of ${InboxViewModel.CODE_LENGTH} digits",
            )
            val error = state.error
            if (error != null) {
                Refusal(message = error)
            }
            Spacer(Modifier.height(10.dp))
            PrimaryAction(
                text = if (state.busy) "Unlocking" else "Unlock the inbox",
                onClick = viewModel::unlock,
                enabled = state.canUnlock,
            )
            Spacer(Modifier.height(8.dp))
            SecondaryAction(text = "Back to sign in", onClick = viewModel::backToSignIn)
            Spacer(Modifier.height(16.dp))
            HonestNote(
                "Six wrong codes in ten minutes locks the attempt out, which is slower to " +
                    "guess than the code is to rotate. Getting in clears the counter: two " +
                    "typos earlier in the week should not leave you two-sixths of the way to " +
                    "a lockout on the day you need the inbox.",
            )
        }
    }
}

@Composable
private fun Enquiries(
    state: InboxUiState,
    onOpenEnquiry: (String) -> Unit,
    onRefresh: () -> Unit,
    onSignOut: () -> Unit,
) {
    val page: InboxPage? = state.page

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
    ) {
        item {
            if (page == null) {
                SectionHeader(
                    title = "Reading the inbox",
                    subtitle = if (state.refreshing) "Fetching the most recent enquiries" else "Nothing loaded yet",
                )
            } else {
                SectionHeader(
                    title = "Enquiries",
                    subtitle = "${page.total} in the log · ${page.receivedToday} arrived today · " +
                        "showing ${page.returned}",
                )
            }

            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                SecondaryAction(
                    text = if (state.refreshing) "Refreshing" else "Refresh",
                    onClick = onRefresh,
                    modifier = Modifier.weight(1f),
                    enabled = !state.refreshing,
                )
                SecondaryAction(
                    text = "Sign out",
                    onClick = onSignOut,
                    modifier = Modifier.weight(1f),
                )
            }

            val error = state.error
            if (error != null) {
                Refusal(message = error)
            }

            val desks = page?.desks.orEmpty()
            if (desks.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                Text(
                    "Where they landed",
                    style = MaterialTheme.typography.titleSmall,
                )
                desks.forEach { (desk, count) ->
                    FactRow(label = desk, value = "$count")
                }
            }
        }

        val enquiries = page?.enquiries.orEmpty()
        items(enquiries) { enquiry ->
            EnquiryRow(enquiry = enquiry, onClick = { onOpenEnquiry(enquiry.reference) })
        }

        if (state.isEmpty) {
            item {
                EmptyState(
                    title = "The inbox is empty",
                    body = "No enquiry has been accepted yet. That is either a quiet day or a " +
                        "service that has not been pointed at — the enquiries in the app's own " +
                        "outbox are still on this phone until one is.",
                )
            }
        }

        item {
            Spacer(Modifier.height(16.dp))
            HonestNote(
                "Newest first, as the inbox on the website shows it. Reading this is logged " +
                    "against your account, as it is on the website. Signing out clears the " +
                    "session here and on the service; nothing was written to this phone.",
            )
        }
    }
}

@Composable
private fun EnquiryRow(enquiry: InboxEnquiry, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable(onClickLabel = enquiry.reference, role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    enquiry.reference,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.weight(1f),
                )
                val sla = enquiry.slaHours
                if (sla != null) {
                    Text(
                        "Answer in $sla h",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            Spacer(Modifier.height(2.dp))
            Text(enquiry.name, style = MaterialTheme.typography.titleMedium)
            Text(
                listOf(enquiry.city, enquiry.projectType).joinToString(" · "),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                formatDateTime(enquiry.receivedAt.orEmpty()) ?: enquiry.receivedAt.orEmpty(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            val routed = enquiry.routedTo
            if (routed != null) {
                Text(routed, style = MaterialTheme.typography.labelSmall)
            }
            val message = enquiry.message
            if (!message.isNullOrBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    message,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (enquiry.source == ApiConfig.SOURCE) {
                Spacer(Modifier.height(6.dp))
                Text(
                    "Sent from the app",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** What the service said when it said no, in its own words. */
@Composable
private fun Refusal(message: String) {
    Spacer(Modifier.height(10.dp))
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Brand.tokens.radius("sm")),
        color = MaterialTheme.colorScheme.errorContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Text(
            message,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onErrorContainer,
            modifier = Modifier.padding(12.dp),
        )
    }
}

