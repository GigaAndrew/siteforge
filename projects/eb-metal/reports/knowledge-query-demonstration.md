# Knowledge query demonstration — eb-metal

Structured smoke queries over Forge Knowledge for human review.

Generated: 2026-07-30T19:08:44.122Z

Classification legend: **fact** (observed) · **observation/finding** · **inference** · **recommendation**

## What product families does EB Metal offer?


| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| _(no matches)_ | — | — | — | — | — | — |

## What technical document types were discovered?

> DocumentType granularity is thin — mostly file extensions today; needs richer typing on next extract pass.

| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| pdf | `ent_DocumentType_6a74daf6a0617051` | DocumentType | fact | medium | `ev_2c1b22bc6ad66634` `ev_f87ae6d9a7ae3f6a` `ev_f8fc88eaa00b011a` | https://ebmetal.us/ https://ebmetal.us/eb-metal-golf-outing-2024 |

## Which user tasks are supported by the current website?

> UserTask is not yet a first-class extracted entity. Proxy: pages that indicate task destinations. See entity review.

| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| Catalog - Metal Framing Manufacturer - EB Metal | `ent_Page_02598fac7348bdbe` | Page | fact | mixed | `ev_9c248d576ccdf225` `ev_fc3f9bc23a150cde` `ev_4140582c9753a5f2` | https://ebmetal.us/catalog |
| Ceiling Span - Metal Framing Manufacturer - EB Metal | `ent_Page_5dbb843cc151623a` | Page | fact | high | `ev_79a3b66362be02a9` | https://ebmetal.us/ceiling-span-tables |
| General Product Information - Metal Framing Manufacturer - EB Metal | `ent_Page_5a2192c9879af707` | Page | fact | high | `ev_af39e37f20411340` | https://ebmetal.us/general-product-information |
| Web Crippling Load - Metal Framing Manufacturer - EB Metal | `ent_Page_fc3e0a50c28b8975` | Page | fact | high | `ev_8727f99e033e64bf` | https://ebmetal.us/web-crippling-load-tables |
| Floor Joist Span - Metal Framing Manufacturer - EB Metal | `ent_Page_cfd2397127563a49` | Page | fact | high | `ev_13ce1ed1b89662ad` | https://ebmetal.us/floor-joist-span-tables |
| Contact - Metal Framing Manufacturer - EB Metal | `ent_Page_ca7e657c5a440161` | Page | fact | high | `ev_d8b9ee86c389e18e` | https://ebmetal.us/contact-us |

## Which user tasks appear underserved?

> Derived from ProcessIssue/UxIssue observations (findings), not invented tasks.

| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| Calculators: score 2/10 | `ent_ProcessIssue_5ed51aae563eaebd` | ProcessIssue | observation | low | `ev_f82c2eb579427c34` | https://ebmetal.us/ |
| Submittal workflow: score 2/10 | `ent_ProcessIssue_fddb9cc58e34ee08` | ProcessIssue | observation | medium | `ev_2ceb8a20fc0fea8d` | https://ebmetal.us/ |
| Process efficiency: score 3/10 | `ent_ProcessIssue_70f4c3b8ea876530` | ProcessIssue | observation | medium | `ev_5f915825a3198bba` | https://ebmetal.us/ |
| Product discovery: score 4/10 | `ent_UxIssue_789dd65dccc47992` | UxIssue | observation | medium | `ev_d2bb073a8665043c` | https://ebmetal.us/ |
| Document management: score 3/10 | `ent_UxIssue_946309756fba925e` | UxIssue | observation | medium | `ev_8cc9ff706ef27c82` | https://ebmetal.us/ |

## What calculators or engineering tools exist?

> Includes recommended conceptual tools. Check classification field.

| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| Limiting height calculator | `ent_Calculator_e4cb4514d39b6e8b` | Calculator | recommendation | medium | `ev_24a1727f892d6c77` | https://www.ebmetal.us/ |

## What calculators are only recommendations?


| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| Limiting height calculator | `ent_Calculator_e4cb4514d39b6e8b` | Calculator | recommendation | medium | `ev_24a1727f892d6c77` | https://www.ebmetal.us/ |

## What submittal workflows exist?

> No observed SubmittalWorkflow entity — only process issues / opportunity recommendations about submittals.

| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| Submittal workflow: score 2/10 | `ent_ProcessIssue_fddb9cc58e34ee08` | ProcessIssue | observation | medium | `ev_2ceb8a20fc0fea8d` | https://ebmetal.us/ |
| Submittal drawer/sheet. | `ent_DigitalOpportunity_4a6ab9807ac9cadd` | DigitalOpportunity | recommendation | medium | `ev_2ceb8a20fc0fea8d` | https://ebmetal.us/ |
| Catalog + calculator + submittal. | `ent_DigitalOpportunity_68fcb1ea79f08e9d` | DigitalOpportunity | recommendation | medium | `ev_5f915825a3198bba` | https://ebmetal.us/ |

## Which process issues were identified?


| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| Calculators: score 2/10 | `ent_ProcessIssue_5ed51aae563eaebd` | ProcessIssue | observation | low | `ev_f82c2eb579427c34` | https://ebmetal.us/ |
| Submittal workflow: score 2/10 | `ent_ProcessIssue_fddb9cc58e34ee08` | ProcessIssue | observation | medium | `ev_2ceb8a20fc0fea8d` | https://ebmetal.us/ |
| Process efficiency: score 3/10 | `ent_ProcessIssue_70f4c3b8ea876530` | ProcessIssue | observation | medium | `ev_5f915825a3198bba` | https://ebmetal.us/ |

