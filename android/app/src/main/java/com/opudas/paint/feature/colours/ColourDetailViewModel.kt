package com.opudas.paint.feature.colours

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.BoardRepository
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.Project
import com.opudas.paint.core.engine.Light
import com.opudas.paint.core.engine.Rgb
import com.opudas.paint.core.engine.contrast
import com.opudas.paint.core.engine.parseHex
import com.opudas.paint.core.engine.underLight
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * A palette this colour belongs to, with the palette's own swatches.
 *
 * [swatches] is the palette's colours as id-and-hex pairs in the order the roles
 * are given, and [thisIndex] is where the colour being looked at sits in it — so
 * the screen can paint four real chips and ring the one it is about, instead of
 * guessing from a list of ids it cannot resolve.
 */
data class PaletteAppearance(
    val name: String,
    val season: String,
    val role: String,
    val bestFor: String,
    val swatches: List<Pair<String, String>>,
    val thisIndex: Int,
)

/** One colour under one of the four lights the printed book shows it in. */
data class LightVariant(val label: String, val hex: String)

/** A text colour against this one, with the ratio that decides whether it is legible. */
data class ContrastCheck(val label: String, val inkHex: String, val ratio: Double, val readable: Boolean)

data class ColourDetailUiState(
    val isLoading: Boolean = true,
    val notFound: Boolean = false,
    val color: PaintColor? = null,
    val palettes: List<PaletteAppearance> = emptyList(),
    val projects: List<Project> = emptyList(),
    val lights: List<LightVariant> = emptyList(),
    val contrasts: List<ContrastCheck> = emptyList(),
    val contact: BrandContact? = null,
    /** Whether this colour is on the project board, so the button says which way it goes. */
    val isOnBoard: Boolean = false,
)

/**
 * One colour, and everything the library knows about it.
 *
 * The interesting part is not the record — it is what is derived from it. The four
 * lights and the contrast checks are computed here rather than shipped in the
 * content bundle, because they are arithmetic on the hex, not content, and
 * arithmetic that is generated once and committed is arithmetic that goes stale
 * the moment a colour is corrected.
 */
class ColourDetailViewModel(
    private val content: ContentRepository,
    private val colourId: String,
    private val board: BoardRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ColourDetailUiState())
    val uiState: StateFlow<ColourDetailUiState> = _uiState.asStateFlow()

    /*
     * A second init block rather than an edit to the one below: looking a colour up and
     * watching the board are unrelated work, and interleaving them in one block would
     * make the board's state depend on the bundle having loaded.
     *
     * Opening a colour notes it as recently viewed, which is the one board change that
     * does not stamp the board as edited - browsing is not planning.
     */
    init {
        viewModelScope.launch { board.pushRecent(colourId) }
        viewModelScope.launch {
            board.observe().collect { saved ->
                _uiState.update { current ->
                    current.copy(isOnBoard = saved.savedColors.contains(colourId))
                }
            }
        }
    }

    /** Put this colour on the project board, or take it off again. */
    fun toggleOnBoard() {
        viewModelScope.launch { board.toggleColor(colourId) }
    }

    init {
        viewModelScope.launch {
            val color = content.color(colourId)
            if (color == null) {
                /*
                 * A colour id that is not in the library is a stale deep link or a
                 * bug in a caller, and the honest answer is "we do not have that
                 * colour" with a way back to the library — not an empty screen that
                 * looks like the app is broken.
                 */
                _uiState.update { it.copy(isLoading = false, notFound = true) }
                return@launch
            }

            val rgb = parseHex(color.hex)
            _uiState.update {
                it.copy(
                    isLoading = false,
                    color = color,
                    palettes = content.palettesFor(color.id).map { entry ->
                        PaletteAppearance(
                            name = entry.palette.name,
                            season = entry.palette.season,
                            role = entry.role,
                            bestFor = entry.palette.bestFor,
                            swatches = content.colorsByIds(entry.palette.colors).map { it.id to it.hex },
                            thisIndex = entry.palette.colors.indexOf(color.id),
                        )
                    },
                    projects = content.projectsUsing(color.id),
                    lights = rgb?.let { base -> lightVariants(base) } ?: emptyList(),
                    contrasts = rgb?.let { base -> contrastChecks(base) } ?: emptyList(),
                    contact = content.contact(),
                )
            }
        }
    }

    private fun lightVariants(base: Rgb): List<LightVariant> =
        Light.entries.map { light -> LightVariant(light.label, underLight(base, light).toHex()) }

    /**
     * White and ink text on this colour, with the ratio printed.
     *
     * This is the question behind "can I use this as a feature wall and still read
     * the signage on it", and answering it with a number rather than an opinion is
     * the difference between a colour tool and a colour mood board. 4.5:1 is the
     * WCAG AA threshold for body text; 3:1 is the threshold for large text.
     */
    private fun contrastChecks(base: Rgb): List<ContrastCheck> {
        val white = Rgb(255, 255, 255)
        val ink = Rgb(11, 26, 19) // the brand's ink token, #0b1a13
        return listOf(
            check("White trim or lettering", base, white),
            check("Ink trim or lettering", base, ink),
        )
    }

    private fun check(label: String, background: Rgb, foreground: Rgb): ContrastCheck {
        val ratio = contrast(background, foreground)
        return ContrastCheck(label, foreground.toHex(), ratio, ratio >= 4.5)
    }

    /**
     * The message a customer sends when they want this colour.
     *
     * Pre-filled with the name and the code, because the code is what the desk
     * needs and nobody remembers it by the time WhatsApp opens.
     */
    fun whatsappMessage(): String {
        val color = _uiState.value.color ?: return "Hello OPUDA'S PAINT — I would like to ask about a colour."
        return "Hello OPUDA'S PAINT — I would like to ask about ${color.name} (${color.code}), " +
            "from the OPUDA'S app. Could you tell me which dealer near me stocks it, and the price for a 4-litre pail?"
    }
}
