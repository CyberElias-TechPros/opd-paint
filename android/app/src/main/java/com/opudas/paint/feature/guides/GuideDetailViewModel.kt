package com.opudas.paint.feature.guides

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.model.Guide
import com.opudas.paint.core.data.model.MediaEntry
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.Product
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class GuideDetailUiState(
    val isLoading: Boolean = true,
    val guide: Guide? = null,
    val hero: MediaEntry? = null,
    val relatedColors: List<PaintColor> = emptyList(),
    val relatedProducts: List<Product> = emptyList(),
    /**
     * The other guides in the same topic.
     *
     * A guide is rarely the whole answer — "how much paint do I need" leads to
     * surface preparation, which leads to application. Offering the neighbours is
     * cheaper for the reader than sending them back to a list to work out which
     * piece they are missing.
     */
    val relatedGuides: List<Guide> = emptyList(),
    val contact: BrandContact? = null,
)

/**
 * One guide: its sections, its callouts, its questions, and what it relates to.
 *
 * The related colours and products are resolved from ids for the same reason they
 * are on a project page: advice that names a product should be able to open it.
 */
class GuideDetailViewModel(
    private val content: ContentRepository,
    private val guideId: String,
) : ViewModel() {

    private val mutableState = MutableStateFlow(GuideDetailUiState())
    val uiState: StateFlow<GuideDetailUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            val guide = content.guide(guideId)
            val all = content.guides()
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    guide = guide,
                    hero = if (guide == null) null else content.media(guide.hero),
                    relatedColors = if (guide == null) {
                        emptyList()
                    } else {
                        content.colorsByIds(guide.relatedColors)
                    },
                    relatedProducts = if (guide == null) {
                        emptyList()
                    } else {
                        content.productsByIds(guide.relatedProducts)
                    },
                    relatedGuides = if (guide == null) {
                        emptyList()
                    } else {
                        all.filter { it.id != guide.id && it.category == guide.category }
                    },
                    contact = content.contact(),
                )
            }
        }
    }
}
