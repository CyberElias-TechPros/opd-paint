"""
The words in the room-scheme book.

This book is the second volume of the colour library: the first one is organised
by colour, this one by the *job* the colour has to do. Four methods, each with
colourways rendered onto the company's own site photographs.

Rules, deliberately stricter than a commercial brochure's:

* The renders are described as colourways throughout. Nowhere does the book
  suggest a photograph shows a finished, styled, photographed room that a
  customer could walk into — because it does not. It shows one real wall in
  different paint, which is a smaller and more useful claim.
* No styled props are invented. There are no "accessories to complete the look"
  pages, because OPUDA'S has not photographed a styled set and this book will not
  pretend a stock image is one.
* No price, no guarantee, no dealer, no testimonial. All of that lives in data
  with a provenance flag.
* The method advice is craft a painter would recognise: a primer's job is to stop
  the substrate deciding the colour; contrast is chosen, not discovered.
"""

BRAND = "OPUDA'S PAINT"
CITY = "Port Harcourt"
EDITION = "2026"

VOLUMES = [
    ("Colour Book", "the library, indexed by colour — nine families, 59 colours, 8 palettes"),
    ("Room Book", "the library, indexed by the job the colour has to do"),
]

COVER_LINE = (
    "Four methods, sixteen colourways, and the two rooms this company has actually\n"
    "painted. The same walls, in different paint."
)

# --------------------------------------------------------------------------- essay

ESSAY_TITLE = "A colour is not a scheme"

ESSAY = [
    "A colour on a chip is a decision about paint. A scheme is a decision about a "
    "room: which surface carries the colour, which surface stays quiet, and where "
    "the light lands. The same pot of Atlantic Blue is a calm bedroom wall or an "
    "overwhelming one depending entirely on the two metres next to it.",
    "So this book is organised by job rather than by colour. A method is a problem "
    "that shows up in almost every job we quote — the surface you cannot afford to "
    "paint twice, the cheap face, the room that is too dark, the detail that decides "
    "the whole elevation — and each one is shown on a wall we have actually painted.",
    "Every plate in the book is a real photograph from one of our sites, with the "
    "wall repainted. That is the honest version of a rendered room: the geometry, the "
    "light, the sockets and the unfinished edges are real, and the paint is the only "
    "thing that is a simulation. Where the simulation is approximations — and it is — "
    "the page says so.",
]

ESSAY_PULL = "Choose the surfaces, not the colours. The colours are the easy part."

# --------------------------------------------------------------------------- how to read

HOW_TITLE = "How to read this book"

HOW_INTRO = (
    "Each method opens with the problem and what it costs to get wrong, then shows "
    "colourways on one of our own jobs. Every plate carries the same three things."
)

HOW_FIELDS = [
    (
        "The plate",
        "A real photograph from an OPUDA'S site, with a wall repainted in the colour "
        "listed beneath it. Nothing else in the picture has been altered — not the "
        "furniture, not the sky, not the unfinished floor.",
    ),
    (
        "The colourway",
        "Three or four colours with a role each. A scheme is not a set of colours; it is "
        "an order, and the role line tells you which surface each one is for.",
    ),
    (
        "The LRV",
        "Light reflectance value, 0–100, estimated from the digital value. It is how much "
        "of the light in the room the surface gives back. Choose the darkest plane in the "
        "room last, and check its number before you commit.",
    ),
]

HONESTY_TITLE = "What a rendered plate is not"

HONESTY = (
    "A repainted photograph is a simulation of a paint film on a wall, and the "
    "simulation has limits: it cannot model the sheen of a finish at a grazing angle, "
    "the way an emulsion covers a patch, or the colour of the light at eight in the "
    "evening. It is a better decision aid than a chip and a worse record than a "
    "sample pot. Paint a 500 mm square on the actual wall, look at it at night, and "
    "then order."
)

# --------------------------------------------------------------------------- methods
#
# `plate` is a key in roombook-plates.json. `schemes` are colourways: hexes are
# looked up by id in colors.ts, and a scheme may not reference an id that is not
# in the library — the build fails rather than printing an orphan name.

