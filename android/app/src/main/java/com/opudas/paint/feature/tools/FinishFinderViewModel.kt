package com.opudas.paint.feature.tools

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.PrepSituation
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.data.model.ToolOption
import com.opudas.paint.core.data.model.ToolQuestion
import com.opudas.paint.core.engine.AdvisorEngine
import com.opudas.paint.core.engine.AdvisorProduct
import com.opudas.paint.core.engine.AdvisorSituation
import com.opudas.paint.core.engine.ConditionKey
import com.opudas.paint.core.engine.FinishAdvice
import com.opudas.paint.core.engine.FinishAnswers
import com.opudas.paint.core.engine.SheenKey
import com.opudas.paint.core.engine.SurfaceKey
import com.opudas.paint.core.engine.WearKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * A recommendation with everything in it resolved to a real record.
 *
 * The engine decides in ids so that it can be tested without a bundle; the screen
 * shows products, situations and the supplier's own sheen wording. This is the seam
 * between the two, and every field is nullable because a bundle that lost a product
 * should cost one line of a specification, not the whole answer.
 */
data class FinishUi(
    val advice: FinishAdvice,
    val topcoat: Product?,
    val alternative: Product?,
    val primer: Product?,
    val screed: Product?,
    val sheenLabel: String?,
    val prep: List<PrepSituation>,
)

data class FinishFinderUiState(
    val isLoading: Boolean = true,
    val questions: List<ToolQuestion> = emptyList(),
    val options: Map<String, List<ToolOption>> = emptyMap(),
    /** Answers by question id. Absent until asked, never defaulted. */
    val answers: Map<String, String> = emptyMap(),
    val result: FinishUi? = null,
) {
    val isComplete: Boolean
        get() = questions.isNotEmpty() && questions.all { answers.containsKey(it.id) }

    val remaining: Int
        get() = questions.count { !answers.containsKey(it.id) }
}

/**
 * Four questions to a specified finish.
 *
 * The questions and their options come from the bundle, so the wording and the
 * order are the technical desk's and change with the data. The scoring is
 * [AdvisorEngine], ported from `advisor.ts` and tested against it.
 *
 * No answer is defaulted. A recommendation that assumes "sound" and "light wear"
 * before anybody has said so is a guess presented as advice, and the one thing this
 * tool has that a shelf of tins does not is the question.
 */
class FinishFinderViewModel(private val content: ContentRepository) : ViewModel() {

    private val mutableState = MutableStateFlow(FinishFinderUiState())
    val uiState: StateFlow<FinishFinderUiState> = mutableState.asStateFlow()

    private var catalogue: List<AdvisorProduct> = emptyList()
    private var situations: List<AdvisorSituation> = emptyList()
    private var situationRecords: List<PrepSituation> = emptyList()
    private var productsById: Map<String, Product> = emptyMap()
    private var sheenByFinish: Map<String, String> = emptyMap()

    init {
        viewModelScope.launch {
            val all = content.products()
            productsById = all.associateBy { it.id }
            catalogue = all.map { AdvisorProduct(it.id, it.finish, it.coatsRecommended) }
            situationRecords = content.prepSituations()
            situations = situationRecords.map { AdvisorSituation(it.id, it.condition) }
            sheenByFinish = all.mapNotNull { product ->
                val label = content.sheenLabel(product.finish)
                if (label == null) null else product.finish to label
            }.toMap()

            val questions = content.finishQuestions()
            val options = questions.associate { question ->
                question.id to content.optionsFor(question.id)
            }
            mutableState.update { current ->
                current.copy(isLoading = false, questions = questions, options = options)
            }
        }
    }

    fun onAnswer(questionId: String, optionId: String) {
        mutableState.update { current ->
            current.copy(answers = current.answers + (questionId to optionId))
        }
        recompute()
    }

    /** Take an answer back. The recommendation disappears with it rather than lingering. */
    fun onClear(questionId: String) {
        mutableState.update { current ->
            current.copy(answers = current.answers - questionId, result = null)
        }
        recompute()
    }

    fun onReset() {
        mutableState.update { it.copy(answers = emptyMap(), result = null) }
    }

    private fun recompute() {
        val current = mutableState.value
        val surface = SurfaceKey.fromId(current.answers["surface"].orEmpty())
        val condition = ConditionKey.fromId(current.answers["condition"].orEmpty())
        val wear = WearKey.fromId(current.answers["wear"].orEmpty())
        val sheen = SheenKey.fromId(current.answers["sheen"].orEmpty())

        // An answer the bundle does not offer is treated as no answer at all, not as
        // a fallthrough to the general-purpose finish. That fallthrough is the quiet
        // failure this whole tool is meant to avoid.
        if (surface == null || condition == null || wear == null || sheen == null) {
            mutableState.update { it.copy(result = null) }
            return
        }

        val advice = AdvisorEngine.recommendFinish(
            FinishAnswers(surface, condition, wear, sheen),
            catalogue,
            situations,
        )
        val prep = advice.prepIds.mapNotNull { id -> situationRecords.firstOrNull { it.id == id } }

        mutableState.update {
            it.copy(
                result = FinishUi(
                    advice = advice,
                    topcoat = productsById[advice.topcoatId],
                    alternative = advice.alternativeId?.let { id -> productsById[id] },
                    primer = advice.primerId?.let { id -> productsById[id] },
                    screed = advice.screedId?.let { id -> productsById[id] },
                    sheenLabel = if (advice.sheenFinish.isEmpty()) {
                        null
                    } else {
                        sheenByFinish[advice.sheenFinish]
                    },
                    prep = prep,
                ),
            )
        }
    }
}
