package com.opudas.paint.core.data.model

import kotlinx.serialization.Serializable

/**
 * One quantity saved from the calculator.
 *
 * Deliberately small, and every field is something a painter can read back over the
 * phone: the website keeps these in a project link, so the shape has to survive a round
 * trip through a URL as well as through a database.
 *
 * [packs] is already a sentence — "2 × 20 L + 1 × 4 L" — rather than a list of
 * numbers, because that is what the calculator worked out and what the desk needs to
 * hear. Re-deriving it here would be a second opinion about the same wall.
 */
@Serializable
data class SavedEstimate(
    /** Stable id, so a saved estimate can be removed or replaced. */
    val id: String,
    val productId: String,
    /** What the person called the room — "Lounge", "Master bedroom". */
    val label: String,
    val packs: String,
    val litres: Double,
    /** "L" or "kg": the screeding compound is sold by weight. */
    val unit: String,
    val area: Double,
    val coats: Int,
    /** Epoch millis. Zero when a board arrived from somewhere that had no clock. */
    val savedAt: Long,
)

/**
 * The project board: everything one person has gathered towards one job.
 *
 * This is the same shape the website keeps in local storage, field for field, so a
 * board built on a phone and a board built on a laptop mean the same thing — and so
 * the checklist the two produce is the same checklist.
 */
@Serializable
data class BoardState(
    /** Colour ids saved to the board. */
    val savedColors: List<String> = emptyList(),
    /** Product ids saved to the board. */
    val savedProducts: List<String> = emptyList(),
    /** Colours looked at recently, kept when the board is cleared. */
    val recentColors: List<String> = emptyList(),
    val boardName: String = "",
    /** Quantities saved from the calculator, newest first. */
    val estimates: List<SavedEstimate> = emptyList(),
    /** Preparation situations chosen for this project, by id. */
    val prep: List<String> = emptyList(),
    val updatedAt: Long = 0L,
)
