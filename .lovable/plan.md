

## Diagnosis

The sub-question cards already have `dragenter` / `dragover` / `dragleave` / `drop` handlers and they `preventDefault()` correctly. From the session replay I can see:

1. The cards DO receive `isDragActive` (they get `animate-pulse` when a drag starts), so the global "drag in progress" signal works.
2. The deeper "currently hovering" highlight (`over` state) never fires during the user's drag.

There are three real culprits:

### A. Window-level `dragover` listener is missing `preventDefault()`
In `InteractiveHouseBuilder.tsx` lines 427-440, the auto-scroll handler only reads `e.clientY`. Without `preventDefault()` on at least one ancestor `dragover`, several browsers (notably Chrome on certain layouts) treat the rest of the document as a non-drop region, which can suppress reliable `dragenter` firing on transient hover targets and also forces the cursor to the "no-drop" icon.

### B. Hover/`over` highlight is too subtle vs the always-on pulse
Once a drag starts, every sub-question card pulses with a 1px ring. The "you are over THIS card" state adds a 2px ring + tint, but the pulse animation visually competes with it, so the user thinks nothing is highlighting. We should make the over state much more obvious (drop pulse while over, stronger background, stronger border).

### C. `<button>` as a drop target swallows nested events
The `<button>` contains `<span>`, `<ChevronRight>`, `<p>` children. When the dragged item's pointer crosses from one child to another inside the button, `dragenter` fires on the inner element and `dragleave` fires on the outer — the `dragCounter` ref logic handles this, but only `setOver(true)` runs on `dragenter`. If `dragenter` is being missed entirely on the button (because a child intercepts first and `e.preventDefault()` isn't called there), the counter never increments past 0. Adding `pointer-events-none` to the button's children prevents this and makes the entire card a single, reliable drop target.

## Fix Plan

Edit `src/components/house/InteractiveHouseBuilder.tsx`:

1. **Window auto-scroll listener** (line 427): call `e.preventDefault()` at the top of `onDragOver` so the document is universally treated as a drop-allowed surface during any drag.

2. **`SubQuestionRowCard` over-state visual** (lines 172-178): make the `over` state unmistakable — solid 2px border, deeper purple background (`bg-[hsl(245_85%_88%)]`), stop the pulse while over, and add a soft scale (`scale-[1.02]`). Also make the always-on `isDragActive` ring 2px + dashed instead of pulsing 1px so the difference between "droppable" and "currently over" is clear.

3. **Make the button itself the only event surface**: add `pointer-events-none` to the inner `span`, `ChevronRight`, and `p` so all drag events fire on the `<button>` directly. This eliminates the inner-element dragenter/leave noise that can leave `dragCounter` stuck.

4. **Defensive: also handle `onDragOver` updating `setOver(true)`**: currently `over` is only set in `dragenter`. If `dragenter` is missed for any reason, `dragover` should still set it. Add `setOver(true)` inside `handleDragOver` (cheap — React skips if already true).

5. **Reset highlight on global `dragend`**: add a window `dragend` listener inside `SubQuestionRowCard` that clears `over`, `reject`, and resets `dragCounter` so a card never gets stuck highlighted if a drag is canceled outside it.

No changes to drop routing, persistence, staging logic, or any other component. Visual styling in the rest of the builder is preserved.

