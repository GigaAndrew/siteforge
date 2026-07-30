import { loadStore } from "@/lib/knowledge/store";
import { getEvidenceForEntity } from "@/lib/knowledge/inspect";
import type {
  EpistemicClass,
  KnowledgeEntity,
} from "@/lib/schemas/knowledge";

export type DemoHit = {
  name: string;
  entityId: string;
  type: string;
  classification: EpistemicClass;
  confidence: "high" | "medium" | "low" | "mixed" | "none";
  evidenceIds: string[];
  sourceUrls: string[];
  notes?: string;
};

export type DemoQueryResult = {
  question: string;
  results: DemoHit[];
  notes?: string;
};

function hitsForEntities(entities: KnowledgeEntity[]): DemoHit[] {
  const store = loadStore();
  return entities.map((ent) => {
    const ev = getEvidenceForEntity(store, ent.id);
    const confidences = [...new Set(ev.map((e) => e.provenance.confidence))];
    const confidence =
      confidences.length === 0
        ? "none"
        : confidences.length > 1
          ? "mixed"
          : confidences[0]!;
    return {
      name: ent.name,
      entityId: ent.id,
      type: ent.type,
      classification: ent.epistemicClass,
      confidence,
      evidenceIds: ent.evidenceIds,
      sourceUrls: [
        ...new Set(
          ev
            .map((e) => e.provenance.sourceUrl)
            .filter((u): u is string => Boolean(u)),
        ),
      ],
      notes:
        typeof ent.properties.classification === "string"
          ? `property.classification=${ent.properties.classification}`
          : undefined,
    };
  });
}

