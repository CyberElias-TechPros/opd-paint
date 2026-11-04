package com.opudas.paint.core.engine

import com.opudas.paint.core.data.model.ApplicationStep
import com.opudas.paint.core.data.model.Pack
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.PrepSituation
import com.opudas.paint.core.data.model.PrepStep
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.data.model.SavedEstimate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/*
 * The project checklist, pinned against the website.
 *
 * Every expected string here was produced by running the real `buildChecklist` and
 * `checklistToText` from `app/src/lib/advisor.ts` under Node and reading its output, not
 * by transcribing what the Kotlin looks like it should say. Seven boards were compared
 * field by field between the TypeScript and a transcription of this engine and agreed
 * exactly; these tests are the part of that agreement worth keeping, so a future edit
 * here cannot drift from the printed checklist a dealer receives.
 *
 * Two of them exist because the first comparison did not catch the bug they now pin. A
 * board with one preparation situation joins nothing, so a separator written as "·"
 * instead of " · " is invisible until a second situation arrives — and then two
 * conditions read as one compound word.
 */
class ChecklistEngineTest {

    /* ---------------------------------------------------------- the published order */

    @Test
    fun `an empty board produces no groups at all`() {
        val groups = ChecklistEngine.build(input(), CATALOGUE)
        assertTrue("an empty board should plan nothing, got $groups", groups.isEmpty())
    }

    @Test
    fun `the groups come in the order the guides publish`() {
        val groups = ChecklistEngine.build(
            input(
                projectName = "Whole flat",
                colours = listOf(WHITE),
                products = listOf(MATT),
                estimates = listOf(estimate(id = "e1", productId = "matt", label = "Lounge")),
                prep = listOf(NEW_RENDER),
            ),
            CATALOGUE,
        )
        assertEquals(listOf("before", "buy", "prepare", "paint", "after"), groups.map { it.id })
    }

    @Test
    fun `a group with nothing in it is left out rather than shown empty`() {
        // No products saved: there is nothing to apply and nothing to cure.
        val groups = ChecklistEngine.build(
            input(colours = listOf(WHITE)),
            CATALOGUE,
        )
        assertEquals(listOf("before", "buy"), groups.map { it.id })
    }

    /* ------------------------------------------------------------- what to confirm */

    @Test
    fun `two preparation situations are separated by a spaced middle dot`() {
        val groups = ChecklistEngine.build(
            input(prep = listOf(NEW_RENDER, PREVIOUSLY_PAINTED)),
            CATALOGUE,
        )
        assertEquals(
            "New render or blockwork · Previously painted and sound",
            groups.item("survey").detail,
        )
    }

    @Test
    fun `one colour reads as one colour, and the grammar is the website's`() {
        val groups = ChecklistEngine.build(input(colours = listOf(WHITE)), CATALOGUE)
        assertTrue(
            groups.item("sample").detail!!.startsWith("1 colour on the board are digital proofs."),
        )
    }

    @Test
    fun `two colours read as two colours`() {
        val groups = ChecklistEngine.build(
            input(colours = listOf(WHITE, BONE)),
            CATALOGUE,
        )
        assertTrue(
            groups.item("sample").detail!!.startsWith("2 colours on the board are digital proofs."),
        )
    }

    @Test
    fun `a board with nothing chosen is told to check the walls anyway`() {
        val groups = ChecklistEngine.build(input(products = listOf(MATT)), CATALOGUE)
        assertEquals("Check what condition the walls are in", groups.item("survey").label)
        assertEquals(ChecklistLink.SurfacePrep, groups.item("survey").link)
    }

    @Test
    fun `naming a situation replaces the generic advice with the situations named`() {
        val groups = ChecklistEngine.build(
            input(products = listOf(MATT), prep = listOf(NEW_RENDER)),
            CATALOGUE,
        )
        assertEquals("Walk the surface and confirm its condition", groups.item("survey").label)
        assertEquals("New render or blockwork", groups.item("survey").detail)
    }

    /* ---------------------------------------------------------------- what to buy */

    @Test
    fun `an estimate is listed with the packs, the room, the area and the coats`() {
        val groups = ChecklistEngine.build(
            input(
                estimates = listOf(
                    estimate(
                        id = "e1",
                        productId = "matt",
                        label = "Lounge",
                        packs = "2 × 20 L + 1 × 4 L",
                        litres = 9.0,
                        area = 43.71,
                        coats = 2,
                    ),
                ),
            ),
            CATALOGUE,
        )
        val item = groups.item("buy-e1")
        assertEquals("2 × 20 L + 1 × 4 L of Matt", item.label)
        assertEquals("Lounge · 43.71 m² · 2 coats · OPD-MT", item.detail)
        assertEquals(ChecklistLink.Product("matt"), item.link)
    }

