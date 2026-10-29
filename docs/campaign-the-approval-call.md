# OPUDA’S PAINT — THE NIGERIAN VIRAL CAMPAIGN MASTER SCRIPT
## *The Approval Call — Full Creative, Production & Conversion Blueprint*

**Tagline:** *Colour, made in Nigeria.*  
**Primary Deliverable:** `opudas-approval-call-ad.mp4` (45-second vertical 9:16 master video)  
**Supporting Creatives:**
- `opudas-which-one-15s.mp4` (15s Organic Engagement / Comment Driver)
- `opudas-stopped-guessing-30s.mp4` (30s UGC Conversion Video)
- `campaign-viewer.html` / `/campaign.html` (Interactive Web Hub & Video Player)

---

## 1. Executive Summary & Strategy

In Nigeria, building a home represents years of work, family investment, and significant financial sacrifice. Often, the person funding the construction (e.g. spouse, diaspora family member in London or the US) is not physically on site, leading to disagreements about paint choices. Paint colour is high-stakes: once applied across an entire house or fence, repainting incurs double labour, waste of materials, and delays.

Opuda’s Paint enters this dynamic with a practical, empowering solution: **test 59 colours on your actual room walls before buying a single bucket using the Room Preview tool**.

### Core Jobs of the Campaign
1. **The Approval Call (45s):** Flagship narrative driving organic reach, emotional relatability, and brand recall.
2. **Which One? (15s):** High-velocity comment engine for Instagram & TikTok algorithms.
3. **I Stopped Guessing (30s):** UGC conversion ad targeting active builders and renovators.
4. **WhatsApp Conversion (0902 642 4350):** Frictionless path to sales and custom colour consultations.

---

## 2. Timed Shot-by-Shot Script (`The Approval Call`)

- **0:00–0:03 (Scene 1: The Hook):** WhatsApp video call connects between London and Port Harcourt.
  - *Text:* `MY HUSBAND IS IN LONDON. THE HOUSE IS IN PORT HARCOURT. AND HE HAS OPINIONS.`
  - *Dialogue:* Woman: *"Daddy, I dey the site oh."*
- **0:03–0:08 (Scene 2: The Family Argument):** Unfinished site with Opuda's Matt paint bucket.
  - *Text:* `EVERY FAMILY HAS THIS ARGUMENT.`
  - *Dialogue:* Father insists on plain cream; Woman challenges: *"Daddy, everybody house na cream?"*
- **0:08–0:10 (Scene 3: The Money Fear):** Weathered faded wall & rain cue.
  - *Text:* `RAIN. SUN. ONE WRONG COLOUR.`
  - *Dialogue:* Father: *"I no wan make we spend this money twice. You know how much enter this building."*
- **0:10–0:17 (Scene 4: The Discovery):** Room Preview demonstration on smartphone.
  - *Text:* `59 COLOURS. YOUR WALL. BEFORE YOU BUY.`
  - *Visual:* Instant wall transformation to Lilac Room OP-605, Bonny Haze OP-136, and Palm Shadow OP-209.
- **0:17–0:22 (Scene 5: The Objection & Guarantee):** Hero shots of Opuda's Matt & Silk buckets.
  - *Text:* `MADE IN PORT HARCOURT. 5-YEAR GUARANTEE ON MATT & SILK.*`
  - *Note:* Subject to written guarantee terms. Applies to Matt and Silk only.
- **0:22–0:25 (Scene 6: The Decision):** The lilac colour is approved.
  - *Text:* `COLOUR APPROVED! OP-605 LILAC ROOM. DON'T GUESS YOUR COLOUR. SEE IT FIRST.`
- **0:25–0:32 (Scene 7: The Reveal):** Beat drop with energetic Afrobeat groove across 4 verified projects:
  - The Arched Villa (GRA Phase 2)
  - The Lilac Lounge (GRA Phase 2)
  - The Blue Boundary Wall (Rumuola)
  - The Creek-Facing Facade & Portico (Woji)
- **0:32–0:38 (Scene 8: The Share Trigger):** Golden hour shot of the finished residence with ornate black & gold gate.
  - *Dialogue:* Neighbour: *"Eh! Who painted your house?"* — Woman: *"Opuda’s. Go try your colour first. Free."*
- **0:38–0:45 (Scene 9: The Call to Action):** Branded end card with hero product buckets.
  - *Text:* `TRY YOUR COLOUR FREE • opudapaint.com • WHATSAPP: 0902 642 4350`
  - *Audio:* Official voiceover and final WhatsApp chime.

---

## 3. Tooling & Reproduction

All video production tools are written in Python leveraging PIL, NumPy, and FFmpeg:
- `tools/generate_ad_audio.py`: Speech synthesis and Afrobeat audio mix.
- `tools/render_all_ads.py`: Master renderer for the 45s flagship ad.
- `tools/render_supporting_ads.py`: Renderer for the 15s "Which One?" ad.
- `tools/render_ugc_30s.py`: Renderer for the 30s UGC conversion ad.
