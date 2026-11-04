package com.opudas.paint.feature.board

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.BoardRepository
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.engine.ChecklistEngine
import com.opudas.paint.core.engine.ChecklistGroup
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChecklistUiState(
    val isLoading: Boolean = true,
    val projectName: String = "",
    val groups: List<ChecklistGroup> = emptyList(),
    val isEmpty: Boolean = true,
) {
    /**
     * The plain-text export, ready for the clipboard or a message.
     *
     * Computed rather than stored: it is a rendering of [groups], and keeping two copies
     * of the same thing is how a screen comes to show a checklist that does not match the
     * one it copies.
     */
    val text: String
        get() = ChecklistEngine.toText(projectName, groups)

    val itemCount: Int
        get() = groups.sumOf { it.items.size }
}

/**
 * The order of work, built from the board.
 *
 * The same builder the website uses, over the same board, so a checklist read on a phone
 * and one printed from a laptop say the same thing about the same job. That matters more
 * than it sounds: this is the list somebody hands a dealer, and two versions of it from
 * one company is a reason to phone instead of ordering.
 *
 * It observes the board rather than taking a snapshot, so a quantity saved while this
 * screen is open changes the checklist underneath it.
 */
class ChecklistViewModel(
    private val board: BoardRepository,
    private val content: ContentRepository,
) : ViewModel() {

    private val mutableState = MutableStateFlow(ChecklistUiState())
    val uiState: StateFlow<ChecklistUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            board.observe().collect { saved ->
                val colours = content.colorsByIds(saved.savedColors)
                val products = content.productsByIds(saved.savedProducts)
                val prep = saved.prep.mapNotNull { id -> content.prepSituation(id) }
                val groups = ChecklistEngine.build(
                    ChecklistInput(
                        projectName = saved.boardName,
                        colours = colours,
                        products = products,
                        estimates = saved.estimates,
                        prep = prep,
                    ),
                    // Every product, not just the saved ones: an estimate and a
                    // preparation sequence both refer to products by id, and those have
                    // to be looked up in the whole catalogue.
                    content.products(),
                )
                mutableState.update {
                    it.copy(
                        isLoading = false,
                        projectName = saved.boardName,
                        groups = groups,
                        isEmpty = ChecklistEngine.isEmpty(colours, products, saved.estimates),
                    )
                }
            }
        }
    }
}
