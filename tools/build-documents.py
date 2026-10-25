#!/usr/bin/env python3
"""
Generate the technical data sheets and safety data sheets served from
/public/documents.

These are generated from one structured source so a specification change is a
one-line edit here, not eight PDF edits. Every figure on the sheet is the figure
used by the product page - the site and the document cannot drift apart.

Run:  python3 tools/build-documents.py
"""
from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parent.parent / "app" / "public" / "documents"
OUT.mkdir(parents=True, exist_ok=True)

INK = (11, 26, 19)
GREEN = (12, 107, 69)
MUTED = (90, 105, 97)
PAPER = (247, 242, 233)

PRODUCTS = {
    "matt": dict(
        name="OPUDA'S MATT Emulsion",
        sku="OPD-MT",
        finish="Matt (flat), sheen < 5%",
        coverage="11 m2 per litre, single coat, sealed surface",
        coats="2",
        touch="1 hour at 25 degC / 60% RH",
        recoat="3 hours",
        cure="7 days",
        dilution="First coat: up to 10% clean water on porous plaster. Finish coat: undiluted.",
        voc="Water-based, low VOC",
        surfaces="Interior walls and ceilings",
        guarantee="5 years",
        packs="1 L - 4 L - 10 L - 20 L",
        claims=[
            "High quality, for walls and ceilings",
            "Smooth finish with better flow",
            "Extra coverage per litre",
            "Anti-fungi additive for humid rooms",
            "Eco-friendly, low odour",
            "5-year guarantee",
        ],
        apply=[
            "Prepare: scrape, fill and sand. New plaster must cure 28 days, then seal with one coat of alkali-resisting primer.",
            "Prime: one coat OPUDA'S Alkali-Resisting Primer. Allow 4 hours.",
            "Cut in: ceilings and corners with a 3-inch brush before rolling.",
            "Coat 1: roll from a wet edge in 1 m2 sections. Thin up to 10% on porous plaster.",
            "Coat 2: after 3 hours, undiluted, at right angles to the first coat.",
            "Cure: do not wash or scrub for 7 days. Ventilate well.",
        ],
    ),
    "silk": dict(
        name="OPUDA'S SILK Emulsion",
        sku="OPD-SLK",
        finish="Silk (soft sheen), 10-15%",
        coverage="12 m2 per litre, single coat, sealed surface",
        coats="2",
        touch="1 hour at 25 degC / 60% RH",
        recoat="4 hours",
        cure="7 days",
        dilution="First coat: up to 10% clean water. Finish coat: undiluted.",
        voc="Water-based, low VOC, low odour",
        surfaces="Interior walls, kitchens, bathrooms, corridors",
        guarantee="5 years",
        packs="1 L - 4 L - 10 L - 20 L",
        claims=[
            "Washable soft-sheen film",
            "Resists kitchen steam and condensation",
            "Anti-fungi additive",
            "Smooth, self-levelling finish",
            "Weather resistant when used under cover",
            "5-year guarantee",
        ],
        apply=[
            "Prepare: wash down greasy surfaces and rinse. Sand filler flush.",
            "Prime: one coat of primer; two on repaired patches to equalise porosity.",
            "Coat 1: medium pile sleeve, single direction, thin up to 10%.",
            "Coat 2: after 4 hours, at right angles to the first coat.",
            "Cure: ventilate; avoid washing for 7 days.",
        ],
    ),
    "primer": dict(
        name="OPUDA'S Alkali-Resisting Primer",
        sku="OPD-PRM",
        finish="Primer (sealing coat)",
        coverage="10 m2 per litre, single coat",
        coats="1",
        touch="2 hours",
        recoat="4 hours",
        cure="3 days",
        dilution="Up to 20% clean water on very porous render.",
        voc="Water-based, low VOC",
        surfaces="New plaster, interior and exterior walls",
        guarantee="-",
        packs="4 L - 20 L",
        claims=[
            "Blocks alkali burn on new render",
            "Seals uneven porosity",
            "Improves topcoat coverage",
            "Quick recoat",
        ],
        apply=[
            "Allow new render to cure at least 14 days, ideally 28.",
            "Brush down salt bloom; treat with a stabilising wash and dry fully.",
            "One full coat by brush and roller. Do not thin unless very porous.",
            "Recoat with Matt or Silk after 4 hours.",
        ],
    ),
    "gloss": dict(
        name="OPUDA'S Synthetic Gloss",
        sku="OPD-GLS",
        finish="Gloss, sheen 80%+",
        coverage="13 m2 per litre, single coat",
        coats="2",
        touch="4 hours",
        recoat="16 hours",
        cure="7 days",
        dilution="Recommended solvent only, maximum 5%. Not water-thinnable.",
        voc="Solvent-based. Ventilate and use appropriate PPE.",
        surfaces="Timber and metal: doors, gates, frames, railings",
        guarantee="3 years",
        packs="1 L - 4 L - 20 L",
        claims=[
            "Hard, impact-resistant film",
            "Interior and exterior joinery",
            "Good flow and levelling",
            "Weather resistant",
        ],
        apply=[
            "Strip loose coating, sand to a sound edge, degrease steel with a solvent wipe.",
            "Prime: zinc-rich or red-oxide primer on metal; wood primer on timber, knots sealed.",
            "Coat 1: brush with the grain or length of the steel. Avoid over-brushing.",
            "Coat 2: after 16 hours. Thin coats always beat thick ones.",
        ],
    ),
    "weathershield": dict(
        name="OPUDA'S Weathershield",
        sku="OPD-WS",
        finish="Textured exterior coating",
        coverage="6 m2 per litre, single coat",
        coats="2",
        touch="2 hours",
        recoat="6 hours",
        cure="14 days",
        dilution="Do not thin. Stir thoroughly; trowel or heavy roller.",
        voc="Water-based acrylic",
        surfaces="Exterior render, facades, boundary walls, parapets",
        guarantee="5 years",
        packs="10 L - 20 L",
        claims=[
            "Bridges hairline cracks",
            "UV and colour stable",
            "Breathable film",
            "Rain resistant after 24 hours",
        ],
        apply=[
            "Remove efflorescence, treat mould, repair honeycombing.",
            "Prime with OPUDA'S Primer, or a bonding agent on chalky render.",
            "Coat 1: work from the top of the elevation downwards.",
            "Coat 2: after 6 hours. Protect from rain for 24 hours.",
        ],
    ),
    "screeding": dict(
        name="OPUDA'S Screeding Compound",
        sku="OPD-SCR",
        finish="Filler / base coat",
        coverage="1.6 m2 per kg at 1 mm thickness",
        coats="2",
        touch="3 hours",
        recoat="4 hours",
        cure="3 days",
        dilution="Mix 1 kg to approximately 0.4 L clean water; rest 10 minutes.",
        voc="Cementitious, low VOC",
        surfaces="Interior walls, ceilings, new blockwork",
        guarantee="-",
        packs="10 kg - 25 kg",
        claims=[
            "Levels uneven blockwork",
            "Sands to a fine finish",
            "Strong bond, minimal shrinkage",
        ],
        apply=[
            "Damp down the wall so it does not pull water from the mix.",
            "Pass 1: 1-2 mm with a steel trowel, tight. Allow to set.",
            "Pass 2: second thin pass to close the surface. Allow 4 hours.",
            "Sand with 120 grit, dust off, prime before painting.",
        ],
    ),
}