    @Test
    fun `one coat is singular`() {
        val groups = ChecklistEngine.build(
            input(estimates = listOf(estimate(id = "e2", productId = "silk", label = "Hall", packs = "1 × 4 L", area = 12.0, coats = 1))),
            CATALOGUE,
        )
        assertEquals("Hall · 12 m² · 1 coat · OPD-SLK", groups.item("buy-e2").detail)
    }

    @Test
    fun `an estimate for a product that no longer exists is still listed, without a link`() {
        val groups = ChecklistEngine.build(
            input(
                estimates = listOf(
                    estimate(id = "e3", productId = "ghost", label = "Stairs", packs = "1 × 1 L", area = 5.5, coats = 3),
                ),
            ),
            CATALOGUE,
        )
        val item = groups.item("buy-e3")
        assertEquals("1 × 1 L of ghost", item.label)
        assertEquals("Stairs · 5.5 m² · 3 coats", item.detail)
        assertNull("a product the catalogue does not have has nowhere to link to", item.link)
    }

    @Test
    fun `pack sizes are written the way the site writes numbers`() {
        val groups = ChecklistEngine.build(input(products = listOf(PRIMER, SCREEDING)), CATALOGUE)
        // 20 and not 20.0: Kotlin's Double.toString would print the decimal point the
        // website does not, on a list somebody reads aloud down a phone.
        assertEquals("Primer · pack sizes 20 L, 4 L", groups.item("buy-primer").detail)
        assertEquals("Filler · pack sizes 25 kg, 10 kg", groups.item("buy-screeding").detail)
    }

    @Test
    fun `a product preparation needs is added once, named for the situation`() {
        val groups = ChecklistEngine.build(
            input(products = listOf(PRIMER), prep = listOf(NEW_RENDER)),
            CATALOGUE,
        )
        // NEW_RENDER asks for matt, which is not on the board yet.
        val added = groups.group("buy").items.filter { it.id.startsWith("buy-prep-") }
        assertEquals(1, added.size)
        assertEquals("buy-prep-new-render-matt", added.single().id)
        assertEquals("OPUDA'S MATT Emulsion", added.single().label)
        assertEquals("Needed for new render or blockwork", added.single().detail)
    }

    @Test
    fun `a product already estimated is not listed a second time`() {
        val groups = ChecklistEngine.build(
            input(
                products = listOf(MATT),
                estimates = listOf(estimate(id = "e1", productId = "matt", label = "Lounge")),
            ),
            CATALOGUE,
        )
        val ids = groups.group("buy").items.map { it.id }
        assertEquals(listOf("buy-e1"), ids)
    }

    @Test
    fun `colours are listed by code because that is what a dealer quotes`() {
        val groups = ChecklistEngine.build(input(colours = listOf(WHITE)), CATALOGUE)
        val item = groups.item("buy-colours")
        assertEquals("Colours: Opuda White (OP-001)", item.label)
        assertEquals(
            "Quote the code, not the name — the code is what the fan deck and the dealer use.",
            item.detail,
        )
        assertEquals(ChecklistLink.Colours, item.link)
    }

    /* -------------------------------------------------------------- prepare, apply */

    @Test
    fun `every step of a situation becomes a line, numbered by its position`() {
        val groups = ChecklistEngine.build(input(prep = listOf(NEW_RENDER)), CATALOGUE)
        val ids = groups.group("prepare").items.map { it.id }
        assertEquals(listOf("prep-new-render-0", "prep-new-render-1"), ids)
        assertEquals("New render or blockwork: Cure", groups.item("prep-new-render-0").label)
    }

    @Test
    fun `a warning is carried through with its sign and a slice of itself as an id`() {
        val groups = ChecklistEngine.build(input(prep = listOf(DAMP)), CATALOGUE)
        val warnings = groups.group("prepare").items.filter { it.id.startsWith("warn-") }
        assertEquals(1, warnings.size)
        assertTrue(warnings.single().label.startsWith("⚠ "))
        assertEquals(
            "warn-damp-Paint will n",
            warnings.single().id,
        )
    }

    @Test
    fun `application steps carry the dry and recoat intervals from the data sheet`() {
        val groups = ChecklistEngine.build(input(products = listOf(MATT)), CATALOGUE)
        val item = groups.item("apply-matt-0")
        assertEquals("Matt: Prepare", item.label)
        assertEquals("Scrape, fill and sand. Touch dry 2 h · recoat 4 h.", item.detail)
        assertEquals(ChecklistLink.Product("matt"), item.link)
    }

    /* ------------------------------------------------------------------ afterwards */

    @Test
    fun `a product with no published guarantee gets no guarantee line`() {
        val groups = ChecklistEngine.build(input(products = listOf(PRIMER, SCREEDING)), CATALOGUE)
        val ids = groups.group("after").items.map { it.id }
        // Both cure in three days. Neither carries a guarantee, and printing "0-year
        // guarantee" would invent a term the supplier never offered.
        assertEquals(listOf("cure-primer", "cure-screeding"), ids)
    }