export function runDemoQueries(projectSlug: string): DemoQueryResult[] {
  const store = loadStore();
  const inProject = (e: KnowledgeEntity) =>
    e.sourceProjects.includes(projectSlug);

  const families = [...store.entities.values()].filter(
    (e) => e.type === "ProductFamily" && inProject(e),
  );
  const docTypes = [...store.entities.values()].filter(
    (e) => e.type === "DocumentType" && inProject(e),
  );
  const pages = [...store.entities.values()].filter(
    (e) => e.type === "Page" && inProject(e),
  );
  const calculators = [...store.entities.values()].filter(
    (e) => e.type === "Calculator" && inProject(e),
  );
  const recommendedCalcs = calculators.filter(
    (e) => e.epistemicClass === "recommendation",
  );
  const processIssues = [...store.entities.values()].filter(
    (e) => e.type === "ProcessIssue" && inProject(e),
  );
  const opportunities = [...store.entities.values()].filter(
    (e) => e.type === "DigitalOpportunity" && inProject(e),
  );
  const submittal = [...store.entities.values()].filter(
    (e) =>
      inProject(e) &&
      (e.type === "SubmittalWorkflow" ||
        /submittal/i.test(e.name) ||
        (e.type === "ProcessIssue" && /submittal/i.test(e.name))),
  );
  const uxIssues = [...store.entities.values()].filter(
    (e) => e.type === "UxIssue" && inProject(e),
  );

  const lowConfEvidence = [...store.evidence.values()]
    .filter(
      (e) =>
        e.provenance.sourceProject === projectSlug &&
        e.provenance.confidence === "low",
    )
    .slice(0, 20);

  const stale = [...store.evidence.values()].filter(
    (e) => e.provenance.sourceProject === projectSlug && e.stale,
  );

  const noSourceEntities = [...store.entities.values()].filter(
    (e) =>
      inProject(e) &&
      (e.evidenceIds.length === 0 ||
        !e.evidenceIds.some((id) => {
          const ev = store.evidence.get(id);
          return Boolean(ev?.provenance.sourceUrl);
        })),
  );

  const underserved = [
    ...processIssues,
    ...uxIssues.filter((u) => /calculator|submittal|document|product discovery/i.test(u.name)),
  ];

  return [
    {
      question: "What product families does EB Metal offer?",
      results: hitsForEntities(families),
    },
    {
      question: "What technical document types were discovered?",
      results: hitsForEntities(docTypes),
      notes:
        docTypes.length <= 1
          ? "DocumentType granularity is thin — mostly file extensions today; needs richer typing on next extract pass."
          : undefined,
    },
    {
      question: "Which user tasks are supported by the current website?",
      results: hitsForEntities(
        pages
          .filter((p) =>
            /product|catalog|distributor|contact|document|table|tool/i.test(
              p.name + JSON.stringify(p.properties),
            ),
          )
          .slice(0, 15),
      ),
      notes:
        "UserTask is not yet a first-class extracted entity. Proxy: pages that indicate task destinations. See entity review.",
    },
    {
      question: "Which user tasks appear underserved?",
      results: hitsForEntities(underserved.slice(0, 20)),
      notes:
        "Derived from ProcessIssue/UxIssue observations (findings), not invented tasks.",
    },
    {
      question: "What calculators or engineering tools exist?",
      results: hitsForEntities(calculators),
      notes:
        "Includes recommended conceptual tools. Check classification field.",
    },
    {
      question: "What calculators are only recommendations?",
      results: hitsForEntities(recommendedCalcs),
    },
    {
      question: "What submittal workflows exist?",
      results: hitsForEntities(submittal),
      notes:
        submittal.filter((s) => s.type === "SubmittalWorkflow").length === 0
          ? "No observed SubmittalWorkflow entity — only process issues / opportunity recommendations about submittals."
          : undefined,
    },
    {
      question: "Which process issues were identified?",
      results: hitsForEntities(processIssues),
    },
    {
      question: "Which digital opportunities were recommended?",
      results: hitsForEntities(opportunities),
    },
    {
      question: "Which facts have the lowest confidence?",
      results: lowConfEvidence.map((e) => ({
        name: e.provenance.evidenceExcerpt ?? e.id,
        entityId: e.relatedEntityIds[0] ?? "(none)",
        type: "Evidence",
        classification: e.provenance.epistemicClass,
        confidence: e.provenance.confidence,
        evidenceIds: [e.id],
        sourceUrls: e.provenance.sourceUrl ? [e.provenance.sourceUrl] : [],
      })),
    },
    {
      question: "Which evidence may be stale?",
      results: stale.map((e) => ({
        name: e.provenance.evidenceExcerpt ?? e.id,
        entityId: e.relatedEntityIds[0] ?? "(none)",
        type: "Evidence",
        classification: e.provenance.epistemicClass,
        confidence: e.provenance.confidence,
        evidenceIds: [e.id],
        sourceUrls: e.provenance.sourceUrl ? [e.provenance.sourceUrl] : [],
        notes: "stale=true",
      })),
      notes: stale.length === 0 ? "No stale evidence currently marked." : undefined,
    },
    {
      question: "Which entities have no direct supporting source URL?",
      results: hitsForEntities(noSourceEntities.slice(0, 25)),
    },
  ];
}

export function renderDemoQueriesMarkdown(
  projectSlug: string,
  results: DemoQueryResult[],
): string {
  const sections = results
    .map((q) => {
      const rows = q.results.length
        ? q.results
            .map(
              (r) =>
                `| ${r.name.replace(/\|/g, "/").slice(0, 80)} | \`${r.entityId}\` | ${r.type} | ${r.classification} | ${r.confidence} | ${r.evidenceIds.slice(0, 3).map((id) => `\`${id}\``).join(" ") || "—"} | ${r.sourceUrls.slice(0, 2).join(" ") || "—"} |`,
            )
            .join("\n")
        : "| _(no matches)_ | — | — | — | — | — | — |";
      return `## ${q.question}

${q.notes ? `> ${q.notes}\n` : ""}
| Result | Entity ID | Type | Classification | Confidence | Evidence IDs | Source URLs |
|---|---|---|---|---|---|---|
${rows}
`;
    })
    .join("\n");

  return `# Knowledge query demonstration — ${projectSlug}

Structured smoke queries over Forge Knowledge for human review.

Generated: ${new Date().toISOString()}

Classification legend: **fact** (observed) · **observation/finding** · **inference** · **recommendation**

${sections}
`;
}
