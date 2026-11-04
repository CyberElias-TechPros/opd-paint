package com.opudas.paint.feature.legal

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.model.LegalDoc
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.AppCopy
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.formatLongDate
import com.opudas.paint.core.util.openWhatsApp
import com.opudas.paint.core.util.sendEmail

/*
 * One notice, read in full.
 *
 * Rendered from structured prose rather than from HTML, which is why it works with no
 * signal and why it reads like the rest of the app instead of like a page dropped into
 * it. The revision date is at the top: a notice that cannot be aged cannot be relied
 * on, and the date is the one piece of metadata a reader needs before trusting the
 * rest.
 *
 * Where the notice carries its data-request form, the app puts its own form — the one
 * that queues the request locally and comes back with a reference and a deadline. The
 * position comes from the section marker in the bundle, not from an assumption about
 * which notice it lives in.
 */

@Composable
private fun rememberLegalDocViewModel(slug: String): LegalDocViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { LegalDocViewModel(context.container.content, slug) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LegalDocScreen(
    slug: String,
    onBack: () -> Unit,
    onOpenDoc: (String) -> Unit,
    onRequestData: () -> Unit,
    viewModel: LegalDocViewModel = rememberLegalDocViewModel(slug),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading the notice")
        return
    }

    val doc = state.doc
    if (doc == null) {
        EmptyState(
            title = "No notice with that reference",
            body = "It may have been renamed or retired since this build was made. The other " +
                "notices are still here.",
        )
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text(doc.title, style = MaterialTheme.typography.titleMedium, maxLines = 1)
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

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
        ) {
            item {
                Text(
                    "Revised " + (formatLongDate(doc.updated) ?: doc.updated),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                Text(doc.title, style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.height(8.dp))
                Text(doc.intro, style = MaterialTheme.typography.bodyMedium)
            }

            items(doc.sections) { section ->
                Column(Modifier.padding(top = 20.dp)) {
                    Text(section.heading, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(6.dp))
                    section.body.forEach { paragraph ->
                        Text(
                            paragraph,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(bottom = 10.dp),
                        )
                    }
                    val list = section.list
                    if (list != null) {
                        Column(Modifier.padding(bottom = 10.dp)) {
                            list.forEach { entry ->
                                Text(
                                    "·  $entry",
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(bottom = 4.dp),
                                )
                            }
                        }
                    }
                    if (section.form == LegalViewModel.DATA_REQUEST_FORM) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "You can make this request from the app. It is saved on this phone " +
                                "and sent when there is a signal, and it comes back with a " +
                                "reference and the date it has to be answered by.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(10.dp))
                        PrimaryAction(text = "Make a data request", onClick = onRequestData)
                    }
                }
            }

            if (state.others.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(20.dp))
                    SectionHeader(title = "The other notices")
                }
                items(state.others) { other ->
                    OtherDocRow(doc = other, onClick = { onOpenDoc(other.slug) })
                }
            }

            val contact = state.contact
            if (contact != null) {
                item {
                    Column(Modifier.padding(top = 20.dp)) {
                        SectionHeader(
                            title = "Questions about this notice",
                            subtitle = "Email ${AppCopy.PRIVACY_EMAIL}, or call and ask",
                        )
                        ContactActions(
                            phoneDisplay = contact.phoneDisplay,
                            phoneTel = contact.phoneTel,
                            whatsapp = contact.whatsapp,
                            onCall = { context.dial(contact.phoneTel) },
                            onWhatsApp = {
                                context.openWhatsApp(
                                    contact.whatsapp,
                                    "Hello OPUDA'S PAINT — I have a question about the " +
                                        "\"${doc.title}\" in your app.",
                                )
                            },
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Or write to ${AppCopy.PRIVACY_EMAIL}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier
                                .clickable(
                                    onClickLabel = "Email ${AppCopy.PRIVACY_EMAIL}",
                                    role = Role.Button,
                                ) {
                                    context.sendEmail(
                                        AppCopy.PRIVACY_EMAIL,
                                        "Question about the ${doc.title}",
                                        "",
                                    )
                                },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun OtherDocRow(doc: LegalDoc, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .background(
                MaterialTheme.colorScheme.surface,
                RoundedCornerShape(Brand.tokens.radius("sm")),
            )
            .clickable(onClickLabel = doc.title, role = Role.Button, onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(doc.title, style = MaterialTheme.typography.titleSmall)
            Text(
                "Revised " + (formatLongDate(doc.updated) ?: doc.updated),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
