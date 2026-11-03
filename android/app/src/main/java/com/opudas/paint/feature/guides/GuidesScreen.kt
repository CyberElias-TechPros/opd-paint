package com.opudas.paint.feature.guides

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
import com.opudas.paint.core.data.model.Guide
import com.opudas.paint.core.data.model.MediaEntry
import com.opudas.paint.core.data.thumbUri
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FilterChipRow
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.formatShortDate

/*
 * The advice library.
 *
 * Written by the technical desk, dated, and attributed — which is why the card
 * shows when a guide was last updated rather than hiding it. Advice about how much
 * paint to buy is the kind of thing a reader should be able to age, and a guide
 * with no date reads as though it has always been true.
 */

@Composable
private fun rememberGuidesViewModel(): GuidesViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { GuidesViewModel(context.container.content) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuidesScreen(
    onBack: () -> Unit,
    onOpenGuide: (String) -> Unit,
    viewModel: GuidesViewModel = rememberGuidesViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading the advice library")
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text("Advice", style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
                    title = "Advice from the technical desk",
                    subtitle = "${state.totalCount} guides and ${state.totalSections} sections, " +
                        "written by the people who answer the phone",
                )
            }

            item {
                OutlinedTextField(
                    value = state.query,
                    onValueChange = viewModel::onQueryChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Search the advice, including inside it") },
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

            if (state.categories.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(10.dp))
                    FilterChipRow(
                        options = state.categories,
                        selected = state.selectedCategory,
                        onSelect = viewModel::onCategorySelect,
                        allLabel = "All topics",
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
                            "${state.guides.size} of ${state.totalCount} shown",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f),
                        )
                        SecondaryAction(text = "Clear", onClick = viewModel::onClearFilters)
                    }
                }
            }

            items(state.guides) { guide ->
                GuideCard(
                    guide = guide,
                    hero = state.heroes[guide.id],
                    onClick = { onOpenGuide(guide.id) },
                )
            }

            if (state.isEmpty) {
                item {
                    EmptyState(
                        title = "Nothing in the library about that",
                        body = "No guide matches that search in this topic. The desk answers " +
                            "questions the library does not cover yet — that is what the phone " +
                            "number is for.",
                        action = {
                            SecondaryAction(text = "Clear", onClick = viewModel::onClearFilters)
                        },
                    )
                }
            }

            item {
                Spacer(Modifier.height(16.dp))
                HonestNote(
                    "Guides carry the date they were last updated and who reviewed them. Advice " +
                        "changes with the products, and a page with no date reads as though it " +
                        "has always been true.",
                )
            }
        }
    }
}

@Composable
private fun GuideCard(guide: Guide, hero: MediaEntry?, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable(onClickLabel = guide.title, role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column {
            if (hero != null) {
                AsyncImage(
                    model = hero.thumbUri,
                    contentDescription = hero.alt,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(130.dp),
                    contentScale = ContentScale.Crop,
                )
            }
            Column(Modifier.padding(14.dp)) {
                Text(
                    listOfNotNull(
                        guide.category,
                        "${guide.readMinutes} min read",
                        formatShortDate(guide.updated),
                    ).joinToString(" · "),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                Text(guide.title, style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(4.dp))
                Text(
                    guide.summary,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
