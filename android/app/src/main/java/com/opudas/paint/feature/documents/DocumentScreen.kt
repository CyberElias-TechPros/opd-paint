package com.opudas.paint.feature.documents

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.core.designsystem.EmptyState
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SecondaryAction
import com.opudas.paint.core.designsystem.SectionHeader

/*
 * A document from inside the APK, one page at a time.
 *
 * These are the technical and safety data sheets behind every product: the numbers a
 * contractor argues from, read at a counter, mid-conversation, in a shop with a metal
 * roof and no signal. That is the whole reason they are bundled rather than linked —
 * "open the website" is not an answer at the moment the question is asked.
 *
 * What is on screen is a rendering of a page, not the text of it, and the screen says so
 * rather than pretending otherwise: a screen reader can announce which page this is and
 * cannot read a coverage table out of a bitmap. The same document on the website is a PDF
 * with real text in it, which is the better route for anybody who needs one.
 */

@Composable
private fun rememberDocumentViewModel(path: String, title: String?): DocumentViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer {
                // The application context: this outlives the screen, and a view model
                // holding an activity is a leak that outlives the thing that caused it.
                DocumentViewModel(context.applicationContext, path, title)
            }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentScreen(
    path: String,
    title: String?,
    onBack: () -> Unit,
    viewModel: DocumentViewModel = rememberDocumentViewModel(path, title),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val heading = state.title.ifEmpty { "Document" }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text(heading, style = MaterialTheme.typography.titleMedium, maxLines = 1)
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
            state.isLoading -> LoadingState(Modifier.fillMaxSize(), label = "Opening $heading")

            // No page and a reason: the document is not in this build.
            state.page == null && state.error != null -> EmptyState(
                title = "Not inside the app",
                body = state.error.orEmpty(),
                action = { SecondaryAction(text = "Back", onClick = onBack) },
            )

            else -> {
                Column(
                    Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                ) {
                    val bitmap = state.page
                    if (bitmap != null) {
                        Image(
                            bitmap = bitmap.asImageBitmap(),
                            contentDescription = "$heading, ${state.position.lowercase()}",
                            modifier = Modifier.fillMaxWidth(),
                            contentScale = ContentScale.Fit,
                        )
                    }
                    val error = state.error
                    if (error != null) {
                        Column(Modifier.padding(20.dp)) {
                            HonestNote(error)
                        }
                    }
                    Column(Modifier.padding(20.dp)) {
                        SectionHeader(
                            title = "Reading a page as a picture",
                            subtitle = "A screen reader can tell you which page this is and " +
                                "cannot read the table on it. The same sheet on the website is " +
                                "a PDF with real text in it.",
                        )
                    }
                }

                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(PaddingValues(horizontal = 20.dp, vertical = 10.dp)),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    SecondaryAction(
                        text = "Previous",
                        onClick = viewModel::previous,
                        enabled = state.canGoBack,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        state.position,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    SecondaryAction(
                        text = "Next",
                        onClick = viewModel::next,
                        enabled = state.canGoForward,
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(Modifier.height(4.dp))
            }
        }
    }
}
