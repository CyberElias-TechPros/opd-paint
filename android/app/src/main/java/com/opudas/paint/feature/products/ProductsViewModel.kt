package com.opudas.paint.feature.products

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.MediaEntry
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.util.plain
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The product range, filterable by finish and searchable by what it is for.
 *
 * Three decisions on this screen are about honesty rather than layout, and all
 * three come from `docs/adr/0003-no-e-commerce-at-launch.md`:
 *
 *  - There is no price anywhere. The business does not publish one, so the app
 *    cannot either, and a price a customer reads on a phone and is then quoted
 *    differently for is a complaint with a screenshot attached.
 *  - The bundle carries an `inStock` flag per pack. It is deliberately not
 *    rendered. There is no inventory system behind it — nothing updates it — so
 *    showing it would be a stock claim the app cannot keep. What is shown is the
 *    sizes the product comes in, and a route to a person for availability.
 *  - Two of the six products carry `claimsStatus: label-verified` and four carry
 *    `pending-verification`. The difference is rendered, not smoothed over: a
 *    claim nobody has checked against the label yet is labelled as one.
 */
data class ProductsUiState(
    val isLoading: Boolean = true,
    val products: List<Product> = emptyList(),
    /** Finish name to what that finish actually means, e.g. Gloss to "80%+". */
    val sheenLabels: Map<String, String> = emptyMap(),
    val finishes: List<String> = emptyList(),
    val selectedFinish: String? = null,
    val query: String = "",
    val visible: List<Product> = emptyList(),
    /**
     * Product id to its photography, resolved once at load.
     *
     * Resolved here rather than per row because the lookup is suspending: a card
     * that fetched its own image would either show an empty box on the first frame
     * or launch a coroutine per row per recomposition. Carrying the alt text along
     * with the entry is the point — it is what TalkBack reads, and an image
     * without it is an image a blind customer cannot use.
     */
    val images: Map<String, MediaEntry> = emptyMap(),
)

class ProductsViewModel(private val content: ContentRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(ProductsUiState())
    val uiState: StateFlow<ProductsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val products = content.products()
            val labels = mutableMapOf<String, String>()
            products.map { it.finish }.distinct().forEach { finish ->
                content.sheenLabel(finish)?.let { label -> labels[finish] = label }
            }
            val images = mutableMapOf<String, MediaEntry>()
            products.forEach { product ->
                content.media(product.image)?.let { entry -> images[product.id] = entry }
            }
            _uiState.update { current ->
                val next = current.copy(
                    isLoading = false,
                    products = products,
                    sheenLabels = labels,
                    finishes = products.map { it.finish }.distinct(),
                    images = images,
                )
                next.copy(visible = filter(next))
            }
        }
    }

    fun onQueryChange(query: String) {
        _uiState.update { current ->
            val next = current.copy(query = query)
            next.copy(visible = filter(next))
        }
    }

    fun onFinishSelect(finish: String?) {
        _uiState.update { current ->
            val next = current.copy(selectedFinish = finish)
            next.copy(visible = filter(next))
        }
    }

    fun clearFilters() {
        _uiState.update { current ->
            val next = current.copy(query = "", selectedFinish = null)
            next.copy(visible = filter(next))
        }
    }

    /** Whether the claims on this product's label have been checked against it. */
    fun isClaimVerified(product: Product): Boolean = product.claimsStatus == CLAIMS_VERIFIED

    /** "20 L, 10 L, 4 L, 1 L" — the sizes, not whether anybody has them today. */
    fun packSummary(product: Product): String =
        product.packs.joinToString(", ") { pack -> "${pack.size.plain()} ${pack.unit}" }

    /** "11 m² per litre", or per kilogram for the weighed products. */
    fun coverageLabel(product: Product): String {
        val unit = unitLabel(product)
        val per = if (unit == "kg") "kilogram" else "litre"
        return "${product.coveragePerUnit.plain()} m² per $per"
    }

    /**
     * Litres or kilograms, taken from the packs rather than from the product name.
     *
     * The screeding compound is sold by weight, and quoting its coverage as
     * "1.6 m² per litre" would be a number nobody can act on: they would buy the
     * wrong amount of a product that does not come in litres.
     */
    fun unitLabel(product: Product): String = product.packs.firstOrNull()?.unit ?: DEFAULT_UNIT

    private fun filter(state: ProductsUiState): List<Product> {
        val query = state.query.trim().lowercase()
        return state.products.filter { product ->
            val matchesFinish = state.selectedFinish == null || product.finish == state.selectedFinish
            val matchesQuery = query.isEmpty() ||
                product.name.lowercase().contains(query) ||
                product.shortName.lowercase().contains(query) ||
                product.line.lowercase().contains(query) ||
                product.finish.lowercase().contains(query) ||
                product.tagline.lowercase().contains(query) ||
                product.bestFor.lowercase().contains(query) ||
                product.description.lowercase().contains(query) ||
                product.surfaces.any { it.lowercase().contains(query) }
            matchesFinish && matchesQuery
        }
    }

    private companion object {
        const val CLAIMS_VERIFIED = "label-verified"
        const val DEFAULT_UNIT = "L"
    }
}
