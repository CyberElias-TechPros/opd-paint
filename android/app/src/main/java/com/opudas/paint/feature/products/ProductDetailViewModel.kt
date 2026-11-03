package com.opudas.paint.feature.products

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.model.MediaEntry
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.util.AppCopy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * A document the product ships with — a technical data sheet or a safety sheet.
 *
 * [bundled] records whether the same file is inside the APK. It is, for every
 * sheet in the range, because the documents are copied in at build time; the app
 * opens the website's copy for now and will open the bundled one when the
 * document viewer lands, which turns "needs a connection" into "works in a
 * basement with no signal". Carrying the flag now means that switch is one line
 * at the call site rather than another trip through the repository.
 */
data class ProductSheet(
    val label: String,
    val url: String,
    val bundled: Boolean,
)

data class ProductDetailUiState(
    val isLoading: Boolean = true,
    val product: Product? = null,
    val sheenLabel: String? = null,
    val contact: BrandContact? = null,
    val image: MediaEntry? = null,
    val gallery: List<MediaEntry> = emptyList(),
    val sheets: List<ProductSheet> = emptyList(),
    val claimVerified: Boolean = false,
)

class ProductDetailViewModel(
    private val content: ContentRepository,
    private val productId: String,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProductDetailUiState())
    val uiState: StateFlow<ProductDetailUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val product = content.product(productId)
            val contact = content.contact()
            if (product == null) {
                // Not an error state to hide: a link to a product that has been
                // renamed is a real thing that happens, and the screen says so.
                _uiState.update { it.copy(isLoading = false, contact = contact) }
                return@launch
            }
            val image = content.media(product.image)
            val gallery = product.gallery.mapNotNull { key -> content.media(key) }
            val sheets = product.tds.map { document ->
                ProductSheet(
                    label = document.label,
                    url = AppCopy.url(document.href),
                    bundled = content.documentAsset(document.href) != null,
                )
            }
            _uiState.update { current ->
                current.copy(
                    isLoading = false,
                    product = product,
                    sheenLabel = content.sheenLabel(product.finish),
                    contact = contact,
                    image = image,
                    // The hero image is the first entry of the gallery in the data,
                    // so showing both repeats the same photograph twice on one screen.
                    gallery = gallery.filterNot { it.src == image?.src },
                    sheets = sheets,
                    claimVerified = product.claimsStatus == CLAIMS_VERIFIED,
                )
            }
        }
    }

    /**
     * The pack sizes as a sentence.
     *
     * The bundle carries an `inStock` flag per pack and it is not used here: there
     * is no inventory system updating it, so rendering it would be a stock claim
     * the app cannot keep. Sizes are a fact about the product; availability is a
     * fact about a warehouse on a given day, and only a person knows that one.
     */
    fun packSizes(product: Product): List<String> =
        product.packs.map { pack -> "${pack.size.toInt()} ${pack.unit}" }

    private companion object {
        const val CLAIMS_VERIFIED = "label-verified"
    }
}
