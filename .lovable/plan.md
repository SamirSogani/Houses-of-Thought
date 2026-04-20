

## Goal

Keep both layers in the staging area (filter chips row + type-row inside AddPanel). Make the **filter chip row itself become a second kind of draggable element**: users can add custom "section" chips (each containing multiple staged items of a given type), and drag an entire section onto a sub-question card / Concepts tile / Implications tile / Consequences tile to apply every item inside it at once.

Keep the earlier assumption-mode reorder (5.1 → 5.2 → 5.3).

## Concept

Think of the filter chip row as "sections". Today it has fixed chips (All, Sub-question, Information, …). We add:

- A **"+ New Section"** button at the end of the chip row.
- When clicked, the user names it and picks a base type (e.g. "Evidence for claim X" / type = information). It becomes a new chip in the row.
- Clicking a section chip filters the staging grid to ONLY that section's items. The AddPanel (layer 2) then adds new items *into that section* with the section's base type.
- Each user-created section chip is draggable. Dragging it onto a valid drop target applies every item it contains in one drop.

Built-in chips (All, Sub-question, Information, …) keep working exactly as today — they are NOT draggable. Only user-created sections are draggable.

## File changes — `src/components/house/InteractiveHouseBuilder.tsx`

### 1. Data model

Add a new local state:

```ts
type StagingSection = {
  id: string;
  name: string;           // user-supplied label
  baseType: StagingType;  // information | assumption | sub-conclusion | ...
  itemIds: string[];      // references into existing staging items
};
const [sections, setSections] = useState<StagingSection[]>([]);
```

Existing `stagingItems` stays unchanged. A staging item belongs to a section when its id is in `section.itemIds`.

### 2. Filter chip row

- Render existing fixed chips (unchanged).
- After them, render one chip per `sections[]` entry, styled distinctly (e.g. dashed border, small grip icon) and with `draggable={true}`.
- Append a final "+ New Section" chip that opens a tiny inline dialog: name input + type select + Create.
- Clicking a section chip sets `filter` to a new value `section:<id>` (extend the `filter` type to `"all" | StagingType | \`section:${string}\``).

### 3. AddPanel wiring

- When `filter` is a section, `activeType` = that section's `baseType`, and newly added items auto-append to `section.itemIds`.
- When `filter` is a fixed chip, behavior is unchanged (current fix we just did stays).
- Show a small tag above AddPanel: *"Adding to section: <name>"* when applicable.

### 4. Section chip drag

- `onDragStart` on a section chip sets `dataTransfer`:
  - `itemType = "section"`
  - `sectionId = section.id`
  - (no single content payload)

### 5. Drop handlers — accept sections

Update the three existing drop-target components:

**SubQuestionRowCard `handleDrop`:**
- If `itemType === "section"`: look up the section, then for each item in `itemIds` route it by the item's own type using the existing per-type routing (information → Information list, assumption → Assumptions list, sub-conclusion → Sub-conclusion field). Items whose type is implication / consequence / concept are silently skipped (sub-question <lov-plan>

## Goal
Keep both layers in the staging area, restore the ability to add new "layer-1" groups, and let users drag an entire group (with all its child items) into a sub-question, Concepts tile, Implications tile, or Consequences tile — dropping the whole section's contents at once.

## Current structure recap
- **Layer 1 (filter chips row)**: `All · Sub-question · Information · Assumption · Sub-conclusion · Implication · Consequence · Concept`. Currently this is a single fixed row used only for filtering.
- **Layer 2 (AddPanel)**: textarea that adds a single staging item of the active type.
- **Assumption sub-modes**: 5.1 Unknown Unknowns → 5.2 Foundational Concepts → 5.3 Concepts that shape inferences (recently reordered — keep as-is).

## New concept: "Staging Groups"
Introduce a new data structure on top of the existing staging items:

```ts
type StagingGroup = {
  id: string;
  type: StagingType;           // information, assumption, sub-conclusion, etc.
  assumptionMode?: AssumptionMode; // only if type === "assumption"
  label: string;               // user-visible name, e.g. "Information #2"
  itemIds: string[];           // references to staging items inside this group
};
```

Each group owns its own child items. The existing single-item staging grid becomes the "default / ungrouped" bucket plus any number of user-added groups.

## Layer-1 changes
Keep the filter chips for filtering behavior, and add a new **"+ New group"** button at the end of the row. Clicking it:
- Opens a small inline chooser (popover or dropdown) listing the 7 non-"all" types.
- For `assumption`, also shows the 5.1/5.2/5.3 sub-mode selector (reuse existing `ASSUMPTION_MODES` ordering).
- Creates a new `StagingGroup` of the chosen type and pushes it into a `stagingGroups` state array.

Each rendered group is a **draggable block** that:
- Shows its label (e.g. "Information", "Assumption — 5.1 Unknown Unknowns") and an item count badge.
- Contains its own mini AddLabel input (reuses the existing `AddPanel` UI) to append items *into that group only*.
- Lists its child staging cards beneath it (reuse existing `StagingCard` rendering).
- Has a drag handle on the group header; `onDragStart` sets `dataTransfer` with:
  - `itemType = "group"`
  - `groupId = <id>`
  - `groupContentType = <type>` (so drop targets know whether to accept it)

## Drop-target updates
Reuse existing drop handlers on:
- Sub-question cards (`SubQuestionRowCard`)
- Concepts `SectionTile`
- Implications `SectionTile`
- Consequences `SectionTile`

Extend each handler to check `itemType`:
- If `itemType === "group"`: read `groupId`, look up all child items, and dispatch each one through the existing single-item routing logic:
  - Sub-question target accepts groups of type `information`, `assumption`, `sub-conclusion`, `sub-question`. Reject `concept` / `implication` / `consequence` groups with the existing red tooltip.
  - Concepts tile accepts only `concept` groups.
  - Implications tile accepts only `implication` groups.
  - Consequences tile accepts only `consequence` groups.
- On successful group drop: persist each child item to the target (existing DB write paths — Information list, Assumptions list, Sub-conclusion, Concepts, Implications, or Consequences), then remove the entire group (and its children) from staging.
- On rejection: red ring + existing tooltip text, no data changes.

## Layer-2 (single AddPanel at root)
Keep it exactly as it is today — quick way to add one-off items typed by the current filter chip. The new per-group AddLabel lives *inside* each group card and only adds to that group.

## Visual treatment
- Groups render as rounded cards with a colored left border matching their type (reuse existing type-color mapping) and a grab cursor on the header.
- While a group is being dragged, valid targets show the existing dashed-pulse; invalid targets show the not-allowed cursor.
- Item count badge updates live as the user adds items into the group.

## Files touched
Only `src/components/house/InteractiveHouseBuilder.tsx`:
1. Add `StagingGroup` type, `stagingGroups` state, `addGroup`, `addItemToGroup`, `removeGroup`, `dragStartGroup` helpers.
2. Render `+ New group` button + type chooser at the end of the filter chips row.
3. Render each group as a draggable card with its own header, inline AddLabel, and child grid.
4. Extend `handleDropOnSubQuestion`, `handleDropOnAnalysisZone` (Concepts / Implications / Consequences) to branch on `itemType === "group"` and fan out child items through existing per-type persistence paths.
5. Keep assumption-mode 5.1 → 5.2 → 5.3 order unchanged.

No database schema changes. No changes to other components.

