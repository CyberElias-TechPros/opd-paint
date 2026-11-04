package com.opudas.paint.feature.products

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import com.opudas.paint.core.data.model.MediaEntry
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.data.thumbUri
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FilterChipRow
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.HonestyBadge
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.engine.parseHex

/*
 * The range: six products, what each is for, what it covers, and the sizes it
 * comes in.
 *
 * No price, and no "in stock" — see the ViewModel for why. Where a customer
 * expects a price, the note at the bottom of the list says what happens instead,
 * because an empty space where a price should be reads as though the app is
 * hiding one.
 */

@Composable
private fun rememberProductsViewModel(): ProductsViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { ProductsViewModel(context.container.content) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductsScreen(
    onBack: () -> Unit,
    onOpenProduct: (String) -> Unit,
    viewModel: ProductsViewModel = rememberProductsViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    if (state.isLoading) {
        LoadingState(label = "Reading the product range")
        return
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Products",
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
        },
    ) { innerPadding ->
        Column(
            Modifier
                .padding(innerPadding)
                .fillMaxSize(),
        ) {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::onQueryChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                placeholder = { Text("Search a product or a surface — try \"ceiling\"") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                trailingIcon = {
                    if (state.query.isNotEmpty()) {
                        IconButton(onClick = { viewModel.onQueryChange("") }) {
                            Icon(Icons.Filled.Close, contentDescription = "Clear the search")
                        }
                    }
                },
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
            )

            FilterChipRow(
                options = state.finishes,
                selected = state.selectedFinish,
                onSelect = viewModel::onFinishSelect,
                allLabel = "All finishes",
            )

            SectionHeader(
                title = if (state.query.isBlank() && state.selectedFinish == null) {
                    "${state.products.size} products"
                } else {
                    "${state.visible.size} of ${state.products.size}"
                },
                subtitle = "Coverage, drying times and pack sizes from the technical data sheets",
                modifier = Modifier.padding(horizontal = 20.dp),
            )

            if (state.visible.isEmpty()) {
                EmptyState(
                    title = "Nothing matches that",
                    body = "There are ${state.products.size} products in the range. Try a finish — " +
                        "matt, silk, gloss — or what you are painting: walls, ceilings, metal, exterior.",
                    modifier = Modifier.fillMaxSize(),
                    action = { SecondaryAction(text = "Clear the search", onClick = viewModel::clearFilters) },
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 28.dp),
                ) {
                    items(state.visible, key = { it.id }) { product ->
                        ProductRow(
                            product = product,
                            image = state.images[product.id],
                            sheenLabel = state.sheenLabels[product.finish],
                            coverage = viewModel.coverageLabel(product),
                            packs = viewModel.packSummary(product),
                            claimVerified = viewModel.isClaimVerified(product),
                            onClick = { onOpenProduct(product.id) },
                        )
                    }
                    item {
                        HonestNote(
                            text = "No prices and no stock figures in this app. Sizes are what the " +
                                "product is sold in; whether a dealer has one today is a phone call. " +
                                "Open a product for its data sheet, or ask the desk for a quote.",
                            modifier = Modifier.padding(top = 16.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProductRow(
    product: Product,
    image: MediaEntry?,
    sheenLabel: String?,
    coverage: String,
    packs: String,
    claimVerified: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp)
            .clickable(onClickLabel = product.name, role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            ProductThumb(image = image, name = product.shortName)

            Column(
                Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = product.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = if (sheenLabel == null) product.finish else "${product.finish} — $sheenLabel",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = coverage,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "Sold in $packs",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                HonestyBadge(
                    verified = claimVerified,
                    verifiedLabel = "Claims checked against the label",
                    unverifiedLabel = "Claims pending verification",
                )
            }

            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

/**
 * The product's own photograph, or its dominant colour while that decodes.
 *
 * The tint comes from the media manifest, which measured it when the image was
 * generated — so the placeholder is the colour of the thing itself rather than a
 * grey box, and a list of six products reads as six paints even before a single
 * byte of WebP has arrived.
 */
@Composable
private fun ProductThumb(image: MediaEntry?, name: String) {
    val shape = RoundedCornerShape(Brand.tokens.radius("sm"))
    val tint = image?.let { parseHex(it.tint) }
    Box(
        Modifier
            .size(width = 68.dp, height = 84.dp)
            .clip(shape)
            .background(
                tint?.let { Color(it.r, it.g, it.b) } ?: MaterialTheme.colorScheme.surfaceVariant,
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (image == null) {
            Text(
                text = name,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            AsyncImage(
                model = image.thumbUri,
                contentDescription = image.alt,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }
    }
}
