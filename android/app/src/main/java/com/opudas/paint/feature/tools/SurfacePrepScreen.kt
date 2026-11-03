package com.opudas.paint.feature.tools

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
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
import com.opudas.paint.core.data.model.PrepSituation
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SectionHeader

/*
 * The preparation sequences.
 *
 * Each card leads with the signs, because that is how somebody standing in front of
 * a wall identifies which one they have. They do not know the technical name for
 * efflorescence; they know it as the white bloom that came back after they painted
 * it the first time.
 */

@Composable
private fun rememberSurfacePrepViewModel(): SurfacePrepViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { SurfacePrepViewModel(context.container.content) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SurfacePrepScreen(
    onBack: () -> Unit,
    onOpenSituation: (String) -> Unit,
    viewModel: SurfacePrepViewModel = rememberSurfacePrepViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Loading the preparation sequences")
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text(
                    "Surface preparation",
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

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
        ) {
            item {
                SectionHeader(
                    title = "Find the wall you have",
                    subtitle = "${state.totalCount} sequences, each with its signs, its steps " +
                        "and the warnings that come with it",
                )
            }

            item {
                OutlinedTextField(
                    value = state.query,
                    onValueChange = viewModel::onQueryChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Search the signs and the steps") },
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                    trailingIcon = {
                        if (state.query.isNotEmpty()) {
                            IconButton(onClick = viewModel::onClearQuery) {
                                Icon(Icons.Filled.Close, contentDescription = "Clear the search")
                            }
                        }
                    },
                )
            }

            items(state.situations) { situation ->
                SituationCard(
                    situation = situation,
                    onClick = { onOpenSituation(situation.id) },
                )
            }

            if (state.isEmpty) {
                item {
                    EmptyState(
                        title = "No sequence matches that",
                        body = "Describe what the wall looks like rather than what you think it " +
                            "is called — the search reads the signs and the steps too.",
                    )
                }
            }

            item {
                Spacer(Modifier.height(16.dp))
                HonestNote(
                    "Preparation is where most failed jobs fail. Every sequence here carries the " +
                        "warnings that go with it, including the ones that say do not paint it yet.",
                )
            }
        }
    }
}

@Composable
private fun SituationCard(situation: PrepSituation, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable(onClickLabel = situation.label, role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(14.dp)) {
            val condition = situation.condition
            if (condition != null) {
                Text(
                    condition.replaceFirstChar { it.uppercaseChar() },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(situation.label, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(4.dp))
            Text(
                "${situation.steps.size} steps · ${situation.surfaces.joinToString(", ")}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (situation.signs.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    situation.signs.first(),
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (situation.warnings.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    "${situation.warnings.size} warning" +
                        if (situation.warnings.size == 1) "" else "s",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}
