# Security Audit — Houses of Thought

**Auditor:** security auditor (subagent, model: Opus) · read-only · 2026-07-19

Next.js 16 App Router · Supabase (PostgREST/RLS/Auth) · multi-provider LLM router.
Audience includes minors (COPPA/FERPA sensitivity). Files cited by path.

> **Important caveat:** `supabase/migrations/0001_profiles.sql` states the
> migrations were *reconstructed, not dumped from the live database* ("Diff this
> against the live DB before treating it as authoritative"). Every RLS finding
> below assumes the live DB matches these files. **Confirm against the live
> schema** — drift here is itself a risk.

---

## CRITICAL

### C1 — Student → Teacher privilege escalation via self-editable `account_type` (mass assignment)
**Files:** `supabase/migrations/0001_profiles.sql` (update policy), `0019_profiles_grants.sql` (GRANT), `components/profile/ProfileForm.tsx:58,84`, `lib/profile/data.ts:120-130`

The profiles UPDATE policy is `using (auth.uid() = id)` with **no `WITH CHECK` and no column restriction**, and `0019` grants `update` on the whole table to `authenticated`. `account_type` is an ordinary column whose CHECK constraint permits `'teacher'`. The client save writes the entire row: `supabase.from('profiles').update(row)` where `row` includes `account_type`.

**Attack:** any signed-in student issues one PostgREST PATCH — `PATCH /rest/v1/profiles?id=eq.<self>` with `{"account_type":"teacher"}` (or just flips the value in the profile form / a crafted request). RLS allows it because they own the row. They are now a "teacher" everywhere capabilities are read.

**Impact:** breaks the core role model of an education product. The escalated user gains `canCreateClasses` / `canViewOthersHouses`, sheds the student AI clamp, and can present as an educator. Combined with C2/H1, becomes a path to read other students' work and PII (minors).

**Fix:** stop trusting the client for `account_type`. Either (a) revoke column-level update on `account_type` (`REVOKE UPDATE (account_type) ...; GRANT UPDATE (username, about_me, ...) ...`), or (b) add a `WITH CHECK` that forbids changing `account_type` (e.g. compare to a SECURITY DEFINER function returning the current stored value), and remove `account_type` from `profileToRow`'s update payload. Role changes should require an out-of-band/admin path, not a self-service profile save.

---

## HIGH

### H1 — Capability model ("who is a teacher") is enforced only in the UI, not at the data layer
**Files:** `supabase/migrations/0014_classes.sql` (`classes_insert with check (teacher_id = auth.uid())`), `app/classroom/page.tsx:52`, `components/classroom/AssignmentPanel.tsx:65,82`

`canCreateClasses` is checked only inside React Server Component page code (`app/classroom/page.tsx:52`). The RLS policy governing the actual write, `classes_insert`, checks *only* `teacher_id = auth.uid()` — it never consults `account_type`. So **any authenticated user (standard or student), without even escalating via C1**, can create a class, become its teacher, author assignments/courses, and generate an assignment strawman by direct PostgREST/RPC calls. The page-level guard is cosmetic.

**Impact:** the entire teacher capability set is client-side-enforceable only. A student can spin up a class, distribute the join code, and — once classmates join — read their houses and roster (email + username) via `can_view_student_house` / `get_class_roster`. This is the amplification path that turns C1/H1 into student-PII disclosure.

**Fix:** enforce role at the DB. Add an `is_teacher()` SECURITY DEFINER helper (reads `profiles.account_type` for `auth.uid()`) and require it in `classes_insert` (`with check (teacher_id = auth.uid() and public.is_teacher())`). This only matters once `account_type` itself is trustworthy (fix C1 first).

### H2 — Anonymous AI rate limit is trivially bypassable and fails open
**File:** `lib/ai/limits.ts:64-122`

Two compounding weaknesses, both confirmed:
- **Cookie bypass:** the anonymous subject is the `hot_aid` cookie, minted server-side per browser. A scripted client that simply discards cookies gets a fresh `anon:<uuid>` on every request, each starting at count 1 — the `ANON_DAILY_CAP` (25) never bites. The IP fallback (`ipSubject`) only triggers when the cookie *can't* be set, and trusts the client-supplied `x-forwarded-for` first hop (spoofable off-Vercel).
- **Fails open:** `enforceAiLimit` returns (allows the call) on any limiter error, and the auth lookup failure path also degrades to the anon cap.

**Impact:** unmetered abuse of paid multi-provider LLM quota and Brave Search from unauthenticated `/api/ai/mini-house`, `/suggest`, `/research`, `/interview`, `/critique`. Cost-DoS and quota exhaustion (which then trips the daily-blackout airbag, degrading service for legitimate users).

**Fix:** layer an IP-based ceiling *in addition to* the cookie subject (the module comment already anticipates this), derive client IP from a trusted proxy header rather than raw XFF, and consider failing closed (or to a low fixed cap) for the anonymous tier specifically. Rate-limit before the body read on the public endpoints.

### H3 — No security headers (no CSP, HSTS, X-Frame-Options, Referrer-Policy, nosniff)
**File:** `next.config.ts` (no `headers()` block; no `vercel.json`)

There is no `headers()` configuration anywhere. The app ships with none of: Content-Security-Policy, Strict-Transport-Security, X-Frame-Options / `frame-ancestors`, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.

**Impact:** clickjacking is possible (the login/profile/build pages can be framed). With no CSP, any future/residual XSS has zero secondary containment, and there's no HSTS to prevent TLS-stripping. For a product handling minors' data this is a baseline gap.

**Fix:** add a `headers()` async function in `next.config.ts` (or `vercel.json`) setting at minimum `Content-Security-Policy` (start report-only), `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Frame-Options: DENY` / `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy`.

---

## MEDIUM

### M1 — Password-reset flow appears unimplemented (broken/undefined "Forgot password")
**Files:** `app/login/page.tsx` (links to `/forgot-password`); no `forgot`/`reset`/`callback`/`confirm` route exists under `app/` (searched).

The login page links to `/forgot-password`, but there is no such route and no auth callback/reset handler in the tree. If email confirmation / reset is handled purely by Supabase's hosted flow that's acceptable, but there is currently no visible redirect-target validation for a recovery callback, and the link is dead. Verify the Supabase Auth email-confirmation and recovery redirect allowlist is locked to your domain (an open `redirectTo` allowlist is a common account-takeover vector). Flagging as an area to confirm rather than a proven bug.

### M2 — AI "student clamp" enforced on only one of five AI routes
**Files:** `app/api/ai/suggest/route.ts:66` (applies `getCallerCapabilities().forcedMode`); `app/api/ai/critique`, `interview`, `research`, `mini-house` (no capability read)

The authoritative posture clamp (students pinned to `learn`/coach) is applied *only* in `/api/ai/suggest`. A student can call `/api/ai/critique`, `/api/ai/research` (drafter lane), or `/api/ai/interview` directly and receive un-clamped output. These endpoints are also open to standard/anon users so the data-exposure impact is low, but the "students never get author-style help" invariant (decision 007) is not enforced consistently server-side — it is bypassable by hitting a sibling endpoint.

**Fix:** if the Learn-only guarantee matters, centralize the capability/posture resolution in a shared helper every AI route calls, not just `/suggest`.

### M3 — `x-forwarded-for` trusted for IP identity
**File:** `lib/ai/limits.ts:55-60`

`ipSubject` takes the first `x-forwarded-for` hop verbatim. On Vercel the platform sets a trustworthy value, but if the app is ever reachable off-platform (or the header is client-appended), the "IP" is attacker-controlled, letting one client masquerade as unlimited distinct IPs. Fold into the H2 fix (use the platform's trusted client-IP signal).

---

## LOW / INFORMATIONAL

- **L1 — Open-redirect hardening on `?next=`** (`app/login/page.tsx:14-18`): `nextPath()` correctly rejects `//` and requires a leading `/`, but does not normalize backslashes (`/\evil.com`), which some browsers coerce to a protocol-relative URL. Tighten to also reject `next` values containing `\` or not matching `^/[^/\\]`.
- **L2 — Verbose-ish upstream error surfacing:** AI routes return short codes (`ai-upstream-error`, `ai-bad-request`) — good. But `lib/ai/router.ts:567` logs full provider error objects server-side; ensure provider responses (which can echo request fragments) never reach the client. Currently they don't. Fine as-is; noted.
- **L3 — Prompt-injection blast radius is well contained.** House content/transcripts are user-controlled and fed to the LLM, but: Research/Mini-House evidence URLs are hard-filtered to the set Brave returned this request (`app/api/ai/research/route.ts` step 4; `mini-house` step 3), and all rendered links pass `safeHttpUrl` (`lib/safeUrl.ts`, used in `ResearchResults.tsx:133`, `EvidenceLayer.tsx:67`) which rejects `javascript:`/`data:`. No `dangerouslySetInnerHTML`, `innerHTML`, or `eval` anywhere in `app/`, `components/`, `lib/`. React's default escaping covers the text surfaces. A poisoned model output cannot inject a malicious href or HTML. Strong posture.
- **L4 — SSRF surface is minimal.** The only server-side outbound fetch of influenced input is `braveSearch` (`lib/ai/brave.ts`), which hits a fixed Brave endpoint with the query as an encoded param — no user-supplied URL is fetched. No SSRF.
- **L5 — Secrets hygiene is clean.** Only `.env.example` is tracked (no real `.env`). Service-role key is used in exactly one server-only module (`lib/ai/limits.ts:46`), guarded by a `window` check. No `NEXT_PUBLIC_` misuse of secrets. Note `.env.example` documents `ADMIN_PASSWORD_001` which the code never reads (`lib/auth/admin.ts` only reads `ADMIN_EMAIL_001`) — drop it from the example to avoid implying it's consumed.
- **L6 — CSRF:** PostgREST writes authenticate via `Authorization: Bearer` (not ambient cookies), so they're not CSRF-able. The AI + admin routes read Supabase cookies; a cross-site POST could burn a victim's rate limit or trigger an admin probe, but there's no state mutation of value. Low. Admin `POST` probe endpoints (`app/api/admin/ai-status`, `ai-model`) are cookie-gated by `isCallerAdmin` — a CSRF'd probe merely spends a sliver of quota.
- **Positive notes:** `ai_usage` deny-all RLS + `service_role`-only execute is correctly locked (the `0011`→`0012` PUBLIC-grant fix is real and correct). All SECURITY DEFINER functions set `search_path = public` and authorize the caller (`is_class_teacher`, `open_assignment`, `join_class`, `ensure_strawman_house`). The RLS recursion trap (self-querying `houses` in a policy) is understood and fixed in `0020`. Teacher visibility into student houses is read-only by construction (only SELECT widened; feedback kept in a separate table so teachers never get write access to student house content — `0018`). Admin pages `notFound()` for non-admins. This is a security-aware codebase.

---

## Fix first (prioritized)

1. **C1** — Block client-controlled `account_type` writes (column REVOKE or `WITH CHECK`) and drop it from the profile update payload. *This is the keystone.*
2. **H1** — Gate `classes_insert` (and by extension teacher powers) on a DB-level `is_teacher()` check, not just the UI.
3. **H2** — Add an IP-based ceiling on top of the cookie limiter for the anonymous tier and reconsider fail-open for public AI endpoints.
4. **H3** — Add security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy) in `next.config.ts`.
5. **M2** — Apply the student posture clamp across all AI routes, not just `/suggest`.
6. **M1** — Confirm/repair the password-reset + email-confirmation flows and lock the Supabase Auth redirect allowlist.
7. Then L1 (backslash open-redirect), M3, and the `.env.example` cleanup.
8. **Cross-cutting:** diff these migrations against the live database — the reconstruction caveat means the live RLS may not match what was audited.

## Overall posture

Encouragingly mature on the hard parts: injection/XSS defense is genuinely strong (URL allow-listing, `safeHttpUrl`, zero raw-HTML sinks), SSRF surface is essentially nil, secrets handling is clean, and the RLS/SECURITY-DEFINER design shows real care. The serious weaknesses are all **broken access control**: the role/capability system is enforceable only in the client/UI layer while the database lets any authenticated user assign themselves a teacher role (C1) or create classes outright (H1). For a product serving minors, role integrity and the anonymous cost/abuse controls (H2) plus baseline headers (H3) are the gaps to close before scaling to real classrooms.
