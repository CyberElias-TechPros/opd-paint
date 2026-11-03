package com.opudas.paint.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.opudas.paint.core.data.model.ThemeBundle
import com.opudas.paint.core.engine.Rgb
import com.opudas.paint.core.engine.parseHex

/*
 * The brand, as a Compose theme.
 *
 * Every colour here comes from `assets/data/theme.json`, which is generated from
 * `app/src/styles/theme.css`. That is not tidiness: the tokens in that file carry
 * measured contrast ratios in their comments — the reason `green-mist` exists is
 * that `green-bright` measured 3.9:1 on a tinted dark panel and failed AA for
 * body text, and axe caught it. An app that re-picked its greens by eye would
 * re-introduce exactly the defect the website was fixed for.
 *
 * Material's roles are mapped onto the brand rather than the other way round:
 * paper is the background, ink is the text on it, green is the primary action and
 * crimson is the accent that means "this is the brush stroke", which on a paint
 * label is also the colour of a warning.
 */

/**
 * The resolved tokens.
 *
 * Resolved once at startup rather than per composition: hex parsing on every
 * recomposition is wasted work on a low-end device, which is the device this app
 * is optimised for.
 */
@Immutable
class BrandTokens(bundle: ThemeBundle) {

    private val resolved: Map<String, Color> = bundle.colors.mapValues { (_, hex) -> hexToColor(hex) }
    private val radii: Map<String, Int> = bundle.radii

    /** A brand colour by token name. Falls back to ink, and logs nothing: an unknown token is a programming error the content tests catch. */
    operator fun get(name: String): Color = resolved[name] ?: INK_FALLBACK

    /** The same lookup, for the cases where "no such token" has a meaning of its own. */
    fun find(name: String): Color? = resolved[name]

    fun rgb(name: String): Rgb? = parseHex(bundle.colors[name] ?: return null)

    /** Corner radius by token name, in dp. */
    fun radius(name: String) = (radii[name] ?: 12).dp

    /**
     * The display face: a serif, the catalogue voice.
     *
     * The website asks for Instrument Serif and falls back to the system serif;
     * no font file is committed to this repository, and bundling one is a
     * licensing decision rather than a build step. So the app ships the same
     * fallback the website ships, and the token says which face that is.
     */
    val displayFont: FontFamily = fontFamilyFor(bundle.fonts["display"]?.android)

    /** The text face: Archivo on the web, the system sans-serif here. */
    val bodyFont: FontFamily = fontFamilyFor(bundle.fonts["sans"]?.android)

    companion object {
        private val INK_FALLBACK = Color(0xFF0B1A13)

        private fun fontFamilyFor(name: String?): FontFamily = when (name?.lowercase()) {
            "serif" -> FontFamily.Serif
            "monospace" -> FontFamily.Monospace
            "cursive" -> FontFamily.Cursive
            else -> FontFamily.SansSerif
        }
    }
}

/** `#rrggbb` to a Compose colour, through the same parser the contrast maths uses. */
fun hexToColor(hex: String): Color {
    val rgb = parseHex(hex) ?: return Color.Magenta
    return Color(rgb.r, rgb.g, rgb.b)
}

val LocalBrand = staticCompositionLocalOf<BrandTokens> {
    error("BrandTokens not provided. Wrap the tree in OpudasTheme.")
}

private val lightScheme: (BrandTokens) -> ColorScheme = { brand ->
    lightColorScheme(
        primary = brand["green"],
        onPrimary = brand["paper-2"],
        primaryContainer = brand["green-deep"],
        onPrimaryContainer = brand["paper"],
        secondary = brand["moss"],
        onSecondary = brand["paper-2"],
        secondaryContainer = brand["sand"],
        onSecondaryContainer = brand["ink"],
        tertiary = brand["crimson"],
        onTertiary = brand["paper-2"],
        tertiaryContainer = brand["plaster"],
        onTertiaryContainer = brand["ink"],
        background = brand["paper"],
        onBackground = brand["ink"],
        surface = brand["paper-2"],
        onSurface = brand["ink"],
        surfaceVariant = brand["plaster"],
        onSurfaceVariant = brand["ink-soft"],
        // 3.2:1 against paper, which is why this token exists at all: WCAG 1.4.11
        // needs 3:1 for the edge of an input, and `line` measured 1.3:1.
        outline = brand["line-strong"],
        outlineVariant = brand["line"],
        error = brand["crimson"],
        onError = brand["paper-2"],
        inverseSurface = brand["ink"],
        inverseOnSurface = brand["paper"],
        inversePrimary = brand["green-bright"],
        surfaceTint = brand["green"],
        scrim = brand["ink"],
    )
}

