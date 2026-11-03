package com.opudas.paint.feature.guides

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
import com.opudas.paint.core.data.model.GuideCallout
import com.opudas.paint.core.data.model.GuideSection
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ColourSwatch
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.formatLongDate
import com.opudas.paint.core.util.openWhatsApp

/*
 * One guide, read as it was written.
 *
 * Sections, lists and callouts in the order the technical desk put them, with the
 * date it was updated and the name of whoever reviewed it at the top. Attribution
 * and a date are what separate advice from marketing copy, and both are in the
 * data, so both are rendered.
 *
 * The callouts are tinted by their tone — warning, tip, note — but always in their
 * own words. A tone is a styling instruction from the author; turning it into a
 * label this screen invented would be putting words in the desk's mouth.
 */

@Composable
private fun rememberGuideDetailViewModel(guideId: String): GuideDetailViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { GuideDetailViewModel(context.container.content, guideId) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuideDetailScreen(
    guideId: String,
    onBack: () -> Unit,
    onOpenGuide: (String) -> Unit,
    onOpenColour: (String) -> Unit,
    onOpenProduct: (String) -> Unit,
    viewModel: GuideDetailViewModel = rememberGuideDetailViewModel(guideId),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Reading the guide")
        return
    }

    val guide = state.guide
    if (guide == null) {
        EmptyState(
            title = "No guide with that reference",
            body = "It may have been renamed or retired since this build was made. The rest " +
                "of the advice library is still here.",
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
                Text(guide.title, style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
            val hero = state.hero
            if (hero != null) {
                item {
                    AsyncImage(
                        model = hero.assetUri,
                        contentDescription = hero.alt,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentScale = ContentScale.Crop,
                    )
                    Spacer(Modifier.height(14.dp))
                }
            }

            item {
                Text(guide.category, style = MaterialTheme.typography.labelSmall)
                Spacer(Modifier.height(4.dp))
                Text(guide.title, style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.height(8.dp))
                Text(guide.summary, style = MaterialTheme.typography.bodyMedium)
                Spacer(Modifier.height(12.dp))
                FactRow(label = "Reading time", value = "${guide.readMinutes} minutes")
                FactRow(
                    label = "Last updated",
                    value = formatLongDate(guide.updated) ?: guide.updated,
                )
                FactRow(label = "Reviewed by", value = guide.reviewer)
            }

            items(guide.sections) { section ->
                Section(section = section)
            }

            if (state.relatedColors.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(title = "Colours this guide mentions")
                }
                items(state.relatedColors) { color ->
                    ColourRow(color = color, onClick = { onOpenColour(color.id) })
                }
            }

            if (state.relatedProducts.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(title = "Products this guide mentions")
                }
                items(state.relatedProducts) { product ->
                    LinkRow(
                        title = product.name,
                        subtitle = product.line + " · " + product.tagline,
                        onClick = { onOpenProduct(product.id) },
                    )
                }
            }

            if (guide.faq.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(title = "Questions the desk gets")
                }
                items(guide.faq) { entry ->
                    Column(Modifier.padding(vertical = 6.dp)) {
                        Text(entry.q, style = MaterialTheme.typography.titleSmall)
                        Spacer(Modifier.height(2.dp))
                        Text(
                            entry.a,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            if (state.relatedGuides.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(
                        title = "More on ${guide.category.lowercase()}",
                        subtitle = "The other guides in this topic",
                    )
                }
                items(state.relatedGuides) { other ->
                    LinkRow(
                        title = other.title,
                        subtitle = "${other.readMinutes} min read · " +
                            (formatLongDate(other.updated) ?: other.updated),
                        onClick = { onOpenGuide(other.id) },
                    )
                }
            }

            val contact = state.contact
            if (contact != null) {
                item {
                    Column(Modifier.padding(top = 20.dp)) {
                        SectionHeader(
                            title = "Ask the desk",
                            subtitle = "If the guide does not cover your wall",
                        )
                        ContactActions(
                            phoneDisplay = contact.phoneDisplay,
                            phoneTel = contact.phoneTel,
                            whatsapp = contact.whatsapp,
                            onCall = { context.dial(contact.phoneTel) },
                            onWhatsApp = {
                                context.openWhatsApp(
                                    contact.whatsapp,
                                    "Hello OPUDA'S PAINT — I am reading \"${guide.title}\" in the " +
                                        "app and have a question about it.",
                                )
                            },
                        )
                    }
                }
            }
        }
    }
}

/** One section: a heading, its paragraphs, an optional list, an optional callout. */
@Composable
private fun Section(section: GuideSection) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = 18.dp),
    ) {
        Text(section.heading, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(6.dp))
        section.paragraphs.forEach { paragraph ->
            Text(
                paragraph,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(bottom = 10.dp),
            )
        }
        if (section.list.isNotEmpty()) {
            Column(Modifier.padding(bottom = 10.dp)) {
                section.list.forEach { entry ->
                    Text(
                        "·  $entry",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(bottom = 4.dp),
                    )
                }
            }
        }
        val callout = section.callout
        if (callout != null) {
            Callout(callout = callout)
        }
    }
}

/**
 * A callout, tinted by the tone its author gave it.
 *
 * The tone chooses a colour and nothing else: the words are the author's title and
 * body, because inventing a label here — "Warning:", "Expert tip:" — would be
 * adding emphasis the technical desk did not ask for.
 */
@Composable
private fun Callout(callout: GuideCallout) {
    val tint = when (callout.tone) {
        "warning" -> MaterialTheme.colorScheme.errorContainer
        "tip" -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
    val onTint = when (callout.tone) {
        "warning" -> MaterialTheme.colorScheme.onErrorContainer
        "tip" -> MaterialTheme.colorScheme.onPrimaryContainer
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .background(tint, RoundedCornerShape(Brand.tokens.radius("sm")))
            .padding(14.dp),
    ) {
        Text(callout.title, style = MaterialTheme.typography.titleSmall)
        Spacer(Modifier.height(4.dp))
        Text(callout.body, style = MaterialTheme.typography.bodySmall, color = onTint)
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

@Composable
private fun LinkRow(title: String, subtitle: String, onClick: () -> Unit) {
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
