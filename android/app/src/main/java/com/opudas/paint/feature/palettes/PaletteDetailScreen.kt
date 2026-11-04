package com.opudas.paint.feature.palettes

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
import com.opudas.paint.core.data.model.Project
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ColourSwatch
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openWhatsApp

/*
 * One palette, and the argument for it.
 *
 * Four colours with the job each one does, the story the palette was built around,
 * and the rooms that actually used it. The projects are not decoration: "feature
 * wall, main walls, ceilings and trim" is advice, and a photograph of a room where
 * those four colours were used in those four places is the reason to believe it.
 */

@Composable
private fun rememberPaletteDetailViewModel(paletteId: String): PaletteDetailViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { PaletteDetailViewModel(context.container.content, paletteId) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaletteDetailScreen(
    paletteId: String,
    onBack: () -> Unit,
    onOpenColour: (String) -> Unit,
    onOpenProject: (String) -> Unit,
    onEnquire: (String) -> Unit,
    viewModel: PaletteDetailViewModel = rememberPaletteDetailViewModel(paletteId),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading the palette")
        return
    }

    val palette = state.palette
    if (palette == null) {
        EmptyState(
            title = "No palette with that reference",
            body = "It may have been renamed or removed since this build was made. " +
                "The whole colour library is still here.",
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
                Text(palette.name, style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
            val image = state.image
            if (image != null) {
                item {
                    AsyncImage(
                        model = image.assetUri,
                        contentDescription = image.alt,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentScale = ContentScale.Crop,
                    )
                    Spacer(Modifier.height(14.dp))
                }
            }

            item {
                SectionHeader(title = palette.name, subtitle = palette.season)
                Text(palette.story, style = MaterialTheme.typography.bodyMedium)
                Spacer(Modifier.height(12.dp))
                FactRow(label = "Best for", value = palette.bestFor)
            }

            item {
                Spacer(Modifier.height(16.dp))
                SectionHeader(
                    title = "The colours, and what each one does",
                    subtitle = "Tap a colour for its whole entry",
                )
            }

            items(state.roles) { entry ->
                ColourRoleRow(
                    hex = entry.color.hex,
                    name = entry.color.name,
                    code = entry.color.code,
                    role = entry.role,
                    onClick = { onOpenColour(entry.color.id) },
                )
            }

            item {
                Spacer(Modifier.height(16.dp))
                HonestNote(
                    "Colours are shown as this screen renders them. A phone screen is not a " +
                        "colour chip: ask for a sample pot or visit a counter before committing " +
                        "to a litre.",
                )
                Spacer(Modifier.height(12.dp))
                PrimaryAction(
                    text = "Ask for a quote",
                    onClick = {
                        // The palette's first colour is the feature wall — the one a
                        // quote is actually about. The rest can be added in the
                        // message; the form is a conversation, not a basket.
                        val first = state.roles.firstOrNull()
                        if (first != null) onEnquire(first.color.id)
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            if (state.projects.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(20.dp))
                    SectionHeader(
                        title = "Rooms that used this palette",
                        subtitle = "${state.projects.size} in the project book",
                    )
                }
                items(state.projects) { project ->
                    ProjectRow(project = project, onClick = { onOpenProject(project.id) })
                }
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
                                    "Hello OPUDA'S PAINT — I am looking at the ${palette.name} " +
                                        "palette in the app and would like some advice.",
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
private fun ColourRoleRow(
    hex: String,
    name: String,
    code: String,
    role: String,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable(onClickLabel = "$name — $role", role = Role.Button, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ColourSwatch(hex = hex, name = name, code = code, modifier = Modifier.width(58.dp))
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(name, style = MaterialTheme.typography.titleSmall)
            Text(code, style = MaterialTheme.typography.labelSmall)
            if (role.isNotEmpty()) {
                Text(
                    role,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ProjectRow(project: Project, onClick: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .background(
                MaterialTheme.colorScheme.surface,
                RoundedCornerShape(Brand.tokens.radius("md")),
            )
            .clickable(onClickLabel = project.title, role = Role.Button, onClick = onClick)
            .padding(14.dp),
    ) {
        Text(project.title, style = MaterialTheme.typography.titleSmall)
        Text(
            "${project.kind} · ${project.location} · ${project.year}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(4.dp))
        Text(project.summary, style = MaterialTheme.typography.bodySmall)
    }
}
