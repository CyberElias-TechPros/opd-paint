package com.opudas.paint.feature.colours

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.designsystem.ColourSwatch
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FilterChipRow
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader

/*
 * The colour library: 59 colours, searchable, filterable by family.
 *
 * This is the screen the app exists for. A decorator standing in a hardware shop
 * with a code written on a scrap of paper needs it in two taps and no signal,
 * which is why the whole library ships inside the APK and the search runs against
 * the loaded list rather than a network call.
 */

@Composable
private fun rememberColoursViewModel(): ColoursViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { ColoursViewModel(context.container.content) }
        },
    )
}

@Composable
fun ColoursScreen(
    onOpenColour: (String) -> Unit,
    viewModel: ColoursViewModel = rememberColoursViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val keyboard = LocalSoftwareKeyboardController.current

    if (state.isLoading) {
        LoadingState(label = "Reading the colour library")
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .imePadding(),
    ) {
        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::onQueryChange,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            placeholder = { Text("Search a name, a code, a room — try \"harmattan\"") },
            leadingIcon = {
                Icon(Icons.Filled.Search, contentDescription = null)
            },
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
            options = state.families,
            selected = state.family,
            onSelect = viewModel::onFamilySelect,
            swatchFor = { family -> state.familySwatch[family] },
        )

        SectionHeader(
            title = if (state.query.isBlank() && state.family == null) {
                "${state.totalCount} colours"
            } else {
                "${state.visible.size} of ${state.totalCount}"
            },
            subtitle = state.family ?: "Every colour in the library, measured from our own fan deck",
            modifier = Modifier.padding(horizontal = 20.dp),
        )

        if (state.visible.isEmpty()) {
            EmptyState(
                title = "Nothing matches that",
                body = "The library has ${state.totalCount} colours. Try a family name, a code like OP-014, " +
                    "or what the room is — \"kitchen\", \"ceiling\", \"boundary wall\".",
                modifier = Modifier.fillMaxSize(),
                action = {
                    SecondaryAction(
                        text = "Clear the search",
                        onClick = {
                            viewModel.clearFilters()
                            keyboard?.hide()
                        },
                    )
                },
            )
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 150.dp),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 28.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(state.visible, key = { it.id }) { color ->
                    ColourSwatch(
                        hex = color.hex,
                        name = color.name,
                        code = color.code,
                        onClick = {
                            keyboard?.hide()
                            onOpenColour(color.id)
                        },
                    )
                }
            }
        }
    }
}
