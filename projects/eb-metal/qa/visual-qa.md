# Visual QA — EB Metal design system (Gate 5)

Independent review of `/prototype/eb-metal/design-system` via rendered screenshots (browser MCP unavailable in this session; Playwright full-page captures used).

## Review artifacts

| Viewport | File | Status |
|---|---|---|
| 1440 × 1000 | `screenshots/prototype/design-system/design-system-1440x1000.png` | Captured |
| 1280 × 800 | `screenshots/prototype/design-system/design-system-1280x800.png` | Captured |
| 768 × 1024 | `screenshots/prototype/design-system/design-system-768x1024.png` | Captured |
| 390 × 844 | `screenshots/prototype/design-system/design-system-390x844.png` | Captured |

Manifest: `screenshots/prototype/design-system-manifest.json`

## Pass criteria checked

- Not purple SaaS / glass / glow
- Not default shadcn card grid
- Industrial signal-orange used sparingly for primary actions
- Dense technical rows/tables present
- Calculator pass/fail/empty/error states present
- Submittal package panel requires naming (no silent default package)
- Prototype disclaimer footer present
- Demo data clearly labeled

## Findings

### DS-001 — Mobile navigation missing (resolved)

- **Page:** design-system
- **Viewport:** 390 × 844
- **Screenshot:** design-system-390x844.png (pre-fix)
- **Severity:** High
- **Problem:** Desktop nav hidden on small screens with no alternate menu control.
- **Why it matters:** Mobile users cannot reach primary IA destinations.
- **Recommended correction:** Add accessible mobile menu disclosure.
- **Responsible agent:** ui-systems
- **Resolution status:** Fixed — `Menu` `<details>` control added in `PrototypeShell`.

### DS-002 — Mobile technical table only scrolled (resolved)

- **Page:** design-system
- **Viewport:** 390 × 844
- **Severity:** High
- **Problem:** Wide table relied on horizontal scroll; keyed stack was mentioned but not implemented.
- **Why it matters:** Field users cannot scan engineering attributes comfortably.
- **Recommended correction:** Provide keyed definition-list stack under `md`.
- **Responsible agent:** ui-systems
- **Resolution status:** Fixed — stacked `dl` rows for mobile; table retained for `md+`.

### DS-003 — Nav items were non-links (resolved)

- **Page:** design-system
- **Viewport:** 1440 × 1000
- **Severity:** Medium
- **Problem:** Header labels were inert spans.
- **Why it matters:** Weak keyboard/AT preview of real prototype nav.
- **Recommended correction:** Use in-page anchors for design-system sections.
- **Responsible agent:** ui-systems
- **Resolution status:** Fixed — anchors to `#products`, `#engineering`, `#resources`, etc.

### DS-004 — Product action density on mobile (accepted / monitor)

- **Page:** design-system
- **Viewport:** 390 × 844
- **Severity:** Low
- **Problem:** Compare + Add buttons stack and consume vertical space per row.
- **Why it matters:** Catalog pages with many results may feel heavy.
- **Recommended correction:** In Gate 6 catalog, consider overflow menu or icon+text pairing once real density is known.
- **Responsible agent:** frontend-implementation
- **Resolution status:** Accepted for Gate 5; revisit in Gate 6 product catalog.

### DS-005 — Brand photography absent (accepted for design-system)

- **Page:** design-system
- **Viewport:** all
- **Severity:** Low
- **Problem:** Design-system route intentionally shows components without manufacturing photography.
- **Why it matters:** Full brand credibility needs product/mill imagery on marketing surfaces.
- **Recommended correction:** Gate 6 homepage/product pages must include purposeful industrial imagery (not stock-office).
- **Responsible agent:** brand-art-direction / frontend-implementation
- **Resolution status:** Accepted — out of Gate 5 component-kit scope.

## Gate 5 verdict

**Conditional pass for design-system route.** Critical/high findings DS-001 and DS-002 resolved and re-shot. No remaining critical/high open items on the design-system page.

**Gate 6 (full interactive prototype) is not approved yet** — proceed only after human review of this kit.

## Anti-AI-slop spot check (design-system only)

| Test | Result |
|---|---|
| Could be any company after logo swap? | Partially — kit is industrial/CFS-specific in content (demo designations, limiting-height language); marketing photography still pending Gate 6 |
| Repeated generic card grids? | Pass — rows/tables dominate |
| Vague transformation language? | Pass |
| Invented claims? | Pass — demo labels + disclaimer |
| Default Tailwind/shadcn look? | Pass — custom tokens, sharp radii, signal accent |
