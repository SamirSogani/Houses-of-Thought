---
name: post-login-ux-audit
description: Deep post-login UX audit of Houses of Thought through 10 personas × 8 viewpoints
user_invocable: true
---

# Post-Login UX Audit — Houses of Thought

Perform a structured UX audit of every post-login surface of
**housesofthought.org**. Evaluate the logged-in experience through 10 user
personas across 8 evaluation lenses, producing a matrix of findings and an
actionable remediation plan. The personas span the full audience — students,
educators, individuals navigating personal decisions, and business users.

---

## Scope — post-login surfaces only

The audit covers every route and flow a logged-in user can reach:

| Surface | Route(s) | Core purpose |
|---|---|---|
| Welcome | `/welcome` | Post-signup onboarding |
| Dashboard | `/dashboard` | House listing, search, filter, sort, bulk ops |
| New House | `/build` | House creation entry point |
| House Builder | `/build/[id]` | 12-layer structured reasoning canvas (the product) |
| Console | `/build/[id]/console` | Multi-chat, sandbox reruns, subagent loops |
| Profile | `/profile` | Account settings, account type |
| Classes | `/classes` | Teacher class management |
| Classroom | `/classroom/[classId]` | Student or teacher classroom view |
| Assignments | `/classroom/[classId]/assignments/[assignmentId]` | Assignment detail |
| Join | `/join/[code]` | Join a class via invite code |
| Shared House | `/shared/[token]` | Read-only shared house view |
| Admin | `/admin/*` | Model routing, chat beta, reasoning pipeline |

Pre-login pages (marketing, `/try`, auth) are **out of scope** — use the
`ux-audit` skill for full-site audits.

---

## The 10 Personas

Each persona defines a realistic user with specific goals, technical comfort,
and expectations. Walk through the post-login experience **as that person**,
noting where their particular needs are met or missed.

### 1. First-time student (teacher-invited)

- **Who:** 15-year-old high school student who received a class join code from
  their teacher. Has never seen the product before.
- **Goal:** Join the class, understand what a "house" is, complete their first
  assignment.
- **Key concern:** "What am I supposed to do?" — needs immediate orientation.
- **Entry:** `/join/[code]` → `/welcome` → `/dashboard` → `/build/[id]`
- **Test:** Can they build a minimally viable house on their first attempt
  without outside help? Do they understand each layer's purpose?

### 2. Returning student

- **Who:** Student with 3–5 existing houses. Familiar with the basics but still
  learning advanced features.
- **Goal:** Check assignment feedback, iterate on a house, submit revisions.
- **Key concern:** Finding work-in-progress, understanding feedback, knowing
  what "done" looks like.
- **Entry:** `/dashboard` → `/build/[id]` → `/classroom/[classId]`
- **Test:** Can they locate their drafts and teacher feedback quickly? Is the
  revision workflow obvious?

### 3. Teacher setting up a classroom

- **Who:** 10th-grade English teacher adopting the platform for the first time.
  Has 30 students and wants to assign a reasoning exercise this week.
- **Goal:** Create a class, invite students, create and configure an assignment.
- **Key concern:** "Can I get this running before Monday?" — setup speed and
  confidence that students can follow instructions.
- **Entry:** `/dashboard` → `/classes` → class creation → share join code
- **Test:** Can they set up a functional class and assignment in under 10
  minutes? Is the join-code flow clear enough to explain to students verbally?

### 4. Teacher reviewing student work

- **Who:** Same teacher, one week later. 25 students have submitted houses.
- **Goal:** Review reasoning quality, leave feedback, identify students who need
  help, assess whether the tool is working.
- **Key concern:** Volume — reviewing 25 houses efficiently. Needs at-a-glance
  quality signals and fast navigation between submissions.
- **Entry:** `/classroom/[classId]` → `/classroom/[classId]/assignments/[assignmentId]`
  → individual student houses
- **Test:** Can they scan the class's work without opening every house
  individually? Are strength scores and completion states visible from the
  listing? Can they leave feedback inline?

