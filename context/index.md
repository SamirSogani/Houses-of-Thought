# Context Index

Entry point into the project's **stable knowledge**. This file does not summarize
the project — it explains what each section holds so you can open only what you need.

Read only the specific document a task requires. Do not load a whole section by
default. See [docs/repository/navigation.md](../docs/repository/navigation.md).

---

## `vision/`

The **why** and the **for whom**. Purpose, audience, problem being solved, product
principles, and long-term direction. Documents here change rarely and set the frame
for everything else.

- [product-strategy.md](vision/product-strategy.md) — target audience, positioning,
  feature status, conversion model, brand decisions.

## `framework/`

The **reasoning method** the product is built on — the Houses of Thought model and
its concepts, layers, and terminology. Stable conceptual knowledge of how the method
works. (Raw source material for the method lives in `references/trapasso/`.)

- [trapasso-model.md](framework/trapasso-model.md) — the 12-layer version of
  Trapasso's model, how each layer maps to product features. (Its own header
  carries a correction note: an earlier version of this file called the
  model "House of Reason," which is not a real name — see decisions/001 §10.)

## `features/`

The **what** — knowledge about individual product features: what each does, how it
behaves, and how it connects to the framework. One focused document per feature as
they stabilize. Design mockups and raw inputs stay in `references/ux/`.

- [chatbot-vs-house.md](features/chatbot-vs-house.md) — the core differentiator:
  why a transparent layered house beats an opaque chatbot answer.

## `architecture/`

How the **system is structured** at a conceptual level: major components, data flow,
and key technical boundaries. Records the shape of the system and the reasoning
behind it — not implementation detail, which lives in code.

- [tech-stack.md](architecture/tech-stack.md) — React/Next.js + Supabase, env var
  config, key architectural boundaries.

---

## What does NOT go here

- Transient plans → `plans/`
- Decision records → `decisions/`
- Raw source material (PDFs, mockups, research) → `references/`

Add a document to a section only when knowledge is settled enough to be durable.
Keep each document focused and under ~150 lines.
