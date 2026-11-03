package com.opudas.paint.feature.tools

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.PrepSituation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SurfacePrepUiState(
    val isLoading: Boolean = true,
    val situations: List<PrepSituation> = emptyList(),
    val totalCount: Int = 0,
    val query: String = "",
) {
    val isEmpty: Boolean
        get() = !isLoading && situations.isEmpty()
}

/**
 * The ten preparation sequences.
 *
 * Seven of them are keyed to a finish-finder condition, so a recommendation can
 * hand the visitor straight to the sequence for the wall they described. The other
 * three — salt bloom, old gloss on timber or metal, coastal exposure — have no
 * condition of their own and are found by looking, which is why the search reaches
 * into the signs and the steps rather than only the title.
 */
class SurfacePrepViewModel(private val content: ContentRepository) : ViewModel() {

    private val mutableState = MutableStateFlow(SurfacePrepUiState())
    val uiState: StateFlow<SurfacePrepUiState> = mutableState.asStateFlow()

    private var all: List<PrepSituation> = emptyList()

    init {
        viewModelScope.launch {
            val situations = content.prepSituations()
            all = situations
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    situations = situations,
                    totalCount = situations.size,
                )
            }
        }
    }

    fun onQueryChange(value: String) {
        mutableState.update { it.copy(query = value) }
        applyFilter()
    }

    fun onClearQuery() {
        mutableState.update { it.copy(query = "") }
        applyFilter()
    }

    private fun applyFilter() {
        val query = mutableState.value.query.trim().lowercase()
        val matched = if (query.isEmpty()) {
            all
        } else {
            all.filter { situation ->
                situation.label.lowercase().contains(query) ||
                    situation.signs.any { it.lowercase().contains(query) } ||
                    situation.surfaces.any { it.lowercase().contains(query) } ||
                    situation.warnings.any { it.lowercase().contains(query) } ||
                    situation.steps.any { step ->
                        step.step.lowercase().contains(query) ||
                            step.detail.lowercase().contains(query)
                    }
            }
        }
        mutableState.update { it.copy(situations = matched) }
    }
}
