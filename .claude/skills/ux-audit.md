---
name: ux-audit
description: Full-flow UX audit of the live site from multiple user viewpoints
user_invocable: true
---

# UX Audit — Full-flow site review

Perform a comprehensive UX audit of the live site at **housesofthought.org**. Test every reachable flow end-to-end, identify friction and drop-off points, and deliver a structured report with an executable remediation plan.

## Methodology

### 1. Choose 6 viewpoints

Pick 6 distinct user personas that represent the site's actual audience. Good defaults (adapt if the product has shifted):

1. **First-time curious student** — Landing → Try it → Sign up
2. **Educator evaluating for classroom** — Landing → Educators → How it works → Sign up
3. **Returning logged-in user** — Dashboard → Building a house → Review
4. **Mobile user** — All core flows on a 375×812 viewport
5. **SEO / organic discovery visitor** — Entry points → Understanding value → Converting
6. **Skeptic / comparison shopper** — FAQ → Examples → Compare → Story

### 2. Test the live site

Use the Browser pane to walk through every page and flow on the live site. For each viewpoint:

- Navigate every page the persona would reach
- Test on both desktop and mobile (use `resize_window` with preset `mobile`)
- Check for visual bugs, broken interactions, blank content, layout overflow
- Read the page tree (`read_page`) to catch DOM-present-but-invisible content
- Check console errors (`read_console_messages`)
- Test form submissions, CTAs, navigation links
- Note where the user would realistically drop off or get confused

### 3. Cross-reference the codebase

For every issue found on the live site, trace it to the source code:

- Identify the component, file, and line causing the issue
- Understand *why* it happens (not just *that* it happens)
- Check if the issue affects other pages using the same pattern
- Note any positive patterns worth calling out as strengths

### 4. Classify findings

Use these severity levels:

- **Critical** — Entire page or flow is broken / unusable for a meaningful user segment
- **High** — Significant friction that will measurably reduce conversion or retention
- **Moderate** — Noticeable UX issue that degrades experience but has workarounds
- **Positive** — Things working well that should be preserved

### 5. Build the executable plan

Group fixes into time-boxed sprints (roughly 1 week each for a solo dev). Order by impact × effort:

- Sprint 1: Fix what's broken (critical + quick high-impact fixes)
- Sprint 2: Reduce signup/onboarding friction
- Sprint 3: Build trust and content depth
- Sprint 4: Polish and progressive disclosure

### 6. Deliver the report

Publish the report as an **Artifact** (HTML). Include:

- A scorecard (total findings, critical/high/moderate counts, strengths)
- One section per viewpoint with persona description, strengths, and findings
- Each finding: title, severity badge, description, affected file/line
- A summary table of all findings with severity, viewpoints affected, and drop-off risk
- An executable plan with sprints, tasks, and severity labels
- Use a professional, editorial design — DM Serif Display for headings, Source Sans 3 for body, JetBrains Mono for labels

After publishing, send the artifact link to the user.
