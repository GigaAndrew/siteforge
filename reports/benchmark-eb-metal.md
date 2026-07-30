# Benchmark Report — EB Metal US (`eb-metal`)

- Benchmark: **CFS Digital Capability Benchmark** (`cfs-digital-capability`) v1.0.0
- Status: accepted — Accepted for engine use within SiteForge. Human review still required before external publication. Candidate patterns are excluded from criteria.
- Generated: 2026-07-30T21:02:50.092Z
- Run ID: `b9cc3f19-12b2-4d7c-b800-dfe8ab9fa8d7`
- Input digest: `219e5e6b62338c3af116b16d`

## Overall

| Metric | Value |
|---|---|
| Performance (weighted eligible dims) | 75.0 |
| Confidence | 60.9% |
| Evidence coverage | 47.4% |
| Uncertainty | 39.1% |
- Caveat: Overall score is weighted across eligible dimensions only; see component scores
- Caveat: Candidate patterns excluded from benchmark criteria (remain unapproved)

### Calculation trace
- `eligibleDims=10 weightSum=0.900 overall=75.01`

## Dimension scores

| Dimension | Raw | Weighted | Confidence | Coverage | Eligible |
|---|---:|---:|---:|---:|---|
| Capability Presence | 66.7 | 13.33 | 57% | 45% | yes |
| Discoverability | 70.0 | 7.00 | 72% | 75% | yes |
| Information Completeness | 70.0 | 7.00 | 59% | 50% | yes |
| Technical Depth | — | — | 35% | 0% | no |
| Workflow Support | 55.0 | 5.50 | 66% | 67% | yes |
| Document Accessibility | 55.0 | 4.40 | 59% | 50% | yes |
| Product Navigation | 77.5 | 5.43 | 61% | 50% | yes |
| Engineering Utility | 100.0 | 10.00 | 63% | 50% | yes |
| Evidence Quality | 100.0 | 10.00 | 57% | 45% | yes |
| Evidence Recency | 95.0 | 2.85 | 57% | 45% | yes |
| Cross-Channel Consistency | 100.0 | 2.00 | 57% | 45% | yes |

## Concept scores (capability presence)

| Concept | Score | Confidence | State notes |
|---|---:|---:|---|
| Document Center | 55.0 | 82% | — |
| Engineering Calculator | 100.0 | 95% | — |
| Product Selector | — | 35% | Unknown — insufficient evidence; not treated as absent |
| Submittal Workflow | 55.0 | 82% | — |
| Technical Resources | — | 35% | Unknown — insufficient evidence; not treated as absent |
| Product Catalog | 100.0 | 90% | — |
| Product Data Sheet | 100.0 | 85% | — |
| Installation Guide | — | 35% | Unknown — insufficient evidence; not treated as absent |
| Specification | — | 35% | Unknown — insufficient evidence; not treated as absent |
| CAD/BIM Resource | — | 35% | Unknown — insufficient evidence; not treated as absent |
| Code Report | — | 35% | Unknown — insufficient evidence; not treated as absent |
| Engineering Table | — | 35% | Unknown — insufficient evidence; not treated as absent |
| Limiting Height Tool | — | 35% | Unknown — insufficient evidence; not treated as absent |
| Product Family | — | 35% | Unknown — insufficient evidence; not treated as absent |
| Product Detail | 55.0 | 82% | — |
| Contact / Rep Locator | 55.0 | 82% | — |
| Search Experience | 55.0 | 82% | — |
| Navigation Pattern | — | 35% | Unknown — insufficient evidence; not treated as absent |
| Download Workflow | — | 35% | Unknown — insufficient evidence; not treated as absent |
| Calculator Opportunity | 25.0 | 85% | — |

## Observation summary

| present | partial | absent | unknown | ambiguous | conflicts |
|---:|---:|---:|---:|---:|---:|
| 16 | 33 | 0 | 59 | 0 | 0 |

Total observations: 108. Unknown is never converted to absent.

## Recommendations

### optimization_opportunity — canon_document-center
- Gap: Partial evidence for Document Center
- Action: Strengthen on-site implementation and re-evidence the capability (not peer-copy)
- Confidence: 82%
- Impact: Stronger first-class UX for this capability improves engineering utility and discoverability
- Limitations: Recommendation grounded in this company's evidence weakness, not peer feature parity alone

### evidence_gap — canon_product-selector
- Gap: Unknown status for Product Selector
- Action: Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark
- Confidence: 35%
- Impact: Cannot judge capability quality until evidence is collected
- Limitations: Do not treat unknown as confirmed absence; Peer presence alone is not a recommendation trigger

