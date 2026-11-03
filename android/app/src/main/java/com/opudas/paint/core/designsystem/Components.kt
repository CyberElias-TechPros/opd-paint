package com.opudas.paint.core.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.opudas.paint.core.engine.Rgb
import com.opudas.paint.core.engine.contrast
import com.opudas.paint.core.engine.parseHex
import com.opudas.paint.core.engine.readableInkOn

/*
 * The pieces every screen is built from.
 *
 * Two rules shaped this file:
 *
 *  1. **Nothing here invents a claim.** A badge says "verified" or "call ahead to
 *     confirm stock" from the data's own `verified` flag; a product card shows
 *     `pending-verification` rather than dropping it. The website's guardrail —
 *     no price, no stock claim, no invented testimonial — is a property of the
 *     data, and the app inherits it by rendering the flags instead of hiding them.
 *
 *  2. **Colour chips compute their own text colour.** A name printed on a swatch
 *     has to be legible on a deep green and on an off-white, so the ink is chosen
 *     by contrast ratio rather than assigned per colour — which means a colour
 *     added to the library next year is legible without anybody remembering it.
 */

/* ------------------------------------------------------------ colour chips */

/**
 * A colour swatch with its name and code on it.
 *
 * The chip's aspect ratio and corner radius match the printed fan deck's, because
 * the person holding a phone and the person holding a deck should be looking at
 * the same thing.
 */
@Composable
fun ColourSwatch(
    hex: String,
    name: String,
    code: String,
    modifier: Modifier = Modifier,
    aspect: Float = 1f,
    onClick: (() -> Unit)? = null,
) {
    val base = parseHex(hex) ?: Rgb(216, 205, 187)
    val ink = readableInkOn(base)
    val background = Color(base.r, base.g, base.b)
    val foreground = Color(ink.r, ink.g, ink.b)

    val description = "$name, $code"
    val clickable = if (onClick == null) {
        Modifier
    } else {
        Modifier
            .clickable(
                onClickLabel = "Open $name",
                role = Role.Button,
                onClick = onClick,
            )
    }

    Surface(
        modifier = modifier
            .aspectRatio(aspect)
            .semantics { contentDescription = description }
            .then(clickable),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = background,
        // A chip edge is a boundary, and WCAG 1.4.11 wants 3:1 against what is
        // beside it; the outline token is the one that was lifted to clear that.
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(10.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = code,
                style = MaterialTheme.typography.labelSmall,
                color = foreground.copy(alpha = 0.72f),
                fontWeight = FontWeight.Medium,
            )
            Text(
                text = name,
                style = MaterialTheme.typography.titleSmall,
                color = foreground,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
            )
        }
    }
}

/** A large swatch for a colour's own page, with the facts printed on it the way a pail label prints them. */
@Composable
fun HeroSwatch(hex: String, modifier: Modifier = Modifier, height: Dp = 190.dp) {
    val base = parseHex(hex) ?: Rgb(216, 205, 187)
    val ink = readableInkOn(base)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(Brand.tokens.radius("lg")))
            .background(Color(base.r, base.g, base.b))
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(Brand.tokens.radius("lg")))
            .padding(16.dp),
        contentAlignment = Alignment.BottomStart,
    ) {
        Text(
            text = hex.uppercase(),
            style = MaterialTheme.typography.labelLarge,
            color = Color(ink.r, ink.g, ink.b).copy(alpha = 0.85f),
        )
    }
}

/** The dot beside a family filter, in that family's own colour. */
@Composable
private fun SwatchDot(hex: String) {
    val rgb = parseHex(hex) ?: Rgb(216, 205, 187)
    Box(
        Modifier
            .size(12.dp)
            .clip(CircleShape)
            .background(Color(rgb.r, rgb.g, rgb.b))
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, CircleShape),
    )
}

/* ---------------------------------------------------------------- structure */

@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    action: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 24.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.headlineSmall)
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        if (action != null) action()
    }
}

