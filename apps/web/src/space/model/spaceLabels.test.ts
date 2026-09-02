import { describe, expect, it } from "vitest";
import { formatCampusBuildingLabel, sameSpaceLabel } from "./spaceLabels";

describe("space labels", () => {
  it("collapses a campus and building with the same label", () => {
    expect(sameSpaceLabel("锁金", " 锁金 ")).toBe(true);
    expect(formatCampusBuildingLabel("锁金", "锁金")).toBe("锁金校区");
  });

  it("keeps a distinct building in the location label", () => {
    expect(formatCampusBuildingLabel("仙林", "教4")).toBe("仙林校区 · 教4");
  });
});
