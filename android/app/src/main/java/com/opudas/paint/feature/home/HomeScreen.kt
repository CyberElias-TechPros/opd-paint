package com.opudas.paint.feature.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.R
import com.opudas.paint.container
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.Palette
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ColourSwatch
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.engine.parseHex
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openWhatsApp

/*
 * The home screen.
 *
 * It answers three questions in the order a customer asks them: what is this
 * (the mark, the guarantee, one sentence), who do I talk to (call and WhatsApp
 * above the fold, because on this product the conversation *is* the conversion),
 * and what can I look at (the colour library, which is the reason to open the app
 * again).
 *
 * What it does not do is sell. There is no price, no offer, no countdown and no
 * "in stock" anywhere in this app — see `docs/adr/0003-no-e-commerce-at-launch.md`.
 * Where a visitor would expect a price, [HonestNote] says what happens instead.
 */

@Composable
private fun rememberHomeViewModel(): HomeViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { HomeViewModel(context.container.content) }
        },
    )
}

@Composable
fun HomeScreen(
    onOpenColours: () -> Unit,
    onOpenColour: (String) -> Unit,
    onOpenMore: () -> Unit,
    viewModel: HomeViewModel = rememberHomeViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    if (state.isLoading) {
        LoadingState(label = "Opening the colour library")
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(bottom = 32.dp),
    ) {
        item { BrandHeader() }

        item {
            Column(Modifier.padding(horizontal = 20.dp)) {
                Text(
                    text = "Colour you can stand inside.",
                    style = MaterialTheme.typography.displaySmall,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Fifty-nine colours measured from our own fan deck, six products with their data sheets, " +
                        "and a desk in Port Harcourt that answers within a day. Nothing here is a checkout — " +
                        "every enquiry goes to a person.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(18.dp))

                val contact = state.contact
                if (contact != null) {
                    ContactActions(
                        phoneDisplay = contact.phoneDisplay,
                        phoneTel = contact.phoneTel,
                        whatsapp = contact.whatsapp,
                        onCall = { context.dial(contact.phoneTel) },
                        onWhatsApp = {
                            context.openWhatsApp(
                                contact.whatsapp,
                                "Hello OPUDA'S PAINT — I am using the app and would like to ask about a colour.",
                            )
                        },
                    )
                }
            }
        }

        item {
            LibrarySummary(
                colourCount = state.colourCount,
                productCount = state.productCount,
                dealerCount = state.dealerCount,
                unverifiedDealerCount = state.unverifiedDealerCount,
                guideCount = state.guideCount,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 20.dp),
            )
        }

        item {
            SectionHeader(
                title = "The Signature collection",
                subtitle = "The colours the printed book leads with",
                modifier = Modifier.padding(horizontal = 20.dp),
                action = {
                    Text(
                        text = "All ${state.colourCount}",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(Brand.tokens.radius("xs")))
                            .clickable(onClickLabel = "See the whole library", role = Role.Button, onClick = onOpenColours)
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                    )
                },
            )
        }

        item {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(horizontal = 20.dp),
            ) {
                items(state.featured, key = { it.id }) { color ->
                    ColourSwatch(
                        hex = color.hex,
                        name = color.name,
                        code = color.code,
                        modifier = Modifier.width(140.dp),
                        onClick = { onOpenColour(color.id) },
                    )
                }
            }
        }

        state.palette?.let { palette ->
            item {
                PaletteCard(
                    palette = palette,
                    colors = state.paletteColors,
                    onOpenColour = onOpenColour,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 24.dp),
                )
            }
        }

        item {
            Column(Modifier.padding(horizontal = 20.dp)) {
                HonestNote(
                    text = "No prices, no stock counts and no checkout. A colour costs what it costs at your " +
                        "nearest dealer, and the desk will tell you — that is what the call and the WhatsApp " +
                        "button are for.",
                )
                Spacer(Modifier.height(12.dp))
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(
                            onClickLabel = "Documents, privacy and the trade inbox",
                            role = Role.Button,
                            onClick = onOpenMore,
                        ),
                    shape = RoundedCornerShape(Brand.tokens.radius("md")),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                ) {
                    Row(
                        Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("Documents, privacy and the trade inbox", style = MaterialTheme.typography.titleMedium)
                            Text(
                                "The colour book, the data sheets, what we hold about you, and the desk's own enquiry log.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Box(
                            Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(Brand.tokens.radius("sm")))
                                .background(MaterialTheme.colorScheme.secondaryContainer),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("→", color = MaterialTheme.colorScheme.onSecondaryContainer, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BrandHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // The same vector the launcher icon uses, so the mark on the home screen
        // and the mark on the home screen of the phone are one drawing.
        Image(
            painter = painterResource(R.drawable.ic_launcher_foreground),
            contentDescription = "OPUDA'S PAINT",
            modifier = Modifier.size(44.dp),
        )
        Spacer(Modifier.width(12.dp))
        Column {
            Text(
                text = "OPUDA'S",
                style = MaterialTheme.typography.titleLarge,
                letterSpacing = 1.5.sp,
            )
            Text(
                text = "PAINT · PORT HARCOURT",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 1.2.sp,
            )
        }
        Spacer(Modifier.weight(1f))
        Surface(
            shape = RoundedCornerShape(Brand.tokens.radius("xs")),
            color = MaterialTheme.colorScheme.primaryContainer,
        ) {
            Text(
                text = "5-year guarantee",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            )
        }
    }
}

@Composable
private fun LibrarySummary(
    colourCount: Int,
    productCount: Int,
    dealerCount: Int,
    unverifiedDealerCount: Int,
    guideCount: Int,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        SummaryTile("Colours", colourCount.toString(), Modifier.weight(1f))
        SummaryTile("Products", productCount.toString(), Modifier.weight(1f))
        SummaryTile("Guides", guideCount.toString(), Modifier.weight(1f))
        SummaryTile(
            label = "Dealers",
            value = dealerCount.toString(),
            modifier = Modifier.weight(1f),
            // The number that matters is the one still to be confirmed, so it is
            // shown rather than left for somebody to discover on a phone call.
            note = "$unverifiedDealerCount to confirm",
        )
    }
}

@Composable
private fun SummaryTile(label: String, value: String, modifier: Modifier = Modifier, note: String? = null) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 12.dp)) {
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (note != null) {
                Text(
                    text = note,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.tertiary,
                )
            }
        }
    }
}

