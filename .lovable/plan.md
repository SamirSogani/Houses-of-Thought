

## Admin Panel: Activity Charts and Site Visitor Tracking

### What We're Building

1. **User Activity Chart** — A chart view in the admin panel showing per-user activity over time (sign-ins, analyses created, chats created), with a toggle for different time ranges (7 days, 30 days, 90 days).

2. **Site Visitor Count** — A new `site_visits` table that logs anonymous page visits, plus a summary stat at the top of the admin panel showing total unique visitors and a signup conversion rate.

### Technical Approach

#### 1. Database: New `site_visits` table
- Create a `site_visits` table with columns: `id`, `visitor_id` (a fingerprint/random ID stored in localStorage), `path`, `created_at`
- RLS: Allow anonymous inserts (public), SELECT only via the admin edge function (service role)
- This lets us track visits without requiring authentication

#### 2. Edge Function: New `activity-stats` action in `admin-users`
- Add an `activity-stats` action that aggregates:
  - User sign-in timestamps from `auth.users` audit log (we'll use `created_at` from analyses/chats as proxy for activity)
  - Per-user daily activity counts from `analyses.created_at` and `sidebar_chats.created_at`
  - Total unique visitors and visit counts from `site_visits`
- Accept a `days` parameter (7, 30, 90) for the time range
- Also add a `site-stats` action returning total unique visitors and visits over time

#### 3. Frontend: Visitor tracking hook
- Create a small `useVisitorTracking` hook in `src/hooks/` that:
  - Generates/stores a random `visitor_id` in localStorage
  - Calls a lightweight edge function (or direct insert via anon key) to log the visit on each page load
- Include this hook in the main `App.tsx` or layout component so all pages are tracked

#### 4. Frontend: Admin Panel chart view
- Add a "Charts" toggle button at the top of the user list view in `AdminUsersPanel`
- When toggled, show:
  - **Site overview**: Total unique visitors, total visits, signups count
  - **Activity over time chart**: Using Recharts (already available via the `chart.tsx` component), show a bar/line chart of daily activity (new analyses + chats created) across all users
  - **Time range selector**: Buttons for 7d / 30d / 90d
- When viewing a specific user, show their individual activity chart with the same time range toggle

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/` | New migration: create `site_visits` table with RLS |
| `supabase/functions/admin-users/index.ts` | Add `activity-stats` and `site-stats` actions |
| `src/hooks/useVisitorTracking.ts` | New hook for anonymous visit logging |
| `src/App.tsx` | Add `useVisitorTracking` hook |
| `src/components/house/AdminUsersPanel.tsx` | Add chart view toggle, Recharts charts, visitor stats header |

### Implementation Order

1. Create `site_visits` table migration
2. Build visitor tracking hook and wire into App
3. Add new edge function actions for aggregated stats
4. Build the chart UI in AdminUsersPanel with time range toggles and visitor summary

