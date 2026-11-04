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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
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
import com.opudas.paint.core.data.model.PrepSituation
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.data.model.ToolOption
import com.opudas.paint.core.data.model.ToolQuestion
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.engine.Caution

/*
 * Four questions to a specified finish.
 *
 * Each question carries the desk's own explanation of why it is being asked, because
 * an answer given without understanding the question is not much use, and because
 * the reason is usually the useful part: "a sheen overhead shows roller marks in
 * raking light" teaches something that survives the next job.
 *
 * Nothing is defaulted. Until all four are answered there is no recommendation at
 * all, rather than a confident one built on assumptions nobody made.
 */

@Composable
private fun rememberFinishFinderViewModel(): FinishFinderViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { FinishFinderViewModel(context.container.content) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FinishFinderScreen(
    onBack: () -> Unit,
    onOpenProduct: (String) -> Unit,
    onOpenGuide: (String) -> Unit,
    onOpenPrep: (String) -> Unit,
    onAskQuote: (String) -> Unit,
    viewModel: FinishFinderViewModel = rememberFinishFinderViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    if (state.isLoading) {
        LoadingState(Modifier.fillMaxSize(), label = "Loading the finish finder")
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text("Finish finder", style = MaterialTheme.typography.titleMedium, maxLines = 1)
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
            },
            actions = {
                if (state.answers.isNotEmpty()) {
                    IconButton(onClick = viewModel::onReset) {
                        Icon(Icons.Filled.Close, contentDescription = "Start again")
                    }
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
                    title = "Four questions to a specified finish",
                    subtitle = if (state.isComplete) {
                        "Answered — the specification is below"
                    } else {
                        "${state.remaining} of ${state.questions.size} still to answer. " +
                            "Nothing is recommended until all four are."
                    },
                )
            }

            items(state.questions) { question ->
                QuestionBlock(
                    question = question,
                    options = state.options[question.id].orEmpty(),
                    selected = state.answers[question.id],
                    onSelect = { optionId -> viewModel.onAnswer(question.id, optionId) },
                    onClear = { viewModel.onClear(question.id) },
                )
            }

            val result = state.result
            if (result != null) {
                item {
                    Spacer(Modifier.height(12.dp))
                    val blocked = result.advice.blocked
                    if (blocked != null) {
                        BlockedPanel(
                            title = blocked.title,
                            body = blocked.body,
                            onOpenGuide = { onOpenGuide(blocked.guideId) },
                        )
                    } else {
                        Specification(
                            result = result,
                            onOpenProduct = onOpenProduct,
                            onOpenGuide = onOpenGuide,
                            onOpenPrep = onOpenPrep,
                            onAskQuote = onAskQuote,
                        )
                    }
                }
            }

            item {
                Spacer(Modifier.height(16.dp))
                HonestNote(
                    "This specifies a finish from four answers. It does not know your wall: " +
                        "where a recommendation and the surface disagree, the surface wins, " +
                        "and the desk will look at a photograph.",
                )
            }
        }
    }
}

@Composable
private fun QuestionBlock(
    question: ToolQuestion,
    options: List<ToolOption>,
    selected: String?,
    onSelect: (String) -> Unit,
    onClear: () -> Unit,
) {
    Column(Modifier.padding(top = 18.dp)) {
        Text(
            question.step,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(question.prompt, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(2.dp))
        Text(
            question.why,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))

        options.forEach { option ->
            OptionRow(
                option = option,
                selected = option.id == selected,
                onSelect = { onSelect(option.id) },
            )
        }

        if (selected != null) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Answered",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                SecondaryAction(text = "Change", onClick = onClear)
            }
        }
    }
}

