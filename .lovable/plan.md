

## Admin House View: Show Full House Structure

### Problem
When the admin views a user's house, they only see purpose, overarching question, conclusion, consequences, concepts, and sub-questions with basic info. Missing: sub-purposes, implications, assumptions under each sub-question, and the visual house layout.

### Approach
Replace the flat admin analysis view with a read-only version of the house visualization layout, showing all elements the user would see:

### Changes to `src/components/house/AdminUsersPanel.tsx`

Rewrite the `view === "analysis"` section (lines 251-293) to mirror the HouseVisualization layout as a read-only view:

1. **Atmosphere** — Concepts section (already shown, keep)
2. **Roof** — Show Consequences, Purpose + Sub-purposes, Implications (currently missing sub-purposes and implications — the analysis object has `sub_purposes` but it's not displayed; implications are stored in the `consequences` field or separate; need to check)
3. **Ceiling** — Overarching Question + Overarching Conclusion (already shown, restructure into side-by-side)
4. **Columns** — Sub-Questions grouped by POV category (individual/group/ideas_disciplines), each showing:
   - Question text
   - Information
   - Sub-conclusion
   - **Assumptions** (from `selectedAnalysis.assumptions` filtered by `sub_question_id`) — currently fetched but never displayed
5. **Foundation** — Personal POV (from the user's profile — would need an extra fetch, skip for now unless easy)

### Visual structure
Use Card components styled like the house zones (atmosphere, roof, ceiling, columns, foundation) but read-only — no textareas, just text display. This gives the admin the same visual experience as the user.

### No backend changes needed
The `analysis-detail` action already returns `analysis`, `sub_questions`, `concepts`, and `assumptions`. All data is available.

### Files to modify
| File | Change |
|------|--------|
| `src/components/house/AdminUsersPanel.tsx` | Replace analysis view section with house-structured read-only layout |

