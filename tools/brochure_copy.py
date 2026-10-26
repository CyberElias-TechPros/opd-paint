"""
The words in the colour book.

Kept apart from the layout so that writing can be edited without reading Python
drawing code, and so that a reviewer can check every claim on one screen. The
rules this file follows:

* No claim about a colour that a painter could not verify on a wall. Perceptual
  effects (red advances, green darkens on four walls) are guidance, and are
  phrased as guidance.
* No price, no dealer, no phone number, no guarantee. Those live in the data the
  website reads, so they can never go stale in print.
* Nothing about OPUDA'S products beyond what the label says. The specification
  page reads its figures from the same dictionary that generates the technical
  data sheets, not from this file.
* British spelling, the site's voice: concrete, unhurried, no exclamation marks.
"""

BRAND = "OPUDA'S PAINT"
CITY = "Port Harcourt"
EDITION = "2026"

COVER_LINE = "Fifty-nine colours, nine families, eight palettes —\nand the reasoning behind each one."

IMPRINT = "Colour Book · 2026"

# --------------------------------------------------------------------------- essay

ESSAY_TITLE = "Colour has a job to do"

ESSAY = [
    "Most paint decisions are made in a shop, under a fluorescent tube, from a chip "
    "the size of a postage stamp. Then the colour goes onto a wall four metres wide, in "
    "a room that faces west, and everything the chip promised changes.",
    "This book exists to shorten that distance. Every colour in it carries a code you "
    "can quote at a counter, a family it belongs to, an undertone that tells you what it "
    "will do next to other colours, and an estimated light reflectance value that tells "
    "you how much of the light in the room it will give back.",
    "None of that replaces standing in the room with a sample pot. What it does is make "
    "the decision smaller. Choose the family first, then the palette, then the exact "
    "colour — in that order, the choice usually makes itself.",
]

ESSAY_PULL = "A white is never neutral. It carries a temperature, and the temperature decides the room."

# --------------------------------------------------------------------------- how to read

HOW_TITLE = "How to read this book"

HOW_INTRO = (
    "Each colour carries four pieces of information. Together they are enough to choose "
    "with, and to argue with a painter about."
)

HOW_FIELDS = [
    (
        "The code",
        "Permanent. Printed under every name and quoted when you order. A name may be "
        "revised; the code never changes, because it is what the mixing system, the dealer "
        "and your own record all point at.",
    ),
    (
        "The family",
        "The neighbourhood the colour lives in. Choosing a family first is the single "
        "biggest shortcut in this book: rooms fail when two colours from different "
        "temperatures are put next to each other without a decision.",
    ),
    (
        "The undertone",
        "Warm, cool or neutral — what the colour does beside its neighbours. Two greys can "
        "carry the same lightness and behave completely differently; the undertone is the "
        "difference.",
    ),
    (
        "The LRV",
        "Light reflectance value, 0 to 100. The higher the number, the more light the surface "
        "gives back. Below 30 a room needs more light than it did before; above 75 the wall "
        "starts to work as a reflector. Ours is estimated from the digital value, not "
        "measured from a dried film — treat it as a guide, and read it with a squint.",
    ),
]

HONESTY_TITLE = "What this book cannot do"

HONESTY = (
    "A printer cannot reproduce a paint film, and neither can a screen. Colour depends on "
    "lighting, the substrate, the finish and the way it was applied — the same colour on "
    "ceiling plaster and on a rendered wall is two different experiences. Everything here "
    "is a printed approximation of a digital value. Confirm every choice against a "
    "physical chip or a sample pot before you buy paint. LRV figures are calculated from "
    "the digital value; they are not spectrophotometer readings of dried film."
)

# --------------------------------------------------------------------------- chapters
#
# Keyed by the exact `family` string in app/src/data/colors.ts. The lead colour and
# the range strip are read from the data, not written here.

