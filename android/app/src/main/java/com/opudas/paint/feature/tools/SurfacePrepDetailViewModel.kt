package com.opudas.paint.feature.tools

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.model.Guide
import com.opudas.paint.core.data.model.PrepSituation
import com.opudas.paint.core.data.model.Product
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SurfacePrepDetailUiState(
    val isLoading: Boolean = true,
    val situation: PrepSituation? = null,
    /** Resolved from the situation's product ids, in the order it lists them. */
    val products: List<Product> = emptyList(),
    val guides: List<Guide> = emptyList(),
    val contact: BrandContact? = null,
)

/**
 * One preparation sequence, with what it names resolved.
 *
 * A sequence lists the products and guides it needs by id, so both are looked up
 * here: advice that names a primer and cannot open it stops being advice at the
 * point somebody needs to check the coat count.
 */
class SurfacePrepDetailViewModel(
    private val content: ContentRepository,
    private val situationId: String,
) : ViewModel() {

    private val mutableState = MutableStateFlow(SurfacePrepDetailUiState())
    val uiState: StateFlow<SurfacePrepDetailUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            val situation = content.prepSituation(situationId)
            val guides = if (situation == null) {
                emptyList()
            } else {
                situation.guides.mapNotNull { id -> content.guide(id) }
            }
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    situation = situation,
                    products = if (situation == null) {
                        emptyList()
                    } else {
                        content.productsByIds(situation.products)
                    },
                    guides = guides,
                    contact = content.contact(),
                )
            }
        }
    }
}
