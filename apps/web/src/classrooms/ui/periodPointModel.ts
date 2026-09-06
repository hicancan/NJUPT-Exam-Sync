import type { SpatialRoomState } from "@/space/SpatialViewport";

export const PERIOD_STATE_LABEL: Record<SpatialRoomState, string> = {
  free: "空闲",
  teaching: "上课",
  exam: "考试",
};

export const PERIOD_STATE_CLASS: Record<SpatialRoomState, string> = {
  free: "bg-[#e8f0fe] text-[#174ea6] dark:bg-[#183153] dark:text-[#aecbfa]",
  teaching: "bg-[#e6f4ea] text-[#137333] dark:bg-[#173b27] dark:text-[#81c995]",
  exam: "bg-[#fef7e0] text-[#8d5b00] dark:bg-[#493a14] dark:text-[#fdd663]",
};

export function nextPeriodSelection(
  mode: "single" | "multiple",
  available: number[],
  selected: number[],
  point: number,
): number[] {
  if (mode === "single") return [point];
  const allSelected =
    available.length > 0 && available.every((item) => selected.includes(item));
  if (allSelected) return [point];
  return selected.includes(point)
    ? selected.filter((item) => item !== point)
    : [...selected, point].sort((left, right) => left - right);
}

export function summarizePeriodStates(
  states: SpatialRoomState[],
): SpatialRoomState {
  if (states.includes("exam")) return "exam";
  if (states.includes("teaching")) return "teaching";
  return "free";
}
