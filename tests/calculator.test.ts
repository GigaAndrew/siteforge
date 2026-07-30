import { describe, expect, it } from "vitest";
import {
  filterPassingMembers,
  type DemoMember,
} from "@/lib/calculators/limiting-height";

describe("limiting-height demo lookup", () => {
  const members: DemoMember[] = [
    {
      designation: "A",
      maxHeightFt: 12.5,
      spacingIn: 16,
      lateralLoadPsf: 5,
      deflectionLimit: "L/240",
      depthIn: 3.625,
    },
    {
      designation: "B",
      maxHeightFt: 14.2,
      spacingIn: 16,
      lateralLoadPsf: 5,
      deflectionLimit: "L/240",
      depthIn: 3.625,
    },
    {
      designation: "C",
      maxHeightFt: 11,
      spacingIn: 16,
      lateralLoadPsf: 5,
      deflectionLimit: "L/240",
      depthIn: 3.625,
    },
  ];

  it("returns sorted passing members", () => {
    const pass = filterPassingMembers(members, 12, 16, 5, "L/240");
    expect(pass.map((m) => m.designation)).toEqual(["A", "B"]);
  });

  it("rejects invalid height", () => {
    expect(() => filterPassingMembers(members, 0, 16, 5, "L/240")).toThrow();
  });
});
