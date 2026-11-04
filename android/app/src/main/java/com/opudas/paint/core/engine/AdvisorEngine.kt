package com.opudas.paint.core.engine

/**
 * What is being painted. Drives which product family is even a candidate.
 *
 * Typed rather than passed around as strings for the same reason the enquiry form's
 * project types are: a misspelled key does not fail loudly, it silently matches no
 * rule, and the visitor is recommended the general-purpose finish for a steel gate.
 */
enum class SurfaceKey(val id: String) {
    INTERIOR_WALL("interior-wall"),
    CEILING_TRIM("ceiling-trim"),
    KITCHEN_BATH("kitchen-bath"),
    WOOD_METAL("wood-metal"),
    EXTERIOR("exterior"),
    NEW_PLASTER("new-plaster"),
    ;

    companion object {
        fun fromId(id: String): SurfaceKey? = entries.firstOrNull { it.id == id }
    }
}

/** The state the surface is in before anything is bought. */
enum class ConditionKey(val id: String) {
    NEW("new"),
    SOUND("sound"),
    FLAKING("flaking"),
    UNEVEN("uneven"),
    CHALKY("chalky"),
    DAMP("damp"),
    MOULD("mould"),
    ;

    companion object {
        fun fromId(id: String): ConditionKey? = entries.firstOrNull { it.id == id }
    }
}

/** How hard the finished surface will be worked. */
enum class WearKey(val id: String) {
    LIGHT("light"),
    MODERATE("moderate"),
    HEAVY("heavy"),
    ;

    companion object {
        fun fromId(id: String): WearKey? = entries.firstOrNull { it.id == id }
    }
}

/** The sheen being aimed for — or not decided yet. */
enum class SheenKey(val id: String) {
    FLAT("flat"),
    SOFT("soft"),
    GLOSS("gloss"),
    UNSURE("unsure"),
    ;

    companion object {
        fun fromId(id: String): SheenKey? = entries.firstOrNull { it.id == id }
    }
}

data class FinishAnswers(
    val surface: SurfaceKey,
    val condition: ConditionKey,
    val wear: WearKey,
    val sheen: SheenKey,
)

/**
 * The three facts about a product the advisor needs, and no more.
 *
 * The engine deliberately does not take the bundle's `Product`. It should be
 * testable against a handful of three-field fixtures, and it should not be able to
 * reach for a field that would make its advice depend on something a specification
 * has no business depending on.
 */
data class AdvisorProduct(
    val id: String,
    val finish: String,
    val coatsRecommended: Int,
)

/** The two facts about a preparation situation the advisor needs. */
data class AdvisorSituation(
    val id: String,
    val condition: String?,
)

/** A warning attached to a recommendation, and the guide that explains it. */
data class Caution(val text: String, val guideId: String?)

/**
 * The answer for a surface that must not be painted yet.
 *
 * Damp is not a paint problem, and this is the one branch where the honest response
 * loses the sale: nothing is recommended, and the reason is given instead.
 */
data class BlockedAdvice(val title: String, val body: String, val guideId: String)

/**
 * One recommendation.
 *
 * Products and situations are named by id and resolved by the caller, because the
 * engine's job is to decide and the repository's job is to look up. Keeping the two
 * apart is what makes the decision testable without a bundle.
 */
data class FinishAdvice(
    val topcoatId: String,
    val alternativeId: String?,
    val primerId: String?,
    val screedId: String?,
    /**
     * Substrates the range does not prime. Bare timber and bare steel need a primer
     * this catalogue does not carry, and saying so is the honest answer.
     */
    val primerNote: String?,
    val coats: Int,
    val coatsNote: String?,
    /** The topcoat's finish, which the caller turns into the supplier's own label. */
    val sheenFinish: String,
    val reasons: List<String>,
    val cautions: List<Caution>,
    val prepIds: List<String>,
    val blocked: BlockedAdvice?,
) {
    val isBlocked: Boolean
        get() = blocked != null
}

/** One candidate topcoat with the weight the rules gave it, and why. */
data class ScoredFinish(val id: String, val weight: Int, val reasons: List<String>)

/**
 * The finish finder: four questions, a weighted rule table, and the cautions that
 * come with the answer.
 *
 * Ported from `app/src/lib/advisor.ts`. The rule table, the weights, the reasons and
 * every caution are that file's words, not paraphrases — they are specification
 * advice, and a reworded reason is a different claim about a product.
 */
object AdvisorEngine {