@Composable
private fun PaletteCard(
    palette: Palette,
    colors: List<PaintColor>,
    onOpenColour: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Brand.tokens.radius("lg")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(18.dp)) {
            Text(palette.season.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(4.dp))
            Text(palette.name, style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(8.dp))
            Text(
                palette.story,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(16.dp))

            // The scheme as the book prints it: one strip per colour with the role
            // it plays, because "which wall goes dark" is the question a palette
            // has to answer.
            colors.forEachIndexed { index, color ->
                val role = palette.roles.getOrNull(index) ?: ""
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    val rgb = parseHex(color.hex)
                    Box(
                        Modifier
                            .size(38.dp)
                            .clip(RoundedCornerShape(Brand.tokens.radius("sm")))
                            .background(rgb?.let { Color(it.r, it.g, it.b) } ?: MaterialTheme.colorScheme.surfaceVariant),
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(color.name, style = MaterialTheme.typography.titleSmall)
                        Text(role, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(
                        text = color.code,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "Open",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(Brand.tokens.radius("xs")))
                            .clickable(
                                onClickLabel = "Open ${color.name}",
                                role = Role.Button,
                            ) { onOpenColour(color.id) }
                            .padding(horizontal = 6.dp, vertical = 4.dp),
                    )
                }
            }
        }
    }
}
