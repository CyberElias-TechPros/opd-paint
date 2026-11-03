package com.opudas.paint.feature.calculator

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.engine.CalculationInput
import com.opudas.paint.core.engine.CalculationResult
import com.opudas.paint.core.engine.MeasureSystem
import com.opudas.paint.core.engine.Opening
import com.opudas.paint.core.engine.OpeningKind
import com.opudas.paint.core.engine.PaintUnit
import com.opudas.paint.core.engine.calculate
import com.opudas.paint.core.engine.fromMetres
import com.opudas.paint.core.engine.toMetres
import com.opudas.paint.core.util.AppCopy
import com.opudas.paint.core.util.plain
import com.opudas.paint.core.util.roundTo
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * One opening as it is being typed.
 *
 * Widths and heights are strings, not numbers, because that is what a text field
 * holds. Converting on every keystroke and writing the number back would fight the
 * user: typing "1." would become "1", and "0.9" could never be entered at all.
 * The engine receives a parsed number, and a field that does not parse contributes
 * zero rather than an invented dimension.
 */
data class OpeningDraft(
    val id: String,
    val kind: OpeningKind,
    val width: String,
    val height: String,
    val count: String,
)

data class CalculatorUiState(
    val isLoading: Boolean = true,
    val products: List<Product> = emptyList(),
    val selectedProductId: String? = null,
    val selectedProduct: Product? = null,
    val unit: PaintUnit = PaintUnit.LITRES,
    val system: MeasureSystem = MeasureSystem.METRIC,
    val roomLength: String = "4.2",
    val roomWidth: String = "3.6",
    val wallHeight: String = "2.9",
    val coats: Int = 2,
    val includeCeiling: Boolean = false,
    val trimAllowancePct: Int = 8,
    val openings: List<OpeningDraft> = emptyList(),
    val result: CalculationResult? = null,
    val contact: BrandContact? = null,
)

/**
 * Sizing a job.
 *
 * The arithmetic lives in [com.opudas.paint.core.engine], which is a port of the
 * website's calculator and is tested against the same hand-computed worked
 * examples as the website's own suite. This class holds the inputs and nothing
 * else: it decides which product's coverage and pack sizes to use, converts the
 * dimensions when the unit system changes, and turns the result into a message a
 * person can act on.
 *
 * It deliberately does not price anything. The output is a quantity and a set of
 * whole packs, and the next step is a conversation with the desk — see
 * `docs/adr/0003-no-e-commerce-at-launch.md`.
 */
