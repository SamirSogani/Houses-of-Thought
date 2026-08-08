# Sitemap & Routes (Pre-Login)

[← Back to index](README.md)

Corrected to the real routes (`app/` in `docs/repository/file-structure.md`).
**`/educators` is listed only for nav context — unchanged, per instruction.**

| Route | Purpose | Status |
|---|---|---|
| `/` | Home — the 10-second pitch; see [04](04-page-landing.md). | Redesign |
| `/how-it-works` | Approachable 3-step explainer. | Redesign |
| `/framework` | Exhaustive, SEO/AEO-carrying glossary of all 7 layers — content already strong; see [05](05-page-how-it-works.md). | Mostly keep, restyle |
| `/try` | The real no-login builder — already live, already free. See [06](06-page-live-demo.md). | Marketing around it, not the feature itself |
| `/examples` (+ `/examples/[slug]`) | Real published houses — replaced a dead "Guides" nav item on purpose. | Keep, restyle |
| `/story` | Origin narrative. See [08](08-page-about-and-switch.md). | Redesign |
| `/faq` | Also carries pricing ("free to start") — no separate pricing page. | Keep, restyle |
| `/contact` | Form + info cards. | Keep, restyle |
| `/educators` | **Unchanged.** Untouched. | Do not touch |
| `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/welcome` | Auth. See [07](07-page-auth-and-legal.md). | Light touch |
| `/terms`, `/privacy` | Legal. See [07](07-page-auth-and-legal.md). | Light touch |
| `/switch-from-rationale` | **New — not in the original plan.** See [08](08-page-about-and-switch.md) and open question about the underlying claim. | New proposal |

Dropped from my first pass: an invented `/method` (the real split of
`/how-it-works` + `/framework` is better than my single page), an invented
`/about` (the real page is `/story`, with existing strong copy), an invented
`/why-free` (folded into `/faq` already).

## Global nav

The real spec caps top nav at four items to control weight. Proposed,
consumer-forward ordering (see the audience flag in
[01](01-positioning-and-goals.md) — this order is the thing to confirm):
Logo → `/` · How it works · Try it free · For educators · Log in ·
**Sign up free** (primary).

Footer: full route list, plus a credit line to Paul-Elder / the Foundation for
Critical Thinking and John Trapasso.

## Navigation principle

Unchanged from my first pass and confirmed by the real UX principles doc:
**"Show, don't tell"** — every page should make `/try` the path of least
resistance, since it's not a mockup of the product, it *is* the product,
already free, already no-login.
