package com.opudas.paint.feature.colours

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.PaintColor
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ColoursUiState(
    val isLoading: Boolean = true,
    val query: String = "",
    val family: String? = null,
    val families: List<String> = emptyList(),
    val familySwatch: Map<String, String> = emptyMap(),
    val visible: List<PaintColor> = emptyList(),
    val totalCount: Int = 0,
)

/**
 * The colour library, with search and a family filter.
 *
 * Filtering happens in the view model rather than in the composable for one
 * reason: it can then be tested. `matches` below is the same rule the website's
 * search uses — name, code, family, undertone and the editorial note — so a
 * visitor who searches "harmattan" on a phone and in a browser gets the same
 * answer, and a unit test can prove it without a device.
 */
class ColoursViewModel(private val content: ContentRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(ColoursUiState())
    val uiState: StateFlow<ColoursUiState> = _uiState.asStateFlow()

    private var all: List<PaintColor> = emptyList()

    init {
        viewModelScope.launch {
            all = content.colors()
            val families = content.families()
            // One lookup per family rather than a map built by the generator: the
            // swatch is a presentation detail, and keeping it out of the content
            // bundle means a family without one is a missing dot, not a missing key.
            val swatches = families.mapNotNull { family ->
                content.familySwatch(family)?.let { hex -> family to hex }
            }.toMap()

            _uiState.update {
                it.copy(
                    isLoading = false,
                    families = families,
                    familySwatch = swatches,
                    visible = all,
                    totalCount = all.size,
                )
            }
        }
    }

    fun onQueryChange(query: String) {
        _uiState.update { it.copy(query = query) }
        applyFilters()
    }

    fun onFamilySelect(family: String?) {
        _uiState.update { it.copy(family = family) }
        applyFilters()
    }

    fun clearFilters() {
        _uiState.update { it.copy(query = "", family = null) }
        applyFilters()
    }

    private fun applyFilters() {
        val state = _uiState.value
        _uiState.update {
            it.copy(visible = filter(all, state.query, state.family))
        }
    }

    companion object {
        /**
         * The library filter, exposed for testing.
         *
         * A colour matches if the query appears in any of the fields a person
         * would actually remember — the name, the code, the family, the undertone
         * or the note. Matching on the note is what makes "kitchen" or "harmattan"
         * work, because the note is where the editorial voice says what a colour
         * is for.
         */
        fun filter(colors: List<PaintColor>, query: String, family: String?): List<PaintColor> {
            val needle = query.trim().lowercase()
            return colors.filter { color ->
                val familyMatches = family == null || color.family == family
                val queryMatches = needle.isEmpty() || matches(color, needle)
                familyMatches && queryMatches
            }
        }

        private fun matches(color: PaintColor, needle: String): Boolean =
            color.name.lowercase().contains(needle) ||
                color.code.lowercase().contains(needle) ||
                color.family.lowercase().contains(needle) ||
                color.undertone.lowercase().contains(needle) ||
                color.collection.lowercase().contains(needle) ||
                color.note.lowercase().contains(needle) ||
                color.rooms.any { it.lowercase().contains(needle) }
    }
}
