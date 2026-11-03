package com.opudas.paint.feature.more

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Create
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.BuildConfig
import com.opudas.paint.container
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.AppCopy
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openWeb
import com.opudas.paint.core.util.openWhatsApp
import com.opudas.paint.core.util.sendEmail

/*
 * Who to talk to, and what this build actually knows.
 *
 * Deliberately not a settings dumping ground. The three things on this screen are
 * the three a customer or a dealer needs at the end of a session: a way to reach a
 * person, the privacy notice, and an honest account of the data behind the app —
 * including how much of it the commercial team has not confirmed yet.
 */

@Composable
private fun rememberMoreViewModel(): MoreViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { MoreViewModel(context.container.content) }
        },
    )
}

@Composable
fun MoreScreen(
    onOpenColourLibrary: () -> Unit,
    onOpenProducts: () -> Unit,
    onOpenCalculator: () -> Unit,
    onOpenQuote: () -> Unit,
    onOpenDealers: () -> Unit,
    viewModel: MoreViewModel = rememberMoreViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading the app's own details")
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
    ) {
        item {
            SectionHeader(
                title = "Talk to the desk",
                subtitle = "Every enquiry in this app ends with a person, not a checkout",
            )
        }

        item {
            val contact = state.contact
            if (contact != null) {
                Column {
                    ContactActions(
                        phoneDisplay = contact.phoneDisplay,
                        phoneTel = contact.phoneTel,
                        whatsapp = contact.whatsapp,
                        onCall = { context.dial(contact.phoneTel) },
                        onWhatsApp = {
                            context.openWhatsApp(
                                contact.whatsapp,
                                "Hello OPUDA'S PAINT — I am using the app and have a question.",
                            )
                        },
                    )
                    Spacer(Modifier.height(10.dp))
                    LinkRow(
                        icon = Icons.Filled.Email,
                        title = "Email ${AppCopy.PRIVACY_EMAIL}",
                        subtitle = "Questions, samples, and anything about your data",
                        onClick = {
                            context.sendEmail(
                                AppCopy.PRIVACY_EMAIL,
                                "Question from the OPUDA'S PAINT app",
                            )
                        },
                    )
                    LinkRow(
                        icon = Icons.AutoMirrored.Filled.ArrowForward,
                        title = "Open the website",
                        subtitle = AppCopy.WEBSITE,
                        onClick = { context.openWeb(AppCopy.WEBSITE) },
                    )
                    LinkRow(
                        icon = Icons.Filled.Search,
                        title = "Colour library",
                        subtitle = "${state.colourCount} colours, searchable offline",
                        onClick = onOpenColourLibrary,
                    )
                    LinkRow(
                        icon = Icons.AutoMirrored.Filled.List,
                        title = "Products",
                        subtitle = "${state.productCount} products, with their data sheets",
                        onClick = onOpenProducts,
                    )
                    LinkRow(
                        icon = Icons.Filled.Create,
                        title = "Size a job",
                        subtitle = "Measure a room and get the tins it takes",
                        onClick = onOpenCalculator,
                    )
                    LinkRow(
                        icon = Icons.AutoMirrored.Filled.Send,
                        title = "Ask for a quote",
                        subtitle = "Saved on this phone, sent when there is a signal",
                        onClick = onOpenQuote,
                    )
                    LinkRow(
                        icon = Icons.Filled.Place,
                        title = "Where to buy",
                        subtitle = "${state.dealerCount} counters, ${state.unverifiedDealerCount} still being confirmed",
                        onClick = onOpenDealers,
                    )
                }
            }
        }

        item {
            SectionHeader(
                title = "Privacy and your data",
                subtitle = "What is stored, for how long, and how to ask us to delete it",
            )
        }

        item {
            Column {
                HonestNote(
                    text = "Nothing leaves this phone until you send it. An enquiry you write with no signal " +
                        "waits on the device and is delivered when there is a network — and it is never " +
                        "included in a backup, because a copy of your name and phone number in a cloud " +
                        "backup is a copy the privacy notice does not describe.",
                )
                Spacer(Modifier.height(10.dp))
                LinkRow(
                    icon = Icons.AutoMirrored.Filled.ArrowForward,
                    title = "Read the privacy notice",
                    subtitle = "The same notice the website publishes, including the 30-day answer to a request",
                    onClick = { context.openWeb(AppCopy.privacyNoticeUrl) },
                )
                LinkRow(
                    icon = Icons.Filled.Email,
                    title = "Ask us to delete what we hold",
                    subtitle = "A statutory right, answered within 30 days",
                    onClick = {
                        context.sendEmail(
                            AppCopy.PRIVACY_EMAIL,
                            "Data subject request — erasure",
                            "Please delete the personal data you hold for me.\n\nName: \nEmail used: \nEnquiry reference (if you have one): \n",
                        )
                    },
                )
            }
        }

        item {
            SectionHeader(
                title = "What this build knows",
                subtitle = "The content ships inside the app, generated from the same files the website renders",
            )
        }

        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(Brand.tokens.radius("md")),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            ) {
                Column(Modifier.padding(16.dp)) {
                    FactRow("Colours", "${state.colourCount}, with codes, undertones and LRV")
                    FactRow("Products", "${state.productCount}, with their technical and safety data sheets")
                    FactRow("Guides", "${state.guideCount} articles, each with a named reviewer")
                    FactRow("Photographs", "${state.imageCount}, all our own work or labelled concept art")
                    FactRow(
                        "Dealers",
                        "${state.dealerCount} — ${state.unverifiedDealerCount} still to be confirmed",
                    )
                    FactRow("Version", BuildConfig.VERSION_NAME)
                }
            }
        }

        item {
            Column(Modifier.padding(vertical = 20.dp)) {
                HonestNote(
                    text = "No prices, no stock counts and no checkout appear anywhere in this app. That is a " +
                        "recorded decision, not an omission: a price that is wrong is worse than no price, and " +
                        "this company sells through a desk and a dealer network. The reasons are written down " +
                        "in the repository's architecture decision records.",
                )
                Spacer(Modifier.height(16.dp))
                Text(
                    text = "OPUDA'S PAINT · Port Harcourt",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun LinkRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp)
            .clickable(onClickLabel = title, role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleSmall)
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