    @Test
    fun `a guarantee is reported in the years the data sheet states`() {
        val groups = ChecklistEngine.build(input(products = listOf(MATT)), CATALOGUE)
        val item = groups.item("guarantee-matt")
        assertEquals("Keep the till slip — 5-year guarantee", item.label)
        assertEquals(
            "The guarantee on this product is under the terms printed on the pail.",
            item.detail,
        )
    }

    @Test
    fun `surplus paint is only mentioned when something was measured`() {
        assertTrue(
            ChecklistEngine.build(input(products = listOf(MATT)), CATALOGUE)
                .group("after").items.none { it.id == "leftovers" },
        )
        assertEquals(
            "leftovers",
            ChecklistEngine.build(
                input(
                    products = listOf(MATT),
                    estimates = listOf(estimate(id = "e1", productId = "matt")),
                ),
                CATALOGUE,
            ).group("after").items.last().id,
        )
    }

    /* ------------------------------------------------------------------ plain text */

    @Test
    fun `the export opens with the company name and closes with the colour warning`() {
        val text = ChecklistEngine.toText("Lounge refresh", emptyList())
        val lines = text.split("\n")
        assertEquals("OPUDA’S PAINT — Lounge refresh", lines.first())
        assertEquals("", lines[1])
        assertEquals(
            "Colours on screen are digital proofs. Confirm with a sample pot or a dealer chip.",
            lines.last(),
        )
        assertFalse("the export is pasted into a message, not appended to one", text.endsWith("\n"))
    }

    @Test
    fun `an empty project name falls back, and a name of spaces does not`() {
        assertEquals(
            "OPUDA’S PAINT — My project",
            ChecklistEngine.toText("", emptyList()).split("\n").first(),
        )
        // `ifEmpty`, not `ifBlank`: three spaces is a name somebody typed, and the
        // website's `||` keeps it for the same reason.
        assertEquals(
            "OPUDA’S PAINT —    ",
            ChecklistEngine.toText("   ", emptyList()).split("\n").first(),
        )
    }

    @Test
    fun `a group title is uppercased and its note comes before its items`() {
        val groups = ChecklistEngine.build(
            input(
                projectName = "Hall",
                products = listOf(MATT),
                estimates = listOf(estimate(id = "e1", productId = "matt", label = "Hall", area = 12.0)),
            ),
            CATALOGUE,
        )
        val text = ChecklistEngine.toText("Hall", groups)
        val lines = text.split("\n")
        val buyAt = lines.indexOf("WHAT TO BUY")
        assertTrue("the buy group should be in the export", buyAt > 0)
        assertEquals(
            "Pricing is not published on this site: send this list to a dealer or to the " +
                "colour desk and they will quote against real stock.",
            lines[buyAt + 1],
        )
        assertTrue(lines[buyAt + 2].startsWith("[ ] "))
        // Details are indented four spaces, so a pasted list still reads as a list.
        assertTrue(lines[buyAt + 3].startsWith("    "))
    }

    @Test
    fun `nothing to plan still exports the two lines that are always true`() {
        val text = ChecklistEngine.toText("", emptyList())
        assertEquals(
            "OPUDA’S PAINT — My project\n\n" +
                "Colours on screen are digital proofs. Confirm with a sample pot or a dealer chip.",
            text,
        )
    }

    /* --------------------------------------------------------------------- emptiness */

    @Test
    fun `a board is empty when nothing is chosen, and preparation alone does not fill it`() {
        assertTrue(ChecklistEngine.isEmpty(emptyList(), emptyList(), emptyList()))
        assertFalse(ChecklistEngine.isEmpty(listOf(WHITE), emptyList(), emptyList()))
        assertFalse(
            ChecklistEngine.isEmpty(
                emptyList(),
                listOf(MATT),
                listOf(estimate(id = "e1", productId = "matt")),
            ),
        )
    }

    /* --------------------------------------------------------------------- fixtures */

    private fun input(
        projectName: String = "",
        colours: List<PaintColor> = emptyList(),
        products: List<Product> = emptyList(),
        estimates: List<SavedEstimate> = emptyList(),
        prep: List<PrepSituation> = emptyList(),
    ) = ChecklistInput(projectName, colours, products, estimates, prep)

    private fun estimate(
        id: String,
        productId: String,
        label: String = "Room",
        packs: String = "1 × 4 L",
        litres: Double = 4.0,
        unit: String = "L",
        area: Double = 12.0,
        coats: Int = 2,
    ) = SavedEstimate(id, productId, label, packs, litres, unit, area, coats, savedAt = 0L)