class CalculatorViewModel(
    private val content: ContentRepository,
    private val preselectedProductId: String?,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CalculatorUiState())
    val uiState: StateFlow<CalculatorUiState> = _uiState.asStateFlow()

    /** The finish labels, for the product selector. */
    val openingKinds: List<OpeningKind> = OpeningKind.entries

    init {
        viewModelScope.launch {
            val products = content.products()
            val contact = content.contact()
            val preselected = products.firstOrNull { it.id == preselectedProductId } ?: products.firstOrNull()
            _uiState.update { current ->
                refresh(
                    current.copy(
                        isLoading = false,
                        products = products,
                        contact = contact,
                        selectedProductId = preselected?.id,
                        selectedProduct = preselected,
                        coats = preselected?.coatsRecommended ?: current.coats,
                        unit = unitFor(preselected),
                    ),
                )
            }
        }
    }

    fun onProductSelect(productId: String?) {
        mutate { current ->
            val product = current.products.firstOrNull { it.id == productId }
            // The product decides the coverage, the pack sizes, the unit and how
            // many coats it wants, so choosing one resets the coat count. Leaving
            // the previous product's coat count behind would quote a primer at two
            // coats because the emulsion before it asked for two. Clearing the
            // choice keeps the coat count: there is no data sheet to defer to.
            current.copy(
                selectedProductId = product?.id,
                coats = product?.coatsRecommended?.coerceIn(MIN_COATS, MAX_COATS) ?: current.coats,
            )
        }
    }

    /**
     * Switching between metres and feet converts what is already typed.
     *
     * Relabelling instead of converting is the dangerous version of this feature:
     * 4.2 read as feet rather than metres is a third of the wall, and the customer
     * finds out on the day the painter runs out.
     */
    fun onSystemChange(system: MeasureSystem) {
        mutate { current ->
            if (current.system == system) {
                current
            } else {
                current.copy(
                    system = system,
                    roomLength = convert(current.roomLength, current.system, system),
                    roomWidth = convert(current.roomWidth, current.system, system),
                    wallHeight = convert(current.wallHeight, current.system, system),
                    openings = current.openings.map { draft ->
                        draft.copy(
                            width = convert(draft.width, current.system, system),
                            height = convert(draft.height, current.system, system),
                        )
                    },
                )
            }
        }
    }

    fun onRoomLengthChange(value: String) = mutate { it.copy(roomLength = value) }
    fun onRoomWidthChange(value: String) = mutate { it.copy(roomWidth = value) }
    fun onWallHeightChange(value: String) = mutate { it.copy(wallHeight = value) }

    fun onCoatsChange(coats: Int) = mutate { it.copy(coats = coats.coerceIn(MIN_COATS, MAX_COATS)) }
    fun onCeilingChange(include: Boolean) = mutate { it.copy(includeCeiling = include) }
    fun onTrimAllowanceChange(percent: Int) =
        mutate { it.copy(trimAllowancePct = percent.coerceIn(MIN_TRIM_PCT, MAX_TRIM_PCT)) }

    fun addOpening() {
        mutate { current ->
            val id = "opening-${nextOpeningNumber(current.openings)}"
            val default = OpeningDraft(
                id = id,
                kind = OpeningKind.DOOR,
                // A standard leaf, in the current unit system: 0.9 x 2.1 m, or the
                // same door in feet. A blank row is a row nobody fills in.
                width = convertLength(DEFAULT_DOOR_WIDTH_M, current.system),
                height = convertLength(DEFAULT_DOOR_HEIGHT_M, current.system),
                count = "1",
            )
            current.copy(openings = current.openings + default)
        }
    }

    fun removeOpening(id: String) = mutate { current ->
        current.copy(openings = current.openings.filterNot { it.id == id })
    }

    fun onOpeningChange(id: String, kind: OpeningKind) = mutate { current ->
        current.copy(openings = current.openings.map { if (it.id == id) it.copy(kind = kind) else it })
    }

    fun onOpeningWidthChange(id: String, value: String) = mutate { current ->
        current.copy(openings = current.openings.map { if (it.id == id) it.copy(width = value) else it })
    }

    fun onOpeningHeightChange(id: String, value: String) = mutate { current ->
        current.copy(openings = current.openings.map { if (it.id == id) it.copy(height = value) else it })
    }

    fun onOpeningCountChange(id: String, value: String) = mutate { current ->
        current.copy(openings = current.openings.map { if (it.id == id) it.copy(count = value) else it })
    }

    /**
     * The whole calculation as a message.
     *
     * Everything the desk needs to answer without asking six follow-up questions:
     * the product, the room, what was deducted, the coats, the quantity including
     * handling, and the packs that quantity comes to. This is the app's version of
     * a quote request, and it ends with a person rather than a checkout.
     */
    fun summary(): String {
        val state = _uiState.value
        val result = state.result ?: return "Hello ${AppCopy.BRAND_NAME} — I would like help sizing a paint job."
        val unit = state.unit.symbol
        val lengthUnit = state.system.lengthUnit
        val openings = state.openings.groupingBy { it.kind }.eachCount()
        val openingText = if (openings.isEmpty()) {
            "none"
        } else {
            openings.entries.joinToString(", ") { (kind, count) ->
                "$count ${kind.label.lowercase()}${if (count == 1) "" else "s"}"
            }
        }
        val packs = if (result.packs.isEmpty()) {
            "none"
        } else {
            result.packs.joinToString(" + ") { pack -> "${pack.count} × ${pack.size.plain()} $unit" }
        }

        return buildString {
            appendLine("Job sized in the ${AppCopy.BRAND_NAME} app")
            appendLine()
            appendLine("Product: ${state.selectedProduct?.name ?: "not chosen"}")
            appendLine(
                "Room: ${state.roomLength} × ${state.roomWidth} $lengthUnit, " +
                    "${state.wallHeight} $lengthUnit high",
            )
            appendLine("Ceiling: ${if (state.includeCeiling) "included" else "excluded"}")
            appendLine("Openings deducted: $openingText")
            appendLine("Trim and cutting-in allowance: ${state.trimAllowancePct}%")
            appendLine("Paintable area: ${result.paintableArea.plain()} m²")
            appendLine("Coats: ${state.coats}")
            appendLine(
                "Quantity with 5% handling: ${result.amountWithAllowance.plain()} $unit",
            )
            appendLine("Packs: $packs = ${result.amountBought.plain()} $unit")
            appendLine()
            append("Please confirm availability and a quote.")
        }
    }

    /** The same summary, prefilled for WhatsApp. */
    fun whatsappMessage(): String = summary()

    private fun mutate(transform: (CalculatorUiState) -> CalculatorUiState) {
        _uiState.update { current -> refresh(transform(current)) }
    }

    /** Recomputes the derived fields. Pure and cheap, so it runs on every change. */
    private fun refresh(state: CalculatorUiState): CalculatorUiState {
        val product = state.products.firstOrNull { it.id == state.selectedProductId }
        val unit = unitFor(product)
        val input = CalculationInput(
            roomLength = state.roomLength.toDoubleOrNull() ?: 0.0,
            roomWidth = state.roomWidth.toDoubleOrNull() ?: 0.0,
            wallHeight = state.wallHeight.toDoubleOrNull() ?: 0.0,
            openings = state.openings.map { draft ->
                Opening(
                    id = draft.id,
                    kind = draft.kind,
                    width = draft.width.toDoubleOrNull() ?: 0.0,
                    height = draft.height.toDoubleOrNull() ?: 0.0,
                    count = draft.count.toIntOrNull() ?: 0,
                )
            },
            coats = state.coats,
            system = state.system,
            includeCeiling = state.includeCeiling,
            trimAllowancePct = state.trimAllowancePct.toDouble(),
            // Zero coverage with no product chosen falls back inside the engine,
            // which is the same guard that protects against a data file saying zero.
            coveragePerUnit = product?.coveragePerUnit ?: 0.0,
            packSizes = product?.packs?.map { it.size } ?: emptyList(),
            unit = unit,
        )
        return state.copy(selectedProduct = product, unit = unit, result = calculate(input))
    }

    /**
     * Litres or kilograms, read from the packs.
     *
     * The screeding compound is sold by weight. Quoting its coverage in litres
     * would give a number nobody could buy against.
     */
    private fun unitFor(product: Product?): PaintUnit =
        if (product?.packs?.firstOrNull()?.unit == "kg") PaintUnit.KILOGRAMS else PaintUnit.LITRES

    private fun convert(value: String, from: MeasureSystem, to: MeasureSystem): String {
        val parsed = value.toDoubleOrNull() ?: return value
        if (from == to) return value
        return fromMetres(toMetres(parsed, from), to).roundTo(2).plain()
    }

    private fun convertLength(metres: Double, system: MeasureSystem): String =
        fromMetres(metres, system).roundTo(2).plain()

    private fun nextOpeningNumber(openings: List<OpeningDraft>): Int {
        val highest = openings.mapNotNull { it.id.removePrefix("opening-").toIntOrNull() }.maxOrNull() ?: 0
        return highest + 1
    }

    /** Bounds the screen needs too, so the stepper cannot disagree with the clamp. */
    companion object {
        const val MIN_COATS = 1
        const val MAX_COATS = 5
        const val MIN_TRIM_PCT = 0
        const val MAX_TRIM_PCT = 25
        const val DEFAULT_DOOR_WIDTH_M = 0.9
        const val DEFAULT_DOOR_HEIGHT_M = 2.1
    }
}
