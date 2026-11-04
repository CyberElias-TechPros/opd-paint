package com.opudas.paint.core.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/*
 * The finish finder, pinned to the behaviour of `app/src/lib/advisor.ts`.
 *
 * This is specification advice: which product goes on which wall, how many coats,
 * and what has to be fixed first. A port that scores differently is not a style
 * difference, it is a different recommendation about a product somebody is about to
 * buy, so the cases below assert the winner, the runner-up, the primer, the screed,
 * the coat note and every caution that should and should not fire.
 */
class AdvisorEngineTest {

    private val products = listOf(
        AdvisorProduct("matt", "Matt", 2),
        AdvisorProduct("silk", "Silk", 2),
        AdvisorProduct("gloss", "Gloss", 2),
        AdvisorProduct("weathershield", "Texture", 2),
        AdvisorProduct("primer", "Primer", 1),
        AdvisorProduct("screeding", "Filler", 2),
    )

    private val situations = listOf(
        AdvisorSituation("sound-repaint", "sound"),
        AdvisorSituation("new-plaster", "new"),
        AdvisorSituation("damp-and-mould", "damp"),
        AdvisorSituation("flaking-coat", "flaking"),
        AdvisorSituation("mould-growth", "mould"),
    )

    private fun advice(
        surface: SurfaceKey,
        condition: ConditionKey = ConditionKey.SOUND,
        wear: WearKey = WearKey.LIGHT,
        sheen: SheenKey = SheenKey.FLAT,
        catalogue: List<AdvisorProduct> = products,
    ) = AdvisorEngine.recommendFinish(
        FinishAnswers(surface, condition, wear, sheen),
        catalogue,
        situations,
    )

    /* ------------------------------------------------------------- the answers */

    @Test
    fun `an interior wall in light wear asked for flat gets matt`() {
        val result = advice(SurfaceKey.INTERIOR_WALL)
        assertEquals("matt", result.topcoatId)
        assertEquals("silk", result.alternativeId)
        assertEquals(2, result.coats)
        assertEquals("Matt", result.sheenFinish)
        assertNull(result.primerId)
        assertNull(result.screedId)
        assertNull(result.blocked)
        // matt: interior-wall 3 + light 1 + flat 3 = 7; silk: interior-wall 1.
        assertEquals(7, AdvisorEngine.score(FinishAnswers(
            SurfaceKey.INTERIOR_WALL, ConditionKey.SOUND, WearKey.LIGHT, SheenKey.FLAT,
        ), products).first().weight)
    }

    @Test
    fun `a kitchen in heavy wear asked for soft sheen gets silk`() {
        val result = advice(SurfaceKey.KITCHEN_BATH, wear = WearKey.HEAVY, sheen = SheenKey.SOFT)
        assertEquals("silk", result.topcoatId)
        // silk: kitchen-bath 4 + heavy 3 + soft 3 = 10. matt scores nothing here, so
        // there is no runner-up to offer — inventing one would be recommending a
        // product these answers argued against.
        assertNull(result.alternativeId)
        assertNull(result.primerId)
    }

    @Test
    fun `timber and metal asked for gloss gets the gloss line`() {
        val result = advice(SurfaceKey.WOOD_METAL, wear = WearKey.MODERATE, sheen = SheenKey.GLOSS)
        assertEquals("gloss", result.topcoatId)
        assertEquals(
            "Wood or metal primer, appropriate to the substrate",
            result.primerNote,
        )
        assertTrue(
            result.cautions.any { it.guideId == "preparing-walls" && it.text.contains("zinc-rich") },
        )
        // Wood and metal are not plaster substrates, so the alkali-resisting primer
        // is not offered: it would be the wrong primer for the substrate.
        assertNull(result.primerId)
    }

    @Test
    fun `an exposed elevation gets the exterior coating and a rain caution`() {
        val result = advice(SurfaceKey.EXTERIOR, condition = ConditionKey.NEW)
        assertEquals("weathershield", result.topcoatId)
        assertEquals("primer", result.primerId)
        assertNotNull(result.coatsNote)
        assertTrue(result.coatsNote!!.contains("Porous new or chalky plaster"))
        assertTrue(result.cautions.any { it.text.contains("out of rain for 24 hours") })
    }

