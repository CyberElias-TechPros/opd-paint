package com.opudas.paint.feature.products

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import coil.compose.AsyncImage
import com.opudas.paint.container
import com.opudas.paint.core.data.assetUri
import com.opudas.paint.core.data.model.ApplicationStep
import com.opudas.paint.core.data.model.MediaEntry
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.data.thumbUri
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.HonestyBadge
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.engine.parseHex
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openWeb
import com.opudas.paint.core.util.openWhatsApp
import com.opudas.paint.core.util.plain

/*
 * A product's whole data sheet: what it is for, what it covers, how long it takes
 * to dry, how to apply it, and the documents behind all of that.
 *
 * The claims badge is the part that matters most and the part most apps leave out.
 * Two of these six products have had their label claims checked against the label;
 * four have not. Saying "eco-friendly" on a screen because the marketing copy says
 * it, when nobody has verified it against the tin, is how a paint company ends up
 * explaining itself to a customer with a receipt — so the app renders the
 * difference instead of smoothing it away.
 */

@Composable
private fun rememberProductDetailViewModel(productId: String): ProductDetailViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { ProductDetailViewModel(context.container.content, productId) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailScreen(
    productId: String,
    onBack: () -> Unit,
    onSizeThisJob: (String) -> Unit,
    viewModel: ProductDetailViewModel = rememberProductDetailViewModel(productId),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = state.product?.shortName ?: "Product",
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back to the range")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
    ) { innerPadding ->
        val product = state.product
        when {
            state.isLoading -> LoadingState(Modifier.padding(innerPadding), label = "Reading the data sheet")

            product == null -> EmptyState(
                title = "We do not have that product",
                body = "It may have been renamed, or the link may have been copied badly. " +
                    "The full range is six products — the desk can point you at the right one.",
                modifier = Modifier
                    .padding(innerPadding)
                    .fillMaxSize(),
            )

            else -> LazyColumn(
                modifier = Modifier
                    .padding(innerPadding)
                    .fillMaxSize(),
                contentPadding = PaddingValues(bottom = 32.dp),
            ) {
                item { ProductHero(image = state.image, name = product.name) }

                item {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 18.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(
                            text = product.line,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = product.name,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = product.tagline,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        HonestyBadge(
                            verified = state.claimVerified,
                            verifiedLabel = "Claims checked against the label",
                            unverifiedLabel = "Claims pending verification",
                        )
                        HonestNote(
                            text = if (state.claimVerified) {
                                "The claims on this product's label have been checked against the " +
                                    "label itself. SKU ${product.sku}."
                            } else {
                                "The claims below come from the product copy and have not yet been " +
                                    "checked against the label — treat them as the manufacturer's " +
                                    "wording, not as something we have verified. SKU ${product.sku}."
                            },
                        )
                    }
                }

                item {
                    ParagraphBlock(
                        modifier = Modifier.padding(horizontal = 20.dp),
                        text = product.description,
                    )
                }

                item {
                    SectionHeader(
                        title = "Specification",
                        subtitle = state.sheenLabel ?: product.finish,
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                }

                item {
                    Column(Modifier.padding(horizontal = 20.dp)) {
                        val unit = product.packs.firstOrNull()?.unit ?: "L"
                        val per = if (unit == "kg") "kilogram" else "litre"
                        FactRow(label = "Coverage", value = "${product.coveragePerUnit.plain()} m² per $per")
                        FactRow(label = "Coats recommended", value = "${product.coatsRecommended}")
                        FactRow(label = "Touch dry", value = "${product.touchDryHours} hour${plural(product.touchDryHours)}")
                        FactRow(label = "Recoat after", value = "${product.recoatHours} hour${plural(product.recoatHours)}")
                        FactRow(label = "Full cure", value = "${product.fullCureDays} day${plural(product.fullCureDays)}")
                        FactRow(label = "Finish", value = product.finish)
                        // The label text is the business's own wording for this
                        // finish ("Flat — under 5% sheen"), so it is shown in
                        // preference to the raw number: a bare figure invites a
                        // reading of its scale that nothing in the data states.
                        FactRow(label = "Sheen", value = state.sheenLabel ?: "${product.sheenLevel}")
                        FactRow(label = "Guarantee", value = "${product.guaranteeYears} year${plural(product.guaranteeYears)}")
                        FactRow(label = "Sold in", value = viewModel.packSizes(product).joinToString(", "))
                    }
                }

                item {
                    HonestNote(
                        text = "Pack sizes are what this product is sold in, not what anybody has " +
                            "on a shelf today. There is no price and no stock figure in this app: " +
                            "both change by dealer and by week, and a number on a screen that " +
                            "nobody updates becomes a promise the business did not make.",
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                    )
                }

                item {
                    SectionHeader(
                        title = "Best for",
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                }
                item {
                    ParagraphBlock(
                        modifier = Modifier.padding(horizontal = 20.dp),
                        text = product.bestFor,
                    )
                }

                item {
                    SectionHeader(
                        title = "Surfaces",
                        subtitle = product.surfaces.joinToString(" · "),
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                }

                item {
                    SectionHeader(
                        title = "Dilution and VOC",
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                }
                item {
                    Column(
                        Modifier.padding(horizontal = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        ParagraphBlock(text = product.dilution)
                        ParagraphBlock(text = product.voc)
                    }
                }

                item {
                    SectionHeader(
                        title = "What it does",
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                }
                item {
                    Column(
                        Modifier.padding(horizontal = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        product.features.forEach { feature ->
                            BulletRow(feature)
                        }
                    }
                }

                item {
                    SectionHeader(
                        title = "How to apply it",
                        subtitle = "${product.application.size} steps, in order",
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                }
                itemsIndexed(product.application) { index, step ->
                    ApplicationStepRow(index = index + 1, step = step)
                }

                if (state.sheets.isNotEmpty()) {
                    item {
                        SectionHeader(
                            title = "Documents",
                            subtitle = "Open on opudapaint.com — these need a connection",
                            modifier = Modifier.padding(horizontal = 20.dp),
                        )
                    }
                    items(state.sheets) { sheet ->
                        DocumentRow(label = sheet.label, onClick = { context.openWeb(sheet.url) })
                    }
                }

                if (state.gallery.isNotEmpty()) {
                    item {
                        SectionHeader(
                            title = "Also in pictures",
                            modifier = Modifier.padding(horizontal = 20.dp),
                        )
                    }
                    items(state.gallery) { entry ->
                        GalleryImage(entry = entry)
                    }
                }

                item {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        PrimaryAction(
                            text = "Size a job with this product",
                            onClick = { onSizeThisJob(product.id) },
                        )
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
                                        "Hello ${product.line} — I would like to ask about ${product.name}.",
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

private fun plural(count: Int): String = if (count == 1) "" else "s"

@Composable
private fun ProductHero(image: MediaEntry?, name: String) {
    val tint = image?.let { parseHex(it.tint) }
    Box(
        Modifier
            .fillMaxWidth()
            .height(240.dp)
            .background(
                tint?.let { Color(it.r, it.g, it.b) } ?: MaterialTheme.colorScheme.surfaceVariant,
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (image == null) {
            Text(
                text = name,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(20.dp),
            )
        } else {
            AsyncImage(
                model = image.assetUri,
                contentDescription = image.alt,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }
    }
}

@Composable
private fun ParagraphBlock(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.fillMaxWidth(),
    )
}

@Composable
private fun BulletRow(text: String) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier
                .padding(top = 8.dp)
                .size(6.dp)
                .clip(RoundedCornerShape(Brand.tokens.radius("xs")))
                .background(MaterialTheme.colorScheme.primary),
        )
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun ApplicationStepRow(index: Int, step: ApplicationStep) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 5.dp),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(Brand.tokens.radius("sm")))
                    .background(MaterialTheme.colorScheme.secondaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "$index",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = step.step,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = step.detail,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun DocumentRow(label: String, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 5.dp)
            .clickable(onClickLabel = label, role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f),
            )
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

@Composable
private fun GalleryImage(entry: MediaEntry) {
    val tint = parseHex(entry.tint)
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 5.dp)
            .height(180.dp)
            .clip(RoundedCornerShape(Brand.tokens.radius("md")))
            .background(
                tint?.let { Color(it.r, it.g, it.b) } ?: MaterialTheme.colorScheme.surfaceVariant,
            ),
    ) {
        AsyncImage(
            model = entry.thumbUri,
            contentDescription = entry.alt,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
        )
    }
}