### 5. Individual facing a high-stakes life decision

- **Who:** 38-year-old navigating a major crossroads — a career change, a
  medical decision, a relocation, a divorce, a financial dilemma. Emotional
  stakes are high and clarity is scarce.
- **Goal:** Build a house that helps them think through the decision
  rigorously, surfacing perspectives and assumptions they haven't examined.
  Wants the AI to stress-test their reasoning when emotions cloud judgment.
- **Key concern:** Trust and depth. The platform must feel serious enough for
  the weight of their decision. If it feels like a toy or a school assignment,
  they'll leave.
- **Entry:** `/welcome` → `/dashboard` → `/build` → `/build/[id]`
- **Test:** Does the onboarding feel age-appropriate and gravity-aware? Does
  the builder's language and tone match someone processing a hard decision?
  Does the Collab AI feel like a thoughtful peer, not a cheerful tutor? Is the
  output — the finished house — something they'd trust enough to act on?

### 6. Debate / forensics student (power user)

- **Who:** 17-year-old competitive debater. Has built 20+ houses. Wants to
  stress-test arguments, use Research Mode, and push the platform's limits.
- **Goal:** Build an airtight house with cited evidence, run Stress Test, and
  achieve the highest possible strength score.
- **Key concern:** Speed, depth, and control. Doesn't want hand-holding.
  Frustrated by unnecessary friction.
- **Entry:** `/dashboard` → `/build/[id]` → Console → Stress Test
- **Test:** Can they skip onboarding? Does the console and pipeline feel
  powerful, not limiting? Can they fork chats and run sandbox reruns
  efficiently?

### 7. Non-technical educator (late adopter)

- **Who:** 55-year-old history teacher. Uses email and Google Docs confidently
  but not much else. Heard about the platform from a colleague.
- **Goal:** Explore whether this is simpler than it looks. Wants to understand
  value before investing time.
- **Key concern:** "I don't want to break anything." Intimidated by AI features.
  Needs reassurance and simple language.
- **Entry:** `/welcome` → `/dashboard` → tentative exploration
- **Test:** Is jargon minimized? Are tooltips and help text present? Does the
  empty dashboard feel welcoming rather than empty? Are destructive actions
  clearly gated?

### 8. Business decision-maker

- **Who:** A startup founder, team lead, or analyst who needs to present
  structured reasoning to stakeholders — evaluating a market entry, a vendor
  selection, a product pivot, or a hiring strategy.
- **Goal:** Build a house that maps the decision rigorously, then share or
  export it for a board meeting, team review, or investor update.
- **Key concern:** Professional credibility. The output must look presentable
  and the reasoning must be defensible. Needs efficient workflows — time is
  money. Wants to know: can I share this with people who don't have accounts?
- **Entry:** `/welcome` → `/dashboard` → `/build` → `/build/[id]` →
  `/shared/[token]`
- **Test:** Does the platform feel like a professional tool, not a classroom
  exercise? Is the shared/export view polished enough for external audiences?
  Does the AI co-reasoning feel like a sharp analyst, not a patient teacher?
  Can they build and share within a single working session?

### 9. Individual making everyday decisions

- **Who:** 28-year-old deciding which city to move to, whether to go back to
  school, which car to buy, or how to approach a relationship issue. Low-to-
  moderate stakes but wants to feel confident they've thought it through.
- **Goal:** Build a quick house that organizes their thinking. Doesn't need
  perfection — needs the process to feel proportionate and useful, not
  overkill.
- **Key concern:** "Is this too heavy for my decision?" — if the platform
  feels like it demands a dissertation for a simple question, they'll abandon
  it. Wants a lightweight, satisfying experience.
- **Entry:** `/welcome` → `/dashboard` → `/build` → `/build/[id]`
- **Test:** Can they build a useful house in 10–15 minutes? Does the 12-layer
  structure feel like helpful scaffolding or intimidating bureaucracy? Are
  layers optional or do they feel mandatory? Does the AI know when to go
  light?