private val darkScheme: (BrandTokens) -> ColorScheme = { brand ->
    darkColorScheme(
        /*
         * Dark mode is the brand inverted, not the brand dimmed. `green-bright`
         * on `ink` measures 4.8:1 and is the primary action; `green-mist` is the
         * token that was lifted specifically to clear AA on a tinted dark panel,
         * so it is what links and small type use. Text on a bright primary is ink
         * rather than paper, because paper on green-bright measures 3.4:1.
         */
        primary = brand["green-bright"],
        onPrimary = brand["ink"],
        primaryContainer = brand["green-deep"],
        onPrimaryContainer = brand["paper"],
        secondary = brand["green-mist"],
        onSecondary = brand["ink"],
        secondaryContainer = brand["ink-soft"],
        onSecondaryContainer = brand["paper"],
        tertiary = brand["crimson"],
        onTertiary = brand["paper"],
        tertiaryContainer = brand["ink-soft"],
        onTertiaryContainer = brand["paper"],
        background = brand["ink"],
        onBackground = brand["paper"],
        surface = brand["ink"],
        onSurface = brand["paper"],
        surfaceVariant = brand["ink-soft"],
        onSurfaceVariant = brand["sand"],
        outline = brand["moss"],
        outlineVariant = brand["ink-soft"],
        error = brand["crimson"],
        onError = brand["paper"],
        inverseSurface = brand["paper"],
        inverseOnSurface = brand["ink"],
        inversePrimary = brand["green"],
        surfaceTint = brand["green-bright"],
        scrim = Color.Black,
    )
}

private fun typography(brand: BrandTokens): Typography {
    /*
     * The display serif only has one weight on the website, and that is the
     * point: headings get their presence from size and tight setting rather than
     * from a synthesized bold. The sizes below are the catalogue's proportions
     * carried onto a phone — large enough to read a colour name across a room,
     * tight enough that a 40-character title still fits a 360 dp screen.
     */
    return Typography(
        displayLarge = TextStyle(
            fontFamily = brand.displayFont,
            fontWeight = FontWeight.Normal,
            fontSize = 40.sp,
            lineHeight = 44.sp,
            letterSpacing = (-0.5).sp,
        ),
        displayMedium = TextStyle(
            fontFamily = brand.displayFont,
            fontWeight = FontWeight.Normal,
            fontSize = 32.sp,
            lineHeight = 36.sp,
            letterSpacing = (-0.25).sp,
        ),
        displaySmall = TextStyle(
            fontFamily = brand.displayFont,
            fontWeight = FontWeight.Normal,
            fontSize = 26.sp,
            lineHeight = 30.sp,
        ),
        headlineLarge = TextStyle(
            fontFamily = brand.displayFont,
            fontWeight = FontWeight.Normal,
            fontSize = 28.sp,
            lineHeight = 32.sp,
        ),
        headlineMedium = TextStyle(
            fontFamily = brand.displayFont,
            fontWeight = FontWeight.Normal,
            fontSize = 24.sp,
            lineHeight = 28.sp,
        ),
        headlineSmall = TextStyle(
            fontFamily = brand.displayFont,
            fontWeight = FontWeight.Normal,
            fontSize = 20.sp,
            lineHeight = 24.sp,
        ),
        titleLarge = TextStyle(
            fontFamily = brand.bodyFont,
            fontWeight = FontWeight.SemiBold,
            fontSize = 19.sp,
            lineHeight = 24.sp,
        ),
        titleMedium = TextStyle(
            fontFamily = brand.bodyFont,
            fontWeight = FontWeight.SemiBold,
            fontSize = 16.sp,
            lineHeight = 22.sp,
            letterSpacing = 0.1.sp,
        ),
        titleSmall = TextStyle(
            fontFamily = brand.bodyFont,
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp,
            lineHeight = 20.sp,
        ),
        bodyLarge = TextStyle(
            fontFamily = brand.bodyFont,
            fontWeight = FontWeight.Normal,
            fontSize = 16.sp,
            lineHeight = 25.sp,
        ),
        bodyMedium = TextStyle(
            fontFamily = brand.bodyFont,
            fontWeight = FontWeight.Normal,
            fontSize = 14.sp,
            lineHeight = 22.sp,
        ),
        bodySmall = TextStyle(
            fontFamily = brand.bodyFont,
            fontWeight = FontWeight.Normal,
            fontSize = 12.sp,
            lineHeight = 18.sp,
        ),
        labelLarge = TextStyle(
            fontFamily = brand.bodyFont,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            lineHeight = 18.sp,
            letterSpacing = 0.4.sp,
        ),
        labelMedium = TextStyle(
            fontFamily = brand.bodyFont,
            fontWeight = FontWeight.Medium,
            fontSize = 12.sp,
            lineHeight = 16.sp,
            letterSpacing = 0.5.sp,
        ),
        labelSmall = TextStyle(
            fontFamily = brand.bodyFont,
            fontWeight = FontWeight.Medium,
            fontSize = 11.sp,
            lineHeight = 14.sp,
            letterSpacing = 0.6.sp,
        ),
    )
}

private fun shapes(brand: BrandTokens): Shapes = Shapes(
    extraSmall = RoundedCornerShape(brand.radius("xs")),
    small = RoundedCornerShape(brand.radius("sm")),
    medium = RoundedCornerShape(brand.radius("md")),
    large = RoundedCornerShape(brand.radius("lg")),
    extraLarge = RoundedCornerShape(brand.radius("xl")),
)

/**
 * The app's theme.
 *
 * [brand] is resolved once at startup from the generated tokens, so this does no
 * I/O and cannot fail on a slow first frame.
 */
@Composable
fun OpudasTheme(
    brand: BrandTokens,
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) darkScheme(brand) else lightScheme(brand)
    CompositionLocalProvider(LocalBrand provides brand) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = typography(brand),
            shapes = shapes(brand),
            content = content,
        )
    }
}

/** The brand tokens, for composables that need a swatch colour rather than a Material role. */
object Brand {
    val tokens: BrandTokens
        @Composable
        @ReadOnlyComposable
        get() = LocalBrand.current
}
