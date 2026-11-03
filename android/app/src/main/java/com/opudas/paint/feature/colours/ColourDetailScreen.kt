package com.opudas.paint.feature.colours

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.model.Project
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.HeroSwatch
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.engine.parseHex
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openWhatsApp

/*
 * One colour's own page.
 *
 * It carries what the printed fan deck carries — the code, the family, the
 * undertone, the note, and the colour under four lights — plus two things a
 * printed deck cannot: which schemes the colour belongs to and the job it does in
 * each, and which of the company's own work used it.
 *
 * It also says plainly what it is not. `source` is printed on screen because a hex
 * on a phone is a digital proof rather than a chip match, and a customer who buys
 * four litres on the strength of a backlit screen deserves to know that before the
 * purchase, not after.
 */

@Composable
private fun rememberColourDetailViewModel(colourId: String): ColourDetailViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { ColourDetailViewModel(context.container.content, colourId) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ColourDetailScreen(
    colourId: String,
    onBack: () -> Unit,
    onOpenProject: ((String) -> Unit)? = null,
    viewModel: ColourDetailViewModel = rememberColourDetailViewModel(colourId),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = state.color?.name ?: "Colour",
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back to the library")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
    ) { innerPadding ->
        val color = state.color
        when {
            state.isLoading -> LoadingState(Modifier.padding(innerPadding), label = "Reading this colour")

            color == null -> EmptyState(
                title = "We do not have that colour",
                body = "The code may be from an older fan deck, or the link may have been copied badly. " +
                    "The library holds every colour we currently mix.",
                modifier = Modifier.padding(innerPadding),
                action = { PrimaryAction(text = "Back to the library", onClick = onBack) },
            )

            else -> LazyColumn(
                modifier = Modifier.padding(innerPadding),
                contentPadding = PaddingValues(bottom = 36.dp),
            ) {
                item {
                    Column(Modifier.padding(horizontal = 20.dp)) {
                        HeroSwatch(hex = color.hex)
                        Spacer(Modifier.height(14.dp))
                        Text(color.note, style = MaterialTheme.typography.bodyLarge)
                    }
                }

                item {
                    Column(Modifier.padding(horizontal = 20.dp, vertical = 18.dp)) {
                        FactRow("Code", color.code)
                        FactRow("Family", color.family)
                        FactRow("Undertone", color.undertone)
                        FactRow("Collection", color.collection)
                        FactRow("LRV", "${color.lrv}% — ${lrvAdvice(color.lrv)}")
                        FactRow("Suitable for", color.rooms.joinToString(", "))
                        FactRow("Measured from", color.source)
                    }
                }

                if (state.lights.isNotEmpty()) {
                    item {
                        Column(Modifier.padding(horizontal = 20.dp)) {
                            SectionHeader(
                                title = "Under four lights",
                                subtitle = "The same colour as the printed book shows it: morning, midday, tungsten, evening",
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                state.lights.forEach { variant ->
                                    LightChip(variant.label, variant.hex, Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }

                if (state.contrasts.isNotEmpty()) {
                    item {
                        Column(Modifier.padding(horizontal = 20.dp)) {
                            SectionHeader(
                                title = "What reads on it",
                                subtitle = "Measured to WCAG AA rather than guessed",
                            )
                            state.contrasts.forEach { check ->
                                ContrastCard(check.inkHex, color.hex, check.label, check.ratio, check.readable)
                            }
                        }
                    }
                }

                if (state.palettes.isNotEmpty()) {
                    item {
                        Column(Modifier.padding(horizontal = 20.dp)) {
                            SectionHeader(
                                title = "Where it belongs",
                                subtitle = "The schemes this colour is part of, and the job it does in each",
                            )
                            state.palettes.forEach { appearance -> PaletteRow(appearance) }
                        }
                    }
                }

                if (state.projects.isNotEmpty()) {
                    item {
                        Column(Modifier.padding(horizontal = 20.dp)) {
                            SectionHeader(title = "On a wall", subtitle = "Jobs that used this colour")
                            state.projects.forEach { project ->
                                ProjectRow(project, onOpen = { onOpenProject?.invoke(project.id) })
                            }
                        }
                    }
                }

                item {
                    Column(Modifier.padding(horizontal = 20.dp, vertical = 20.dp)) {
                        HonestNote(
                            text = "This is a digital proof on your screen, not a chip match — the same colour " +
                                "looks different on a backlit phone, under a tungsten bulb and in daylight. " +
                                "Ask for a sample pot or a drawdown before buying four litres.",
                        )
                        Spacer(Modifier.height(16.dp))
                        val contact = state.contact
                        if (contact != null) {
                            val message = viewModel.whatsappMessage()
                            PrimaryAction(
                                text = "Ask about ${color.name} on WhatsApp",
                                onClick = { context.openWhatsApp(contact.whatsapp, message) },
                            )
                            Spacer(Modifier.height(10.dp))
                            ContactActions(
                                phoneDisplay = contact.phoneDisplay,
                                phoneTel = contact.phoneTel,
                                whatsapp = contact.whatsapp,
                                onCall = { context.dial(contact.phoneTel) },
                                onWhatsApp = { context.openWhatsApp(contact.whatsapp, message) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * What an LRV number means for a room.
 *
 * A decorator thinks in "will this make the room feel dark", not in percentages,
 * so the percentage gets a sentence beside it.
 */
private fun lrvAdvice(lrv: Int): String = when {
    lrv >= 70 -> "bounces light; safe for ceilings and small rooms"
    lrv >= 50 -> "keeps a room light without reading as white"
    lrv >= 30 -> "mid-tone; fine on a well-lit wall, darker in a corner"
    lrv >= 15 -> "deep; best as a feature wall or on joinery"
    else -> "very deep; expects good light and a matt finish"
}

@Composable
private fun LightChip(label: String, hex: String, modifier: Modifier = Modifier) {
    val rgb = parseHex(hex)
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(56.dp)
                .clip(RoundedCornerShape(Brand.tokens.radius("sm")))
                .background(rgb?.let { Color(it.r, it.g, it.b) } ?: MaterialTheme.colorScheme.surfaceVariant)
                .border(
                    1.dp,
                    MaterialTheme.colorScheme.outlineVariant,
                    RoundedCornerShape(Brand.tokens.radius("sm")),
                ),
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
        )
    }
}

@Composable
private fun ContrastCard(inkHex: String, backgroundHex: String, label: String, ratio: Double, readable: Boolean) {
    val ink = parseHex(inkHex)
    val background = parseHex(backgroundHex)
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(Brand.tokens.radius("sm")))
                    .background(background?.let { Color(it.r, it.g, it.b) } ?: MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Aa",
                    style = MaterialTheme.typography.titleMedium,
                    color = ink?.let { Color(it.r, it.g, it.b) } ?: MaterialTheme.colorScheme.onSurface,
                )
            }
            Column(Modifier.weight(1f)) {
                Text(label, style = MaterialTheme.typography.titleSmall)
                Text(
                    text = "%.2f:1 — %s".format(
                        ratio,
                        if (readable) "clears AA for body text" else "large text only",
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/**
 * One scheme this colour belongs to.
 *
 * The chips are painted with the palette's own colours and the one being looked at
 * carries a ring, which answers "am I the feature wall or the ceiling?" faster than
 * any sentence does.
 */
@Composable
private fun PaletteRow(appearance: PaletteAppearance) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    appearance.swatches.forEachIndexed { index, (_, hex) ->
                        val rgb = parseHex(hex)
                        val isThis = index == appearance.thisIndex
                        Box(
                            Modifier
                                .size(if (isThis) 24.dp else 20.dp)
                                .clip(CircleShape)
                                .background(rgb?.let { Color(it.r, it.g, it.b) } ?: MaterialTheme.colorScheme.surfaceVariant)
                                .border(
                                    width = if (isThis) 2.dp else 1.dp,
                                    color = if (isThis) {
                                        MaterialTheme.colorScheme.primary
                                    } else {
                                        MaterialTheme.colorScheme.outlineVariant
                                    },
                                    shape = CircleShape,
                                ),
                        )
                    }
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(appearance.name, style = MaterialTheme.typography.titleSmall)
                    Text(
                        text = appearance.role.ifBlank { appearance.season },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (appearance.bestFor.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = appearance.bestFor,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ProjectRow(project: Project, onOpen: () -> Unit) {
    val enabled = project.id.isNotBlank()
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp)
            .then(
                if (enabled) {
                    Modifier.clickable(onClickLabel = "Open ${project.title}", role = Role.Button, onClick = onOpen)
                } else {
                    Modifier
                },
            ),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(project.title, style = MaterialTheme.typography.titleSmall)
            Text(
                text = listOf(project.location, project.year, project.kind).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (project.stage != "completed") {
                Spacer(Modifier.height(6.dp))
                // Concept and in-progress work is labelled as such everywhere it
                // appears, on the site and in the app: a render presented as a
                // finished house is a claim the company cannot support.
                Text(
                    text = if (project.stage == "concept") {
                        "Concept artwork, not a completed job"
                    } else {
                        "In progress"
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.tertiary,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}
