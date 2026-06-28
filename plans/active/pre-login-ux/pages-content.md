# Pages — Content & Legal

Lower-traffic but necessary pages: **Framework, FAQ, Our Story, Contact, Legal.**
Grouped because each is light; all reuse the shell, SectionHeader, and CTASection.

---

## The Framework (`/framework`)

**Goal:** depth + credibility + SEO for the method. The exhaustive companion to the
approachable `/how-it-works`.

- **Layout:** long-form editorial with a **sticky table of contents** `≥lg`
  (jump-links to each layer). Reading column ≤68ch.
- **Content:** the full Trapasso / Paul–Elder model — Concepts, Purpose, Overarching
  Question, Sub-Questions, Points of View (+ Personal Foundational POV), Information/
  Facts, Assumptions (incl. Unknown Unknowns), Logical Inference, Sub-Conclusions,
  Overarching Conclusion, Implications vs. Consequences, Iterative Thinking. One
  concise block per layer with a small inline diagram highlight.
- **Attribution:** "Based on John Trapasso's House of Reason, derived from the
  Paul–Elder framework for critical thinking."
- **Tradeoff — one long page vs. many sub-pages:** one page is better for SEO and
  linear reading and is easy to ToC-navigate; if it grows past ~200 lines of copy,
  split per the constitution. CTA at end: `Try it free`.
- **Responsive:** ToC → top accordion `<lg`.

## FAQ (`/faq`)

- **Layout:** sectioned `Accordion`s mirroring the existing groups: **The basics ·
  How it works · AI & accuracy · Classrooms & teachers · Pricing & account.**
- **Content rule:** remove obsolete answers (Draft Full House); ensure "What AI does
  / doesn't," "How we prevent hallucinated sources," "Is my work private," and the
  account-type explanation are present and match the product. Pricing reflects
  "free to start."
- **A11y:** answers rendered in DOM (SSR) even when collapsed; `aria-expanded`;
  keyboard operable. Ends with a "Still curious? Build one." `CTASection`.
- **Tradeoff — accordion vs. full text:** accordion keeps a long FAQ scannable; cost
  is hidden content → SSR + anchor links by question.

## Our Story (`/story`)

- **Layout:** editorial narrative, generous `Quote` pull-quotes, a numbered
  "chapters" rhythm (e.g. `01 THE SPARK`). Single reading column.
- **Content:** the authentic origin — a student watching smart people make messy
  decisions; structure, not intelligence, was missing; a teacher (Trapasso) shared
  the framework. Reinforces "not built by a company."
- **Purpose:** trust + humanity (counters "just another AI wrapper"). CTA: `Build
  your first house.`

## Contact (`/contact`)

- **Layout:** two-column `≥lg` — left `Field` form (Name, Email, User Type,
  Subject, Message, Send), right info cards (Direct email, Reporting bugs, Feature
  requests). Stacked `<lg`.
- **Behavior:** client validation, success/error states, spam honeypot. Submit
  target TBD (form service or app endpoint).
- **A11y:** labeled fields, error summary, focus management on submit result.

## Legal — Terms (`/terms`) & Privacy (`/privacy`)

- **Layout:** clean single-column legal template — title, "Last updated", numbered
  sections, `Back to Dashboard`/home link, ToC `≥lg` optional.
- **Content:** render the current Terms and Privacy copy (source PDFs in
  `references/legal/`). **Must be reviewed** against the final product (esp. the
  education push: 12+ age floor, student data, third-party infra). Keep the
  canonical brand name; drop "also known as House of Reason" or reduce to a note.
- **Tradeoff — styling legal pages:** keep them visually quiet (no marketing
  flourish) for scannability and seriousness; just inherit type + spacing tokens.

---

## Shared notes
- Every page: SheetStrip + Header + BlueprintFooter, and exactly one `CTASection`
  before the footer (except Legal, which uses a quiet inline link).
- All reuse tokens/components; no page invents new visual primitives.
