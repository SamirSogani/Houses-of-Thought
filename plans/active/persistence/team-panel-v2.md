# Team panel v2 — presence, DMs, activity log, always-on tabs

**Scoped:** 2026-08-16, same day as
[invite-share-panels.md](invite-share-panels.md) (v1: invite + share,
fully verified live). Feedback from actually using v1: real people don't
show up in the top presence bar, sharing is buried in a dashboard menu
instead of living with Team, the Team tab disappears instead of always
being there, and there's no way to see or talk to who else is on the
house. This doc scopes the fix.

## What's changing

1. **Real presence in `ContextBar`.** `presenceOrder = ['you', 'ai']` is
   hardcoded (comment: "who is actually here: you and the co-pilot") — a
   leftover from when collaboration was fake. Now that `house_collaborators`
   is real, the top bar should show an avatar for the owner and every
   collaborator, not just the viewer. Hovering a name shows last-active.
2. **Tab strip always shows both tabs.** `RightRail`'s `RailHeader` renders
   a single static "Co-pilot" label with no tabs at all when `team` is
   null, and only shows the Co-pilot/Team strip once `team` is truthy.
   Change: always render both tabs. `team` is already non-null for every
   normal owner/collaborator case (`app/build/[id]/page.tsx`'s `setTeam`)
   — the null case is specifically teacher-viewing-a-student's-house and
   strawman-attack, where there's genuinely no team concept; Team shows a
   simple "Not available in this view" state there instead of vanishing.
3. **Share moves into the Team panel.** "Get/Copy/Revoke share link"
   currently only lives in the dashboard's `HouseCard` kebab menu — no way
   to do it from inside the workspace. Add the same action to the top of
   `TeamPanel`, owner-only. Leave the dashboard menu items in place too
   (both work, same underlying `houses.share_token`).
4. **Presence / last-active.** New `house_presence(house_id, user_id,
   last_seen_at)` table — covers the owner and every collaborator
   uniformly (not folded into `house_collaborators`, since presence isn't
   a role and applies to the owner too, who has no row there).
   `TeamPanel` pings it on mount/every ~60s while open; each membership
   row's hover/title shows "active now" / "active 12m ago" / "active
   3d ago" from it.
5. **Direct messages, scoped to the house.** New
   `house_direct_messages(id, house_id, sender_id, recipient_id, body,
   created_at)`. A "Message" affordance next to each teammate in `TeamPanel`
   opens a small thread (sender/recipient only, both must actually have
   standing on this house). Simple send + poll-based list — no realtime
   infra in this codebase yet (confirmed: no Supabase Realtime usage
   anywhere), so this stays consistent with everything else here rather
   than introducing a new pattern for one feature.
6. **Activity log, scrollable, bottom of panel.** New `house_activity(id,
   house_id, actor_id, kind, detail, created_at)`. Scope: team/
   collaboration events only (invited, removed, left, role changed, share
   link created/revoked, message sent) — **not** a full content-edit
   history of every house field, which is a separable, much bigger feature
   if wanted later. Populated by DB triggers on `house_collaborators`
   insert/update/delete and `house_direct_messages` insert (and a plain
   app-level insert on the share-link action, which isn't a table
   trigger's natural hook) — triggers so an event can't be silently missed
   by a code path forgetting to log it, matching this codebase's existing
   preference for enforcing invariants at the DB layer.
7. **Expandable panel.** A toggle in `RailHeader` that widens the rail
   (320px → ~520px) or opens a taller overlay — needed once DMs + activity
   log + membership list all have to fit. Exact affordance (widen vs.
   overlay) is an implementation detail, not a decision worth blocking on.

## Schema (two new tables + one for messages, all RLS-scoped to
`can_access_house`, matching the existing pattern)

```sql
create table public.house_presence (
  house_id uuid not null references public.houses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (house_id, user_id)
);

create table public.house_direct_messages (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  recipient_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.house_activity (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  actor_id uuid references auth.users(id),
  kind text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
```

RLS on all three: read = `can_access_house(house_id)` (owner or any
collaborator, matching every other house-scoped table). Write:
`house_presence` self-only upsert; `house_direct_messages` insert requires
`sender_id = auth.uid()` and both sender+recipient having real standing on
the house; `house_activity` has no client-facing insert policy at all —
only the triggers (`security definer`) and the share-link route write to
it.

## Explicit scope line

Audit log = team/collaboration events only, not house-content edit
history. Presence = last-seen timestamp, not live "who's looking at this
right now" (that would need actual realtime infra — out of scope, matches
the rest of this codebase). DMs = house-scoped, not a general cross-house
inbox.

## Implementation

Delegated to a subagent immediately after this doc — the schema and RLS
shape above is the spec; UI polish (exact expand affordance, thread
layout) is the implementer's judgment, same division as v1.
