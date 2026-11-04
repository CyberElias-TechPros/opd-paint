package com.opudas.paint.feature.legal

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.model.LegalDoc
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LegalDocUiState(
    val isLoading: Boolean = true,
    val doc: LegalDoc? = null,
    /** The other two notices, so a reader does not have to go back to find them. */
    val others: List<LegalDoc> = emptyList(),
    val contact: BrandContact? = null,
) {
    /**
     * Whether this notice carries the data-request form.
     *
     * Read from the section marker rather than from the slug, so the app follows the
     * text instead of assuming which notice the form lives in. If the desk moves it,
     * the bundle moves it and the app follows.
     */
    val hasRequestForm: Boolean
        get() = doc?.sections?.any { it.form == LegalViewModel.DATA_REQUEST_FORM } == true
}

/** One notice, and the two beside it. */
class LegalDocViewModel(
    private val content: ContentRepository,
    private val slug: String,
) : ViewModel() {

    private val mutableState = MutableStateFlow(LegalDocUiState())
    val uiState: StateFlow<LegalDocUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            val all = content.legalDocs()
            val doc = all.firstOrNull { it.slug == slug }
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    doc = doc,
                    others = all.filter { it.slug != slug },
                    contact = content.contact(),
                )
            }
        }
    }
}
