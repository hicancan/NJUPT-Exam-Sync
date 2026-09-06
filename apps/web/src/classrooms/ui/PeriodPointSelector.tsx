import type { SpatialRoomState } from "@/space/SpatialViewport";
import {
  nextPeriodSelection,
  PERIOD_STATE_CLASS,
  PERIOD_STATE_LABEL,
} from "./periodPointModel";

export interface PeriodPoint {
  period: number;
  start_time: string;
  end_time: string;
}

interface PeriodPointSelectorProps {
  label: string;
  mode: "single" | "multiple";
  periods: PeriodPoint[];
  selected: number[];
  onChange: (periods: number[]) => void;
  stateFor?: (period: number) => SpatialRoomState;
}

const naturalPeriods = (periods: PeriodPoint[]) =>
  [...periods].sort((left, right) => left.period - right.period);

export function PeriodPointSelector({
  label,
  mode,
  periods,
  selected,
  onChange,
  stateFor,
}: PeriodPointSelectorProps) {
  const ordered = naturalPeriods(periods);
  const allSelected =
    ordered.length > 0 &&
    ordered.every((item) => selected.includes(item.period));
  const summary =
    mode === "single"
      ? selected.length
        ? `第 ${selected[0]} 节`
        : "未选择"
      : allSelected
        ? "全部时间"
        : selected.length
          ? `已选 ${selected.length} 个时间点`
          : "未选择";

  const choose = (point: number) => {
    onChange(
      nextPeriodSelection(
        mode,
        ordered.map((item) => item.period),
        selected,
        point,
      ),
    );
  };

  return (
    <div
      className="rounded-xl border border-[#dadce0] bg-white p-3 dark:border-[#3c4043] dark:bg-[#292a2d]"
      aria-label={`${label}时间轴`}
      role="group"
    >
      <div className="flex items-center justify-between gap-3 text-xs text-[#5f6368] dark:text-[#bdc1c6]">
        <span>{label}</span>
        <span>{summary}</span>
      </div>
      <div className="mt-3 pb-1">
        <div className="relative grid grid-cols-12 gap-0 px-0.5 sm:gap-1.5 sm:px-1">
          <div className="pointer-events-none absolute left-[4%] right-[4%] top-[2.15rem] h-px bg-[#dadce0] dark:bg-[#5f6368]" />
          {ordered.map((item) => {
            const active = selected.includes(item.period);
            const state = stateFor?.(item.period);
            const stateLabel = state ? PERIOD_STATE_LABEL[state] : null;
            return (
              <button
                key={item.period}
                type="button"
                onClick={() => choose(item.period)}
                className="group relative flex min-w-0 flex-col items-center text-center focus-visible:outline-none"
                aria-pressed={active}
                aria-label={`第 ${item.period} 节，${item.start_time}–${item.end_time}${stateLabel ? `，${stateLabel}` : ""}，${active ? "已选择" : "未选择"}`}
              >
                <span className="h-4 w-full truncate text-[8px] text-[#5f6368] dark:text-[#bdc1c6] sm:text-[10px]">
                  {item.start_time}
                </span>
                <span
                  className={`relative z-10 mt-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] transition sm:h-8 sm:w-8 sm:text-xs ${state ? PERIOD_STATE_CLASS[state] : "bg-[#e8f0fe] text-[#174ea6] dark:bg-[#183153] dark:text-[#aecbfa]"} ${active ? "ring-2 ring-[#1a73e8] ring-offset-1 dark:ring-offset-[#292a2d] sm:ring-offset-2" : "ring-1 ring-inset ring-[#8ab4f8] group-hover:ring-2"}`}
                >
                  {item.period}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {mode === "multiple" ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onChange(ordered.map((item) => item.period))}
            disabled={allSelected}
            className={`rounded-full px-3 py-1 text-xs transition ${allSelected ? "bg-[#1a73e8] text-white" : "bg-[#e8f0fe] text-[#174ea6] hover:bg-[#d2e3fc] dark:bg-[#183153] dark:text-[#aecbfa]"}`}
          >
            {allSelected ? "已选择全部时间" : "选择全部时间"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
