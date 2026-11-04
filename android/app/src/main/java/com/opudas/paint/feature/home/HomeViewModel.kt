package com.opudas.paint.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.Palette
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * What the home screen shows, and the counts behind it.
 *
 * The counts are on the home screen rather than in a settings page because "59
 * colours, 14 dealers, 6 of them not yet confirmed" is the honest summary of what
 * this app knows — and the last of those numbers is the one the business has to
 * chase.
 */
data class HomeUiState(
    val isLoading: Boolean = true,
    val contact: BrandContact? = null,
    val colourCount: Int = 0,
    val productCount: Int = 0,
    val dealerCount: Int = 0,
    val unverifiedDealerCount: Int = 0,
    val guideCount: Int = 0,
    val featured: List<PaintColor> = emptyList(),
    val palette: Palette? = null,
    val paletteColors: List<PaintColor> = emptyList(),
)

class HomeViewModel(private val content: ContentRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val colors = content.colors()
            val palette = content.palettes().firstOrNull()
            _uiState.update {
                it.copy(
                    isLoading = false,
                    contact = content.contact(),
                    colourCount = colors.size,
                    productCount = content.products().size,
                    dealerCount = content.dealers().size,
                    unverifiedDealerCount = content.unverifiedDealerCount(),
                    guideCount = content.guides().size,
                    // The Signature collection is the one the printed colour book
                    // leads with, so it is what the app leads with too.
                    featured = colors.filter { color -> color.collection == SIGNATURE_COLLECTION }
                        .ifEmpty { colors }
                        .take(8),
                    palette = palette,
                    paletteColors = palette?.let { scheme -> content.colorsByIds(scheme.colors) } ?: emptyList(),
                )
            }
        }
    }

    private companion object {
        const val SIGNATURE_COLLECTION = "The Signature"
    }
}
