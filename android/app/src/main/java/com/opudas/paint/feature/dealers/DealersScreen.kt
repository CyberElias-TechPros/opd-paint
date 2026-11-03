package com.opudas.paint.feature.dealers

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import com.opudas.paint.core.designsystem.FilterChipRow
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.HonestyBadge
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openWhatsApp

/*
 * Where to buy.
 *
 * The part of this screen that matters is the part that is easy to leave out:
 * eight of these fourteen counters have been confirmed in the current review
 * cycle and six have not. Both are listed. A locator that showed only the
 * confirmed ones would look tidier and would send somebody to a counter that
 * might not be there while hiding the one down the road that is — and the six
 * unconfirmed entries carry the website's own sentence about calling before
 * travelling, on the card, before anybody has driven anywhere.
 *
 * No distances and no "near me": that would need a location permission, and a
 * paint app asking where you are to show you a shop is a trade the customer did
 * not agree to. State, city and a map link do the job without it.
 */

@Composable
private fun rememberDealersViewModel(): DealersViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { DealersViewModel(context.container.content) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DealersScreen(
    onBack: () -> Unit,
    onOpenDealer: (String) -> Unit,
    viewModel: DealersViewModel = rememberDealersViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading the dealer list")
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text("Where to buy", style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
                SectionHeader(
                    title = "Counters and dealers",
                    subtitle = "Brand trade counters and authorised dealers stock the full range. " +
                        "Call ahead to confirm the pack size and colour — we would rather you " +
                        "arrived certain than hopeful.",
                )
            }

            item {
                OutlinedTextField(
                    value = state.query,
                    onValueChange = viewModel::onQueryChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Search by name, area, city or service") },
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                    trailingIcon = {
                        if (state.query.isNotEmpty()) {
                            IconButton(onClick = { viewModel.onQueryChange("") }) {
                                Icon(Icons.Filled.Close, contentDescription = "Clear the search")
                            }
                        }
                    },
                )
            }

            item {
                Spacer(Modifier.height(10.dp))
                FilterChipRow(
                    options = state.states,
                    selected = state.selectedState,
                    onSelect = viewModel::onStateSelect,
                    allLabel = "All states",
                )
            }

            if (state.services.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "What you need it to do",
                        style = MaterialTheme.typography.labelLarge,
                    )
                    Spacer(Modifier.height(6.dp))
                    ServiceChips(
                        options = state.services,
                        selected = state.selectedServices,
                        onToggle = viewModel::onToggleService,
                    )
                }
            }

            if (state.hasFilters) {
                item {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(
                            "${state.dealers.size} of ${state.totalCount} shown",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f),
                        )
                        SecondaryAction(text = "Clear filters", onClick = viewModel::onClearFilters)
                    }
                }
            }

            item {
                Spacer(Modifier.height(12.dp))
                HonestNote(
                    "${state.totalCount - state.unverifiedCount} of ${state.totalCount} counters were " +
                        "confirmed in the current review cycle. The rest are marked, and worth a call " +
                        "before you travel.",
                )
            }

            items(state.dealers) { dealer ->
                DealerCard(dealer = dealer, onClick = { onOpenDealer(dealer.id) })
            }

            if (state.isEmpty) {
                item {
                    EmptyState(
                        title = "No counter matches that",
                        body = "Nothing in the list matches those filters. Try a wider search, or " +
                            "call the commercial team — they will tell you who is nearest.",
                        action = { SecondaryAction(text = "Clear filters", onClick = viewModel::onClearFilters) },
                    )
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

            val contact = state.contact
            if (contact != null) {
                item {
                    Column(Modifier.padding(top = 16.dp)) {
                        SectionHeader(
                            title = "If a counter has moved",
                            subtitle = "Tell the commercial team and they will correct the list",
                        )
                        ContactActions(
                            phoneDisplay = contact.phoneDisplay,
                            phoneTel = contact.phoneTel,
                            whatsapp = contact.whatsapp,
                            onCall = { context.dial(contact.phoneTel) },
                            onWhatsApp = {
                                context.openWhatsApp(
                                    contact.whatsapp,
                                    "Hello OPUDA'S PAINT — a dealer entry in the app looks wrong. " +
                                        "Here is what I found: ",
                                )
                            },
                        )
                    }
                }
            }
        }
    }
}

/**
 * Services filter, multi-select.
 *
 * Not [FilterChipRow]: that component carries an "All" option and replaces the
 * selection, which is right for one state out of ten and wrong for "colour mixing
 * and a site visit", which is one question about two services.
 */
@Composable
private fun ServiceChips(
    options: List<String>,
    selected: Set<String>,
    onToggle: (String) -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { option ->
            FilterChip(
                selected = selected.contains(option),
                onClick = { onToggle(option) },
                label = { Text(option) },
            )
        }
    }
}

@Composable
private fun DealerCard(dealer: Dealer, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp)
            .clickable(onClickLabel = dealer.name, role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(16.dp)) {
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
            Text(dealer.name, style = MaterialTheme.typography.titleMedium)
            Text(
                "${dealer.area}, ${dealer.city} · ${dealer.state}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))
            Text(dealer.services.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(2.dp))
            Text(
                dealer.hours,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (!dealer.verified) {
                Spacer(Modifier.height(8.dp))
                HonestNote(
                    "Stock and opening hours for this counter are being confirmed. " +
                        "Please call before travelling.",
                )
            }
        }
    }
}
