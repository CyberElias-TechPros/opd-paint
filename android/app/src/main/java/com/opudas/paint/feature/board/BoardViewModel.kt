package com.opudas.paint.feature.board

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.BoardRepository
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.PrepSituation
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.data.model.SavedEstimate
import com.opudas.paint.core.engine.ChecklistEngine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class BoardUiState(
    val isLoading: Boolean = true,
    val boardName: String = "",
    val colours: List<PaintColor> = emptyList(),
    val products: List<Product> = emptyList(),
    val estimates: List<SavedEstimate> = emptyList(),
    val prep: List<PrepSituation> = emptyList(),
) {
    /**
     * Whether there is anything to plan.
     *
     * The engine decides this rather than the screen, because it is the same question the
     * website asks before it offers a checklist — and preparation situations are counted
     * the same way in both, which is to say not at all: a board with a damp wall named on
     * it has work to do but nothing to buy.
     */
    val isEmpty: Boolean
        get() = ChecklistEngine.isEmpty(colours, products, estimates)

    val savedCount: Int
        get() = colours.size + products.size + estimates.size
}

/**
 * The project board: what somebody has gathered towards one job.
 *
 * It observes the stored board and resolves ids against the content bundle, so the screen
 * is given colours and products rather than strings to look up. Saving a quantity in the
 * calculator arrives here by itself — the board is a [kotlinx.coroutines.flow.Flow], and
 * a screen that has to be told to refresh is a screen that eventually shows a room
 * somebody already re-measured.
 *
 * Nothing is invented: an id that no longer resolves is dropped rather than shown as a
 * gap, because a colour removed from the catalogue is not something a person can buy.
 */
class BoardViewModel(
    private val board: BoardRepository,
    private val content: ContentRepository,
) : ViewModel() {

    private val mutableState = MutableStateFlow(BoardUiState())
    val uiState: StateFlow<BoardUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            board.observe().collect { saved ->
                val colours = content.colorsByIds(saved.savedColors)
                val products = content.productsByIds(saved.savedProducts)
                val prep = saved.prep.mapNotNull { id -> content.prepSituation(id) }
                mutableState.update {
                    it.copy(
                        isLoading = false,
                        boardName = saved.boardName,
                        colours = colours,
                        products = products,
                        estimates = saved.estimates,
                        prep = prep,
                    )
                }
            }
        }
    }

    fun onNameChange(name: String) {
        // Typed straight through, and capped on the way in by the repository: the limit
        // belongs with the other rules about the board, not in each screen that edits it.
        viewModelScope.launch { board.rename(name) }
    }

    /**
     * Take a colour off the board.
     *
     * Through the repository's toggle, which removes an id that is there. The board only
     * ever offers this for colours it is showing, so the add branch cannot be reached from
     * here — and if it ever could, adding back what was just removed is the least
     * surprising thing it could do.
     */
    fun removeColour(id: String) {
        viewModelScope.launch { board.toggleColor(id) }
    }

    fun removeProduct(id: String) {
        viewModelScope.launch { board.toggleProduct(id) }
    }

    fun removePrep(id: String) {
        viewModelScope.launch { board.togglePrep(id) }
    }

    fun removeEstimate(id: String) {
        viewModelScope.launch { board.removeEstimate(id) }
    }

    /** Empty the board. The recently viewed colours survive, as they do on the website. */
    fun clear() {
        viewModelScope.launch { board.clear() }
    }
}
