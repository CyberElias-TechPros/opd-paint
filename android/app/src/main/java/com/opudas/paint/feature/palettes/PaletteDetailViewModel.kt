package com.opudas.paint.feature.palettes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.model.MediaEntry
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.Palette
import com.opudas.paint.core.data.model.Project
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** One colour in a palette, and the job that palette gives it. */
data class ColourRole(val color: PaintColor, val role: String)

data class PaletteDetailUiState(
    val isLoading: Boolean = true,
    val palette: Palette? = null,
    val colors: List<PaintColor> = emptyList(),
    val image: MediaEntry? = null,
    val projects: List<Project> = emptyList(),
    val contact: BrandContact? = null,
) {
    /**
     * The colours paired with their roles.
     *
     * Paired by id, not by position in a resolved list. `Palette.roles` is
     * parallel to `Palette.colors` — the ids, in order — so zipping a *resolved*
     * list against it would misalign the moment one id did not resolve, and every
     * role after it would be printed against the wrong colour. Two swatches in one
     * palette can also legitimately be the same colour playing two roles, which is
     * another reason position in the resolved list is not a safe key.
     */
    val roles: List<ColourRole>
        get() {
            val current = palette ?: return emptyList()
            return current.colors.mapIndexedNotNull { index, id ->
                val color = colors.firstOrNull { it.id == id } ?: return@mapIndexedNotNull null
                ColourRole(color = color, role = current.roles.getOrElse(index) { "" })
            }
        }
}

/**
 * One palette: the colours, what each is for, and rooms that used it.
 *
 * The projects are here rather than only on the projects screen because they are
 * the evidence. "Feature wall, main walls, ceilings and trim" is advice; a
 * photograph of a room where those four colours were used in those four places is
 * the reason to believe it.
 */
class PaletteDetailViewModel(
    private val content: ContentRepository,
    private val paletteId: String,
) : ViewModel() {

    private val mutableState = MutableStateFlow(PaletteDetailUiState())
    val uiState: StateFlow<PaletteDetailUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            val palette = content.palette(paletteId)
            val colors = if (palette == null) emptyList() else content.colorsByIds(palette.colors)
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    palette = palette,
                    colors = colors,
                    image = if (palette == null) null else content.media(palette.image),
                    projects = if (palette == null) {
                        emptyList()
                    } else {
                        content.projects().filter { it.paletteId == palette.id }
                    },
                    contact = content.contact(),
                )
            }
        }
    }
}