@Composable
private fun OptionRow(option: ToolOption, selected: Boolean, onSelect: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .clickable(onClickLabel = option.label, role = Role.RadioButton, onClick = onSelect),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = null)
        Column(Modifier.padding(vertical = 6.dp)) {
            Text(option.label, style = MaterialTheme.typography.bodyLarge)
            if (option.note.isNotEmpty()) {
                Text(
                    option.note,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/**
 * The one answer where nothing is sold.
 *
 * A damp wall needs its water found and stopped before any coating goes on, and
 * saying so loses the sale. It is the correct answer anyway, and it is the reason
 * this tool can be trusted about the other six conditions.
 */
@Composable
private fun BlockedPanel(title: String, body: String, onOpenGuide: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.errorContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
            Spacer(Modifier.height(12.dp))
            SecondaryAction(text = "Read the damp and mould guide", onClick = onOpenGuide)
        }
    }
}

@Composable
private fun Specification(
    result: FinishUi,
    onOpenProduct: (String) -> Unit,
    onOpenGuide: (String) -> Unit,
    onOpenPrep: (String) -> Unit,
    onAskQuote: (String) -> Unit,
) {
    val advice = result.advice
    val topcoat: Product? = result.topcoat

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                "The specification",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                topcoat?.name ?: advice.topcoatId,
                style = MaterialTheme.typography.headlineSmall,
            )
            if (topcoat != null) {
                Text(topcoat.line, style = MaterialTheme.typography.bodySmall)
            }

            val sheen = result.sheenLabel
            if (sheen != null) {
                Spacer(Modifier.height(10.dp))
                FactRow(label = "Sheen", value = sheen)
            }
            if (advice.coats > 0) {
                FactRow(label = "Coats", value = "${advice.coats}")
            }
            val coatsNote = advice.coatsNote
            if (coatsNote != null) {
                Spacer(Modifier.height(6.dp))
                Text(coatsNote, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(12.dp))
            Text("Why", style = MaterialTheme.typography.titleSmall)
            advice.reasons.forEach { reason ->
                Text(
                    "·  $reason",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }

            val primer: Product? = result.primer
            val screed: Product? = result.screed
            val alternative: Product? = result.alternative
            if (primer != null || screed != null || alternative != null || advice.primerNote != null) {
                Spacer(Modifier.height(14.dp))
                Text("Also in this system", style = MaterialTheme.typography.titleSmall)
                if (primer != null) {
                    ProductLine(product = primer, why = "Primer", onOpen = { onOpenProduct(primer.id) })
                }
                val primerNote = advice.primerNote
                if (primerNote != null) {
                    Text(
                        "·  Primer not in this range: $primerNote",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                if (screed != null) {
                    ProductLine(product = screed, why = "To flatten the surface first", onOpen = { onOpenProduct(screed.id) })
                }
                if (alternative != null) {
                    ProductLine(product = alternative, why = "If you disagree", onOpen = { onOpenProduct(alternative.id) })
                }
            }

            if (advice.cautions.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                Text("Before you start", style = MaterialTheme.typography.titleSmall)
                advice.cautions.forEach { caution ->
                    CautionLine(caution = caution, onOpenGuide = onOpenGuide)
                }
            }

            if (result.prep.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                Text("Preparation for this condition", style = MaterialTheme.typography.titleSmall)
                result.prep.forEach { situation ->
                    SituationLine(situation = situation, onOpen = { onOpenPrep(situation.id) })
                }
            }

            if (topcoat != null) {
                Spacer(Modifier.height(16.dp))
                PrimaryAction(
                    text = "Ask about this specification",
                    onClick = { onAskQuote(topcoat.id) },
                )
                Spacer(Modifier.height(8.dp))
                SecondaryAction(
                    text = "Open ${topcoat.shortName}",
                    onClick = { onOpenProduct(topcoat.id) },
                )
            }
        }
    }
}

@Composable
private fun ProductLine(product: Product, why: String, onOpen: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = 6.dp)
            .clickable(onClickLabel = product.name, role = Role.Button, onClick = onOpen),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(product.name, style = MaterialTheme.typography.bodyLarge)
            Text(why, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun CautionLine(caution: Caution, onOpenGuide: (String) -> Unit) {
    val guideId = caution.guideId
    Column(Modifier.padding(top = 6.dp)) {
        Text("·  ${caution.text}", style = MaterialTheme.typography.bodySmall)
        if (guideId != null) {
            Text(
                "Read the guide",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .padding(top = 2.dp)
                    .clickable(onClickLabel = "Read the guide", role = Role.Button) {
                        onOpenGuide(guideId)
                    },
            )
        }
    }
}

@Composable
private fun SituationLine(situation: PrepSituation, onOpen: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = 6.dp)
            .clickable(onClickLabel = situation.label, role = Role.Button, onClick = onOpen),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(situation.label, style = MaterialTheme.typography.bodyLarge)
            Text(
                "${situation.steps.size} steps",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
