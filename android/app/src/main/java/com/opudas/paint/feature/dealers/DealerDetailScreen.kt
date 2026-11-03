package com.opudas.paint.feature.dealers

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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.model.Dealer
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.HonestyBadge
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openDirections
import com.opudas.paint.core.util.openWhatsApp

/*
 * One counter: where it is, when it is open, what it can do, and how to get there.
 *
 * Two things this screen is careful about.
 *
 * The badge. Eight of fourteen counters were confirmed in the current review
 * cycle; six were not, and the six say so here in the same words the website uses,
 * above any button that would start a journey.
 *
 * The telephone number. The bundle has no direct line per counter, so the number
 * offered is the commercial team's, and the screen says whose number it is rather
 * than labelling it "call this dealer" — which would imply a phone on a counter
 * that this app has no evidence for.
 */

@Composable
private fun rememberDealerDetailViewModel(dealerId: String): DealerDetailViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { DealerDetailViewModel(context.container.content, dealerId) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DealerDetailScreen(
    dealerId: String,
    onBack: () -> Unit,
    onOpenDealer: (String) -> Unit,
    viewModel: DealerDetailViewModel = rememberDealerDetailViewModel(dealerId),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading the counter")
        return
    }

    val dealer = state.dealer
    if (dealer == null) {
        EmptyState(
            title = "No counter with that reference",
            body = "It may have been removed from the list since this build was made. " +
                "The commercial team can tell you who is nearest.",
            action = {
                val contact = state.contact
                if (contact != null) {
                    SecondaryAction(
                        text = "Call the commercial team",
                        onClick = { context.dial(contact.phoneTel) },
                    )
                }
            },
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
                Text(dealer.name, style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        dealer.kind,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    HonestyBadge(
                        verified = dealer.verified,
                        verifiedLabel = "Verified",
                        unverifiedLabel = "Being confirmed",
                    )
                }
                Spacer(Modifier.height(6.dp))
                Text(dealer.name, style = MaterialTheme.typography.headlineSmall)
                Text(
                    "${dealer.area}, ${dealer.city} · ${dealer.state}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (!dealer.verified) {
                item {
                    Spacer(Modifier.height(12.dp))
                    HonestNote(
                        "Stock and opening hours for this counter are being confirmed. " +
                            "Please call before travelling.",
                    )
                }
            }

            item {
                Spacer(Modifier.height(14.dp))
                PrimaryAction(
                    text = "Open in maps",
                    onClick = { context.openDirections(dealer.lat, dealer.lng, dealer.name) },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            item {
                Spacer(Modifier.height(16.dp))
                SectionHeader(title = "The details")
                FactRow(label = "Opening hours", value = dealer.hours)
                FactRow(label = "Area", value = dealer.area)
                FactRow(label = "City", value = dealer.city)
                FactRow(label = "State", value = dealer.state)
            }

            item {
                Spacer(Modifier.height(16.dp))
                SectionHeader(
                    title = "What this counter does",
                    subtitle = "As recorded by the commercial team, not promised by this app",
                )
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    dealer.services.forEach { service ->
                        Text("·  $service", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }

            val contact = state.contact
            if (contact != null) {
                item {
                    Column(Modifier.padding(top = 20.dp)) {
                        SectionHeader(
                            title = "Call before you travel",
                            subtitle = "This is the commercial team's number — the list carries no " +
                                "direct line for individual counters.",
                        )
                        ContactActions(
                            phoneDisplay = contact.phoneDisplay,
                            phoneTel = contact.phoneTel,
                            whatsapp = contact.whatsapp,
                            onCall = { context.dial(contact.phoneTel) },
                            onWhatsApp = {
                                context.openWhatsApp(
                                    contact.whatsapp,
                                    "Hello OPUDA'S PAINT — I am planning to visit ${dealer.name} " +
                                        "in ${dealer.area}, ${dealer.city}. Could you confirm stock " +
                                        "and opening hours?",
                                )
                            },
                        )
                    }
                }
            }

            if (state.nearby.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(20.dp))
                    SectionHeader(
                        title = "Also in the area",
                        subtitle = "Worth knowing before making a trip of it",
                    )
                }
                items(state.nearby) { other ->
                    NearbyRow(dealer = other, onClick = { onOpenDealer(other.id) })
                }
            }

            item {
                Spacer(Modifier.height(16.dp))
                HonestNote(
                    "Dealer locations are maintained by the commercial team and reviewed monthly. " +
                        "Addresses and opening hours can change without notice; an entry marked " +
                        "verified has been confirmed in the current review cycle.",
                )
            }
        }
    }
}

@Composable
private fun NearbyRow(dealer: Dealer, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp)
            .clickable(onClickLabel = dealer.name, role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(dealer.name, style = MaterialTheme.typography.titleSmall, maxLines = 2)
                Text(
                    "${dealer.area}, ${dealer.city}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            HonestyBadge(
                verified = dealer.verified,
                verifiedLabel = "Verified",
                unverifiedLabel = "Being confirmed",
            )
        }
    }
}
