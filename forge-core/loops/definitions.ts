export type LoopDefinition = {
  id: string;
  name: string;
  purpose: string;
  activateWhen: string[];
  capabilities: string[];
  maxIterations: number;
};

export const LOOP_DEFINITIONS: LoopDefinition[] = [
  {
    id: "evidence",
    name: "Evidence Loop",
    purpose: "Repair extraction and strengthen evidence quality",
    activateWhen: ["pages_need_repair", "unsupported_facts", "low_text_quality"],
    capabilities: ["extraction.repair", "knowledge.build", "reliability.score"],
    maxIterations: 3,
  },
  {
    id: "audit",
    name: "Audit Loop",
    purpose: "Fill missing audit facets",
    activateWhen: ["missing_audit_artifacts"],
    capabilities: [
      "audit.technical",
      "audit.accessibility",
      "audit.seo",
      "audit.performance",
      "audit.ux",
    ],
    maxIterations: 3,
  },
  {
    id: "strategy",
    name: "Strategy Loop",
    purpose: "Improve recommendations and strategy package",
    activateWhen: ["low_recommendation_confidence", "strategy_rejected"],
    capabilities: ["strategy.generate"],
    maxIterations: 3,
  },
  {
    id: "prototype",
    name: "Prototype Loop",
    purpose: "Generate and QA prototype surfaces",
    activateWhen: ["browser_qa_failed", "prototype_invalid"],
    capabilities: ["prototype.generate", "qa.browser"],
    maxIterations: 3,
  },
  {
    id: "learning",
    name: "Learning Loop",
    purpose: "Extract lessons and platform improvements",
    activateWhen: ["run_near_complete"],
    capabilities: ["lessons.derive", "platform.improvements"],
    maxIterations: 2,
  },
];

export function getLoop(id: string): LoopDefinition | undefined {
  return LOOP_DEFINITIONS.find((l) => l.id === id);
}