METHODS = [
    dict(
        key="aperture",
        number="01",
        name="Aperture",
        headline="The colour behind the light",
        subtitle="Two wall colours, one room, and the difference each one makes",
        problem=(
            "Almost every room we are asked to look at has one wall the light actually "
            "comes from. Paint it the same as the others and the room goes flat; paint it "
            "the darkest colour you like and the room turns into a tunnel. The wall around "
            "the opening is the one surface whose colour you will see most often and judge "
            "most quickly — from the doorway, from the corridor, in the two seconds before "
            "anyone walks in."
        ),
        principle=(
            "Give the opening wall the second-deepest colour in the scheme, never the "
            "deepest. The deepest belongs on the feature plane the light does not touch."
        ),
        plate="bedroom",
        schemes=[
            dict(name="Evening Room", note="Atlantic on the wall beside the opening; the reveal stays pale",
                 colors=[("atlantic-blue", "Wall beside the opening")], pair=["coconut-milk"]),
            dict(name="Clay Room", note="Terracotta warms the corridor before anyone walks in",
                 colors=[("terracotta", "Wall beside the opening")], pair=["limestone"]),
            dict(name="Moss Room", note="A green that reads as a neutral from the doorway",
                 colors=[("moss-room", "Wall beside the opening")], pair=["bone"]),
        ],
    ),
    dict(
        key="substrate",
        number="02",
        name="Substrate",
        headline="When the surface is the problem",
        subtitle="Skim, prime, or paint — decided before the colour is chosen",
        problem=(
            "Plaster varies. A wall that has been skimmed twice takes colour differently "
            "from a wall built of block and rendered in one pass, and a wall that has been "
            "patched takes it differently again — the patches pull at the paint and show "
            "through a pale colour as a ghost you cannot unsee. No amount of quality in the "
            "topcoat fixes a substrate that was not sealed."
        ),
        principle=(
            "Decide the system before the colour: one coat of alkali-resisting primer over "
            "the whole wall, not just the repairs. A tinted primer also removes the third "
            "coat that a deep colour would otherwise need."
        ),
        plate="living",
        schemes=[
            dict(name="Sealed and Pale", note="Bone over one full priming coat; no patch shows through",
                 colors=[("bone", "Feature wall")], pair=["limestone"]),
            dict(name="Sealed and Deep", note="Aubergine after a tinted primer, so two coats finish it",
                 colors=[("aubergine", "Feature wall")], pair=["coconut-milk"]),
            dict(name="Sealed and Warm", note="Ochre on a wall that was skimmed in two passes",
                 colors=[("ochre", "Feature wall")], pair=["stone-white"]),
        ],
    ),
    dict(
        key="threshold",
        number="03",
        name="Threshold",
        headline="The surface a street judges first",
        subtitle="Boundary walls, plinths and the band that separates them",
        problem=(
            "A boundary wall is the largest painted surface most of our customers own and "
            "the one nobody thinks about until it is wrong. It has to work in flat light and "
            "in sun, from twenty metres and from the pavement, next to brick or stone that "
            "will not be repainted. Get the band wrong and the whole elevation looks like an "
            "afterthought; get it right and it reads as architecture."
        ),
        principle=(
            "Two surfaces, two values. Keep the panel pale enough to throw the brick forward, "
            "and take the plinth band a full step darker than the panel so the wall stops "
            "looking like it is floating."
        ),
        plate="boundary",
        schemes=[
            dict(name="Pale Ground", note="White panel, brick plinth, nothing else",
                 colors=[("opuda-white", "Wall panels"), ("terracotta", "Plinth band")]),
            dict(name="Harmattan Band", note="Sand panel with a deeper clay line",
                 colors=[("savannah-sand", "Wall panels"), ("brick-lane", "Plinth band")]),
            dict(name="Delta Shadow", note="A pale grey panel against red brick",
                 colors=[("bonny-haze", "Wall panels"), ("rust-ember", "Plinth band")]),
        ],
    ),
    dict(
        key="depth",
        number="04",
        name="Depth",
        headline="Contrast is chosen, not discovered",
        subtitle="Ironwork, frames and the dark line that holds a facade together",
        problem=(
            "The darkest surface on a building is usually a decision made by default — the "
            "gate is black because gates are black. But the dark line is what the eye reads "
            "as structure: it is the difference between a fence that belongs to a wall and a "
            "fence that was installed next to one. On ironwork it also decides how loudly the "
            "metalwork announces itself from the road."
        ),
        principle=(
            "One dark accent, used consistently, and never two darks at different "
            "temperatures. If the gate is charcoal, the railings are charcoal; a warm brown "
            "gate beside a cold grey railing looks like a mistake because it is one."
        ),
        plate="gate",
        schemes=[
            dict(name="Charcoal Line", note="One black, everywhere, including the railings",
                 colors=[("window-black", "Ironwork")], pair=["indigo-night"]),
            dict(name="Atlantic Iron", note="A cool blue-black reads softer from the road",
                 colors=[("indigo-night", "Ironwork")], pair=["graphite"]),
            dict(name="Deep Green", note="A green-dark that ties the gate to a garden",
                 colors=[("opuda-green", "Ironwork")], pair=["charcoal-wall"]),
        ],
    ),
]