SDS_BODY = [
    ("1. Identification",
     "Product as named above. Manufacturer: OPUDA'S PAINT, Port Harcourt, Nigeria. "
     "Emergency telephone: 0902 642 4350 (Monday to Saturday, 08:00-18:00 WAT)."),
    ("2. Hazards identification",
     "Water-based products are not classified as hazardous under GHS. Solvent-based gloss contains "
     "flammable solvent: keep away from ignition sources, avoid inhalation of vapour. "
     "Wet paint is a mild eye and skin irritant. Sanding dust from cured film may be irritant."),
    ("3. Composition",
     "Acrylic/styrene-acrylic polymer dispersion, titanium dioxide, calcium carbonate, silicate extenders, "
     "water, glycol ether coalescent, preservative and anti-fungi additive, defoamer, thickener. "
     "Exact formulation is withheld as confidential business information."),
    ("4. First aid",
     "Eyes: rinse with clean water for 15 minutes, holding the lids open. Seek medical advice if irritation "
     "persists. Skin: wash with soap and water. Inhalation: move to fresh air. Ingestion: do not induce "
     "vomiting; rinse mouth and seek medical advice."),
    ("5. Fire fighting",
     "Water-based products are non-flammable; use media appropriate to the surrounding fire. "
     "Solvent-based gloss: foam, dry powder or CO2. Do not use a direct water jet on burning solvent."),
    ("6. Accidental release",
     "Contain with sand or earth; do not allow to enter drains or watercourses. Collect into a labelled "
     "container for disposal. Wash the area with water."),
    ("7. Handling and storage",
     "Store between 5 degC and 35 degC, out of direct sunlight, with the lid firmly closed. Protect from frost. "
     "Keep out of reach of children. Do not store near food or drink."),
    ("8. Exposure controls",
     "Water-based: general ventilation is adequate. Solvent-based: ensure local exhaust ventilation; wear "
     "solvent-resistant gloves and eye protection. Respiratory protection if spraying."),
    ("9. Physical properties",
     "Appearance: pigmented liquid. Odour: low (water-based) / solvent (gloss). pH 8-9. "
     "Density approximately 1.3-1.5 g/cm3. Solubility: miscible with water before curing."),
    ("10. Stability and reactivity",
     "Stable under normal conditions. Protect from freezing; freezing permanently damages the dispersion."),
    ("11. Toxicological information",
     "No acute systemic toxicity expected from normal use. Prolonged skin contact may cause dermatitis in "
     "sensitised individuals."),
    ("12. Ecological information",
     "Do not allow to enter drains or watercourses. Cured film is inert. Dispose of unused product through "
     "an authorised waste contractor."),
    ("13. Disposal",
     "Allow small residues to dry in the container and dispose of as household/industrial waste in accordance "
     "with local regulations. Do not pour liquid paint down drains."),
    ("14. Transport",
     "Not classified as dangerous goods for transport in the pack sizes supplied, with the exception of "
     "solvent-based gloss above the applicable flammable liquid threshold."),
    ("15. Regulatory information",
     "Classified in accordance with the GHS as adopted in Nigeria. Safety data sheet prepared in line with "
     "the four-part SDS format used in Nigeria."),
    ("16. Other information",
     "This sheet is reviewed annually. The current revision date is printed on the document footer. "
     "It does not replace a site-specific risk assessment."),
]