    /**
     * The fallback topcoat when nothing scores.
     *
     * It is only reachable through the blocked branch, which recommends nothing at
     * all: the id is there so the data class has something to carry, never so a
     * screen can present it as advice.
     */
    const val FALLBACK_TOPCOAT_ID = "matt"

    /** Products that can be a topcoat for a wall — the recommendation candidates. */
    private val TOPCOAT_IDS = listOf("matt", "silk", "gloss", "weathershield")

    private val PLASTER_SUBSTRATES = setOf(
        "interior-wall",
        "ceiling-trim",
        "kitchen-bath",
        "exterior",
        "new-plaster",
    )

    private val NEEDS_PRIMER = setOf(
        ConditionKey.NEW,
        ConditionKey.FLAKING,
        ConditionKey.CHALKY,
        ConditionKey.UNEVEN,
    )

    /**
     * Preparation situations that match a condition, or the general repaint sequence.
     *
     * The fallback matters: a condition with no situation of its own would otherwise
     * leave the visitor with advice about a finish and nothing about the wall it goes
     * on. Every situation is identified here so the caller can resolve them.
     */
    fun prepForCondition(
        situations: List<AdvisorSituation>,
        condition: ConditionKey,
    ): List<String> {
        val direct = situations.filter { it.condition == condition.id }
        return if (direct.isNotEmpty()) {
            direct.map { it.id }
        } else {
            situations.filter { it.id == "sound-repaint" }.map { it.id }
        }
    }

    private data class Rule(
        val matches: (FinishAnswers) -> Boolean,
        val product: String,
        val weight: Int,
        val reason: String,
    )

    /**
     * The rule table. Read top to bottom: surface rules carry the most weight because
     * a steel gate cannot be painted with an emulsion whatever the wear, then wear,
     * then the sheen the visitor asked for.
     */
    private val RULES: List<Rule> = listOf(
        // ---- surface
        Rule(
            matches = { it.surface == SurfaceKey.INTERIOR_WALL },
            product = "matt",
            weight = 3,
            reason = "Interior walls in bedrooms, lounges and offices are the matt line’s work: " +
                "a flat film that hides the small imperfections in plaster.",
        ),
        Rule(
            matches = { it.surface == SurfaceKey.INTERIOR_WALL },
            product = "silk",
            weight = 1,
            reason = "The same wall can take silk if it will be washed.",
        ),
        Rule(
            matches = { it.surface == SurfaceKey.CEILING_TRIM },
            product = "matt",
            weight = 4,
            reason = "Ceilings and cornices are almost always matt — a sheen overhead shows " +
                "roller marks in raking light.",
        ),
        Rule(
            matches = { it.surface == SurfaceKey.KITCHEN_BATH },
            product = "silk",
            weight = 4,
            reason = "Kitchens and bathrooms want the tighter film of the silk line: it wipes " +
                "down without burnishing and shrugs off cooking steam.",
        ),
        Rule(
            matches = { it.surface == SurfaceKey.WOOD_METAL },
            product = "gloss",
            weight = 5,
            reason = "Timber and steel that are handled or rained on need the hard, washable " +
                "gloss film. An emulsion will not survive a gate.",
        ),
        Rule(
            matches = { it.surface == SurfaceKey.EXTERIOR },
            product = "weathershield",
            weight = 5,
            reason = "An exposed elevation needs the textured exterior coating: it bridges " +
                "hairline cracks, sheds water and stays colour-stable under UV.",
        ),
        Rule(
            matches = { it.surface == SurfaceKey.NEW_PLASTER },
            product = "matt",
            weight = 2,
            reason = "New plaster is normally finished in matt for a first decoration; the " +
                "primer underneath matters more than the sheen on top.",
        ),
        Rule(
            matches = { it.surface == SurfaceKey.NEW_PLASTER },
            product = "silk",
            weight = 1,
            reason = "Silk is possible on new plaster only once the surface has been screeded flat.",
        ),

        // ---- wear
        Rule(
            matches = { it.wear == WearKey.HEAVY },
            product = "silk",
            weight = 3,
            reason = "Heavy wear — corridors, kitchens, children’s rooms, rentals — is exactly " +
                "the case the silk line exists for.",
        ),
        Rule(
            matches = { it.wear == WearKey.MODERATE },
            product = "silk",
            weight = 1,
            reason = "Moderate wear tips a wall that will be wiped towards silk.",
        ),
        Rule(
            matches = { it.wear == WearKey.LIGHT },
            product = "matt",
            weight = 1,
            reason = "Light wear means nothing has to be scrubbed, so the flatter, deeper film wins.",
        ),

        // ---- sheen
        Rule(
            matches = { it.sheen == SheenKey.FLAT },
            product = "matt",
            weight = 3,
            reason = "You asked for a flat, quiet surface — that is matt, under 5% sheen.",
        ),
        Rule(
            matches = { it.sheen == SheenKey.SOFT },
            product = "silk",
            weight = 3,
            reason = "You asked for a soft sheen — that is silk, 10–15%, which also lifts light " +
                "into a dark room.",
        ),
        // Split by surface on purpose. The gloss line is a solvent-borne coating for joinery and
        // metal: recommending it for a wall because somebody ticked "hard gloss" would be a
        // recommendation the caution underneath it argues against. On a wall the honest answer is
        // silk, plus the explanation.
        Rule(
            matches = { it.sheen == SheenKey.GLOSS && it.surface == SurfaceKey.WOOD_METAL },
            product = "gloss",
            weight = 4,
            reason = "You asked for a hard gloss on timber or metal — that is exactly what the " +
                "synthetic gloss line is for.",
        ),
        Rule(
            matches = { it.sheen == SheenKey.GLOSS && it.surface != SurfaceKey.WOOD_METAL },
            product = "silk",
            weight = 4,
            reason = "You asked for a hard gloss. This range has no gloss emulsion, so the " +
                "closest film for a wall is silk — washable, 10–15% sheen, and it needs a " +
                "genuinely flat surface.",
        ),

        // ---- condition (adjusts the finish, not only the preparation)
        Rule(
            matches = { it.condition == ConditionKey.UNEVEN },
            product = "matt",
            weight = 2,
            reason = "An uneven wall is more forgiving in a flat finish; silk shows every ripple " +
                "left in the plaster.",
        ),
        Rule(
            matches = { it.condition == ConditionKey.MOULD && it.surface != SurfaceKey.WOOD_METAL },
            product = "silk",
            weight = 1,
            reason = "Both interior lines carry an anti-fungi additive; the tighter silk film is " +
                "the one to choose where condensation is the cause.",
        ),
    )

