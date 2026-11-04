package com.opudas.paint.feature.more

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandContact
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MoreUiState(
    val isLoading: Boolean = true,
    val contact: BrandContact? = null,
    val colourCount: Int = 0,
    val productCount: Int = 0,
    val guideCount: Int = 0,
    val dealerCount: Int = 0,
    val unverifiedDealerCount: Int = 0,
    val imageCount: Int = 0,
)

/**
 * The "more" screen's data: how to reach a human, and what this build knows.
 *
 * The counts are here rather than hidden in a debug menu because they are the
 * honest answer to "is this app complete?". Fifty-nine colours and fourteen
 * dealers, six of them not yet confirmed, is a truer summary of the product than
 * any feature list — and the unconfirmed number is the one the business has to
 * chase, so it is on a screen a person will actually open.
 */
class MoreViewModel(private val content: ContentRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(MoreUiState())
    val uiState: StateFlow<MoreUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = false,
                    contact = content.contact(),
                    colourCount = content.colors().size,
                    productCount = content.products().size,
                    guideCount = content.guides().size,
                    dealerCount = content.dealers().size,
                    unverifiedDealerCount = content.unverifiedDealerCount(),
                    imageCount = content.mediaKeys().size,
                )
            }
        }
    }
}
