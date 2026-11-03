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

data class DealersUiState(
    val isLoading: Boolean = true,
    /** Everything that matches the current filters, in a stable order. */
    val dealers: List<Dealer> = emptyList(),
    val totalCount: Int = 0,
    val unverifiedCount: Int = 0,
    val states: List<String> = emptyList(),
    val services: List<String> = emptyList(),
    val selectedState: String? = null,
    val selectedServices: Set<String> = emptySet(),
    val query: String = "",
    val contact: BrandContact? = null,
) {
    val isEmpty: Boolean
        get() = !isLoading && dealers.isEmpty()

    val filterCount: Int
        get() = selectedServices.size +
            (if (selectedState != null) 1 else 0) +
            (if (query.isNotBlank()) 1 else 0)

    val hasFilters: Boolean
        get() = filterCount > 0
}

/**
 * Where to buy.
 *
 * Fourteen counters, eight of them confirmed in the current review cycle and six
 * of them trading areas the commercial team has not signed off yet. Both are
 * listed, because a list of only the confirmed ones would send somebody to a
 * counter that might not exist while hiding the one down the road that does — and
 * the six unconfirmed entries say so on the card, in the words the website uses.
 *
 * The order is state, then city, then name, and deliberately not
 * verified-first. Sorting the confirmed counters to the top would read as a
 * ranking of the business's own stockists, and the difference between the two
 * groups is when somebody last checked, not how good they are.
 */
class DealersViewModel(private val content: ContentRepository) : ViewModel() {

    private val mutableState = MutableStateFlow(DealersUiState())
    val uiState: StateFlow<DealersUiState> = mutableState.asStateFlow()

    private var all: List<Dealer> = emptyList()

    init {
        viewModelScope.launch {
            val dealers = content.dealers()
            all = dealers.sortedWith(
                compareBy({ it.state }, { it.city }, { it.name }),
            )
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    dealers = all,
                    totalCount = all.size,
                    unverifiedCount = all.count { !it.verified },
                    states = content.dealerStates(),
                    services = content.dealerServices(),
                    contact = content.contact(),
                )
            }
        }
    }

    fun onQueryChange(value: String) {
        mutableState.update { it.copy(query = value) }
        applyFilters()
    }

    fun onStateSelect(state: String?) {
        mutableState.update { it.copy(selectedState = state) }
        applyFilters()
    }

    /**
     * Services combine, rather than replacing each other.
     *
     * Somebody who needs colour mixing *and* site visits is asking one question —
     * "which counter can do both" — and a filter that widens the list when a
     * second service is added answers a different one.
     */
    fun onToggleService(service: String) {
        mutableState.update { current ->
            val services = current.selectedServices
            current.copy(
                selectedServices = if (services.contains(service)) services - service else services + service,
            )
        }
        applyFilters()
    }

    fun onClearFilters() {
        mutableState.update { it.copy(query = "", selectedState = null, selectedServices = emptySet()) }
        applyFilters()
    }

    private fun applyFilters() {
        val current = mutableState.value
        val query = current.query.trim().lowercase()
        val matched = all.filter { dealer ->
            val stateOk = current.selectedState == null || dealer.state == current.selectedState
            val servicesOk = current.selectedServices.isEmpty() ||
                dealer.services.containsAll(current.selectedServices)
            val queryOk = query.isEmpty() ||
                dealer.name.lowercase().contains(query) ||
                dealer.area.lowercase().contains(query) ||
                dealer.city.lowercase().contains(query) ||
                dealer.state.lowercase().contains(query) ||
                dealer.kind.lowercase().contains(query) ||
                dealer.services.any { it.lowercase().contains(query) }
            stateOk && servicesOk && queryOk
        }
        mutableState.update { it.copy(dealers = matched) }
    }
}
