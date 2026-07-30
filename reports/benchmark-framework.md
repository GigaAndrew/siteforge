# Benchmark Framework

## Definition

- **ID:** `cfs-digital-capability`
- **Name:** CFS Digital Capability Benchmark
- **Version:** 1.0.0
- **Status:** accepted
- **Industry:** cold-formed-steel

Evidence-backed digital capability benchmark for cold-formed steel and adjacent building-product manufacturers. Seed definition for SiteForge — not a universal industry standard.

## Scope

Public website digital capabilities observable via SiteForge crawl/knowledge/normalization. Excludes market share, company size, and commercial performance.

## Dimensions

| ID | Name | Weight |
|---|---|---:|
| capability_presence | Capability Presence | 0.2 |
| discoverability | Discoverability | 0.1 |
| information_completeness | Information Completeness | 0.1 |
| technical_depth | Technical Depth | 0.1 |
| workflow_support | Workflow Support | 0.1 |
| document_accessibility | Document Accessibility | 0.08 |
| product_navigation | Product Navigation | 0.07 |
| engineering_utility | Engineering Utility | 0.1 |
| evidence_quality | Evidence Quality | 0.1 |
| evidence_recency | Evidence Recency | 0.03 |
| cross_channel_consistency | Cross-Channel Consistency | 0.02 |

## Eligibility

- minMappedConcepts: 3
- minEvidenceCoverage: 0.35
- minEligibleDimensions: 4
- requiredDimensions: capability_presence, evidence_quality

## Missing-data policy

- unknownIsNotAbsent: true
- fabricateScores: false
- suppressOverallBelowCoverage: 0.35

## Notes

Accepted for engine use within SiteForge. Human review still required before external publication. Candidate patterns are excluded from criteria.

Candidate patterns are **excluded** from scoring criteria until explicitly approved.
