import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PeriodPointSelector } from "./PeriodPointSelector";
import { nextPeriodSelection, summarizePeriodStates } from "./periodPointModel";

describe("period point selection", () => {
  const all = [1, 2, 3, 4];

  it("keeps the floor overview on exactly one time point", () => {
    expect(nextPeriodSelection("single", all, [2], 4)).toEqual([4]);
  });

  it("starts a focused room selection when every point was selected", () => {
    expect(nextPeriodSelection("multiple", all, all, 3)).toEqual([3]);
  });

  it("toggles room-detail time points deterministically", () => {
    expect(nextPeriodSelection("multiple", all, [1, 3], 2)).toEqual([1, 2, 3]);
    expect(nextPeriodSelection("multiple", all, [1, 2, 3], 2)).toEqual([1, 3]);
  });

  it("summarizes every selected point instead of reusing the floor point", () => {
    expect(summarizePeriodStates(["free", "teaching"])).toBe("teaching");
    expect(summarizePeriodStates(["teaching", "exam"])).toBe("exam");
    expect(summarizePeriodStates([])).toBe("free");
  });

  it("renders period metadata from the artifact instead of fixed clock text", () => {
    const html = renderToStaticMarkup(
      createElement(PeriodPointSelector, {
        label: "选择时间",
        mode: "multiple",
        periods: [
          { period: 2, start_time: "09:01", end_time: "09:46" },
          { period: 7, start_time: "14:36", end_time: "15:21" },
        ],
        selected: [2, 7],
        onChange: () => undefined,
        stateFor: (period) => (period === 2 ? "teaching" : "free"),
      }),
    );

    expect(html).toContain("09:01");
    expect(html).toContain("14:36");
    expect(html).toContain("第 2 节，09:01–09:46，上课，已选择");
    expect(html).toContain("第 7 节，14:36–15:21，空闲，已选择");
  });
});
