export type DemoMember = {
  designation: string;
  maxHeightFt: number;
  spacingIn: number;
  lateralLoadPsf: number;
  deflectionLimit: string;
  depthIn: number;
};

export function filterPassingMembers(
  members: DemoMember[],
  requiredHeightFt: number,
  spacingIn: number,
  lateralLoadPsf: number,
  deflectionLimit: string,
): DemoMember[] {
  if (requiredHeightFt <= 0) {
    throw new Error("Wall height must be greater than zero");
  }
  return members
    .filter(
      (m) =>
        m.spacingIn === spacingIn &&
        m.lateralLoadPsf === lateralLoadPsf &&
        m.deflectionLimit === deflectionLimit &&
        m.maxHeightFt >= requiredHeightFt,
    )
    .sort((a, b) => a.maxHeightFt - b.maxHeightFt);
}
