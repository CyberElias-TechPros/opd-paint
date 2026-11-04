package com.opudas.paint.feature.legal

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.LegalDoc
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LegalUiState(
    val isLoading: Boolean = true,
    val docs: List<LegalDoc> = emptyList(),
    /** The slug of the notice that carries the data-request form. */
    val requestSlug: String? = null,
)

/**
 * The three notices.
 *
 * Shipped in the APK rather than fetched, which is not a convenience here: the app
 * has a form that submits a statutory data request, and the notice explaining what
 * that request does has to be readable at the moment somebody is deciding whether to
 * make one — including with no signal.
 */
class LegalViewModel(private val content: ContentRepository) : ViewModel() {

    private val mutableState = MutableStateFlow(LegalUiState())
    val uiState: StateFlow<LegalUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            val docs = content.legalDocs()
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    docs = docs,
                    requestSlug = docs.firstOrNull { doc ->
                        doc.sections.any { it.form == DATA_REQUEST_FORM }
                    }?.slug,
                )
            }
        }
    }

    companion object {
        /** The marker the website renders its data-request form at. */
        const val DATA_REQUEST_FORM = "data-request"
    }
}