/** A labelled fact, the way a data sheet presents one: name on the left, value on the right. */
@Composable
fun FactRow(label: String, value: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(132.dp),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
fun FilterChipRow(
    options: List<String>,
    selected: String?,
    onSelect: (String?) -> Unit,
    modifier: Modifier = Modifier,
    swatchFor: ((String) -> String?)? = null,
    allLabel: String = "All",
) {
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
    ) {
        item {
            FilterChip(
                selected = selected == null,
                onClick = { onSelect(null) },
                label = { Text(allLabel) },
            )
        }
        items(options, key = { it }) { option ->
            val swatch = swatchFor?.invoke(option)
            // Annotated explicitly: a bare `{ ... }` inside `let` leaves the
            // compiler to guess whether the lambda is `@Composable`, and guessing
            // wrong here is an error at the call site rather than a warning.
            val leading: (@Composable () -> Unit)? = swatch?.let { hex -> { SwatchDot(hex) } }
            FilterChip(
                selected = selected == option,
                onClick = { onSelect(if (selected == option) null else option) },
                label = { Text(option) },
                leadingIcon = leading,
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer,
                ),
            )
        }
    }
}

/* ------------------------------------------------------------------- honesty */

/**
 * The verification badge.
 *
 * Eight of the fourteen dealers are confirmed; six are representative trading
 * areas the commercial team has not signed off, and products carrying
 * `pending-verification` are standard lines whose specs have not been signed
 * either. Both render as a badge rather than being quietly omitted, because a
 * customer who drives to a dealer that does not stock the product has been
 * misled by an interface that looked certain.
 */
@Composable
fun HonestyBadge(
    verified: Boolean,
    modifier: Modifier = Modifier,
    verifiedLabel: String = "Confirmed",
    unverifiedLabel: String = "Call ahead to confirm stock",
) {
    val container =
        if (verified) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.tertiaryContainer
    val content =
        if (verified) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onTertiaryContainer
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(Brand.tokens.radius("xs")))
            .background(container)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            imageVector = if (verified) {
                Icons.Filled.Check
            } else {
                Icons.Filled.Info
            },
            contentDescription = null,
            modifier = Modifier.size(14.dp),
            tint = content,
        )
        Text(
            text = if (verified) verifiedLabel else unverifiedLabel,
            style = MaterialTheme.typography.labelSmall,
            color = content,
        )
    }
}

/**
 * A note about something the app will not claim.
 *
 * Used for the two things a paint company's website is most often tempted to
 * invent: a price and a stock level. Neither appears anywhere in this app, and
 * where a visitor would expect one, this says what to do instead.
 */
@Composable
fun HonestNote(text: String, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Row(
            Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(
                imageVector = Icons.Filled.Info,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp),
            )
            Text(
                text = text,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/* ------------------------------------------------------------------ actions */

@Composable
fun PrimaryAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp),
        enabled = enabled,
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun SecondaryAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp),
        enabled = enabled,
        shape = RoundedCornerShape(Brand.tokens.radius("md")),
        border = ButtonDefaults.outlinedButtonBorder.copy(width = 1.5.dp),
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

/**
 * Call and WhatsApp, side by side.
 *
 * These are the two buttons that make the business money, so they appear on the
 * home screen, on every product, on every dealer and at the end of every quote.
 * Each reports whether it worked: a phone with no WhatsApp installed gets the
 * number to copy instead of a dead tap.
 */
@Composable
fun ContactActions(
    phoneDisplay: String,
    phoneTel: String,
    whatsapp: String,
    onCall: () -> Unit,
    onWhatsApp: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        OutlinedButton(
            onClick = onCall,
            modifier = Modifier
                .weight(1f)
                .height(52.dp),
            shape = RoundedCornerShape(Brand.tokens.radius("md")),
        ) {
            Icon(
                imageVector = Icons.Filled.Call,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text("Call", style = MaterialTheme.typography.labelLarge)
        }
        Button(
            onClick = onWhatsApp,
            modifier = Modifier
                .weight(1.4f)
                .height(52.dp),
            shape = RoundedCornerShape(Brand.tokens.radius("md")),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
            ),
        ) {
            Text("WhatsApp $phoneDisplay", style = MaterialTheme.typography.labelLarge, maxLines = 1)
        }
    }
}

