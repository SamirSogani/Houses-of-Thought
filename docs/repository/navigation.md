# Repository Navigation

How Claude should move through this repository. The goal is to load the **minimum**
context needed to do the requested task well.

## Core rules

1. **Begin with the files the user specified.** Those are your starting context.
2. **Do not recursively explore** the repository. No tree-walking, no "just looking
   around" to build background.
3. **If more context seems necessary**, first identify the *exact* file(s) you need
   and explain *why* before reading them. Let the user confirm or redirect.
4. **Prefer concise documentation over raw material.** Read `context/` and `docs/`
   before reaching into `references/`.
5. **Treat PDFs as source material, not default working context.** Open a PDF only
   when a specific question genuinely requires it, never as background reading.

## Where to look (when you have permission to look)

- Repository conventions → [docs/repository/](.)
- Stable product knowledge → [context/](../../context/index.md)
- Past decisions → `decisions/`
- Current / planned work → `plans/active/`, `plans/backlog/`
- Raw source (PDFs, mockups, research) → `references/` (last resort)

## When in doubt

State what you know, name the single file you believe you need next, and ask
before opening it. Narrow and explicit beats broad and speculative.