### 10. Mobile-only user

- **Who:** College student whose primary computing device is a phone (375×812
  viewport). Common demographic for lower-income students.
- **Goal:** Build and submit a house entirely from a mobile device.
- **Key concern:** Touch targets, horizontal overflow, modal stacking, keyboard
  occlusion on text inputs, and the fundamental question: is the 12-layer house
  builder even usable at this viewport?
- **Entry:** Any post-login route, tested at `mobile` preset (375×812).
- **Test:** Can they complete a full house build? Is the blueprint rail usable?
  Does the canvas scroll correctly? Can they reach all actions?

---

## The 8 Evaluation Lenses

Every finding must be tagged with **at least one** lens. When walking each
persona, evaluate their experience through **every applicable lens** — don't
stop after finding one issue per page.

### L1 — Accessibility (WCAG 2.1 AA)

- Color contrast ratios (4.5:1 text, 3:1 UI components)
- Keyboard navigation: logical tab order, no focus traps, visible focus rings
- Screen reader: semantic HTML, ARIA labels, `role` attributes, live regions
- Touch targets: minimum 44×44px on interactive elements
- Motion: respect `prefers-reduced-motion`
- Form labels: every input has an associated label or `aria-label`
- Error identification: programmatic association, not just color

### L2 — Clarity & Learnability

- Can the user understand the purpose of each screen without prior knowledge?
- Is terminology consistent and self-explanatory? (Watch for: "house,"
  "layer," "blueprint," "canvas," "collab," "pipeline," "strength" — are these
  defined on first encounter?)
- Does progressive disclosure work? (Simple first, advanced later)
- Are empty states instructive, not just empty?
- Is microcopy (button labels, tooltips, placeholders) specific rather than
  generic?

### L3 — Task Efficiency

- Count clicks/taps to complete core flows:
  - Create a new house and fill the first layer
  - Navigate from dashboard to an in-progress house
  - Submit a house for an assignment
  - Review a student's submission (teacher)
  - Change a profile setting
- Identify unnecessary intermediate screens, redundant confirmations, or
  missing shortcuts
- Check for sensible keyboard shortcuts on power-user surfaces (console, builder)

### L4 — Error Handling & Recovery

