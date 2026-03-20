

## Plan: Sign-up Back Navigation + New Homepage Feature Cards

### 1. Terms/Privacy "Back to Sign Up" when opened from sign-up

**Approach**: Pass a `?from=signup` query param on the Links in AuthPage. In TermsPage and PrivacyPage, read that param. If present (and user is not logged in), show "Back to Sign Up" and navigate to `/auth?mode=signup` instead of home.

On AuthPage, read `?mode=signup` from URL to initialize `isLogin=false`, preserving the sign-up form state. Since the links currently use `target="_blank"` (new tab), form data in the original tab is naturally preserved.

**Files**:
- `src/pages/AuthPage.tsx`: Change Links from `/terms` to `/terms?from=signup` and same for privacy. Also read `mode=signup` search param to default `isLogin` to false.
- `src/pages/TermsPage.tsx`: Read `from` search param; if `from=signup`, show "Back to Sign Up" and navigate to `/auth?mode=signup`.
- `src/pages/PrivacyPage.tsx`: Same treatment.

### 2. Homepage: Add analysis tools feature card

Add a 6th card to the `features` array in HomePage for the Logic Strength Meter, Stress Tests, and Evidence Strength Meter.

**File**: `src/pages/HomePage.tsx`
- Add a new entry to the `features` array with a suitable icon (e.g., `Shield` or `Gauge`) titled something like "Analysis & Testing Tools" describing the logic strength meter, stress tests (including AI attack mode), and evidence strength evaluation.

