# Design Tokens

Concrete values. Hex/sizes are the recommended starting point — finalize against
the existing brand assets before launch. Rationale is in
[design-language.md](design-language.md).

## Color

| Token | Value | Use |
|---|---|---|
| `--ink-900` | `#14213A` | Primary text, dark section ground |
| `--ink-700` | `#2C3A57` | Headings on light, hovered dark |
| `--slate-500` | `#5A6B85` | Secondary text, mono labels |
| `--slate-300` | `#AEB8C7` | Hairlines, disabled |
| `--paper-50` | `#F7F6F2` | Page background (warm off-white) |
| `--paper-0` | `#FFFFFF` | Card/raised surfaces on paper |
| `--amber-500` | `#F2B021` | Primary action, active marks |
| `--amber-600` | `#D9990C` | Amber hover/pressed |
| `--blueprint-500` | `#3E5C8A` | Secondary/diagram accent (sparing) |
| `--success-500` | `#3F8F5B` | Strength: positive |
| `--warn-500` | `#C2682B` | Strength: negative/risk |
| `--uncertain-500` | `#8A7A3F` | Strength: uncertain |

Dark sections: ground `--ink-900`, text `--paper-50`, accent `--amber-500`.
Contrast: body text uses ink/slate on paper; **amber is for fills, marks, and
large/bold type only**, never small body text on paper.

## Typography

Stacks (with fallbacks):
- Display serif: `"Fraunces", "Newsreader", Georgia, serif`
- Body sans: `"Inter Tight", "Geist", system-ui, sans-serif`
- Mono label: `"Geist Mono", "IBM Plex Mono", ui-monospace, monospace`

Scale (desktop → mobile clamp where noted):

| Role | Font | Size | Weight | LH | Tracking |
|---|---|---|---|---|---|
| Display XL (hero) | serif | clamp 40→72px | 500 | 1.04 | -0.01em |
| Display L | serif | clamp 32→52px | 500 | 1.08 | -0.01em |
| Heading M | serif | 28px | 500 | 1.15 | 0 |
| Heading S | sans | 20px | 600 | 1.3 | 0 |
| Body L | sans | 18px | 400 | 1.6 | 0 |
| Body M | sans | 16px | 400 | 1.6 | 0 |
| Eyebrow / label | mono | 12px | 500 | 1.2 | 0.12em, UPPERCASE |
| Caption | mono | 11px | 500 | 1.3 | 0.08em |

## Spacing (4px base)

`2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128`. Section vertical padding: 96px
desktop / 64px tablet / 48px mobile. Outer page gutter: 24px mobile, 48px ≥1024.

## Radius, border, elevation

- Radius: `--r-sm 4px`, `--r-md 8px`, `--r-lg 12px`. No pill cards.
- Border: hairline `1px var(--slate-300)`; emphasis `1px var(--ink-900)`.
- Elevation: prefer borders. Allowed shadow: `--shadow-1: 0 1px 2px rgba(20,33,58,.06)`
  and `--shadow-2: 0 8px 24px rgba(20,33,58,.10)` for the one floating element
  (e.g. mobile nav sheet). No shadow-on-everything.

## Breakpoints

| Name | Min width | Notes |
|---|---|---|
| `sm` | 0 | Mobile, single column, base |
| `md` | 640px | Large phone / small tablet |
| `lg` | 1024px | Tablet landscape / desktop; nav switches to inline |
| `xl` | 1280px | Max content width 1200px centered |

Mobile-first. The desktop→mobile nav switch happens at `lg`.

## Layout

- Container max width: 1200px; reading column max: 68ch.
- Grid: 12-col, 24px gutter (16px on `sm`).
- Z-index: header 100, mobile-nav sheet 200, toasts 300, modal 400.

## Motion

- Durations: `--t-fast 120ms`, `--t-base 240ms`, `--t-slow 480ms`,
  house draw-in `900ms`.
- Easing: `--ease-out: cubic-bezier(.2,.7,.2,1)`; `--ease-inout: cubic-bezier(.5,0,.2,1)`.
- Scroll-reveal: opacity 0→1 + translateY 12px→0 over `--t-base`, staggered 60ms.
- All motion gated by `prefers-reduced-motion: reduce` → final state, no transition.
