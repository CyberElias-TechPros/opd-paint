package com.opudas.paint.feature.board

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.BoardRepository
import com.opudas.paint.core.data.model.SavedEstimate
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ColourSwatch
import com.opudas.paint.core.designsystem.FormField
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.plain

/*
 * The project board.
 *
 * What somebody has gathered towards one job: colours they are considering, products
 * they intend to use, quantities they measured with the calculator, and the condition
 * the walls are in. The website keeps the same board in local storage; this keeps it in
 * the app's own database, and the two hold the same fields with the same limits, so a
 * board means the same thing on either.
 *
 * Saving happens elsewhere — a colour page, a product page, the calculator — and this
 * screen is where it lands. It observes the board rather than being told to refresh, so
 * a quantity saved a moment ago is already here.
 */

@Composable
private fun rememberBoardViewModel(): BoardViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { BoardViewModel(context.container.board, context.container.content) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BoardScreen(
    onBack: () -> Unit,
    onOpenChecklist: () -> Unit,
    viewModel: BoardViewModel = rememberBoardViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text("Project board", style = MaterialTheme.typography.titleMedium, maxLines = 1)
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

        if (state.isLoading) {
            LoadingState(Modifier.fillMaxSize(), label = "Reading your board")
            return@Column
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
        ) {
            item {
                SectionHeader(
                    title = "One job, in one place",
                    subtitle = if (state.isEmpty) {
                        "Nothing saved yet. Save a colour, a product or a measured quantity " +
                            "and it gathers here."
                    } else {
                        "${state.savedCount} saved · the checklist this produces is the order " +
                            "the guides publish"
                    },
                )
                FormField(
                    label = "Project name",
                    value = state.boardName,
                    onValueChange = viewModel::onNameChange,
                    supporting = "${state.boardName.length} of ${BoardRepository.NAME_LIMIT} characters",
                )
            }

            if (state.colours.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(12.dp))
                    Text("Colours", style = MaterialTheme.typography.titleSmall)
                }
                item {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        state.colours.forEach { colour ->
                            Column(
                                Modifier.weight(1f),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                ColourSwatch(
                                    hex = colour.hex,
                                    name = colour.name,
                                    code = colour.code,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                                IconButton(
                                    onClick = { viewModel.removeColour(colour.id) },
                                    modifier = Modifier.height(32.dp),
                                ) {
                                    Icon(
                                        Icons.Filled.Close,
                                        contentDescription = "Take ${colour.name} off the board",
                                    )
                                }
                            }
                        }
                    }
                }
            }

            if (state.products.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(12.dp))
                    Text("Products", style = MaterialTheme.typography.titleSmall)
                }
                state.products.forEach { product ->
                    item {
                        BoardRow(
                            title = product.name,
                            subtitle = product.finish +
                                " · " + product.packs.joinToString(", ") { "${it.size.plain()} ${it.unit}" },
                            onRemove = { viewModel.removeProduct(product.id) },
                            removeLabel = "Take ${product.shortName} off the board",
                        )
                    }
                }
            }

            if (state.estimates.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(12.dp))
                    Text("Measured quantities", style = MaterialTheme.typography.titleSmall)
                }
                state.estimates.forEach { estimate ->
                    item {
                        EstimateRow(
                            estimate = estimate,
                            onRemove = { viewModel.removeEstimate(estimate.id) },
                        )
                    }
                }
            }

            if (state.prep.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Surface condition",
                        style = MaterialTheme.typography.titleSmall,
                    )
                }
                state.prep.forEach { situation ->
                    item {
                        BoardRow(
                            title = situation.label,
                            subtitle = "${situation.steps.size} steps" +
                                if (situation.warnings.isNotEmpty()) {
                                    " · ${situation.warnings.size} warnings"
                                } else {
                                    ""
                                },
                            onRemove = { viewModel.removePrep(situation.id) },
                            removeLabel = "Take ${situation.label} off the board",
                        )
                    }
                }
            }

            item {
                Spacer(Modifier.height(18.dp))
                PrimaryAction(
                    text = "Open the checklist",
                    onClick = onOpenChecklist,
                    enabled = !state.isEmpty,
                )
                Spacer(Modifier.height(8.dp))
                SecondaryAction(
                    text = "Clear the board",
                    onClick = viewModel::clear,
                    enabled = state.savedCount > 0 || state.prep.isNotEmpty(),
                )
                Spacer(Modifier.height(16.dp))
                HonestNote(
                    "The board lives on this phone and is not sent anywhere. Re-measuring a " +
                        "room replaces the old figure rather than adding a second one, so the " +
                        "list a dealer receives has one number per room. Clearing it keeps the " +
                        "colours you have been looking at, because those are a browsing history " +
                        "and not part of the job.",
                )
            }
        }
    }
}

@Composable
private fun EstimateRow(estimate: SavedEstimate, onRemove: () -> Unit) {
    BoardRow(
        title = estimate.label,
        subtitle = estimate.packs + " · " + estimate.area.plain() + " m² · " +
            estimate.coats + " coat" + if (estimate.coats == 1) "" else "s" +
            " · " + estimate.litres.plain() + " " + estimate.unit,
        onRemove = onRemove,
        removeLabel = "Remove the quantity for ${estimate.label}",
    )
}

/** One saved thing, with the means to unsave it. */
@Composable
private fun BoardRow(
    title: String,
    subtitle: String,
    onRemove: () -> Unit,
    removeLabel: String,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.padding(start = 14.dp, end = 4.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleSmall)
                Text(
                    subtitle,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onRemove) {
                Icon(Icons.Filled.Close, contentDescription = removeLabel)
            }
        }
    }
}
