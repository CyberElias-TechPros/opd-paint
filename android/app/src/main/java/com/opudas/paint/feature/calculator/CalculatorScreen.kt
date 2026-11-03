package com.opudas.paint.feature.calculator

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.ContactActions
import com.opudas.paint.core.designsystem.FactRow
import com.opudas.paint.core.designsystem.FilterChipRow
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.engine.CalculationResult
import com.opudas.paint.core.engine.MeasureSystem
import com.opudas.paint.core.engine.OpeningKind
import com.opudas.paint.core.engine.PaintUnit
import com.opudas.paint.core.util.dial
import com.opudas.paint.core.util.openWhatsApp
import com.opudas.paint.core.util.plain

/*
 * Size a job.
 *
 * The point of this screen is not the number at the bottom, it is that the number
 * can be argued with: every step is written out in the formula card, in the unit
 * system the room was measured in, so a contractor who thinks the allowance is
 * wrong can see the allowance and say so.
 *
 * The other thing worth noticing is what is absent. There is no price, no "add to
 * basket" and no checkout. The last action on this screen is a message to a person
 * who can confirm availability and quote — see
 * `docs/adr/0003-no-e-commerce-at-launch.md`.
 */

@Composable
private fun rememberCalculatorViewModel(productId: String?): CalculatorViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { CalculatorViewModel(context.container.content, productId) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalculatorScreen(
    onBack: () -> Unit,
    preselectedProductId: String? = null,
    viewModel: CalculatorViewModel = rememberCalculatorViewModel(preselectedProductId),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    if (state.isLoading) {
        LoadingState(label = "Reading the product range")
        return
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Size a job",
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                    )
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
        },
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize(),
            contentPadding = PaddingValues(bottom = 36.dp),
        ) {
            item {
                SectionHeader(
                    title = "Product",
                    subtitle = state.selectedProduct?.name
                        ?: "Choose one for its coverage and pack sizes",
                    modifier = Modifier.padding(horizontal = 20.dp),
                )
            }
            item {
                FilterChipRow(
                    options = state.products.map { it.shortName },
                    selected = state.selectedProduct?.shortName,
                    onSelect = { shortName ->
                        viewModel.onProductSelect(
                            state.products.firstOrNull { it.shortName == shortName }?.id,
                        )
                    },
                    allLabel = "No product yet",
                )
            }
            item {
                if (state.selectedProduct == null) {
                    HonestNote(
                        text = "Without a product this uses a placeholder coverage of 10 m² per " +
                            "litre and cannot suggest pack sizes. Choose one from the range.",
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                    )
                }
            }

            item {
                SectionHeader(
                    title = "The room",
                    subtitle = "Measured in ${if (state.system == MeasureSystem.METRIC) "metres" else "feet"}",
                    modifier = Modifier.padding(horizontal = 20.dp),
                )
            }
            item {
                SystemToggle(system = state.system, onSelect = viewModel::onSystemChange)
            }
            item {
                MeasureFields(state = state, viewModel = viewModel)
            }
            item {
                CeilingRow(
                    checked = state.includeCeiling,
                    onCheckedChange = viewModel::onCeilingChange,
                )
            }
            item {
                CoatStepper(
                    coats = state.coats,
                    recommended = state.selectedProduct?.coatsRecommended,
                    onDecrement = { viewModel.onCoatsChange(state.coats - 1) },
                    onIncrement = { viewModel.onCoatsChange(state.coats + 1) },
                )
            }
            item {
                TrimSlider(
                    percent = state.trimAllowancePct,
                    onChange = viewModel::onTrimAllowanceChange,
                )
            }

            item {
                SectionHeader(
                    title = "Doors and windows",
                    subtitle = "Deducted from the wall area, because they are not painted",
                    modifier = Modifier.padding(horizontal = 20.dp),
                )
            }
            item {
                OpeningList(state = state, viewModel = viewModel)
            }
            item {
                SecondaryAction(
                    text = "Add an opening",
                    onClick = viewModel::addOpening,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                )
            }

            val result = state.result
            if (result != null) {
                item {
                    SectionHeader(
                        title = "What to buy",
                        subtitle = "Whole packs only — you cannot buy part of a tin",
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                }
                item {
                    ResultFacts(result = result, unit = state.unit, system = state.system)
                }
                item {
                    FormulaCard(result = result)
                }
                item {
                    HonestNote(
                        text = "A guide, not a specification. Coverage is the figure on the data " +
                            "sheet for one coat on a sound surface; porous plaster, heavy texture " +
                            "or a dark colour being covered by a light one all take more. The " +
                            "desk will confirm it against the job.",
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                    )
                }
                item {
                    val contact = state.contact
                    if (contact != null) {
                        ContactActions(
                            phoneDisplay = contact.phoneDisplay,
                            phoneTel = contact.phoneTel,
                            whatsapp = contact.whatsapp,
                            onCall = { context.dial(contact.phoneTel) },
                            onWhatsApp = {
                                context.openWhatsApp(contact.whatsapp, viewModel.whatsappMessage())
                            },
                            modifier = Modifier.padding(horizontal = 20.dp),
                        )
                    }
                }
                item {
                    HonestNote(
                        text = "The message to the desk carries these numbers, so the person " +
                            "reading it does not have to ask what the room measured.",
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun SystemToggle(system: MeasureSystem, onSelect: (MeasureSystem) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        MeasureSystem.entries.forEach { option ->
            FilterChip(
                selected = option == system,
                onClick = { onSelect(option) },
                label = {
                    Text(if (option == MeasureSystem.METRIC) "Metres" else "Feet")
                },
            )
        }
    }
}

@Composable
private fun MeasureFields(state: CalculatorUiState, viewModel: CalculatorViewModel) {
    val unit = state.system.lengthUnit
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        OutlinedTextField(
            value = state.roomLength,
            onValueChange = viewModel::onRoomLengthChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Length ($unit)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            shape = MaterialTheme.shapes.medium,
        )
        OutlinedTextField(
            value = state.roomWidth,
            onValueChange = viewModel::onRoomWidthChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Width ($unit)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            shape = MaterialTheme.shapes.medium,
        )
        OutlinedTextField(
            value = state.wallHeight,
            onValueChange = viewModel::onWallHeightChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Wall height ($unit)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            shape = MaterialTheme.shapes.medium,
        )
    }
}

@Composable
private fun CeilingRow(checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(text = "Include the ceiling", style = MaterialTheme.typography.titleSmall)
            Text(
                text = "Adds length × width to the paintable area",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun CoatStepper(
    coats: Int,
    recommended: Int?,
    onDecrement: () -> Unit,
    onIncrement: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(text = "Coats", style = MaterialTheme.typography.titleSmall)
            Text(
                text = if (recommended == null) {
                    "Between ${CalculatorViewModel.MIN_COATS} and ${CalculatorViewModel.MAX_COATS}"
                } else {
                    "The data sheet recommends $recommended"
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        IconButton(onClick = onDecrement, enabled = coats > CalculatorViewModel.MIN_COATS) {
            Icon(Icons.Filled.KeyboardArrowDown, contentDescription = "Fewer coats")
        }
        Text(
            text = "$coats",
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.padding(horizontal = 6.dp),
        )
        IconButton(onClick = onIncrement, enabled = coats < CalculatorViewModel.MAX_COATS) {
            Icon(Icons.Filled.KeyboardArrowUp, contentDescription = "More coats")
        }
    }
}

@Composable
private fun TrimSlider(percent: Int, onChange: (Int) -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(text = "Trim and cutting-in", style = MaterialTheme.typography.titleSmall)
                Text(
                    text = "Skirting, reveals and edges, cut in from the same bucket",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = "$percent%",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(start = 12.dp),
            )
        }
        Slider(
            value = percent.toFloat(),
            onValueChange = { onChange(it.toInt()) },
            valueRange = 0f..CalculatorViewModel.MAX_TRIM_PCT.toFloat(),
            steps = CalculatorViewModel.MAX_TRIM_PCT - 1,
        )
    }
}

@Composable
private fun OpeningList(state: CalculatorUiState, viewModel: CalculatorViewModel) {
    val unit = state.system.lengthUnit
    if (state.openings.isEmpty()) {
        HonestNote(
            text = "No openings deducted. A room with a door and two windows loses about " +
                "5 m² of wall — worth adding, because it is paint nobody will use.",
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp),
        )
        return
    }
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        state.openings.forEach { draft ->
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(Brand.tokens.radius("md")),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            ) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Row(
                            Modifier.weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            OpeningKind.entries.forEach { kind ->
                                FilterChip(
                                    selected = draft.kind == kind,
                                    onClick = { viewModel.onOpeningChange(draft.id, kind) },
                                    label = { Text(kind.label) },
                                )
                            }
                        }
                        IconButton(onClick = { viewModel.removeOpening(draft.id) }) {
                            Icon(
                                imageVector = Icons.Filled.Delete,
                                contentDescription = "Remove this opening",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = draft.width,
                            onValueChange = { viewModel.onOpeningWidthChange(draft.id, it) },
                            modifier = Modifier.weight(1f),
                            label = { Text("Width ($unit)") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            shape = MaterialTheme.shapes.small,
                        )
                        OutlinedTextField(
                            value = draft.height,
                            onValueChange = { viewModel.onOpeningHeightChange(draft.id, it) },
                            modifier = Modifier.weight(1f),
                            label = { Text("Height ($unit)") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            shape = MaterialTheme.shapes.small,
                        )
                        OutlinedTextField(
                            value = draft.count,
                            onValueChange = { viewModel.onOpeningCountChange(draft.id, it) },
                            modifier = Modifier.weight(0.7f),
                            label = { Text("How many") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            shape = MaterialTheme.shapes.small,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ResultFacts(result: CalculationResult, unit: PaintUnit, system: MeasureSystem) {
    val symbol = unit.symbol
    val packs = if (result.packs.isEmpty()) {
        "no pack sizes for this product"
    } else {
        result.packs.joinToString(" + ") { pack ->
            "${pack.count} × ${pack.size.plain()} $symbol"
        } + " = ${result.amountBought.plain()} $symbol"
    }
    Column(Modifier.padding(horizontal = 20.dp)) {
        FactRow(label = "Wall area", value = "${result.wallArea.plain()} m²")
        if (result.ceilingArea > 0) {
            FactRow(label = "Ceiling", value = "${result.ceilingArea.plain()} m²")
        } else {
            FactRow(label = "Ceiling", value = "excluded")
        }
        FactRow(label = "Openings deducted", value = "${result.openingsArea.plain()} m²")
        FactRow(label = "Trim and cutting-in", value = "${result.trimArea.plain()} m²")
        FactRow(label = "Paintable area", value = "${result.paintableArea.plain()} m²")
        FactRow(label = "Per coat", value = "${result.amountPerCoat.plain()} $symbol")
        FactRow(label = "With 5% handling", value = "${result.amountWithAllowance.plain()} $symbol")
        FactRow(label = "Buy", value = packs)
        FactRow(label = "Left over", value = "${result.surplus.plain()} $symbol")
        FactRow(
            label = "Measured in",
            value = if (system == MeasureSystem.METRIC) "metres" else "feet",
        )
    }
}

@Composable
private fun FormulaCard(result: CalculationResult) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                text = "How this was calculated",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            result.formula.forEach { line ->
                Text(
                    text = line,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
