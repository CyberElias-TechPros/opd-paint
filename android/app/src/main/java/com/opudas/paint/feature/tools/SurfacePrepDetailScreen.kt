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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.model.Guide
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openWhatsApp

/*
 * One preparation sequence.
 *
 * The warnings come first and they are the loudest thing on the page, because two of
 * the ten sequences exist to say "do not paint this yet" — new render under fourteen
 * days old blisters weeks later and no topcoat repairs it. A sequence that buried
 * that under its steps would be a checklist for doing the wrong thing neatly.
 */

@Composable
private fun rememberSurfacePrepDetailViewModel(situationId: String): SurfacePrepDetailViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer {
                SurfacePrepDetailViewModel(
                    context.container.content,
                    situationId,
                    context.container.board,
                )
            }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SurfacePrepDetailScreen(
    situationId: String,
    onBack: () -> Unit,
    onOpenProduct: (String) -> Unit,
    onOpenGuide: (String) -> Unit,
    viewModel: SurfacePrepDetailViewModel = rememberSurfacePrepDetailViewModel(situationId),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading the sequence")
        return
    }

    val situation = state.situation
    if (situation == null) {
        EmptyState(
            title = "No sequence with that reference",
            body = "It may have been renamed since this build was made. The other nine are " +
                "still in the list.",
        )
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text(situation.label, style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
                val condition = situation.condition
                if (condition != null) {
                    Text(
                        "Finish-finder condition: " + condition.replaceFirstChar { it.uppercaseChar() },
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(4.dp))
                }
                Text(situation.label, style = MaterialTheme.typography.headlineSmall)
                if (situation.surfaces.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        situation.surfaces.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (situation.warnings.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(14.dp))
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(Brand.tokens.radius("md")),
                        color = MaterialTheme.colorScheme.errorContainer,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text(
                                if (situation.warnings.size == 1) "Warning" else "Warnings",
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                            )
                            situation.warnings.forEach { warning ->
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    warning,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onErrorContainer,
                                )
                            }
                        }
                    }
                }
            }

            if (situation.signs.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(
                        title = "How to recognise it",
                        subtitle = "The signs this sequence is for",
                    )
                    situation.signs.forEach { sign ->
                        Text(
                            "·  $sign",
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(bottom = 4.dp),
                        )
                    }
                }
            }

            item {
                Spacer(Modifier.height(16.dp))
                SectionHeader(
                    title = "The sequence",
                    subtitle = "${situation.steps.size} steps, in order",
                )
            }

            itemsIndexed(situation.steps) { index, step ->
                Row(Modifier.padding(vertical = 6.dp)) {
                    Text(
                        "${index + 1}.",
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(end = 10.dp),
                    )
                    Column(Modifier.weight(1f)) {
                        Text(step.step, style = MaterialTheme.typography.titleSmall)
                        if (step.detail.isNotEmpty()) {
                            Text(
                                step.detail,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            if (state.products.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(
                        title = "What this sequence uses",
                        subtitle = "In the order the sequence names them",
                    )
                }
                items(state.products) { product ->
                    ProductLine(product = product, onOpen = { onOpenProduct(product.id) })
                }
            }

            if (state.guides.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(title = "Read alongside")
                }
                items(state.guides) { guide ->
                    GuideLine(guide = guide, onOpen = { onOpenGuide(guide.id) })
                }
            }

            item {
                Column(Modifier.padding(top = 20.dp)) {
                    SecondaryAction(
                        text = if (state.isOnBoard) {
                            "Take this sequence off my project"
                        } else {
                            "Add this sequence to my project"
                        },
                        onClick = viewModel::toggleOnBoard,
                    )
                }
            }

            val contact = state.contact
            if (contact != null) {
                item {
                    Column(Modifier.padding(top = 20.dp)) {
                        SectionHeader(
                            title = "Not sure this is your wall?",
                            subtitle = "Send a photograph and the desk will say",
                        )
                        ContactActions(
                            phoneDisplay = contact.phoneDisplay,
                            phoneTel = contact.phoneTel,
                            whatsapp = contact.whatsapp,
                            onCall = { context.dial(contact.phoneTel) },
                            onWhatsApp = {
                                context.openWhatsApp(
                                    contact.whatsapp,
                                    "Hello OPUDA'S PAINT — I am working through \"${situation.label}\" " +
                                        "in the app and I am not certain it is my wall.",
                                )
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProductLine(product: Product, onOpen: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .background(
                MaterialTheme.colorScheme.surface,
                RoundedCornerShape(Brand.tokens.radius("sm")),
            )
            .clickable(onClickLabel = product.name, role = Role.Button, onClick = onOpen)
            .padding(14.dp),
    ) {
        Text(product.name, style = MaterialTheme.typography.titleSmall)
        Text(
            product.line + " · " + product.tagline,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun GuideLine(guide: Guide, onOpen: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable(onClickLabel = guide.title, role = Role.Button, onClick = onOpen),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(guide.title, style = MaterialTheme.typography.titleSmall)
            Text(
                "${guide.category} · ${guide.readMinutes} min read",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
