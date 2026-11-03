package com.opudas.paint.feature.projects

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.MediaEntry
import com.opudas.paint.core.data.model.Project
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProjectsUiState(
    val isLoading: Boolean = true,
    val projects: List<Project> = emptyList(),
    val totalCount: Int = 0,
    val kinds: List<String> = emptyList(),
    val stages: List<String> = emptyList(),
    val selectedKind: String? = null,
    val selectedStage: String? = null,
    /**
     * Cover images by project id.
     *
     * Resolved once, here, because a project's `cover` is a key into the media
     * manifest rather than a path — and a key that is not in the manifest is a real
     * possibility, not an error. A card with no photograph still shows its title,
     * location and summary, so a missing image costs a picture and nothing else.
     */
    val covers: Map<String, MediaEntry> = emptyMap(),
) {
    val isEmpty: Boolean
        get() = !isLoading && projects.isEmpty()

    val hasFilters: Boolean
        get() = selectedKind != null || selectedStage != null
}

/**
 * The project book: rooms that were actually painted, in the colours that were
 * actually used.
 *
 * Newest first. A project book read in the order it was written buries the recent
 * work under the old, and recent work is the part that still matches what the
 * counters have in stock.
 */
class ProjectsViewModel(private val content: ContentRepository) : ViewModel() {

    private val mutableState = MutableStateFlow(ProjectsUiState())
    val uiState: StateFlow<ProjectsUiState> = mutableState.asStateFlow()

    private var all: List<Project> = emptyList()

    init {
        viewModelScope.launch {
            val projects = content.projects()
            all = projects.sortedWith(compareByDescending<Project> { it.year }.thenBy { it.title })
            val covers = all.mapNotNull { project ->
                val entry = content.media(project.cover)
                if (entry == null) null else project.id to entry
            }.toMap()

            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    projects = all,
                    totalCount = all.size,
                    kinds = projects.map { it.kind }.distinct().sorted(),
                    stages = projects.map { it.stage }.distinct().sorted(),
                    covers = covers,
                )
            }
        }
    }

    fun onKindSelect(kind: String?) {
        mutableState.update { it.copy(selectedKind = kind) }
        applyFilters()
    }

    fun onStageSelect(stage: String?) {
        mutableState.update { it.copy(selectedStage = stage) }
        applyFilters()
    }

    fun onClearFilters() {
        mutableState.update { it.copy(selectedKind = null, selectedStage = null) }
        applyFilters()
    }

    private fun applyFilters() {
        val current = mutableState.value
        val matched = all.filter { project ->
            (current.selectedKind == null || project.kind == current.selectedKind) &&
                (current.selectedStage == null || project.stage == current.selectedStage)
        }
        mutableState.update { it.copy(projects = matched) }
    }
}
