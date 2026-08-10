# The Trapasso / Paul–Elder Reasoning Model

Extracted from `references/trapasso/Migration_v2_Framework.pdf`. This is the
**conceptual model** the product is built on. The raw PDF is the source of truth;
this is the working summary.

> **Correction (2026-08-10):** this file used to call the model "House of
> Reason" in its title and origin section. That name is not real — it does
> not appear in Trapasso's actual material. It was hallucinated by an
> earlier migration tool (Lovable) during an early pass over the source PDF,
> written into this file as if it were fact, and then cited from here by
> decisions/001, context/index.md, context/vision/product-strategy.md, and
> eventually a pre-login marketing rewrite — until the product owner caught
> it. The model and the product both go by "Houses of Thought," full stop.
> The 12-layer structure below is a separate claim from the naming and
> hasn't been independently re-verified against the source PDF since this
> was caught; per the pre-login redesign brief, don't use it as a copy
> source without checking it against what's actually implemented
> (`lib/build/content.ts`, `lib/ai/reasoning/steps.ts`).

## Origin

John Trapasso's classroom model, derived from the Paul–Elder framework for
critical thinking. Adapted into the Houses of Thought product by Samir Sogani.

## The 12 layers (foundation → roof)

A "house" is built bottom-up. Each layer depends on the ones below it.

### Foundation

1. **Concepts** — the key ideas and terms that frame the topic. Define before
   reasoning so everyone shares the same vocabulary.
2. **Purpose** — why you're reasoning about this. Clarifies intent and scope.
3. **Overarching Question** — the single central question the house answers.

### Structure

4. **Sub-Questions** — the overarching question decomposed into smaller, answerable
   parts. These become the skeleton of the reasoning.
5. **Points of View** — multiple perspectives on the question. Three lenses:
   - **Self** — your own position and biases.
   - **Group** — stakeholders, communities, affected parties.
   - **Ideas** — intellectual traditions, frameworks, schools of thought.
6. **Personal Foundational POV** — a persistent, cross-house record of the user's
   own evolving worldview, values, and biases. Surfaces blind spots.

### Evidence

7. **Information / Facts** — the evidence gathered to answer sub-questions.
   Research Mode cites real sources (anti-hallucination).
8. **Assumptions** — beliefs taken as true without direct evidence. Includes
   **Unknown Unknowns** — what you might not even know to question.

### Reasoning

9. **Logical Inference** — the step from evidence + assumptions to conclusions.
   Where logical fallacies are identified and challenged.
10. **Sub-Conclusions** — answers to each sub-question, grounded in inference.

### Conclusion

11. **Overarching Conclusion** — the synthesized answer to the central question,
    built from sub-conclusions. Accompanied by a **House Strength** score:
    - **Evidence** (0–100) — how well-grounded in cited sources.
    - **Logic** (0–100) — how sound the inferential chain.
    - **Coverage** (0–100) — how many perspectives and sub-questions addressed.
12. **Implications vs. Consequences** — what follows from the conclusion. Sorted
    into **Positive / Negative / Uncertain**. Distinguishes intended implications
    from unintended consequences.

### Meta

- **Iterative Thinking** — the model is not linear. New evidence or a failed Stress
  Test sends you back to revise earlier layers. The house is never "finished" —
  it's the best current structure.
- **Stress Test** — adversarial challenge: the AI (or another user) attacks the
  weakest layer. If the house survives, the reasoning is defensible.

## How the product maps to the model

- The **Collab builder** (AI Workspace + House Workspace) is where houses are
  built, one layer at a time.
- **Research Mode** powers layer 7 (cited evidence).
- **Logic Strength** is the quantified score at layer 11.
- **Stress Test** is the adversarial pass after layer 12.
- **Student mode** restricts the AI so students build layers themselves.
- **Classrooms** let teachers assign questions and review student houses.
