# Pages — Try It (`/try`) & Auth (`/signup`, `/login`)

The front door and the conversion handoff. The full builder UI is the logged-in
product (out of scope); here we spec the **no-login entry surface** and the **auth
screens** + the local→account carry.

## `/try` — No-login builder entry

**Goal:** get a visitor reasoning within seconds, no account, and persist their
work so the save prompt converts.

- **Entry state:** a single, inviting prompt — *"What's a question you can't
  crack?"* — with example chips (a decision, a debate topic, an essay prompt).
  Submitting seeds a house and enters the builder.
- **Builder surface:** this reuses the real Collab builder (AI workspace + house
  workspace). For logged-out users:
  - Work **persists to localStorage** (no account).
  - A persistent, low-pressure **`Save this house → Create free account`**
    affordance (see conversion mechanic in navigation-and-flows.md).
  - AI co-reasoning (Collab) available in try mode; classroom/student restrictions
    only apply to provisioned student accounts.
- **Empty/again states:** returning visitors with a local house land back in it
  with a "pick up where you left off" + "start fresh" choice.
- **Tradeoff — full builder vs. a teaser sandbox:** giving the real thing maximizes
  activation and lets teachers evaluate honestly; risk is exposing an unfinished
  builder UX → gate genuinely broken features, but don't fake the experience.

### Responsive
- The builder is dense; on `sm` use a **tabbed** AI-workspace ⇆ house-workspace
  switch rather than side-by-side. Define this in the app spec; the marketing site
  just routes here.

## `/signup` — Create account

- **Layout:** split — left a quiet brand panel (mono `SHEET / CREATE ACCOUNT`,
  one-line value prop, a faint house line-art), right the form. Single column `<lg`.
- **Form:** email, password (or OAuth if supported), username. Role context from
  query (`role=teacher|student`, `class=`):
  - **Teacher:** adds "create your first classroom" hint post-signup.
  - **Student (invited):** minimal form, class pre-filled, age-appropriate (12+),
    no marketing extras.
  - **Default/Standard:** standard form.
- **Carry local work:** if a `/try` house exists in localStorage, show
  *"We'll move the house you just started into your account"* and import on success.
- **States:** inline validation, `aria-invalid`, clear error summary, loading on
  submit, success → app.
- **Tradeoff — role in URL vs. an in-form role picker:** URL keeps the common paths
  (teacher CTA, student invite) frictionless; include a small "I'm a teacher /
  student / just me" toggle as fallback for direct visitors.

## `/login`

- Same split shell. Email/password (+ OAuth), forgot-password link, link to
  `/signup`. On success → app. Carry any local `/try` house as well.

## Trust & microcopy (both)
- Reassure: work is private; no selling data; you can delete your account anytime
  (matches Privacy/ToS). Link Terms + Privacy near the submit button.

## A11y
- Real `<form>` semantics, labels tied to inputs, visible focus, error text linked
  via `aria-describedby`, password reveal toggle, no color-only validation.
