package com.opudas.paint.feature.projects

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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import coil.compose.AsyncImage
import com.opudas.paint.container
import com.opudas.paint.core.data.assetUri
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.Palette
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.data.thumbUri
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ColourSwatch
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openWhatsApp

/*
 * One project: the photographs, how it went, and everything that was used.
 *
 * This is the screen that turns a picture into a specification. Somebody looking
 * at a wall they like should be able to find out which colour it is, which product
 * it was painted in, how many coats, and which palette it belongs to — and then
 * ask for a quote about it without going back through a list. Every one of those
 * links is here because the ids were already in the data; leaving them as text
 * would make the project book a gallery instead of a specification.
 */

@Composable
private fun rememberProjectDetailViewModel(projectId: String): ProjectDetailViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { ProjectDetailViewModel(context.container.content, projectId) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectDetailScreen(
    projectId: String,
    onBack: () -> Unit,
    onOpenColour: (String) -> Unit,
    onOpenProduct: (String) -> Unit,
    onOpenPalette: (String) -> Unit,
    onEnquire: (String) -> Unit,
    viewModel: ProjectDetailViewModel = rememberProjectDetailViewModel(projectId),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading the project")
        return
    }

    val project = state.project
    if (project == null) {
        EmptyState(
            title = "No project with that reference",
            body = "It may have been removed since this build was made. The rest of the " +
                "project book is still here.",
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
                Text(project.title, style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
            val cover = state.cover
            if (cover != null) {
                item {
                    AsyncImage(
                        model = cover.assetUri,
                        contentDescription = cover.alt,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(220.dp),
                        contentScale = ContentScale.Crop,
                    )
                    Spacer(Modifier.height(14.dp))
                }
            }

            item {
                Text(
                    "${project.kind} · ${project.stage}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                Text(project.title, style = MaterialTheme.typography.headlineSmall)
                Text(
                    "${project.location} · ${project.year}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(12.dp))
                Text(project.summary, style = MaterialTheme.typography.bodyMedium)
            }

            if (project.story.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(title = "How it went")
                    Column {
                        project.story.forEach { paragraph ->
                            Text(
                                paragraph,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(bottom = 10.dp),
                            )
                        }
                    }
                }
            }

            item {
                Spacer(Modifier.height(8.dp))
                FactRow(label = "The takeaway", value = project.takeaway)
            }

            if (state.colors.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(
                        title = "Colours used",
                        subtitle = "Tap a colour for its whole entry",
                    )
                }
                items(state.colors) { color ->
                    ColourRow(color = color, onClick = { onOpenColour(color.id) })
                }
            }

            if (state.products.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(title = "Products used")
                }
                items(state.products) { product ->
                    SpecificationRow(
                        title = product.name,
                        subtitle = product.line + " · " + product.tagline,
                        onClick = { onOpenProduct(product.id) },
                    )
                }
            }

            val palette = state.palette
            if (palette != null) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(title = "Palette")
                    SpecificationRow(
                        title = palette.name,
                        subtitle = palette.season + " · " + palette.roles.joinToString(", "),
                        onClick = { onOpenPalette(palette.id) },
                    )
                }
            }

            if (state.gallery.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(
                        title = "More photographs",
                        subtitle = "${state.gallery.size} from this job",
                    )
                }
                items(state.gallery) { entry ->
                    AsyncImage(
                        model = entry.thumbUri,
                        contentDescription = entry.alt,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .height(160.dp),
                        contentScale = ContentScale.Crop,
                    )
                }
            }

            item {
                Spacer(Modifier.height(16.dp))
                PrimaryAction(
                    text = "Ask for a quote about this",
                    onClick = {
                        // The first colour is the one the project leads with. The
                        // rest travel in the message: a quote is a conversation
                        // with the desk, not a basket.
                        val first = state.colors.firstOrNull()
                        if (first != null) onEnquire(first.id)
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            val contact = state.contact
            if (contact != null) {
                item {
                    Column(Modifier.padding(top = 20.dp)) {
                        SectionHeader(title = "Talk it through")
                        ContactActions(
                            phoneDisplay = contact.phoneDisplay,
                            phoneTel = contact.phoneTel,
                            whatsapp = contact.whatsapp,
                            onCall = { context.dial(contact.phoneTel) },
                            onWhatsApp = {
                                context.openWhatsApp(
                                    contact.whatsapp,
                                    "Hello OPUDA'S PAINT — I am looking at the ${project.title} " +
                                        "project in the app and would like something similar.",
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
private fun ColourRow(color: PaintColor, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable(onClickLabel = color.name, role = Role.Button, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ColourSwatch(
            hex = color.hex,
            name = color.name,
            code = color.code,
            modifier = Modifier.width(58.dp),
        )
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(color.name, style = MaterialTheme.typography.titleSmall)
            Text(color.code, style = MaterialTheme.typography.labelSmall)
        }
    }
}

/**
 * One tappable line for a product or a palette.
 *
 * Deliberately not a card with a border: a project page can list several of these
 * in a row, and a stack of heavy cards reads as a set of choices to make rather
 * than what it is, which is the specification behind a photograph.
 */
@Composable
private fun SpecificationRow(title: String, subtitle: String, onClick: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .background(
                MaterialTheme.colorScheme.surface,
                RoundedCornerShape(Brand.tokens.radius("sm")),
            )
            .clickable(onClickLabel = title, role = Role.Button, onClick = onClick)
            .padding(14.dp),
    ) {
        Text(title, style = MaterialTheme.typography.titleSmall)
        Text(
            subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
