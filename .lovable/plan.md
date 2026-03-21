

## Updated Plan: Framework, Footer, and Admin Panel Fixes

The only change from the previously approved plan is the placement of the new **Concepts** section: it goes **before Purpose** (as Section 4), not after Sub-Questions.

### Revised Section Order for `src/pages/FrameworkPage.tsx`

1. Why Structured Thinking Matters
2. The House Metaphor (alt)
3. The Full Reasoning Flow
4. **Concepts (NEW)** (alt) — foundational concepts and concepts that shape inferences
5. Purpose
6. Overarching Question (alt)
7. Points of View
8. Sub-Questions (alt)
9. Information / Facts
10. Assumptions (alt)
11. **Unknown Unknowns (MOVED from 15)**
12. Logical Inference (alt)
13. Sub-Conclusions
14. Overarching Conclusion (alt)
15. Implications vs. Consequences
16. Iterative Thinking (alt) — fix styling consistency
17. How the Platform Helps

### Other changes (unchanged from prior plan)

- **Footer** (`SiteFooter.tsx`): Features link → `/#features` for guests, `/framework#s17` for logged-in users. Show on all footers.
- **Admin Panel** (`AdminUsersPanel.tsx`): Convert all timestamps to PST using `toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })`.

### Files to modify
| File | Change |
|------|--------|
| `src/pages/FrameworkPage.tsx` | Insert Concepts as Section 4, move Unknown Unknowns after Assumptions, renumber all, fix Section 16 styling |
| `src/components/layout/SiteFooter.tsx` | Conditional Features link for all users |
| `src/components/house/AdminUsersPanel.tsx` | PST timezone for all dates |