CHAPTERS = {
    "White & Off-White": dict(
        name="Light, with an opinion",
        subtitle="Seven whites, no two the same temperature",
        body=(
            "A white is never neutral: every one carries a temperature, and that "
            "temperature decides whether a room reads warm or clinical. Ranging from a "
            "clean, cool white that holds its own beside steel and tile to an ivory warmed "
            "by late sun, these are the colours that do the quiet structural work of a "
            "house — ceilings, cornices, and the rooms you will repaint last."
        ),
        areas=[
            "Ceilings and cornices",
            "A whole-house base",
            "Kitchens and bathrooms",
            "Trim against stronger colour",
        ],
        craft=(
            "Take the ceiling one step lighter than the wall. The same white on both reads "
            "flat; two whites read as depth."
        ),
        pairs="Warm Neutral",
    ),
    "Warm Neutral": dict(
        name="The quiet ground",
        subtitle="Sand, clay and taupe, a step lighter than you think",
        body=(
            "Neutrals do the hardest job in a house: they let the furniture, the art and "
            "the people be the subject. In this light the mistake is almost always the "
            "same — a neutral chosen to match the floor exactly, which leaves the room "
            "looking unfinished. Ours are pitched a step lighter, so they carry the "
            "daylight without turning grey."
        ),
        areas=[
            "Living rooms and bedrooms",
            "Exterior render",
            "Hallways and stairwells",
            "Bands and dado rails",
        ],
        craft=(
            "Never match the floor. Move a step lighter or darker than the timber and the "
            "room separates itself."
        ),
        pairs="Green",
    ),
    "Grey": dict(
        name="Structure without drama",
        subtitle="The family that makes other colours look deliberate",
        body=(
            "Grey is the most useful colour in this book and the easiest to get wrong. "
            "Warm greys sit comfortably beside clay and timber; cool greys give a room "
            "precision but turn muddy next to a warm neutral. On joinery, piers and doors, "
            "grey is what makes a coloured wall look chosen rather than accidental."
        ),
        areas=[
            "Joinery, doors and frames",
            "Exterior piers and plinths",
            "Studies and home offices",
            "A quiet feature wall",
        ],
        craft=(
            "Test a grey against the colour it will sit beside, never on its own. A cool "
            "grey next to a warm neutral drags both towards green."
        ),
        pairs="Blue",
    ),
    "Green": dict(
        name="The borrowed landscape",
        subtitle="Eight greens that behave like neutrals",
        body=(
            "A well-chosen green brings the garden inside without asking permission, and in "
            "a climate this green that is a real advantage. These run from a deep forest "
            "that holds a library together to a misted eucalyptus for rooms that never get "
            "direct sun. Green is also the most forgiving family under artificial light: it "
            "rarely shifts."
        ),
        areas=[
            "Lower walls and dados",
            "Studies and libraries",
            "Garden rooms and verandas",
            "Exterior metalwork and gates",
        ],
        craft=(
            "Green reads darker on four walls than it does as a chip. On a north-facing "
            "wall, take one step lighter than the sample suggests."
        ),
        pairs="Warm Neutral",
    ),
    "Blue": dict(
        name="Cool that behaves",
        subtitle="From a lagoon at noon to a midnight",
        body=(
            "Blue is the family most affected by the light it lives in. A deep blue reads "
            "almost black by lamplight and opens up completely in daylight, which makes it "
            "the most dramatic choice here — and the one that rewards a proper primer. The "
            "pale end is calmer: powder and harmattan sky keep a hot room from feeling "
            "hotter."
        ),
        areas=[
            "A dramatic feature wall",
            "Bedrooms",
            "Exterior fences and boundary walls",
            "Bathrooms and wet rooms",
        ],
        craft=(
            "A deep blue over a light wall is three coats, not two. Tint the primer towards "
            "the topcoat and the third coat becomes optional."
        ),
        pairs="White & Off-White",
    ),
    "Purple & Mauve": dict(
        name="The colour that changes its mind",
        subtitle="Lilac, plum and the shades between",
        body=(
            "Purple is the family that surprises people, and it is worth knowing why: mauve "
            "and lilac carry so little colour of their own that whatever sits underneath "
            "shows through. Over a warm white primer a lilac drifts peach; over a grey one "
            "it goes cool. Prime the whole wall, not just the patches, and what you chose is "
            "what you get."
        ),
        areas=[
            "Bedrooms",
            "Alcoves and reveals",
            "Lounges",
            "Children's rooms",
        ],
        craft=(
            "Prime the entire wall in one tint. Patch-priming is why two rooms painted the "
            "same colour come out different."
        ),
        pairs="Grey",
    ),
    "Terracotta & Red": dict(
        name="Warmth with weight",
        subtitle="Brick, clay and the strongest accent in the book",
        body=(
            "Red advances. On a wall it shortens the distance between you and the surface, "
            "which is why it works so well in a dining room and so badly down a narrow "
            "corridor. The terracotta end is the practical half of the family: warm, earthy, "
            "and forgiving of the dust and sun that anything exterior will meet."
        ),
        areas=[
            "Feature and dining walls",
            "Exterior plinths and boundary walls",
            "Gates and ironwork",
            "Alcoves and reveals",
        ],
        craft=(
            "Reds show a lap mark more than any other colour. Keep a wet edge, roll in one "
            "direction, and never stop in the middle of a wall."
        ),
        pairs="Warm Neutral",
    ),
    "Yellow & Ochre": dict(
        name="Light you can paint",
        subtitle="The only family that adds daylight to a room",
        body=(
            "Yellow lifts a space without a window, which makes it useful in corridors, "
            "stairwells and kitchens that face away from the sun. It is also the least "
            "forgiving family on a poor surface: colour this saturated shows every ripple in "
            "the plaster, so fill, sand and prime before committing a whole wall to it."
        ),
        areas=[
            "Kitchens",
            "Corridors and stairwells",
            "Exterior accents and trim",
            "Ceilings in dark rooms",
        ],
        craft=(
            "Inspect the wall under a raking light before you paint. If you can see it "
            "unlit, yellow will show it twice."
        ),
        pairs="White & Off-White",
    ),
    "Deep & Architectural": dict(
        name="Rooms that hold you",
        subtitle="Colours that shrink a space, on purpose",
        body=(
            "The deepest colours here are not for every room, but nothing else does what "
            "they do: a dark room, painted properly, feels deliberate and quiet rather than "
            "small. On doors, frames and joinery against a pale wall they cost almost "
            "nothing and change everything. Deep colour is judged by its edges, so the "
            "preparation matters more than the coat."
        ),
        areas=[
            "Feature walls and studies",
            "Doors, frames and joinery",
            "Exterior joinery",
            "Ceilings in tall rooms",
        ],
        craft=(
            "Brush the last coat on a textured wall rather than rolling it: a roller leaves "
            "a stipple you will see in every raking light."
        ),
        pairs="White & Off-White",
    ),
}

