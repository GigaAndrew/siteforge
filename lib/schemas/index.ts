import { z } from "zod";

export * from "./project";
export * from "./crawl";
export * from "./analysis";
export * from "./knowledge";

export const GateIdSchema = z.enum([
  "gate_1_source_evidence",
  "gate_2_audit",
  "gate_3_strategy",
  "gate_4_art_direction",
  "gate_5_design_system",
  "gate_6_interactive_prototype",
  "gate_7_automated_qa",
  "gate_8_visual_critique",
  "gate_9_pitch_package",
]);

export type GateId = z.infer<typeof GateIdSchema>;