# --------------------------------------------------------------------------- collections

COLLECTION_TITLE = "Four collections, four arguments"

COLLECTION_INTRO = (
    "The library is grouped into collections. They are not seasons and they are not "
    "trend forecasts: each one is a position on how colour should behave in Nigerian "
    "light, and each is a starting point rather than a rule."
)

COLLECTIONS = [
    (
        "The Signature",
        "The house range. Neutrals and deeps that will not date, specified on more of our "
        "jobs than everything else combined — which is also why they are the ones we can "
        "speak about with the most confidence.",
    ),
    (
        "The Delta Edit",
        "Colours taken from finished jobs around Port Harcourt: a lilac lounge in GRA, a "
        "turquoise boundary wall in Rumuola. Every one of them has been mixed for a real "
        "customer and seen on a real wall.",
    ),
    (
        "Harmattan",
        "Dust-warm. December light is flatter and cooler than the rest of the year, and "
        "these are the colours that hold their temperature in it — sand, clay, ochre, and "
        "the reds that read warm without going hot.",
    ),
    (
        "Rain Season",
        "Greens and cool neutrals for the months when the light never gets above grey. In "
        "a rainy-season room a green is effectively a neutral; these are the ones that stay "
        "green instead of going grey.",
    ),
]

ROOM_MATRIX_TITLE = "Which surface takes which method"

ROOM_MATRIX_INTRO = (
    "The four methods are not rooms; they are surfaces. A job usually needs two or three "
    "of them at once, and the order below is the order they should be decided in."
)

ROOM_MATRIX = [
    ("Aperture", "Doorway walls, reveals, corridor ends, any wall with an opening in it"),
    ("Substrate", "Skimmed plaster, patched walls, block and render, ceilings"),
    ("Threshold", "Boundary walls, plinths, gatehouses, retaining walls"),
    ("Depth", "Ironwork, frames, doors, shutters, the plinth of a facade"),
]

ORDER_TITLE = "The order to decide in"

ORDER_STEPS = [
    ("01", "Surface, then colour",
     "Decide what is being painted and how it will be sealed before choosing anything. "
     "A colour chosen before the substrate is a colour chosen twice."),
    ("02", "One plane at a time",
     "Write the scheme down as surfaces with roles — feature, main, ceiling, trim — not as "
     "a list of colours. A scheme with no roles is a palette, and a palette is not a plan."),
    ("03", "Check the darkest number",
     "The deepest colour in the scheme sets how much light the room gives back. If its LRV "
     "is under 20, plan the lighting before you plan the paint."),
    ("04", "Sample on the wall",
     "Two coats on a 500 mm square, right to the edge, and live with it for a day. Every "
     "plate in this book is a simulation; the wall is not."),
]

ORDER_CLOSE = (
    "The paint is the last decision. The surfaces are the first, and they are the ones "
    "that cannot be changed without sanding."
)

BACK_LINE = "Masters of the surface."