    @Test
    fun `an uneven wall is screeded before it is finished`() {
        val result = advice(SurfaceKey.INTERIOR_WALL, condition = ConditionKey.UNEVEN)
        assertEquals("screeding", result.screedId)
        assertEquals("primer", result.primerId)
        // matt: interior-wall 3 + light 1 + flat 3 + uneven 2 = 9. silk: 1.
        assertEquals("matt", result.topcoatId)
    }

    @Test
    fun `silk over an uneven wall carries the ripple caution`() {
        // kitchen-bath 4 + soft 3 = 7 for silk against matt's uneven 2: silk wins,
        // and the surface is the one that shows every ripple left in the plaster.
        val result = advice(SurfaceKey.KITCHEN_BATH, condition = ConditionKey.UNEVEN, sheen = SheenKey.SOFT)
        assertEquals("silk", result.topcoatId)
        assertEquals("screeding", result.screedId)
        assertTrue(result.cautions.any { it.text.contains("Silk shows every ripple") })
    }

    @Test
    fun `a gloss sheen asked for on a wall explains itself rather than recommending gloss`() {
        val result = advice(SurfaceKey.INTERIOR_WALL, sheen = SheenKey.GLOSS)
        assertEquals("silk", result.topcoatId)
        // Two different sentences say two different jobs, and this test had them
        // mixed up: the caution warns, the reason explains the score. Both reach the
        // visitor, so both are pinned — to the text each one actually carries.
        assertTrue(
            result.cautions.any {
                it.guideId == "matt-or-silk" && it.text.contains("Gloss is specified for joinery and metal")
            },
        )
        assertTrue(result.reasons.any { it.contains("no gloss emulsion") })
    }

    @Test
    fun `mould gets the anti-fungi caution and the silk film`() {
        val result = advice(SurfaceKey.KITCHEN_BATH, condition = ConditionKey.MOULD, sheen = SheenKey.SOFT)
        assertEquals("silk", result.topcoatId)
        assertTrue(result.cautions.any { it.guideId == "damp-and-mould" })
        assertTrue(result.cautions.any { it.text.contains("does not remove water from the room") })
        // The caution points at the damp-and-mould guide; the preparation is the
        // situation whose own condition is mould. Those are different lookups and
        // they are allowed to name different records.
        assertEquals(listOf("mould-growth"), result.prepIds)
    }

    @Test
    fun `chalky surfaces are rubbed before they are painted`() {
        val result = advice(SurfaceKey.INTERIOR_WALL, condition = ConditionKey.CHALKY)
        assertTrue(result.cautions.any { it.text.contains("if pigment comes off on your hand") })
        assertEquals("primer", result.primerId)
        assertNotNull(result.coatsNote)
    }

    /* ------------------------------------------------------- the honest refusal */

    @Test
    fun `a damp wall is not sold anything`() {
        val result = advice(SurfaceKey.INTERIOR_WALL, condition = ConditionKey.DAMP)
        assertNotNull(result.blocked)
        assertTrue(result.isBlocked)
        assertEquals("Fix the water before you buy paint", result.blocked!!.title)
        assertEquals("damp-and-mould", result.blocked!!.guideId)
        assertEquals(0, result.coats)
        assertTrue(result.reasons.isEmpty())
        assertTrue(result.cautions.isEmpty())
        // No finish is described, because none is recommended.
        assertEquals("", result.sheenFinish)
        assertNull(result.primerId)
        assertNull(result.screedId)
        // The preparation is still given: there is work to do, it is just not painting.
        assertEquals(listOf("damp-and-mould"), result.prepIds)
    }

    /* ------------------------------------------------------------- the ranking */

    @Test
    fun `equal weights resolve by id, so identical answers give identical advice`() {
        // interior-wall gives matt 3 and silk 1; light wear gives matt 1; soft sheen
        // gives silk 3. Both land on 4, and the tie is broken by id rather than by
        // whatever order a map happened to iterate in.
        val answers = FinishAnswers(
            SurfaceKey.INTERIOR_WALL, ConditionKey.SOUND, WearKey.LIGHT, SheenKey.SOFT,
        )
        val ranked = AdvisorEngine.score(answers, products)
        assertEquals(4, ranked[0].weight)
        assertEquals(4, ranked[1].weight)
        assertEquals("matt", ranked[0].id)
        assertEquals("silk", ranked[1].id)
        assertEquals("matt", AdvisorEngine.recommendFinish(answers, products, situations).topcoatId)
    }

