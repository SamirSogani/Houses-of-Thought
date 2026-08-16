# Invite/Share panels

**Scoped:** 2026-08-15. Fulfills the "invite/team flow" item deferred in
[README.md](README.md) and [decision 003](../../../decisions/003-collaboration-model.md).
Investigated via three parallel explore passes this session — see that
session's findings folded in below; not re-cited per-claim to keep this
doc actionable rather than a research log.

## Two independent mechanisms, both in v1

**"Invite" and "Share" are different features, not two names for one
thing.** Ship both; they don't block each other.

| | Invite | Share |
|---|---|---|
| Audience | Someone with an account | Anyone with a link |
| Backend | `house_collaborators` table (exists, deployed, RLS live, **zero app code uses it**) | New: a `share_token` column |
| Access | Real `viewer`/`editor` role, sees house in their own dashboard | Read-only, no account, no dashboard entry |
| Lands on | `/build/<id>` (existing builder, RLS already honors collaborators) | New `/shared/<token>` route |

## History — read before touching UI

An invite/share UI existed once and was **deliberately removed**
(commit `1c49db6`, 2026-07-20, "ai-slop" audit): a fake Team tab with an
inert Invite button, fictional collaborators "Maya R."/"Devan K.", and a
dashboard "Share (copy link)" item that copied a `/build/<id>` URL RLS
silently bounced for anyone but the owner — recipients dead-ended with no
error. **Do not repeat that failure mode.** Whatever ships must actually
resolve for the recipient, which is why Share does not reuse `/build/<id>`.

## Mechanism 1 — Invite

Backend already exists (migration `0004_collaborators.sql`, confirmed
live): `house_collaborators(house_id, user_id, role, invited_by)`, roles
`viewer`/`editor` (default `editor`), `can_access_house()`/`can_edit_house()`
RLS helpers already wired into `houses` and all four child tables' policies.
Owner-only insert/update on the membership table; a collaborator may remove
themselves.

Work needed — UI only, no schema/RLS changes:

1. **Resolve a user by email.** The client cannot query `auth.users`
   directly. Add a small server route (service-role key) that takes an
   email, returns a `user_id` or "not found" — do not leak whether an email
   exists beyond that (rate-limit this endpoint; it's an enumeration
   surface). No pending/email-invite for non-existing accounts in v1 (matches
   decision 003's own deferral) — if the email doesn't match an account,
   say so and stop; don't silently no-op.
2. **Invite panel** (in the builder, replacing the removed Team tab):
   email input → resolve → role picker (`viewer`/`editor`) → insert into
   `house_collaborators` (owner's session, existing RLS allows it).
3. **Membership list**: current collaborators, avatar/name via a join
   against `profiles`, role, a remove button (owner removes anyone; a
   collaborator removes only themselves — existing RLS already enforces
   this, just call it).
4. **Dashboard query** currently only selects `owner_id = auth.uid()`
   houses (`app/dashboard/page.tsx`) — extend it to also surface houses
   where the viewer is a collaborator, matching what `houses_select`'s RLS
   already permits. Label these visibly as shared-with-you, not owned.
5. **Explicitly out of scope for v1**: per-item attribution. `owner_key`
   stays the cosmetic `you`/`ai` enum — every item a collaborator adds
   still shows as authored by "you" (from their own view) rather than by
   their real identity. Reworking `owner_key`/`PersonKey` into real
   per-collaborator attribution is a separate, larger change; decision 003
   already deferred this on purpose. Don't bundle it in.

## Mechanism 2 — Share

Nothing backend exists for this yet; it's genuinely new, small surface.

1. **Migration `0033_house_share_token.sql`**: `houses.share_token uuid
   unique`, nullable (null = not shared). No RLS/grant changes — anon stays
   at zero table grants, unchanged. Authorization is token possession,
   checked in application code, not in RLS.
2. **"Get share link" action** (builder or dashboard): if `share_token` is
   null, `UPDATE houses SET share_token = gen_random_uuid() WHERE id = ...`
   (owner's own session — existing owner-only UPDATE RLS already allows
   this, no new policy needed). Show the resulting `/shared/<token>` URL,
   copy-to-clipboard.
3. **Revoke**: same action, but sets `share_token = null`. Old links stop
   resolving immediately.
4. **Extract the read-only render.** `app/examples/[slug]/page.tsx` already
   builds a full read-only mirror of the builder (Frame, Perspectives,
   Evidence, Assumptions, Conclusion, Implications, House Strength) from a
   plain data shape. Pull that render into a shared component (e.g.
   `components/house-detail/ReadOnlyHouse.tsx`) that takes the same shape
   `/examples` already uses — don't fork it, reuse it verbatim from both
   call sites.
5. **New route `app/shared/[token]/page.tsx`** — sibling to `/examples`,
   not inside it. `/examples` stays curated marketing content (its actual
   spec'd purpose per [page-examples.md](../pre-login-ux/page-examples.md));
   `/shared` is real user houses. Server component calls a Route Handler
   (`app/api/shared/[token]/route.ts`) that uses the **service-role key**
   to look up the house by `share_token`, joins its child tables, shapes it
   identically to what `/examples/[slug]` feeds its render, returns 404 on
   no match (don't distinguish "no such token" from "revoked" — same
   response). Renders via the extracted component from step 4.
6. **Add `/shared` to `middleware.ts`'s public routes** — i.e. do *not* add
   it to `PROTECTED_PREFIXES`. It must stay reachable without login; that's
   the entire point.

## Verification checklist (before calling this done)

- `npx tsc --noEmit` and `npm run build` clean.
- A real house, invited as `viewer`: confirm read access in `/build/<id>`,
  confirm write attempts are rejected (RLS, not just UI hiding the button).
- A real house, invited as `editor`: confirm write access works.
- A collaborator removing themselves: confirm they lose access immediately
  (re-query, not just UI state).
- A share link: open in an incognito/logged-out context, confirm it
  renders real data, confirm revoking it 404s the same URL immediately.
- A stranger (authenticated, not invited, no token): confirm `/build/<id>`
  still RLS-bounces them exactly as today — this feature must not widen
  access beyond what was explicitly granted.