### optimization_opportunity — canon_submittal-workflow
- Gap: Partial evidence for Submittal Workflow
- Action: Strengthen on-site implementation and re-evidence the capability (not peer-copy)
- Confidence: 82%
- Impact: Stronger first-class UX for this capability improves engineering utility and discoverability
- Limitations: Recommendation grounded in this company's evidence weakness, not peer feature parity alone

### evidence_gap — canon_technical-resources
- Gap: Unknown status for Technical Resources
- Action: Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark
- Confidence: 35%
- Impact: Cannot judge capability quality until evidence is collected
- Limitations: Do not treat unknown as confirmed absence; Peer presence alone is not a recommendation trigger

### evidence_gap — canon_installation-guide
- Gap: Unknown status for Installation Guide
- Action: Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark
- Confidence: 35%
- Impact: Cannot judge capability quality until evidence is collected
- Limitations: Do not treat unknown as confirmed absence; Peer presence alone is not a recommendation trigger

### evidence_gap — canon_specification
- Gap: Unknown status for Specification
- Action: Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark
- Confidence: 35%
- Impact: Cannot judge capability quality until evidence is collected
- Limitations: Do not treat unknown as confirmed absence; Peer presence alone is not a recommendation trigger

### evidence_gap — canon_cad-bim-resource
- Gap: Unknown status for CAD/BIM Resource
- Action: Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark
- Confidence: 35%
- Impact: Cannot judge capability quality until evidence is collected
- Limitations: Do not treat unknown as confirmed absence; Peer presence alone is not a recommendation trigger

### evidence_gap — canon_code-report
- Gap: Unknown status for Code Report
- Action: Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark
- Confidence: 35%
- Impact: Cannot judge capability quality until evidence is collected
- Limitations: Do not treat unknown as confirmed absence; Peer presence alone is not a recommendation trigger

### evidence_gap — canon_engineering-table
- Gap: Unknown status for Engineering Table
- Action: Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark
- Confidence: 35%
- Impact: Cannot judge capability quality until evidence is collected
- Limitations: Do not treat unknown as confirmed absence; Peer presence alone is not a recommendation trigger

### evidence_gap — canon_limiting-height-tool
- Gap: Unknown status for Limiting Height Tool
- Action: Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark
- Confidence: 35%
- Impact: Cannot judge capability quality until evidence is collected
- Limitations: Do not treat unknown as confirmed absence; Peer presence alone is not a recommendation trigger

### evidence_gap — canon_product-family
- Gap: Unknown status for Product Family
- Action: Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark
- Confidence: 35%
- Impact: Cannot judge capability quality until evidence is collected
- Limitations: Do not treat unknown as confirmed absence; Peer presence alone is not a recommendation trigger

### evidence_gap — canon_navigation-pattern
- Gap: Unknown status for Navigation Pattern
- Action: Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark
- Confidence: 35%
- Impact: Cannot judge capability quality until evidence is collected
- Limitations: Do not treat unknown as confirmed absence; Peer presence alone is not a recommendation trigger

### evidence_gap — canon_download-workflow
- Gap: Unknown status for Download Workflow
- Action: Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark
- Confidence: 35%
- Impact: Cannot judge capability quality until evidence is collected
- Limitations: Do not treat unknown as confirmed absence; Peer presence alone is not a recommendation trigger

### confirmed_gap — canon_document-center
- Gap: Weaker evidenced implementation vs cohort peer (Δ=45.0); own state=partial
- Action: Improve this company's own evidenced capability — peer parity is context, not the requirement
- Confidence: 70%
- Impact: Users may struggle to complete related engineering/document tasks
- Limitations: Limited peer comparison / validation cohort; Do not copy peer UX blindly; Synthetic fixture peers are not market proof

### confirmed_gap — canon_submittal-workflow
- Gap: Weaker evidenced implementation vs cohort peer (Δ=45.0); own state=partial
- Action: Improve this company's own evidenced capability — peer parity is context, not the requirement
- Confidence: 70%
- Impact: Users may struggle to complete related engineering/document tasks
- Limitations: Limited peer comparison / validation cohort; Do not copy peer UX blindly; Synthetic fixture peers are not market proof

## Unresolved review

- Publication requires `benchmark.definition.review`, `benchmark.observation.review`, `benchmark.publish`.
- Candidate patterns remain unapproved and are excluded from criteria.

