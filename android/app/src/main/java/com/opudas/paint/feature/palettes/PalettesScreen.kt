package com.opudas.paint.feature.palettes

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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.Palette
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ColourSwatch
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FilterChipRow
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SectionHeader

/*
 * Palettes that work together, with the job each colour does.
 *
 * The four squares are the easy part. What makes a palette useful to somebody who
 * has not painted a room before is the roles list beside it — feature wall, main
 * walls, ceilings and trim, accent — because that is the question a colour chart
 * cannot answer. So a card shows both, and the roles are never dropped to make the
 * swatches bigger.
 */

@Composable
private fun rememberPalettesViewModel(): PalettesViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { PalettesViewModel(context.container.content) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PalettesScreen(
    onBack: () -> Unit,
    onOpenPalette: (String) -> Unit,
    onOpenColour: (String) -> Unit,
    viewModel: PalettesViewModel = rememberPalettesViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading the palettes")
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text("Palettes", style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
                    title = "Colours that work together",
                    subtitle = "Nine palettes, each with the job every colour in it does",
                )
            }

            if (state.seasons.isNotEmpty()) {
                item {
                    FilterChipRow(
                        options = state.seasons,
                        selected = state.selectedSeason,
                        onSelect = viewModel::onSeasonSelect,
                        allLabel = "All seasons",
                    )
                }
            }

            items(state.palettes) { palette ->
                PaletteCard(
                    palette = palette,
                    colors = state.colors[palette.id].orEmpty(),
                    onClick = { onOpenPalette(palette.id) },
                    onOpenColour = onOpenColour,
                )
            }

            if (state.isEmpty) {
                item {
                    EmptyState(
                        title = "No palettes in that season",
                        body = "Try another season, or look at the whole colour library instead.",
                    )
                }
            }
        }
    }
}

@Composable
private fun PaletteCard(
    palette: Palette,
    colors: List<PaintColor>,
    onClick: () -> Unit,
    onOpenColour: (String) -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable(onClickLabel = palette.name, role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                colors.forEach { color ->
                    ColourSwatch(
                        hex = color.hex,
                        name = color.name,
                        code = color.code,
                        modifier = Modifier.weight(1f),
                        onClick = { onOpenColour(color.id) },
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(palette.name, style = MaterialTheme.typography.titleMedium)
            Text(
                palette.season,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(6.dp))
            // The roles, paired with nothing: the detail screen pairs each one with
            // its colour. Here they answer "what am I actually buying?" at a glance.
            Text(
                palette.roles.joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                palette.bestFor,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
