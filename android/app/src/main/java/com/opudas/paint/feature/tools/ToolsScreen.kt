package com.opudas.paint.feature.tools

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.model.ToolCard
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SectionHeader

/*
 * The tools hub.
 *
 * Every card the product has, including the two this build cannot open. A card that
 * looks tappable and does nothing reads as a broken app; a card that says the tool
 * is not here yet reads as an honest one, and it is also the only version that does
 * not understate the range to somebody deciding whether the app is worth their time.
 */

@Composable
private fun rememberToolsViewModel(): ToolsViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { ToolsViewModel(context.container.content) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ToolsScreen(
    onBack: () -> Unit,
    onOpenTool: (ToolTarget) -> Unit,
    viewModel: ToolsViewModel = rememberToolsViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Loading the tools")
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text("Tools", style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
                    title = "Decide before you buy",
                    subtitle = "${state.questionCount} questions to a specified finish, " +
                        "${state.prepCount} preparation sequences, and the quantities",
                )
            }

            items(state.cards) { entry ->
                ToolCardRow(
                    entry = entry,
                    onClick = { onOpenTool(entry.target) },
                )
            }

            item {
                Spacer(Modifier.height(16.dp))
                HonestNote(
                    "${state.openableCount} of ${state.cards.size} tools are in this build. " +
                        "The others are named above rather than left out, because the product " +
                        "has them and pretending otherwise would be a smaller claim than the " +
                        "truth.",
                )
            }
        }
    }
}

@Composable
private fun ToolCardRow(entry: ToolCardUi, onClick: () -> Unit) {
    val card: ToolCard = entry.card
    val modifier = if (entry.isOpenable) {
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable(onClickLabel = card.name, role = Role.Button, onClick = onClick)
    } else {
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
    }

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = if (entry.isOpenable) {
            MaterialTheme.colorScheme.surface
        } else {
            MaterialTheme.colorScheme.surfaceVariant
        },
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    card.kind.replaceFirstChar { it.uppercaseChar() },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(2.dp))
                Text(card.name, style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(4.dp))
                Text(card.summary, style = MaterialTheme.typography.bodySmall)
                if (card.roadmap.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Roadmap " + card.roadmap.joinToString(", "),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                val note = entry.note
                if (note != null) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        note,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (entry.isOpenable) {
                Spacer(Modifier.width(8.dp))
                Icon(
                    Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = null,
                )
            }
        }
    }
}
