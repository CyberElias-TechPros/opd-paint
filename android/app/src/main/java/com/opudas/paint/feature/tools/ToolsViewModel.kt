package com.opudas.paint.feature.tools

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.ToolCard
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Where a tool card leads inside the app.
 *
 * The bundle carries a web route in `ToolCard.to`, because it is generated for the
 * website. The app maps a card onto its own destination by id instead of parsing a
 * path: a route string is the website's business, and a path that changed there
 * should not silently send a phone somewhere else.
 */
enum class ToolTarget {
    FINISH_FINDER,
    SURFACE_PREP,
    CALCULATOR,
    /** The tool exists in the product and not yet in this build. */
    NOT_IN_THIS_BUILD,
}

data class ToolCardUi(
    val card: ToolCard,
    val target: ToolTarget,
    /**
     * Why a card cannot be opened, in the words the card should carry.
     *
     * Null when it can. The alternative to saying so is a card that looks tappable
     * and does nothing, which reads as a broken app rather than an unfinished one.
     */
    val note: String?,
) {
    val isOpenable: Boolean
        get() = target != ToolTarget.NOT_IN_THIS_BUILD
}

data class ToolsUiState(
    val isLoading: Boolean = true,
    val cards: List<ToolCardUi> = emptyList(),
    val openableCount: Int = 0,
    val questionCount: Int = 0,
    val prepCount: Int = 0,
)

/**
 * The tools hub.
 *
 * Five cards, of which three have screens in this build. The other two are shown
 * anyway, with the reason: the product has a project checklist and a room preview,
 * and an app that quietly omitted them would be describing a smaller range than the
 * one being sold.
 */
class ToolsViewModel(private val content: ContentRepository) : ViewModel() {

    private val mutableState = MutableStateFlow(ToolsUiState())
    val uiState: StateFlow<ToolsUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            val cards = content.toolCards().map { card -> describe(card) }
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    cards = cards,
                    openableCount = cards.count { it.isOpenable },
                    questionCount = content.finishQuestions().size,
                    prepCount = content.prepSituations().size,
                )
            }
        }
    }

    private fun describe(card: ToolCard): ToolCardUi = when (card.id) {
        "finish-finder" -> ToolCardUi(card, ToolTarget.FINISH_FINDER, null)
        "surface-prep" -> ToolCardUi(card, ToolTarget.SURFACE_PREP, null)
        "calculator" -> ToolCardUi(card, ToolTarget.CALCULATOR, null)
        "project" -> ToolCardUi(
            card,
            ToolTarget.NOT_IN_THIS_BUILD,
            "The project checklist is not in this build of the app yet. It is on the " +
                "website, and the calculator here covers the quantities it would carry.",
        )
        "room-preview" -> ToolCardUi(
            card,
            ToolTarget.NOT_IN_THIS_BUILD,
            "The room preview is not in this build of the app yet. Colours here are shown " +
                "with their hex, family and light-reflectance value, which is what the " +
                "preview estimates from.",
        )
        else -> ToolCardUi(
            card,
            ToolTarget.NOT_IN_THIS_BUILD,
            "This tool is not in this build of the app yet.",
        )
    }
}
