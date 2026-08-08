# Pages: Auth & Legal

[← Back to index](README.md)

Real routes: `/login`, `/forgot-password`, `/reset-password`,
`/auth/callback` (emailed-link landing), `/welcome` (post-auth screen),
`/terms`, `/privacy`. My first pass's restraint principle for these still
holds; only the route list and one legal detail are corrected below.

## Auth routes

Task pages, not persuasion pages — restraint over spectacle. Full type/color
system applies; full animated storytelling doesn't. A signup link that
carries context through (e.g. `/login?mode=signup&q=<question>`, as `/try`
already does when converting a Mini House) should keep working — don't design
a signup flow that loses the question someone just reasoned about.

`/welcome` is a real post-auth screen worth a design pass: first thing a new
account sees, natural place for a brief "here's what changes now" moment
(persistent houses, the full assumption taxonomy, House Strength) rather than
dropping straight into an empty dashboard.

## Legal — `/terms`, `/privacy`

Content already exists (sourced from `references/legal/` PDFs) and per
`pages-content.md` **must be reviewed against the real product specifically
for the education push** — a 12+ age floor, student data handling,
third-party infra — before this ships, independent of anything visual. Keep
this page visually quiet: type and spacing tokens only, no illustration, no
motion. Drop "also known as House of Reason" or reduce it to a one-line
historical note, matching the canonical-name decision.
