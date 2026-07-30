---
name: visual-qa
description: Performs independent browser-based visual critique at required viewports, documents findings in qa/visual-qa.md with severity and resolution tracking. Use at Gate 5 design-system review, Gate 8 prototype critique, or when UI looks generic or off-brand.
---

# Visual QA

## Workflow

1. Confirm dev server running; load routes from prototype sitemap.
2. Review each primary page at **1440×1000**, **1280×800**, **768×1024**, **390×844**.
3. Capture screenshots; compare against `design/art-direction.md` and `design-tokens.json`.
4. Evaluate: first impression, credibility, originality, typography, hierarchy, spacing, alignment, content density, navigation, tables, calculators, submittal UX, focus/empty/error states, generic AI patterns.
5. Write finding per issue: page, viewport, screenshot path, severity (critical/high/medium/low), problem, why it matters, recommended correction, responsible agent, resolution status.
6. Assign critical/high fixes to ui-systems, frontend-implementation, brand-art-direction, or editorial-design.
7. Re-review after fixes; capture post-fix screenshots; update resolution status.
8. Orchestrator advances gate only when critical/high findings are resolved.

## Required outputs

```
projects/<slug>/qa/visual-qa.md
projects/<slug>/screenshots/current/** (updated after fixes)
```

Gate 7 context: also reference `projects/<slug>/qa/automated-qa.md`.

## Prohibitions

- Do not approve based on code review alone — must render in browser.
- Do not implement fixes — assign to responsible agent.
- Do not approve own implementing agent's work without independent pass.
- Do not delete prior findings — mark resolved with date.
- Do not skip mobile (390×844) or design-system route review.