## Which digital opportunities were recommended?


| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| Gate 4–5 design system. | `ent_DigitalOpportunity_ec79f7aab71ef317` | DigitalOpportunity | recommendation | medium | `ev_72cbdc8946f5cc06` | https://ebmetal.us/ |
| Proposed sitemap in strategy. | `ent_DigitalOpportunity_0b4cf41de70cd202` | DigitalOpportunity | recommendation | medium | `ev_b6d9b1c2c1dc58f9` | https://ebmetal.us/ |
| Products catalog module (Gate 6). | `ent_DigitalOpportunity_5fac2f0b42ace8fc` | DigitalOpportunity | recommendation | medium | `ev_d2bb073a8665043c` | https://ebmetal.us/ |
| NITROSTUD detail prototype. | `ent_DigitalOpportunity_b3b9d43d7b36e39c` | DigitalOpportunity | recommendation | medium | `ev_068ffc7a7a33804e` | https://ebmetal.us/ |
| Resources center. | `ent_DigitalOpportunity_37385e33d827258d` | DigitalOpportunity | recommendation | medium | `ev_1663aabad85b17ae` | https://ebmetal.us/ |
| Document rows with status fields (unknown when missing). | `ent_DigitalOpportunity_bd06c7d92f51edd2` | DigitalOpportunity | recommendation | medium | `ev_8cc9ff706ef27c82` | https://ebmetal.us/ |
| Limiting-height calculator (conceptual). | `ent_DigitalOpportunity_96cbd31b8980774d` | DigitalOpportunity | recommendation | low | `ev_f82c2eb579427c34` | https://ebmetal.us/ |
| Submittal drawer/sheet. | `ent_DigitalOpportunity_4a6ab9807ac9cadd` | DigitalOpportunity | recommendation | medium | `ev_2ceb8a20fc0fea8d` | https://ebmetal.us/ |
| Contact workflow page. | `ent_DigitalOpportunity_1b14bbf6aaa88938` | DigitalOpportunity | recommendation | medium | `ev_1ebae1c4815b509a` | https://ebmetal.us/ |
| Responsive design-system patterns. | `ent_DigitalOpportunity_11083bb46d5ab7a6` | DigitalOpportunity | recommendation | low | `ev_a0fad283cd197a7b` | https://ebmetal.us/ |
| Accessible component system. | `ent_DigitalOpportunity_9135da6ca92f9595` | DigitalOpportunity | recommendation | medium | `ev_71d52f0d0480f8e1` | https://ebmetal.us/ |
| Lean prototype; production perf backlog. | `ent_DigitalOpportunity_8bdabda9d95482d8` | DigitalOpportunity | recommendation | low | `ev_9575e05d95f80cab` | https://ebmetal.us/ |
| Template-level metadata model. | `ent_DigitalOpportunity_8565c1980145cf28` | DigitalOpportunity | recommendation | medium | `ev_e3fb403a4ec76ef8` | https://ebmetal.us/ |
| prototype-copy.md | `ent_DigitalOpportunity_5359f7ed8f4afbb1` | DigitalOpportunity | recommendation | medium | `ev_61dc7ec44891b591` | https://ebmetal.us/ |
| Status unknown labels when missing. | `ent_DigitalOpportunity_0993054393bd5c7d` | DigitalOpportunity | recommendation | low | `ev_b513ed4ae5b828d2` | https://ebmetal.us/ |
| Tools before gated brochure asks. | `ent_DigitalOpportunity_5fa62a8fd20cf6f5` | DigitalOpportunity | recommendation | medium | `ev_4329f54fc70874d6` | https://ebmetal.us/ |
| Catalog + calculator + submittal. | `ent_DigitalOpportunity_68fcb1ea79f08e9d` | DigitalOpportunity | recommendation | medium | `ev_5f915825a3198bba` | https://ebmetal.us/ |
| Data schemas + search-ready inventories. | `ent_DigitalOpportunity_d71ac7a8e81919be` | DigitalOpportunity | recommendation | medium | `ev_72260d6f05055a07` | https://ebmetal.us/ |
| Full SiteForge prototype path. | `ent_DigitalOpportunity_7e78c1dc918cf633` | DigitalOpportunity | recommendation | medium | `ev_bde5d1021d76ec5c` | https://ebmetal.us/ |

## Which facts have the lowest confidence?


| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| No clear first-class limiting-height calculator UX dominant in crawl labels. | `ent_ProcessIssue_5ed51aae563eaebd` | Evidence | observation | low | `ev_f82c2eb579427c34` | https://ebmetal.us/ |
| Theme includes mobile viewport meta; dense homepage content likely stressful on  | `ent_UxIssue_cd98cfb3b136b842` | Evidence | observation | low | `ev_a0fad283cd197a7b` | https://ebmetal.us/ |
| CMS theme + third-party assets; Lighthouse pending. | `ent_PerformanceIssue_c563ff419ffcd80b` | Evidence | observation | low | `ev_9575e05d95f80cab` | https://ebmetal.us/ |
| Revision metadata largely unknown in document inventory. | `ent_UxIssue_b196222259f20188` | Evidence | observation | low | `ev_b513ed4ae5b828d2` | https://ebmetal.us/ |

## Which evidence may be stale?

> No stale evidence currently marked.

| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| _(no matches)_ | — | — | — | — | — | — |

## Which entities have no direct supporting source URL?


| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
| _(no matches)_ | — | — | — | — | — | — |

