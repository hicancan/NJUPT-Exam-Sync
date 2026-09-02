import { describe, expect, it } from "vitest";
import { formatExamDisplayDate } from "./examDateTime";

describe("exam date display", () => {
  it("keeps official Nanjing wall-clock time regardless of the device timezone", () => {
    expect(formatExamDisplayDate("2026-06-24T05:30:00Z")).toBe(
      "6月24日周三 13:30",
    );
  });

  it("renders absent timestamps as empty text", () => {
    expect(formatExamDisplayDate(null)).toBe("");
  });
});
