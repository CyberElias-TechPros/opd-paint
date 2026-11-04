package com.opudas.paint.feature.board

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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.engine.ChecklistItem
import com.opudas.paint.core.engine.ChecklistLink
import com.opudas.paint.core.util.shareText
import kotlinx.coroutines.delay

/*
 * The order of work.
 *
 * Built by the same engine the website uses, over the same board, so a checklist read
 * here and one printed from a laptop agree about the same job. That is the point of the
 * screen: it is the thing somebody hands a dealer or reads from a ladder, and two
 * versions of it from one company is a reason to phone instead of ordering.
 *
 * There are no tick boxes. A tick that is forgotten the moment the screen closes is
 * worse than no tick, because it looks like a record of work done; the copied text has
 * boxes to tick on paper, which is where a checklist gets ticked anyway.
 */

@Composable
private fun rememberChecklistViewModel(): ChecklistViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { ChecklistViewModel(context.container.board, context.container.content) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChecklistScreen(
    onBack: () -> Unit,
    onOpenLink: (ChecklistLink) -> Unit,
    viewModel: ChecklistViewModel = rememberChecklistViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var copied by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(copied) {
        if (copied) {
            delay(COPIED_FOR_MILLIS)
            copied = false
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text("Checklist", style = MaterialTheme.typography.titleMedium, maxLines = 1)
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

        when {
            state.isLoading -> LoadingState(Modifier.fillMaxSize(), label = "Building the checklist")

            state.isEmpty -> EmptyState(
                title = "Nothing to plan yet",
                body = "A checklist is built from what is on the board: colours, products, " +
                    "measured quantities and the condition of the walls. Save one of those and " +
                    "the order of work appears here.",
                action = { SecondaryAction(text = "Back to the board", onClick = onBack) },
            )

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
            ) {
                item {
                    SectionHeader(
                        title = state.projectName.ifEmpty { "My project" },
                        subtitle = "${state.groups.size} sections · ${state.itemCount} steps",
                    )
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        PrimaryAction(
                            text = if (copied) "Copied" else "Copy as text",
                            onClick = {
                                clipboard.setText(AnnotatedString(state.text))
                                copied = true
                            },
                            modifier = Modifier.weight(1f),
                        )
                        SecondaryAction(
                            text = "Send",
                            onClick = {
                                context.shareText(
                                    "${state.projectName.ifEmpty { "My project" }} — OPUDA’S PAINT project",
                                    state.text,
                                )
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }

                state.groups.forEach { group ->
                    item {
                        Spacer(Modifier.height(16.dp))
                        SectionHeader(title = group.title, subtitle = group.note)
                    }
                    group.items.forEach { entry ->
                        item {
                            ChecklistRow(item = entry, onOpenLink = onOpenLink)
                        }
                    }
                }

                item {
                    Spacer(Modifier.height(16.dp))
                    HonestNote(
                        "Colours on a screen are digital proofs, which is why confirming one " +
                            "against a sample pot is the second thing on this list and not the " +
                            "last. Quantities come from the calculator and the numbers you typed " +
                            "into it: confirm them against the wall before anybody buys paint.",
                    )
                }
            }
        }
    }
}

@Composable
private fun ChecklistRow(item: ChecklistItem, onOpenLink: (ChecklistLink) -> Unit) {
    val link = item.link
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .then(
                if (link == null) {
                    Modifier
                } else {
                    Modifier.clickable(
                        onClickLabel = item.label,
                        role = Role.Button,
                        onClick = { onOpenLink(link) },
                    )
                },
            ),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(item.label, style = MaterialTheme.typography.titleSmall)
            val detail = item.detail
            if (detail != null) {
                Spacer(Modifier.height(2.dp))
                Text(
                    detail,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** How long the button says "Copied", the same two seconds the website waits. */
private const val COPIED_FOR_MILLIS = 2_200L