# --------------------------------------------------------------------------- sections

PALETTE_TITLE = "Palettes that already work"
PALETTE_INTRO = (
    "Eight colour stories, each with a role for every wall. Nothing here was generated "
    "by an algorithm: a palette is an editorial decision about what belongs next to what, "
    "and each one names the job each colour does."
)

LIGHT_TITLE = "One colour, four lights"
LIGHT_INTRO = (
    "The same wall, from a rainy morning to a lamp at ten at night. The paint does not "
    "change; the light does, and with it the temperature you read. This is why a colour "
    "chosen at noon can feel wrong at dinner — and why the largest surfaces in a room "
    "deserve a colour you have seen at your worst hour of light, not your best."
)
LIGHT_STOPS = [
    ("Rain, 7am", 0.80, "Cool and flat. Everything loses saturation."),
    ("Harmattan noon", 1.00, "The reference. Judge the swatch here."),
    ("Late afternoon", 1.16, "Warmth arrives; undertone becomes visible."),
    ("Lamp, 9pm", 0.62, "Deepens fast. Pale colours warm, deep colours close."),
]

PROJECT_TITLE = "On the wall"
PROJECT_INTRO = (
    "Three jobs on this page, and the palette specified for each. Every photograph is a "
    "site we painted; the colours listed under a caption are the ones the job record "
    "specifies, which is a narrower claim than the one the picture makes."
)

SPEC_TITLE = "Specification"
SPEC_INTRO = (
    "How much paint, which system, and in what order. Figures are per litre of a single "
    "coat on a sound, sealed surface; a porous or unpainted wall will always take more. "
    "Your dealer can turn a wall area into a pack list."
)

ORDER_TITLE = "Where to start"

ORDER_STEPS = [
    (
        "01",
        "Choose a family",
        "Start with the chapter that matches the room's job, not with a colour you liked "
        "somewhere else. Every family chapter lists the rooms it suits.",
    ),
    (
        "02",
        "Take a sample pot",
        "Paint a 500 mm square on the actual wall — two coats, right to the edge — and "
        "live with it for a day. Look at it at night with the lamps on.",
    ),
    (
        "03",
        "Quote the code",
        "OP-401, not \"the terracotta one\". The code is what the mixing system, the dealer "
        "and this book all agree on.",
    ),
    (
        "04",
        "Size the job",
        "Measure the wall area, subtract the openings, and take the coverage figure from "
        "the specification page. Two coats, every time.",
    ),
]

ORDER_CLOSE = (
    "The colour on the wall is the last decision, not the first. Get the family right and "
    "the rest is arithmetic."
)

BACK_LINE = "Masters of the surface."
BACK_TAIL = "Colour mixed in Port Harcourt. Dealers nationwide."