    private fun List<ChecklistGroup>.group(id: String): ChecklistGroup = first { it.id == id }

    private fun List<ChecklistGroup>.item(id: String): ChecklistItem =
        flatMap { it.items }.first { it.id == id }

    /*
     * Both factories below supply every field of their model, because neither model has
     * defaults: the bundles are parsed with `encodeDefaults = false` and a field the
     * generator forgets should fail loudly, not arrive as an empty string. That means a
     * test fixture cannot leave anything out either, and the fields a checklist never
     * reads are filled with blanks rather than plausible-looking inventions.
     */
    private companion object {

        fun product(
            id: String,
            sku: String,
            name: String,
            shortName: String,
            finish: String,
            packs: List<Pack> = emptyList(),
            application: List<ApplicationStep> = emptyList(),
            touchDryHours: Int = 0,
            recoatHours: Int = 0,
            fullCureDays: Int = 0,
            guaranteeYears: Int = 0,
        ) = Product(
            id = id,
            sku = sku,
            name = name,
            shortName = shortName,
            line = "",
            tagline = "",
            description = "",
            finish = finish,
            surfaces = emptyList(),
            sheenLevel = 0,
            coveragePerUnit = 10.0,
            coatsRecommended = 2,
            touchDryHours = touchDryHours,
            recoatHours = recoatHours,
            fullCureDays = fullCureDays,
            dilution = "",
            voc = "",
            guaranteeYears = guaranteeYears,
            features = emptyList(),
            packs = packs,
            image = "",
            gallery = emptyList(),
            tds = emptyList(),
            bestFor = "",
            application = application,
            claimsStatus = "pending-verification",
        )

        fun situation(
            id: String,
            label: String,
            steps: List<PrepStep> = emptyList(),
            products: List<String> = emptyList(),
            warnings: List<String> = emptyList(),
        ) = PrepSituation(
            id = id,
            label = label,
            signs = emptyList(),
            surfaces = emptyList(),
            steps = steps,
            products = products,
            guides = emptyList(),
            warnings = warnings,
        )

        val WHITE = PaintColor(
            source = "fan deck",
            id = "op-001",
            code = "OP-001",
            name = "Opuda White",
            hex = "#f4f1ea",
            family = "Whites",
            undertone = "warm",
            rooms = emptyList(),
            collection = "The Signature",
            note = "",
            lrv = 85,
        )

        val BONE = WHITE.copy(id = "op-014", code = "OP-014", name = "Bone", lrv = 78)

        val MATT = product(
            id = "matt",
            sku = "OPD-MT",
            name = "OPUDA'S MATT Emulsion",
            shortName = "Matt",
            finish = "Matt",
            packs = listOf(Pack(20.0, "L", true), Pack(4.0, "L", true)),
            application = listOf(ApplicationStep("Prepare", "Scrape, fill and sand.")),
            touchDryHours = 2,
            recoatHours = 4,
            fullCureDays = 7,
            guaranteeYears = 5,
        )

        val SILK = MATT.copy(
            id = "silk",
            sku = "OPD-SLK",
            name = "OPUDA'S Silk Emulsion",
            shortName = "Silk",
            finish = "Silk",
        )

        /** No guarantee published, which is a zero here and an absent line in the checklist. */
        val PRIMER = MATT.copy(
            id = "primer",
            sku = "OPD-PR",
            name = "OPUDA'S Alkali-Resisting Primer",
            shortName = "Primer",
            finish = "Primer",
            packs = listOf(Pack(20.0, "L", true), Pack(4.0, "L", true)),
            application = emptyList(),
            fullCureDays = 3,
            guaranteeYears = 0,
        )

        val SCREEDING = MATT.copy(
            id = "screeding",
            sku = "OPD-SC",
            name = "OPUDA'S Screeding Compound",
            shortName = "Screeding",
            finish = "Filler",
            packs = listOf(Pack(25.0, "kg", true), Pack(10.0, "kg", true)),
            application = emptyList(),
            fullCureDays = 3,
            guaranteeYears = 0,
        )

        val CATALOGUE = listOf(MATT, SILK, PRIMER, SCREEDING)

        val NEW_RENDER = situation(
            id = "new-render",
            label = "New render or blockwork",
            steps = listOf(
                PrepStep("Cure", "Let new render cure for 28 days."),
                PrepStep("Seal", "Seal with one coat of alkali-resisting primer."),
            ),
            products = listOf("matt"),
        )

        val PREVIOUSLY_PAINTED = situation(
            id = "sound-repaint",
            label = "Previously painted and sound",
            steps = listOf(PrepStep("Wash", "Wash down and let dry.")),
        )

        val DAMP = situation(
            id = "damp",
            label = "Damp or mould",
            warnings = listOf("Paint will not stop water coming through."),
        )
    }
}