    /**
     * Every candidate topcoat, weighted by the rules the answers matched.
     *
     * Sorted by weight, then by id, so that two candidates scoring the same always
     * resolve the same way. A tie broken by whatever order a map happened to iterate
     * in would give one visitor matt and the next silk for identical answers.
     */
    fun score(answers: FinishAnswers, products: List<AdvisorProduct>): List<ScoredFinish> {
        val available = TOPCOAT_IDS.filter { id -> products.any { it.id == id } }
        val weight = available.associateWith { 0 }.toMutableMap()
        val reasons = available.associateWith { mutableListOf<String>() }

        // One pass, so a rule contributes its weight and its reason together. Two
        // passes would let the total and the explanation disagree about which rules
        // fired, and a recommendation whose reasons do not add up to its answer is
        // worse than no reasons at all.
        RULES.forEach { rule ->
            if (!rule.matches(answers)) return@forEach
            val current = weight[rule.product] ?: return@forEach
            weight[rule.product] = current + rule.weight
            reasons[rule.product]?.add(rule.reason)
        }

        return available.map { id -> ScoredFinish(id, weight.getValue(id), reasons.getValue(id)) }
            .sortedWith(compareByDescending<ScoredFinish> { it.weight }.thenBy { it.id })
    }

    /** The recommendation for one set of answers. */
    fun recommendFinish(
        answers: FinishAnswers,
        products: List<AdvisorProduct>,
        situations: List<AdvisorSituation>,
    ): FinishAdvice {
        val byId = products.associateBy { it.id }
        val ranked = score(answers, products)
        val cautions = mutableListOf<Caution>()
        val prepIds = prepForCondition(situations, answers.condition)

        // A damp wall is not a paint problem. Recommend nothing and say why — this is
        // the one answer where the honest response loses the sale.
        if (answers.condition == ConditionKey.DAMP) {
            val fallback = ranked.firstOrNull()?.id ?: FALLBACK_TOPCOAT_ID
            return FinishAdvice(
                topcoatId = fallback,
                alternativeId = null,
                primerId = null,
                screedId = null,
                primerNote = null,
                coats = 0,
                coatsNote = null,
                // No finish is being recommended, so no sheen is described: the
                // website returns an empty label here for the same reason.
                sheenFinish = "",
                reasons = emptyList(),
                cautions = emptyList(),
                prepIds = prepIds,
                blocked = BlockedAdvice(
                    title = "Fix the water before you buy paint",
                    body = "A damp wall needs its source found and repaired, and the wall dried, " +
                        "before any coating goes on. No product in this range — or any other — " +
                        "stops rising damp, and a film applied over a wet wall blisters from " +
                        "behind. Work through the damp sequence, then come back and we will " +
                        "specify the finish.",
                    guideId = "damp-and-mould",
                ),
            )
        }

        val best = ranked.firstOrNull()
        val bestId = best?.id ?: FALLBACK_TOPCOAT_ID
        val alternative = ranked.firstOrNull { it.weight > 0 && it.id != bestId }

        val needsPrimer = answers.condition in NEEDS_PRIMER && answers.surface.id in PLASTER_SUBSTRATES
        val primerId = if (needsPrimer && byId.containsKey("primer")) "primer" else null
        val screedId = if (answers.condition == ConditionKey.UNEVEN && byId.containsKey("screeding")) {
            "screeding"
        } else {
            null
        }

        if (answers.surface == SurfaceKey.WOOD_METAL) {
            cautions.add(
                Caution(
                    text = "Bare timber and bare steel need a primer this range does not carry: a " +
                        "wood primer with the knots sealed, or a zinc-rich or red-oxide metal " +
                        "primer. Degrease steel with a solvent wipe first.",
                    guideId = "preparing-walls",
                ),
            )
        }
        if (answers.sheen == SheenKey.GLOSS && answers.surface != SurfaceKey.WOOD_METAL) {
            cautions.add(
                Caution(
                    text = "Gloss is specified for joinery and metal, not for walls. On a wall the " +
                        "same sheen is achievable nowhere in this range — silk is the closest " +
                        "washable film, and it needs a genuinely flat surface.",
                    guideId = "matt-or-silk",
                ),
            )
        }
        if (bestId == "silk" &&
            (answers.condition == ConditionKey.UNEVEN || answers.condition == ConditionKey.FLAKING)
        ) {
            cautions.add(
                Caution(
                    text = "Silk shows every ripple in the plaster. On this surface, either screed " +
                        "it flat first or drop to matt — a silk finish over an uneven wall reads " +
                        "as a defect even when the paint is perfect.",
                    guideId = "matt-or-silk",
                ),
            )
        }
        if (answers.condition == ConditionKey.MOULD) {
            cautions.add(
                Caution(
                    text = "Treat the mould and reduce the moisture first. The anti-fungi additive " +
                        "protects the paint film; it does not remove water from the room.",
                    guideId = "damp-and-mould",
                ),
            )
        }
        if (answers.condition == ConditionKey.CHALKY) {
            cautions.add(
                Caution(
                    text = "Rub the surface: if pigment comes off on your hand, stabilise it and " +
                        "re-test before any finish coat. Painting over a chalky surface bonds to " +
                        "the powder, not the wall.",
                    guideId = "preparing-walls",
                ),
            )
        }
        if (answers.surface == SurfaceKey.EXTERIOR || answers.condition == ConditionKey.NEW) {
            cautions.add(
                Caution(
                    text = "Keep the coat out of rain for 24 hours, and do not paint a wall hot " +
                        "enough to be uncomfortable to touch — a hot substrate flash-dries a " +
                        "water-based coat before it can be laid off.",
                    guideId = "preparing-walls",
                ),
            )
        }

        val coatsNote = if (answers.condition == ConditionKey.NEW || answers.condition == ConditionKey.CHALKY) {
            "Porous new or chalky plaster drinks the first coat. Budget for the coat count on the " +
                "data sheet plus one, and never skip the primer."
        } else {
            null
        }

        val reasons = best?.reasons?.takeIf { it.isNotEmpty() }
            ?: listOf(
                "Nothing in your answers points one way or the other, so this is the " +
                    "general-purpose interior finish.",
            )

        return FinishAdvice(
            topcoatId = bestId,
            alternativeId = alternative?.id,
            primerId = primerId,
            screedId = screedId,
            primerNote = if (answers.surface == SurfaceKey.WOOD_METAL) {
                "Wood or metal primer, appropriate to the substrate"
            } else {
                null
            },
            coats = byId[bestId]?.coatsRecommended ?: 0,
            coatsNote = coatsNote,
            sheenFinish = byId[bestId]?.finish.orEmpty(),
            reasons = reasons,
            cautions = cautions,
            prepIds = prepIds,
            blocked = null,
        )
    }
}
