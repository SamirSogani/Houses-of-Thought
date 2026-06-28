# Page — Homepage (`/`)

**Goal:** in one screen, make a skeptic understand "this is reasoning, not a
chatbot answer," and get them to **Try it free**. Secondary goal: route educators
to `/educators`.

**Primary CTA:** Try it free. **Secondary:** Create account · For educators.

Sections top→bottom. Each: purpose, layout, content, responsive, motion, tradeoff.

---

## 1. Hero — "Build the reasoning, not just the answer"
- **Layout (`≥lg`):** asymmetric two-column. Left: Eyebrow (`SHEET 01 / HOME`),
  serif Display XL headline, one-line subhead, `Try it free` + `Read how it works`.
  Right: **HouseDiagram (animated)** drawing itself foundation→roof.
- **Mobile:** headline → diagram (capped height) → CTAs.
- **Content:** Headline *"Build the reasoning, not just the answer."* Sub: *"For
  hard decisions and arguments that deserve more than a chat reply. Houses of
  Thought turns a question into structured, defensible reasoning — with AI that
  guides instead of deciding."*
- **Motion:** house draws in (900ms) on load; reduced-motion → final state.
- **Tradeoff — animated house vs. static screenshot:** the animation *is* the
  pitch (reasoning builds up from evidence). Heavier to build; mitigated by SVG +
  reduced-motion fallback. Chosen.

## 2. The problem — chatbot vs. house
- **Layout:** centered SectionHeader + a two-card contrast: *"A chatbot hands you
  an answer"* (a flat verdict bubble) vs. *"A house shows the reasoning"* (mini
  structured house). Side by side `≥md`, stacked `sm`.
- **Copy:** short — "AI can sound certain and still be wrong. You can't see the
  assumptions, the evidence, or the perspectives it skipped — so you can't defend
  it, and you don't learn anything." 
- **Tradeoff — naming the competitor (chatbots):** sharpens differentiation and is
  the product's actual wedge; risk of sounding anti-AI → we're *pro*-AI-as-guide,
  copy makes that explicit.

## 3. The shift — what a House is
- **Layout:** full-width, interactive `HouseDiagram` (interactive mode). Tap/hover
  a layer → its name + one-line definition (Concepts, Question, Perspectives,
  Evidence, Assumptions, Conclusion, Implications).
- **Purpose:** teach the core idea visually in ~10 seconds. Progressive disclosure —
  no wall of 12 layers; the diagram invites exploration instead.
- **Tradeoff — interactive vs. annotated static:** interactivity rewards curiosity
  and proves the product feels alive; static is cheaper and simpler. Recommend
  interactive on `≥lg`, tap-reveal on touch, static fallback otherwise.

## 4. How it works — 3 steps
- **Layout:** three `StepCard`s (numbered mono), single row `≥lg`, stacked `sm`.
- **Content:**
  1. **Ask a question worth reasoning about.** Bring a decision, a topic, an essay.
  2. **Explore perspectives and evidence.** AI guides with questions and cites real
     sources (Research Mode) — it won't write your conclusion for you.
  3. **Reach a conclusion you can defend.** See a House Strength score across
     evidence, logic, and coverage; stress-test it.
- Ends with `Read how it works →` to `/how-it-works`.

## 5. Differentiator band — "AI that guides, not decides"
- **Layout:** dark band (`CTASection` styling, no CTA yet) with three `FeatureRow`
  mini-items: **Guided, not given** (Collab = reason *with* AI) · **Grounded in
  evidence** (cited sources, anti-hallucination) · **Stress-tested** (challenge
  your conclusion before reality does).
- **Note:** "Collab" framed as human+AI co-reasoning. No multi-user claims here.

## 6. Built for classrooms (educator band)
- **Layout:** two-column; left copy + `For educators →`, right a small visual of a
  teacher reviewing student houses / strength scores.
- **Copy:** "Teachers use Houses of Thought to make critical thinking visible — and
  gradeable. Students reason with structure; the AI assistant steps back so the
  thinking stays theirs."
- **Tradeoff — dedicating homepage real estate to educators:** reinforces the
  primary wedge and feeds `/educators`; cost is homepage length → keep to one tight
  band, depth lives on the dedicated page.

## 7. Real example teaser
- **Layout:** one `ExampleCard` enlarged — "Should AI be used in schools?" showing
  PerspectiveCards (Students/Teachers/Parents…) + StrengthMeter, linking to
  `/examples/:slug` and the gallery.
- **Purpose:** proof it produces something real and rich; discoverability into
  Examples. Uses the actual data shape from the product.

## 8. Credibility / origin
- **Layout:** editorial `Quote` + short text. "Built by a student, around a
  framework his teacher chose to share — John Trapasso's House of Reason, derived
  from the Paul–Elder model for critical thinking." Link `Our story →`.
- **Purpose:** trust via real lineage + human authenticity (counters "just another
  AI wrapper").

## 9. Final CTA
- **Layout:** dark `CTASection`. Headline *"Pick a question you can't crack."*
  Primary `Try it free`, secondary `Create free account`. Mono reassurance line:
  *"No sign-up to try — your work is saved locally until you create an account."*

## 10. Footer
`BlueprintFooter` (see navigation-and-flows.md).

---

## Page-level notes
- **Section rhythm:** alternate light/dark and text-left/right so it never reads as
  identical stacked slabs (anti-vibecoded).
- **Performance:** lazy-load below-fold diagrams; inline-critical the hero; the
  house SVG should be lightweight (paths, not raster).
- **One expressive moment** (the hero house) + restrained everything else.
- **A11y:** each section is a landmark with a heading; diagram has text equivalents;
  color never the sole signal in the strength teaser.
