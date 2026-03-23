

## Plan: Multiple Houses + Responsive Mobile Design

### 1. "Create New House" Card on Dashboard

The dashboard already supports multiple analyses — users can create unlimited houses. The issue is discoverability: the "New House" button is only in the header. 

**Change**: Add a persistent "+" card at the end of the analysis grid that acts as a large, obvious "Create New House" button.

**File**: `src/pages/Dashboard.tsx`
- Add a final card in the grid after all analysis cards with a large "+" icon, dashed border, and "Create New House" text
- Make header buttons responsive (collapse to icons on mobile)

### 2. Responsive Dashboard

**File**: `src/pages/Dashboard.tsx`
- Header: collapse button labels on mobile (show only icons), wrap into a compact layout
- Grid already uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — this is fine

### 3. Responsive Analysis Page (the big change)

**File**: `src/pages/AnalysisPage.tsx`

Currently uses a fixed `w-14` sidebar + resizable tool panel + main content in a horizontal flex layout. On mobile this doesn't work.

**Mobile layout**:
- Hide the left icon sidebar on mobile (`hidden md:flex`)
- Replace with a fixed bottom navigation bar on mobile showing view toggle + tool icons
- Tool panels open as a sheet/drawer from bottom instead of a side panel
- AI FAB stays as-is (already works on mobile)
- Breadcrumb and title remain at top

**Desktop**: Keep existing layout unchanged.

### 4. Responsive House Visualization

**File**: `src/components/house/HouseVisualization.tsx`
- The house sections use cards in a vertical layout — already mostly responsive
- Ensure sub-question columns stack vertically on mobile instead of side-by-side
- Add touch-friendly tap targets (min 44px)

### 5. Responsive Interactive House Builder

**File**: `src/components/house/InteractiveHouseBuilder.tsx`
- On mobile, simplify the drag-and-drop canvas to a scrollable vertical list of blocks
- Blocks should be tappable instead of draggable
- Ensure the canvas scrolls vertically

### 6. Global Responsive Tweaks

**File**: `src/index.css`
- Add mobile-specific utility styles for touch targets
- Ensure `page-container` has appropriate mobile padding

**File**: `src/components/layout/SiteNavbar.tsx` — already has mobile hamburger menu, no changes needed

**File**: `src/components/ai/AISidebar.tsx` — uses Sheet component, likely already works on mobile. Verify and adjust width if needed.

### Files Summary

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add "Create New House" card in grid, responsive header |
| `src/pages/AnalysisPage.tsx` | Mobile bottom nav bar, tool panels as drawers, hide desktop sidebar on mobile |
| `src/components/house/HouseVisualization.tsx` | Responsive column stacking, touch-friendly sizing |
| `src/components/house/InteractiveHouseBuilder.tsx` | Mobile-friendly block layout, vertical scroll |
| `src/index.css` | Mobile touch target utilities, responsive padding |

### Implementation Order

1. Dashboard: "Create New House" card + responsive header
2. AnalysisPage: Mobile bottom nav + drawer-based tool panels
3. HouseVisualization: Responsive tweaks
4. InteractiveHouseBuilder: Mobile adaptations
5. CSS utilities for touch targets

