package com.opudas.paint.feature.documents

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.opudas.paint.container
import com.opudas.paint.core.data.model.BrandDocument
import com.opudas.paint.core.designsystem.Brand
import com.opudas.paint.core.designsystem.HonestNote
import com.opudas.paint.core.designsystem.LoadingState
import com.opudas.paint.core.designsystem.SectionHeader
import com.opudas.paint.core.util.AppCopy
import com.opudas.paint.core.util.openWeb

/*
 * The colour book, the room book, the colour wheel, the fan deck, the specification
 * sheet and the master catalogue.
 *
 * Five of the six are in the APK, so they open with no signal at all; the catalogue is
 * 6.2 MB of 126 pages that the build leaves out, and this screen says that on the row
 * rather than letting somebody tap it and wait. The titles and details are the ones the
 * website prints, out of the same generated bundle, so a document cannot be called one
 * thing here and another thing there.
 */

@Composable
private fun rememberDocumentsViewModel(): DocumentsViewModel {
    val context = LocalContext.current
    return viewModel(
        factory = viewModelFactory {
            initializer { DocumentsViewModel(context.container.content) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentsScreen(
    onBack: () -> Unit,
    onOpenDocument: (String, String) -> Unit,
    viewModel: DocumentsViewModel = rememberDocumentsViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = {
                Text("Documents", style = MaterialTheme.typography.titleMedium, maxLines = 1)
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

        if (state.isLoading) {
            LoadingState(Modifier.fillMaxSize(), label = "Loading the documents")
            return@Column
        }

        LazyColumn(
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            item {
                SectionHeader(
                    title = "Books, charts and sheets",
                    subtitle = "${state.offlineCount} of ${state.documents.size} are inside " +
                        "the app and open with no signal.",
                    modifier = Modifier.padding(bottom = 6.dp),
                )
            }
            items(state.documents) { document ->
                DocumentCard(
                    document = document,
                    onClick = {
                        if (document.bundled) {
                            onOpenDocument(document.file, document.title)
                        } else {
                            // Not in the build. The website's copy is the only one, and
                            // the row has already said so before this tap.
                            context.openWeb(AppCopy.url(document.href))
                        }
                    },
                )
            }
            item {
                Column(Modifier.padding(vertical = 12.dp)) {
                    HonestNote(
                        "A page in this app is a rendering of the sheet, not its text: a " +
                            "screen reader can be told which page you are on and cannot read " +
                            "a table off a picture. The same file on the website is a PDF with " +
                            "real text in it.",
                    )
                }
            }
        }
    }
}

@Composable
private fun DocumentCard(document: BrandDocument, onClick: () -> Unit) {
    Surface(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable(
                onClickLabel = if (document.bundled) {
                    "Open ${document.title}"
                } else {
                    "Open ${document.title} on the website"
                },
                role = Role.Button,
                onClick = onClick,
            ),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(document.title, style = MaterialTheme.typography.titleSmall)
            Text(
                document.detail,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
            val purpose = document.purpose
            if (purpose != null) {
                Text(
                    purpose,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            if (!document.bundled) {
                Text(
                    "Opens on the website — 126 pages is not something to carry in the app.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}
