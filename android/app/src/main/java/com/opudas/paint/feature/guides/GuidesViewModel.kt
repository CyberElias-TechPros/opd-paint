package com.opudas.paint.feature.guides

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.Guide
import com.opudas.paint.core.data.model.MediaEntry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class GuidesUiState(
    val isLoading: Boolean = true,
    val guides: List<Guide> = emptyList(),
    val totalCount: Int = 0,
    val totalSections: Int = 0,
    val categories: List<String> = emptyList(),
    val selectedCategory: String? = null,
    val query: String = "",
    /**
     * Hero images by guide id.
     *
     * Resolved once rather than per card: a hero key that is missing from the media
     * manifest is a real possibility, and a guide without a photograph still shows
     * its title, category, reading time and summary. The words are the guide.
     */
    val heroes: Map<String, MediaEntry> = emptyMap(),
) {
    val isEmpty: Boolean
        get() = !isLoading && guides.isEmpty()

    val hasFilters: Boolean
        get() = selectedCategory != null || query.isNotBlank()
}

/**
 * The advice library.
 *
 * Nineteen sections across six guides, written by the technical desk and dated.
 * Kept in the order the bundle has them rather than sorted by date or title: that
 * order is authored, and a "how much paint do I need" that arrives before a
 * troubleshooting piece is deliberate sequencing, not an accident to be tidied.
 */
class GuidesViewModel(private val content: ContentRepository) : ViewModel() {

    private val mutableState = MutableStateFlow(GuidesUiState())
    val uiState: StateFlow<GuidesUiState> = mutableState.asStateFlow()

    private var all: List<Guide> = emptyList()

    init {
        viewModelScope.launch {
            val guides = content.guides()
            all = guides
            val heroes = guides.mapNotNull { guide ->
                val entry = content.media(guide.hero)
                if (entry == null) null else guide.id to entry
            }.toMap()

            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    guides = guides,
                    totalCount = guides.size,
                    totalSections = guides.sumOf { it.sections.size },
                    categories = content.guideCategories(),
                    heroes = heroes,
                )
            }
        }
    }

    fun onCategorySelect(category: String?) {
        mutableState.update { it.copy(selectedCategory = category) }
        applyFilters()
    }

    fun onQueryChange(value: String) {
        mutableState.update { it.copy(query = value) }
        applyFilters()
    }

    fun onClearFilters() {
        mutableState.update { it.copy(selectedCategory = null, query = "") }
        applyFilters()
    }

    /**
     * Search reaches into the section headings, not just the title and summary.
     *
     * Somebody who remembers reading something about efflorescence will not
     * remember which guide it was in, and the heading is where that word lives.
     */
    private fun applyFilters() {
        val current = mutableState.value
        val query = current.query.trim().lowercase()
        val matched = all.filter { guide ->
            val categoryOk = current.selectedCategory == null || guide.category == current.selectedCategory
            val queryOk = query.isEmpty() ||
                guide.title.lowercase().contains(query) ||
                guide.summary.lowercase().contains(query) ||
                guide.category.lowercase().contains(query) ||
                guide.sections.any { section ->
                    section.heading.lowercase().contains(query) ||
                        section.paragraphs.any { it.lowercase().contains(query) }
                } ||
                guide.faq.any { it.q.lowercase().contains(query) || it.a.lowercase().contains(query) }
            categoryOk && queryOk
        }
        mutableState.update { it.copy(guides = matched) }
    }
}