class Sheet(FPDF):
    def header(self):
        self.set_fill_color(*GREEN)
        self.rect(0, 0, 210, 22, "F")
        self.set_font("Helvetica", "B", 15)
        self.set_text_color(252, 249, 243)
        self.set_xy(14, 6)
        self.cell(0, 6, "OPUDA'S PAINT", align="L")
        self.set_font("Helvetica", "", 8)
        self.set_xy(14, 13)
        self.cell(0, 4, "Manufactured in Nigeria  -  0902 642 4350  -  opudapaint.com", align="L")
        self.set_text_color(*INK)
        self.set_xy(14, 30)

    def footer(self):
        self.set_y(-16)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MUTED)
        self.cell(0, 4, "Controlled document - rev 2026-09 - page %d" % self.page_no(), align="L")
        self.cell(0, 4, "Digital values are approximations; physical chips are the authority.", align="R")

    def h1(self, text):
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(*GREEN)
        self.multi_cell(0, 8, text)
        self.set_text_color(*INK)
        self.ln(1)

    def h2(self, text):
        self.ln(2)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*GREEN)
        self.cell(0, 6, text.upper(), new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(*INK)
        self.set_draw_color(216, 205, 187)
        self.line(self.l_margin, self.get_y(), 210 - self.r_margin, self.get_y())
        self.ln(2)

    def body(self, text, size=9):
        self.set_font("Helvetica", "", size)
        self.multi_cell(0, 5, text)
        self.ln(1)

    def kv_table(self, rows):
        self.set_font("Helvetica", "", 9)
        for i, (key, value) in enumerate(rows):
            fill = i % 2 == 0
            if fill:
                self.set_fill_color(*PAPER)
            self.set_font("Helvetica", "B", 9)
            self.cell(52, 7, key, border=0, fill=fill)
            self.set_font("Helvetica", "", 9)
            self.multi_cell(0, 7, str(value), border=0, fill=fill, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)


def tds(key: str, product: dict) -> None:
    pdf = Sheet(format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    pdf.h1(f"Technical Data Sheet\n{product['name']}")
    pdf.body(
        f"Product code {product['sku']} - Emulsion range - Revision 2026-09\n"
        "This sheet states the figures used by the product page and the paint calculator on opudapaint.com. "
        "Coverage is quoted for one coat on a sound, sealed surface; porous substrates absorb more."
    )

    pdf.h2("Specification")
    pdf.kv_table([
        ("Finish", product["finish"]),
        ("Coverage", product["coverage"]),
        ("Recommended coats", product["coats"]),
        ("Touch dry", product["touch"]),
        ("Recoat", product["recoat"]),
        ("Full cure", product["cure"]),
        ("Thinning", product["dilution"]),
        ("VOC / base", product["voc"]),
        ("Surfaces", product["surfaces"]),
        ("Pack sizes", product["packs"]),
        ("Guarantee", product["guarantee"]),
    ])

    pdf.h2("Product claims (as printed on the pail)")
    pdf.set_font("Helvetica", "", 9)
    for claim in product["claims"]:
        pdf.cell(4, 5, "-")
        pdf.multi_cell(0, 5, claim, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    pdf.h2("Application")
    pdf.set_font("Helvetica", "", 9)
    for index, step in enumerate(product["apply"], start=1):
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(6, 5, str(index))
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, step, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    pdf.h2("Limitations")
    pdf.body(
        "Do not apply when the substrate or ambient temperature is below 10 degC, or when relative humidity is above 85%. "
        "Do not apply over active damp, mould or efflorescence: correct the cause first. "
        "Do not wash the film for 7 days. Colour on a screen cannot guarantee a physical match; "
        "approve a painted sample on the actual wall before full application."
    )
    pdf.h2("Guarantee")
    pdf.body(
        "The guarantee applies to the supplied product when applied in accordance with this sheet, on a sound and "
        "correctly prepared substrate, in the specified system. It does not cover failure caused by structural movement, "
        "water ingress, inadequate preparation or application outside these instructions."
    )
    pdf.output(OUT / f"opudas-{key}-tds.pdf")


def sds(key: str, product: dict) -> None:
    pdf = Sheet(format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    pdf.h1(f"Safety Data Sheet\n{product['name']}")
    pdf.body(
        f"Product code {product['sku']} - Revision 2026-09 - Prepared in the four-part SDS format used in Nigeria.\n"
        "Read this sheet before use. It does not replace a site-specific risk assessment."
    )
    for heading, text in SDS_BODY:
        pdf.h2(heading)
        pdf.body(text)
    pdf.output(OUT / f"opudas-{key}-sds.pdf")


def main() -> None:
    for key, product in PRODUCTS.items():
        tds(key, product)
        sds(key, product)
        print(f"wrote {key}: tds + sds")
    print(f"{len(PRODUCTS) * 2} documents in {OUT}")


if __name__ == "__main__":
    main()
