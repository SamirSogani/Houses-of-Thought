# Navigation, Routing & Flows

How the shell behaves and how users move through it. Components defined in
[components.md](components.md).

## Routing map (public)

| Path | Page | Doc |
|---|---|---|
| `/` | Homepage | [page-home.md](page-home.md) |
| `/how-it-works` | How It Works | [page-how-it-works.md](page-how-it-works.md) |
| `/educators` | For Educators | [page-for-educators.md](page-for-educators.md) |
| `/examples` | Examples gallery | [page-examples.md](page-examples.md) |
| `/examples/:slug` | Example detail | [page-examples.md](page-examples.md) |
| `/try` | No-login builder | [page-try-and-auth.md](page-try-and-auth.md) |
| `/signup`, `/login` | Auth | [page-try-and-auth.md](page-try-and-auth.md) |
| `/framework` | The Framework (deep) | [pages-content.md](pages-content.md) |
| `/faq` | FAQ | [pages-content.md](pages-content.md) |
| `/story` | Our Story | [pages-content.md](pages-content.md) |
| `/contact` | Contact | [pages-content.md](pages-content.md) |
| `/terms`, `/privacy` | Legal | [pages-content.md](pages-content.md) |

Authenticated routes (dashboard, builder, classroom) are out of scope; `Log in`
and successful auth redirect to the app.

## Header

Primary nav (exactly 4, to avoid overload): **How it works · For Educators ·
Examples · FAQ**. Right side: `Log in` (text) + **`Try it free`** (primary).

- **Sticky** at top; on scroll past hero it **condenses** (reduced height + bottom
  hairline + paper background even over dark hero). Active route: amber underline.
- **Tradeoff — 4 items vs. more:** Framework/Story/Contact pushed to footer to keep
  the bar scannable and the CTA dominant. Cost: those pages get less exposure →
  acceptable; they're supporting, not conversion-critical.

### Mobile nav (`<lg`)
- Header shows Logo · compact `Try it free` · hamburger.
- Tap hamburger → **full-screen MobileNavSheet** (z 200): large serif nav links,
  then `Log in` + `Try it free`, then a mono mini-footer (Framework/Story/Contact).
- Focus trapped while open; `Esc`/overlay closes; body scroll locked; returns focus
  to toggle. Animates in `--t-base`; instant under reduced-motion.
- **Pro of full-screen sheet vs. dropdown:** comfortable targets, room for the CTA,
  feels intentional. **Con:** covers content → mitigated by fast open/close + clear
  close affordance.

## Footer
`BlueprintFooter` on every page. Columns: **Product** (Try it, Examples,
Framework) · **Learn** (How it works, For Educators, Our Story, FAQ) · **Legal**
(Terms, Privacy, Contact/Support). Plus the `SHEET 99 / FOOTER` mark and the
one-line product descriptor (canonical name only).

## CTA hierarchy (global)
1. **`Try it free`** — no-login `/try`. The dominant action everywhere.
2. **`Create account`** — appears contextually (after building, in CTASections).
3. **`For educators`** — high-intent secondary path to `/educators`.

Rule: at most one *primary* (amber) CTA visible per viewport section.

## The conversion mechanic (local → account)
- `/try` builds and **persists work to localStorage**, no account (matches the
  product's "saved locally until you create an account").
- Triggers to prompt account creation, in priority order:
  1. User reaches a meaningful milestone (first conclusion / 2+ sections).
  2. User clicks Save / Export / Publish.
  3. Gentle persistent affordance: "Save this house → Create free account."
- Account creation **carries the local house** into the new account (pass the
  localStorage payload through signup). Never lose work on signup.
- **Tradeoff — letting people work before signup:** maximizes activation and lets
  teachers evaluate; risk is anonymous work lost on cache-clear → mitigated by the
  persistent save prompt and import-on-signup.

## User flows

**A. Curious individual (primary funnel)**
`/` → reads hero, sees house draw itself → `Try it free` → `/try`, builds a house →
milestone prompt → `Create account` (carries house) → app.

**B. Teacher (primary wedge)**
`/` or ad → `For Educators` → sees "make thinking visible / AI won't do it for
them / classroom review" → `Create a classroom` → `/signup?role=teacher` → app
(create class, invite students).

**C. Student (invited)**
Join link/code from teacher → `/signup?role=student&class=…` → minimal student
signup → assigned house in app. (Student AI assistant disabled — pedagogy.)

**D. Skeptic / researcher**
`/` → `How it works` and/or `Examples` → sees cited evidence + Stress Test +
strength scoring → `Try it free` → account.

All flows end at the same two doors: **Try it free** (low intent) or **Create
account / Create a classroom** (high intent).
