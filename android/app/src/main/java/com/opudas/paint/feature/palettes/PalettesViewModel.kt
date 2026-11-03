package com.opudas.paint.feature.palettes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.Palette
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PalettesUiState(
    val isLoading: Boolean = true,
    val palettes: List<Palette> = emptyList(),
    val seasons: List<String> = emptyList(),
    val selectedSeason: String? = null,
    /**
     * The colours behind each palette, resolved once.
     *
     * `Palette.colors` is a list of colour ids. Resolving them here rather than in
     * the composable means the screen renders hexes it has been given, and it means
     * a repeated id cannot be mistaken for a different colour by a lookup keyed on
     * position — two swatches in one palette can legitimately be the same colour
     * playing two roles.
     */
    val colors: Map<String, List<PaintColor>> = emptyMap(),
) {
    val isEmpty: Boolean
        get() = !isLoading && palettes.isEmpty()
}

/**
 * Curated palettes: four colours that work together, and what each one is for.
 *
 * A palette is the most useful thing in the app for somebody who has not painted a
 * room before, because it answers the question they cannot answer from a colour
 * chart — not "which colours are nice?" but "which one goes on the ceiling?". That
 * is what `roles` is, and the list screen shows it rather than four anonymous
 * squares.
 */
class PalettesViewModel(private val content: ContentRepository) : ViewModel() {

    private val mutableState = MutableStateFlow(PalettesUiState())
    val uiState: StateFlow<PalettesUiState> = mutableState.asStateFlow()

    private var all: List<Palette> = emptyList()
    private var resolved: Map<String, List<PaintColor>> = emptyMap()

    init {
        viewModelScope.launch {
            val palettes = content.palettes()
            all = palettes
            resolved = palettes.associate { palette ->
                palette.id to content.colorsByIds(palette.colors)
            }
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    palettes = all,
                    colors = resolved,
                    // Derived from the data rather than hardcoded: a season that
                    // appears in the bundle should be filterable without this file
                    // being edited.
                    seasons = palettes.map { it.season }.distinct().sorted(),
                )
            }
        }
    }

    fun onSeasonSelect(season: String?) {
        val matched = if (season == null) all else all.filter { it.season == season }
        mutableState.update { it.copy(selectedSeason = season, palettes = matched) }
    }
}
