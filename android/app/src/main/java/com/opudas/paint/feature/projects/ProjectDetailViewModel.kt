package com.opudas.paint.feature.projects

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.model.MediaEntry
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.Palette
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.data.model.Project
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProjectDetailUiState(
    val isLoading: Boolean = true,
    val project: Project? = null,
    val cover: MediaEntry? = null,
    val gallery: List<MediaEntry> = emptyList(),
    val colors: List<PaintColor> = emptyList(),
    val products: List<Product> = emptyList(),
    val palette: Palette? = null,
    val contact: BrandContact? = null,
)

/**
 * One project: the photographs, the story, and everything that was used.
 *
 * The colours, products and palette are resolved here rather than left as ids,
 * because the point of a project entry is that it connects a photograph to a
 * specification. A screen that showed "atlantic-blue" instead of the colour, its
 * name and its code would be a list of strings that only this app understands.
 */
class ProjectDetailViewModel(
    private val content: ContentRepository,
    private val projectId: String,
) : ViewModel() {

    private val mutableState = MutableStateFlow(ProjectDetailUiState())
    val uiState: StateFlow<ProjectDetailUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            val project = content.project(projectId)
            val gallery = if (project == null) {
                emptyList()
            } else {
                project.gallery.mapNotNull { key -> content.media(key) }
            }
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    project = project,
                    cover = if (project == null) null else content.media(project.cover),
                    gallery = gallery,
                    colors = if (project == null) emptyList() else content.colorsByIds(project.colorIds),
                    products = if (project == null) emptyList() else content.productsByIds(project.productIds),
                    palette = if (project == null) null else content.palette(project.paletteId),
                    contact = content.contact(),
                )
            }
        }
    }
}
