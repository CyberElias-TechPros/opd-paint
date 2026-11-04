package com.opudas.paint.feature.projects

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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import coil.compose.AsyncImage
import com.opudas.paint.container
import com.opudas.paint.core.data.model.MediaEntry
import com.opudas.paint.core.data.model.Project
import com.opudas.paint.core.data.thumbUri
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FilterChipRow
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader

/*
 * The project book.
 *
 * Photographs of rooms that were painted, with the colours and products that were
 * used in them. This is the evidence behind every palette in the app: advice about
 * which colour goes on a ceiling is worth considerably more next to a ceiling
 * somebody actually painted.
 *
 * A project whose cover key is not in the media manifest still renders — title,
 * location, summary — because the words are the part that cannot be reconstructed
 * and a missing photograph should cost a picture, not an entry.
 */

@Composable
private fun rememberProjectsViewModel(): ProjectsViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { ProjectsViewModel(context.container.content) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectsScreen(
    onBack: () -> Unit,
    onOpenProject: (String) -> Unit,
    viewModel: ProjectsViewModel = rememberProjectsViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading the project book")
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text("Project book", style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
                    title = "Rooms that were painted",
                    subtitle = "${state.totalCount} projects, newest first, with the colours and " +
                        "products used in each",
                )
            }

            if (state.kinds.isNotEmpty()) {
                item {
                    FilterChipRow(
                        options = state.kinds,
                        selected = state.selectedKind,
                        onSelect = viewModel::onKindSelect,
                        allLabel = "All kinds",
                    )
                }
            }

            if (state.stages.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(8.dp))
                    FilterChipRow(
                        options = state.stages,
                        selected = state.selectedStage,
                        onSelect = viewModel::onStageSelect,
                        allLabel = "Any stage",
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
                            "${state.projects.size} of ${state.totalCount} shown",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f),
                        )
                        SecondaryAction(text = "Clear filters", onClick = viewModel::onClearFilters)
                    }
                }
            }

            items(state.projects) { project ->
                ProjectCard(
                    project = project,
                    cover = state.covers[project.id],
                    onClick = { onOpenProject(project.id) },
                )
            }

            if (state.isEmpty) {
                item {
                    EmptyState(
                        title = "Nothing matches those filters",
                        body = "No project in the book is both that kind of work and at that stage.",
                        action = {
                            SecondaryAction(text = "Clear filters", onClick = viewModel::onClearFilters)
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ProjectCard(
    project: Project,
    cover: MediaEntry?,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable(onClickLabel = project.title, role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column {
            if (cover != null) {
                AsyncImage(
                    model = cover.thumbUri,
                    contentDescription = cover.alt,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp),
                    contentScale = ContentScale.Crop,
                )
            }
            Column(Modifier.padding(14.dp)) {
                Text(
                    "${project.kind} · ${project.stage}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                Text(project.title, style = MaterialTheme.typography.titleMedium)
                Text(
                    "${project.location} · ${project.year}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    project.summary,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
