# Live vs Synthetic Cohorts

| Kind | Detection | Role |
|---|---|---|
| Live | Not synthetic | Production-facing validation / comparison |
| Synthetic | `notes` contain synthetic/fixture **or** URL contains `.example` | Deterministic tests / regression only |

`northline-framing` remains a synthetic fixture. It must not appear in live market claims.

```bash
npm run siteforge -- benchmark-cohort --live-cohort
```

Mixed cohorts are labeled explicitly and warn that synthetic evidence is not market proof.