/* ------------------------------------------------------------------- states */

@Composable
fun LoadingState(modifier: Modifier = Modifier, label: String = "Loading") {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(12.dp))
            Text(
                label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
fun EmptyState(
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    action: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 28.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(title, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        Text(
            body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        if (action != null) {
            Spacer(Modifier.height(6.dp))
            action()
        }
    }
}

/* -------------------------------------------------------------- tab glyphs */

/*
 * The four tab glyphs, drawn rather than taken from an icon set.
 *
 * Material's core icon set has nothing colour-related in it — Palette, ColorLens
 * and Brush all live in `material-icons-extended`, which is roughly ten megabytes
 * of vectors and would land in every debug build to supply four 24 dp shapes. So
 * these are drawn from the same geometry as the brand mark: a pail, a swatch
 * grid, a brush stroke and three dots.
 */

@Composable
fun TabGlyph(kind: TabGlyphKind, tint: Color, modifier: Modifier = Modifier) {
    Canvas(modifier.size(24.dp).semantics { contentDescription = kind.label }) {
        val stroke = Stroke(width = size.minDimension / 12f)
        when (kind) {
            TabGlyphKind.HOME -> {
                // The roof line and the pail body from brand/mark.svg.
                val roof = Path().apply {
                    moveTo(size.width * 0.5f, size.height * 0.10f)
                    lineTo(size.width * 0.95f, size.height * 0.46f)
                    lineTo(size.width * 0.05f, size.height * 0.46f)
                    close()
                }
                drawPath(roof, tint)
                drawRoundRect(
                    color = tint,
                    topLeft = Offset(size.width * 0.22f, size.height * 0.50f),
                    size = Size(size.width * 0.56f, size.height * 0.40f),
                    cornerRadius = CornerRadius(size.width * 0.06f),
                )
            }

            TabGlyphKind.COLOURS -> {
                // A 2x2 fan deck: four chips, one of them lifted.
                val gap = size.width * 0.08f
                val cell = (size.width - gap) / 2f
                for (row in 0..1) {
                    for (column in 0..1) {
                        val lifted = row == 0 && column == 1
                        drawRoundRect(
                            color = tint,
                            topLeft = Offset(column * (cell + gap), row * (cell + gap) - if (lifted) gap else 0f),
                            size = Size(cell, cell),
                            cornerRadius = CornerRadius(cell * 0.16f),
                            alpha = if (lifted) 0.45f else 1f,
                        )
                    }
                }
            }

            TabGlyphKind.TOOLS -> {
                // A brush stroke: the crimson sweep from the wordmark, in one colour.
                val path = Path().apply {
                    moveTo(size.width * 0.12f, size.height * 0.78f)
                    cubicTo(
                        size.width * 0.34f, size.height * 0.30f,
                        size.width * 0.62f, size.height * 0.90f,
                        size.width * 0.88f, size.height * 0.24f,
                    )
                }
                drawPath(path, tint, style = Stroke(width = size.minDimension / 7f))
                drawCircle(tint, radius = size.minDimension / 9f, center = Offset(size.width * 0.88f, size.height * 0.24f))
            }

            TabGlyphKind.MORE -> {
                val radius = size.minDimension / 9f
                val y = size.height / 2f
                drawCircle(tint, radius, Offset(size.width * 0.22f, y))
                drawCircle(tint, radius, Offset(size.width * 0.50f, y))
                drawCircle(tint, radius, Offset(size.width * 0.78f, y))
            }
        }
    }
}

enum class TabGlyphKind(val label: String) {
    HOME("Home"),
    COLOURS("Colours"),
    TOOLS("Tools"),
    MORE("More"),
}
