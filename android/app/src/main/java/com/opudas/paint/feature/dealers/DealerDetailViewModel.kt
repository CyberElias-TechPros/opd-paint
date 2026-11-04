package com.opudas.paint.feature.dealers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.model.Dealer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DealerDetailUiState(
    val isLoading: Boolean = true,
    val dealer: Dealer? = null,
    val contact: BrandContact? = null,
    /**
     * Other counters in the same city, then the same state.
     *
     * Offered because the useful question at a dealer page is often "and if that
     * one is closed or does not have the pack size?". Six of these fourteen
     * entries are not yet confirmed, so an alternative in the same city is not a
     * convenience — it is the reason the unconfirmed ones are still listed.
     */
    val nearby: List<Dealer> = emptyList(),
)

class DealerDetailViewModel(
    private val content: ContentRepository,
    private val dealerId: String,
) : ViewModel() {

    private val mutableState = MutableStateFlow(DealerDetailUiState())
    val uiState: StateFlow<DealerDetailUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            val dealer = content.dealer(dealerId)
            val all = content.dealers()
            val sameCity = all
                .filter { it.id != dealerId && dealer != null && it.city == dealer.city }
                .sortedBy { it.name }
            val sameState = all
                .filter { other ->
                    other.id != dealerId &&
                        dealer != null &&
                        other.state == dealer.state &&
                        other.city != dealer.city
                }
                .sortedBy { it.name }

            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    dealer = dealer,
                    contact = content.contact(),
                    nearby = (sameCity + sameState).take(4),
                )
            }
        }
    }
}
