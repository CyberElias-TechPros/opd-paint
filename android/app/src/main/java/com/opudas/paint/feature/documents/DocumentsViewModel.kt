package com.opudas.paint.feature.documents

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandDocument
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DocumentsUiState(
    val isLoading: Boolean = true,
    val documents: List<BrandDocument> = emptyList(),
) {
    /** How many of these open with no signal, for the line under the heading. */
    val offlineCount: Int
        get() = documents.count { it.bundled }
}

/**
 * The documents that belong to nobody in particular: the brand books and the
 * specification sheet.
 *
 * Six entries, all of them already inside the APK except the master catalogue. The
 * screen's whole job is to say which is which, because "download" on a phone with no
 * signal means something different from "download" on a laptop, and the difference is
 * whether the file is in the build.
 */
class DocumentsViewModel(private val content: ContentRepository) : ViewModel() {

    private val mutableState = MutableStateFlow(DocumentsUiState())
    val uiState: StateFlow<DocumentsUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            val documents = content.documents()
            mutableState.update { it.copy(isLoading = false, documents = documents) }
        }
    }
}
