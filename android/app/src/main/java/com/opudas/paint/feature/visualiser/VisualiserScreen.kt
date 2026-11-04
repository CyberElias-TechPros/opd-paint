package com.opudas.paint.feature.visualiser

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.designsystem.ColourSwatch
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.PrimaryAction
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.engine.FinishLook

/*
 * Try it on your wall.
 *
 * The photograph is chosen through the system photo picker, which needs no permission on a
 * modern Android and hands over one image rather than the gallery. It is decoded on this
 * device, scaled to at most 1400px on its longest edge, and never sent anywhere — the same
 * position the website takes, and for the same reason: it is the only privacy promise that
 * is both honest and cheap to keep.
 *
 * The preview is a simulation and the screen says so in the website's own words. It swaps
 * the hue and keeps the light and shadow in the photograph; real paint also reflects
 * differently depending on finish, substrate and time of day.
 */

@Composable
private fun rememberVisualiserViewModel(colourId: String?): VisualiserViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer {
                VisualiserViewModel(context.applicationContext, context.container.content, colourId)
            }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisualiserScreen(
    colourId: String?,
    onBack: () -> Unit,
    viewModel: VisualiserViewModel = rememberVisualiserViewModel(colourId),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val picker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia(),
    ) { uri -> viewModel.onPhotoPicked(uri) }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text("Room preview", style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
            state.isDecoding -> LoadingState(
                Modifier.fillMaxSize(),
                label = "Opening your photograph",
            )

            !state.hasImage -> EmptyState(
                title = "Try it on your wall",
                body = "Choose a photograph of the room, tap the wall you want to change, " +
                    "then work through the library. Nothing is uploaded: every pixel of this " +
                    "happens on the phone.",
                action = {
                    PrimaryAction(
                        text = "Choose a photograph",
                        onClick = {
                            picker.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                            )
                        },
                    )
                },
            )

            else -> {
                // The preview sits outside the scrolling column on purpose. A drag that
                // paints a wall and a drag that scrolls a list are the same gesture, and
                // whichever owns the node wins; putting the image in a scrollable would
                // make the brush unusable.
                PreviewPane(
                    width = state.width,
                    height = state.height,
                    revision = state.revision,
                    state = state,
                    viewModel = viewModel,
                )

                Column(
                    Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(PaddingValues(horizontal = 20.dp, vertical = 10.dp)),
                ) {
                    val failure = state.failure
                    if (failure != null) {
                        HonestNote(failure)
                    }

                    SectionHeader(
                        title = "The wall",
                        subtitle = "${state.coveragePercent}% of the photograph is selected.",
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SecondaryAction(
                            text = "Another photograph",
                            onClick = {
                                picker.launch(
                                    PickVisualMediaRequest(
                                        ActivityResultContracts.PickVisualMedia.ImageOnly,
                                    ),
                                )
                            },
                            modifier = Modifier.weight(1f),
                        )
                        SecondaryAction(
                            text = "Undo",
                            onClick = viewModel::undo,
                            enabled = state.canUndo,
                            modifier = Modifier.weight(1f),
                        )
                        SecondaryAction(
                            text = "Clear",
                            onClick = viewModel::clearSelection,
                            enabled = state.hasImage,
                            modifier = Modifier.weight(1f),
                        )
                    }

                    SectionHeader(
                        title = "How to select",
                        subtitle = "Tap fills a wall up to its edges. The brush corrects what " +
                            "a tap got wrong, in either direction.",
                        modifier = Modifier.padding(top = 14.dp),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        VisualiserTool.entries.forEach { tool ->
                            SecondaryAction(
                                text = tool.label,
                                onClick = { viewModel.setTool(tool) },
                                enabled = state.tool != tool,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }

                    if (state.tool == VisualiserTool.FILL) {
                        SliderRow(
                            label = "Tolerance",
                            value = "${state.tolerance}",
                            supporting = "How far from the colour you tapped the fill may " +
                                "wander. Low keeps a doorway crisp; high crosses a shadow.",
                            valueRange = 0f..100f,
                            current = state.tolerance.toFloat(),
                            onChange = { viewModel.setTolerance(it.toInt()) },
                        )
                    } else {
                        SliderRow(
                            label = "Brush",
                            value = "${state.brushRadius}px",
                            supporting = "The radius of the soft edge. Small for a corner, " +
                                "large for a whole wall.",
                            valueRange = VisualiserViewModel.MIN_BRUSH_RADIUS.toFloat()..VisualiserViewModel.MAX_BRUSH_RADIUS.toFloat(),
                            current = state.brushRadius.toFloat(),
                            onChange = { viewModel.setBrushRadius(it.toInt()) },
                        )
                    }

                    SectionHeader(
                        title = "The colour",
                        subtitle = state.colour?.let { "${it.name} (${it.code})" }
                            ?: "${state.colours.size} colours",
                        modifier = Modifier.padding(top = 14.dp),
                    )
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(vertical = 4.dp),
                    ) {
                        items(state.colours, key = { it.id }) { colour ->
                            ColourSwatch(
                                hex = colour.hex,
                                name = colour.name,
                                code = colour.code,
                                modifier = Modifier.size(64.dp),
                                aspect = 1f,
                                onClick = { viewModel.selectColour(colour.id) },
                            )
                        }
                    }

                    SectionHeader(
                        title = "The finish",
                        modifier = Modifier.padding(top = 14.dp),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SecondaryAction(
                            text = "Matt",
                            onClick = { viewModel.setFinish(FinishLook.MATT) },
                            enabled = state.finish != FinishLook.MATT,
                            modifier = Modifier.weight(1f),
                        )
                        SecondaryAction(
                            text = "Silk",
                            onClick = { viewModel.setFinish(FinishLook.SILK) },
                            enabled = state.finish != FinishLook.SILK,
                            modifier = Modifier.weight(1f),
                        )
                    }

                    Column(Modifier.padding(top = 16.dp)) {
                        HonestNote(
                            "A simulation, not a promise. The preview keeps the light and " +
                                "shadow in your photograph and swaps the hue. Real paint also " +
                                "reflects light differently depending on finish, substrate and " +
                                "time of day — confirm with a sample pot or a dealer chip.",
                        )
                        HonestNote(
                            "Colours on screen are digital proofs. Your photograph never " +
                                "leaves this phone: it is decoded here, scaled down here and " +
                                "thrown away when you leave the screen.",
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }
        }
    }
}

@Composable
private fun PreviewPane(
    width: Int,
    height: Int,
    revision: Int,
    state: VisualiserUiState,
    viewModel: VisualiserViewModel,
) {
    val bitmap = state.preview ?: return
    val ratio = if (height > 0) width.toFloat() / height else 1f

    // Keyed on the revision because the bitmap instance is reused: Compose compares a
    // state value for equality, a reused bitmap is equal to itself, and without this the
    // pixels would change and the screen would not.
    key(revision) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = "Your photograph with ${state.colour?.name ?: "the chosen colour"} " +
                "on the selected wall, in a ${state.finish.name.lowercase()} finish",
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(ratio)
                .pointerInput(width, height) {
                    detectDragGestures(
                        onDragStart = { offset ->
                            viewModel.onGestureStart(
                                offset.x * width / size.width,
                                offset.y * height / size.height,
                            )
                        },
                        onDrag = { change, _ ->
                            change.consume()
                            viewModel.onGestureDrag(
                                change.position.x * width / size.width,
                                change.position.y * height / size.height,
                            )
                        },
                        onDragEnd = viewModel::onGestureEnd,
                        onDragCancel = viewModel::onGestureEnd,
                    )
                },
                contentScale = ContentScale.FillBounds,
            )
    }
}

@Composable
private fun SliderRow(
    label: String,
    value: String,
    supporting: String,
    valueRange: ClosedFloatingPointRange<Float>,
    current: Float,
    onChange: (Float) -> Unit,
) {
    Column(Modifier.padding(top = 8.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label, style = MaterialTheme.typography.labelLarge)
            Text(
                value,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Slider(
            value = current,
            onValueChange = onChange,
            valueRange = valueRange,
        )
        Text(
            supporting,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