    @Test
    fun `a sheen nobody has decided yet still scores through the other answers`() {
        val result = advice(SurfaceKey.CEILING_TRIM, wear = WearKey.LIGHT, sheen = SheenKey.UNSURE)
        assertEquals("matt", result.topcoatId)
        assertTrue(result.reasons.any { it.contains("raking light") })
    }

    @Test
    fun `the reasons given are the reasons that produced the score`() {
        val answers = FinishAnswers(
            SurfaceKey.INTERIOR_WALL, ConditionKey.SOUND, WearKey.LIGHT, SheenKey.FLAT,
        )
        val best = AdvisorEngine.score(answers, products).first()
        // Three rules fire for matt, so three reasons are shown. If the explanation
        // and the total ever disagree, a visitor is told something other than what
        // was decided.
        assertEquals(3, best.reasons.size)
        assertEquals(best.reasons, AdvisorEngine.recommendFinish(answers, products, situations).reasons)
    }

    @Test
    fun `an empty catalogue still produces an answer rather than a crash`() {
        val result = advice(SurfaceKey.INTERIOR_WALL, catalogue = emptyList())
        assertEquals(AdvisorEngine.FALLBACK_TOPCOAT_ID, result.topcoatId)
        assertEquals(0, result.coats)
        assertEquals(1, result.reasons.size)
        assertTrue(result.reasons.first().contains("general-purpose interior finish"))
        assertNull(result.alternativeId)
    }

    @Test
    fun `a primer the catalogue does not carry is not recommended`() {
        val without = products.filter { it.id != "primer" && it.id != "screeding" }
        val result = advice(SurfaceKey.INTERIOR_WALL, condition = ConditionKey.UNEVEN, catalogue = without)
        assertNull(result.primerId)
        assertNull(result.screedId)
    }

    /* ---------------------------------------------------------- the preparation */

    @Test
    fun `preparation follows the condition, and falls back to the general repaint`() {
        assertEquals(
            listOf("new-plaster"),
            AdvisorEngine.prepForCondition(situations, ConditionKey.NEW),
        )
        assertEquals(
            listOf("sound-repaint"),
            AdvisorEngine.prepForCondition(situations, ConditionKey.SOUND),
        )
        // No situation carries this condition, so the general sequence is offered
        // rather than nothing: advice about a finish with nothing about the wall it
        // goes on is half an answer.
        assertEquals(
            listOf("sound-repaint"),
            AdvisorEngine.prepForCondition(situations, ConditionKey.CHALKY),
        )
    }

    @Test
    fun `every situation matching a condition is returned, in bundle order`() {
        val withDuplicates = situations + AdvisorSituation("second-damp-case", "damp")
        assertEquals(
            listOf("damp-and-mould", "second-damp-case"),
            AdvisorEngine.prepForCondition(withDuplicates, ConditionKey.DAMP),
        )
    }

    /* ------------------------------------------------------------- the contract */

    /*
     * The answer keys, as the bundle spells them.
     *
     * These are matched against the option ids in `assets/data/tools.json`. A key
     * that does not match does not fail a build and does not throw: it matches no
     * rule, and the visitor is recommended a general-purpose interior finish for a
     * steel gate. That is why they are pinned here.
     */
    @Test
    fun `the answer keys are the ones the bundle uses`() {
        assertEquals(
            listOf("interior-wall", "ceiling-trim", "kitchen-bath", "wood-metal", "exterior", "new-plaster"),
            SurfaceKey.entries.map { it.id },
        )
        assertEquals(
            listOf("new", "sound", "flaking", "uneven", "chalky", "damp", "mould"),
            ConditionKey.entries.map { it.id },
        )
        assertEquals(listOf("light", "moderate", "heavy"), WearKey.entries.map { it.id })
        assertEquals(listOf("flat", "soft", "gloss", "unsure"), SheenKey.entries.map { it.id })
    }

    @Test
    fun `every key resolves from its id, and nothing else does`() {
        SurfaceKey.entries.forEach { assertEquals(it, SurfaceKey.fromId(it.id)) }
        ConditionKey.entries.forEach { assertEquals(it, ConditionKey.fromId(it.id)) }
        WearKey.entries.forEach { assertEquals(it, WearKey.fromId(it.id)) }
        SheenKey.entries.forEach { assertEquals(it, SheenKey.fromId(it.id)) }

        assertNull(SurfaceKey.fromId("wall"))
        assertNull(ConditionKey.fromId("DAMP"))
        assertNull(WearKey.fromId(""))
        assertNull(SheenKey.fromId("matte"))
    }
}