- What happens on network failure mid-save?
- Are error messages actionable? ("Something went wrong" vs. "Your house
  couldn't save — check your connection and try again")
- Can the user undo destructive actions? (Delete a house, leave a class,
  remove evidence)
- Empty state messaging: does it guide toward the fix, or just state the
  absence?
- Form validation: inline, on submit, or silent failure?

### L5 — Visual Hierarchy & Information Architecture

- Is the most important action the most visually prominent?
- Is navigation predictable? (Can the user always find their way back?)
- Does the header/nav update to reflect logged-in context?
- Are related actions grouped? (e.g., all house actions in one place)
- Breadcrumbs and back-navigation on deep routes (assignments, builder)
- Card layouts: does the dashboard card communicate the right information at
  a glance?

### L6 — Emotional Design & Motivation

- Does completing a layer feel like progress? (Progress bars, celebrations,
  checkmarks)
- Is the tone of AI responses encouraging without being condescending?
- Does the strength score motivate improvement or discourage?
- Are there moments of delight or satisfaction in the flow?
- Does the empty dashboard feel like an invitation or a barren wasteland?

### L7 — Consistency & Predictability

- Do similar actions use the same UI pattern? (e.g., all delete confirmations
  behave the same way)
- Are icon meanings stable across surfaces?
- Does button placement follow a consistent spatial pattern?
- Are loading states consistent? (Spinners vs. skeletons vs. nothing)
- Does the same term always mean the same thing?

### L8 — Performance & Responsiveness

- Are loading states present? (Skeleton screens, spinners, progress bars)
- Does the app feel fast? Check the waterfall for heavy or blocking requests
- Does the layout shift during load? (CLS)
- Does the builder remain responsive with a fully populated house?
- Test at `mobile` and `tablet` viewports — does layout adapt, or just shrink?
- Are images lazy-loaded? Do large assets block interaction?

---

## Execution protocol

### Step 1 — Prepare

1. Open **housesofthought.org** in the Browser pane.
2. Log in as a test user (ask the user for credentials if not available, or use
   an existing test account if one is known).
3. Confirm you're on the dashboard. Take a baseline screenshot.

### Step 2 — Walk each persona

For each of the 10 personas, in order:

1. **Announce** the persona you're testing (use it as a chapter marker).
2. **Navigate** the routes that persona would visit, in the order they would
   visit them.
3. At each significant screen:
   - `read_page` to check semantic structure, ARIA, and interactive elements
   - `read_console_messages` for errors or warnings
   - `computer { action: "screenshot" }` at desktop viewport
   - `resize_window { preset: "mobile" }` and screenshot again (for mobile
     persona, do the full walkthrough at mobile; for others, spot-check)
   - Interact with forms, buttons, and navigation as the persona would
4. **Record findings** for each lens that applies — tag each finding with both
   the persona number and the lens code (e.g., "P3-L2" = Teacher setup +
   Clarity).
5. Cross-reference findings with source code: identify the component, file,
   and line.

### Step 3 — Build the matrix

After all personas are tested, create the **Persona × Lens matrix** — a 10×8
grid where each cell is color-coded:

- 🟢 **Pass** — No issues found for this persona through this lens
- 🟡 **Minor** — Issues found but the flow completes acceptably
- 🔴 **Fail** — The experience is broken, confusing, or inaccessible for this
  persona through this lens
- ⚪ **N/A** — This lens doesn't meaningfully apply to this persona

### Step 4 — Prioritize

Score each finding:

- **Impact** (1–5): How many personas are affected? How badly?
- **Effort** (1–5): How hard is it to fix? (1 = trivial, 5 = architectural)
- **Priority** = Impact ÷ Effort — high-impact, low-effort fixes come first

### Step 5 — Deliver the report

Publish the report as an **Artifact** (HTML). Structure:

1. **Executive summary** — Total findings by severity, top 5 issues, overall
   readiness assessment
2. **Persona × Lens matrix** — The 10×8 grid with color-coded cells; each cell
   links to its findings
3. **Findings by persona** — Each persona gets a section with:
   - Persona description (one paragraph)
   - Flow walkthrough summary
   - Findings listed by lens, with severity badge, description, screenshot
     reference, and source file/line
4. **Cross-cutting themes** — Issues that appear across multiple personas
   (these are usually the most important to fix)
5. **Remediation plan** — Prioritized list of fixes grouped into sprints:
   - Sprint 1: Critical accessibility and broken flows
   - Sprint 2: Clarity and learnability gaps
   - Sprint 3: Mobile and responsiveness fixes
   - Sprint 4: Consistency, performance, and emotional polish
6. **Strengths** — Things working well that should be preserved or extended

Design: clean, scannable, editorial. Use:
- DM Serif Display for headings
- Source Sans 3 for body text
- JetBrains Mono for code references and labels
- Severity badges with semantic colors
- A sticky sidebar for navigation on desktop

After publishing, send the artifact link to the user.

---

## Finding template

Every finding must follow this structure:

```
**[P#-L#] Title** — Severity: Critical | High | Moderate | Low

Description of the issue from the persona's perspective. What they would
experience, not just what's technically wrong.

- **Affected surface:** Route/component name
- **Source:** `file_path:line_number`
- **Impact:** (1–5) × **Effort:** (1–5) = **Priority:** score
- **Recommendation:** Specific, actionable fix (not "make it better")
```

---

## Running the audit

This audit is comprehensive and takes significant time. For a faster pass,
the user may specify:

- **Specific personas only:** `post-login-ux-audit P1 P5 P9` (numbers from
  the persona list)
- **Specific lenses only:** `post-login-ux-audit L1 L3` (lens codes)
- **Specific surfaces only:** `post-login-ux-audit dashboard builder`

Default (no args) runs the full 10×8 matrix.
