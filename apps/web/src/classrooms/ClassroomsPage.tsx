import {
  ArrowRight,
  BookOpen,
  Building2,
  GraduationCap,
  Layers3,
  MapPin,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ClassroomAvailability,
  ClassroomAvailabilityClient,
  ClassroomIndex,
  ClassroomRoomDaySchedule,
} from "./model/ClassroomAvailabilityClient";
import {
  SpatialViewport,
  type SpatialRoomState,
} from "@/space/SpatialViewport";
import { collapsedCampusBuilding } from "./model/spaceHierarchy";

interface ClassroomsPageProps {
  date: string | null;
  week: number | null;
  weekday: number | null;
  period: number;
  campus: string | null;
  building: string | null;
  floor: string | null;
  room: string | null;
  query: string;
  client: ClassroomAvailabilityClient;
  onChange: (params: Record<string, string | null>, replace?: boolean) => void;
}

const natural = (left: string, right: string) =>
  left.localeCompare(right, "zh-CN", { numeric: true, sensitivity: "base" });
const STATE_LABEL: Record<SpatialRoomState, string> = {
  free: "空闲",
  teaching: "上课",
  exam: "考试",
};
const STATE_BADGE_CLASS: Record<SpatialRoomState, string> = {
  free: "bg-[#e8f0fe] text-[#174ea6] dark:bg-[#183153] dark:text-[#aecbfa]",
  teaching: "bg-[#e6f4ea] text-[#137333] dark:bg-[#173b27] dark:text-[#81c995]",
  exam: "bg-[#fef7e0] text-[#8d5b00] dark:bg-[#493a14] dark:text-[#fdd663]",
};

export function ClassroomsPage({
  date,
  week,
  weekday,
  period,
  campus,
  building,
  floor,
  room,
  query,
  client,
  onChange,
}: ClassroomsPageProps) {
  const [index, setIndex] = useState<ClassroomIndex | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const requestKey = `${date ?? ""}:${week ?? ""}:${weekday ?? ""}:${period}:${campus ?? ""}:${building ?? ""}:${floor ?? ""}`;
  const viewContextKey = `${date ?? ""}:${week ?? ""}:${weekday ?? ""}:${campus ?? ""}:${building ?? ""}:${floor ?? ""}`;
  const [loadState, setLoadState] = useState<{
    key: string;
    contextKey: string;
    result: ClassroomAvailability | null;
    error: string | null;
  }>({ key: "", contextKey: "", result: null, error: null });
  const [roomDayState, setRoomDayState] = useState<{
    key: string;
    result: ClassroomRoomDaySchedule | null;
    error: string | null;
  }>({ key: "", result: null, error: null });
  const [detailSelection, setDetailSelection] = useState<{
    key: string;
    period: number | null;
  }>({ key: "", period: null });

  useEffect(() => {
    const controller = new AbortController();
    client
      .initialize(controller.signal)
      .then(setIndex)
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setIndexError(
          reason instanceof Error ? reason.message : "教室空间数据加载失败",
        );
      });
    return () => controller.abort();
  }, [client]);

  const activeCampus =
    index?.space.campuses.find((item) => item.name === campus) ?? null;
  const activeBuilding =
    (activeCampus &&
      index?.space.buildings.find(
        (item) =>
          item.campus_id === activeCampus.campus_id && item.name === building,
      )) ||
    null;
  const activeFloor =
    (activeBuilding &&
      index?.space.floors.find(
        (item) =>
          item.building_id === activeBuilding.building_id &&
          item.level === floor,
      )) ||
    null;
  const collapsedBuilding = Boolean(
    activeCampus &&
    activeBuilding &&
    collapsedCampusBuilding(activeCampus, index?.space.buildings ?? [])
      ?.building_id === activeBuilding.building_id,
  );

  useEffect(() => {
    if (!activeFloor) return;
    const controller = new AbortController();
    client
      .query(
        { date, week, weekday, period, campus, building, floor, query: null },
        controller.signal,
      )
      .then((nextResult) => {
        setLoadState({ key: requestKey, contextKey: viewContextKey, result: nextResult, error: null });
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setLoadState({
          key: requestKey,
          contextKey: viewContextKey,
          result: null,
          error:
            reason instanceof Error ? reason.message : "教室占用数据加载失败",
        });
      });
    return () => controller.abort();
  }, [
    activeFloor,
    building,
    campus,
    client,
    date,
    floor,
    period,
    requestKey,
    week,
    weekday,
    viewContextKey,
  ]);

  const result = loadState.contextKey === viewContextKey ? loadState.result : null;
  const error =
    indexError ?? (loadState.key === requestKey ? loadState.error : null);
  const effectiveWeek = result?.week ?? week ?? 1;
  const effectiveWeekday = result?.weekday ?? weekday ?? 1;
  const resolvedDate = result?.date ?? null;
  const roomDayKey = `${resolvedDate ?? date ?? `${effectiveWeek}-${effectiveWeekday}`}:${activeFloor?.floor_id ?? ""}:${room ?? ""}`;
  useEffect(() => {
    if (!resolvedDate || !activeFloor || !room) return;
    const controller = new AbortController();
    client
      .queryRoomDay(
        { date: resolvedDate },
        room,
        activeFloor.floor_id,
        controller.signal,
      )
      .then((nextResult) => {
        setRoomDayState({ key: roomDayKey, result: nextResult, error: null });
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setRoomDayState({
          key: roomDayKey,
          result: null,
          error: reason instanceof Error ? reason.message : "教室安排加载失败",
        });
      });
    return () => controller.abort();
  }, [activeFloor, client, resolvedDate, room, roomDayKey]);
  const roomDay = roomDayState.key === roomDayKey ? roomDayState.result : null;
  const roomDayError = roomDayState.key === roomDayKey ? roomDayState.error : null;
  const detailPeriod =
    detailSelection.key === roomDayKey ? detailSelection.period : null;
  const setDetailPeriod = (nextPeriod: number | null) =>
    setDetailSelection({ key: roomDayKey, period: nextPeriod });
  const update = (next: Record<string, string | null>) =>
    onChange({
      date,
      week: date ? null : String(effectiveWeek),
      weekday: date ? null : String(effectiveWeekday),
      period: String(period),
      campus,
      building,
      floor,
      room,
      q: query || null,
      ...next,
    });
  const buildings = useMemo(
    () =>
      activeCampus && index
        ? index.space.buildings
            .filter((item) => item.campus_id === activeCampus.campus_id)
            .sort((left, right) => natural(left.name, right.name))
        : [],
    [activeCampus, index],
  );
  const floors = useMemo(
    () =>
      activeBuilding && index
        ? index.space.floors
            .filter((item) => item.building_id === activeBuilding.building_id)
            .sort((left, right) => natural(left.level, right.level))
        : [],
    [activeBuilding, index],
  );
  const floorFamilies = useMemo(
    () =>
      activeFloor && result
        ? result.spatialFamilies
            .filter((item) => item.floor.floor_id === activeFloor.floor_id)
            .sort((left, right) =>
              natural(left.family.room_number, right.family.room_number),
            )
        : [],
    [activeFloor, result],
  );
  const roomState = (familyId: string): SpatialRoomState => {
    const family = floorFamilies.find(
      (item) => item.family.space_family_id === familyId,
    );
    if (!family) return "free";
    const sources = result?.occupied.get(familyId);
    if (!sources) return "free";
    if (sources.exams.length) return "exam";
    return "teaching";
  };
  const freeCount = floorFamilies.filter(
    (item) => roomState(item.family.space_family_id) === "free",
  ).length;
  const examOccupiesPeriod = (startTimestamp: string, endTimestamp: string, periodNumber: number) => {
    if (!roomDay || !index) return false;
    const periodItem = index.manifest.periods.find((item) => item.period === periodNumber);
    if (!periodItem) return false;
    const start = `${roomDay.date}T${periodItem.start_time}:00+08:00`;
    const end = `${roomDay.date}T${periodItem.end_time}:00+08:00`;
    return startTimestamp < end && endTimestamp > start;
  };
  const roomDayPeriodState = (periodNumber: number): SpatialRoomState => {
    if (!roomDay) return "free";
    const teaching = roomDay.teaching.some(
      (item) => item.start_period <= periodNumber && item.end_period >= periodNumber,
    );
    const exam = roomDay.exams.some((item) =>
      examOccupiesPeriod(item.start_timestamp, item.end_timestamp, periodNumber),
    );
    if (exam) return "exam";
    if (teaching) return "teaching";
    return "free";
  };
  const formatTimestampTime = (value: string) => value.slice(11, 16);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-7">
      <header>
        <p className="text-sm font-medium text-[#1967d2] dark:text-[#8ab4f8]">
          校园空间
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">教室</h1>
        <nav
          className="mt-4 flex flex-wrap items-center gap-2 text-sm"
          aria-label="空间层级"
        >
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-[#1967d2] hover:underline"
          >
            全部校区
          </button>
          {activeCampus ? (
            <>
              <ArrowRight className="h-3.5 w-3.5 text-[#9aa0a6]" />
              <button
                type="button"
                onClick={() =>
                  collapsedBuilding
                    ? update({ floor: null, room: null })
                    : update({ building: null, floor: null, room: null })
                }
                className={
                  (activeBuilding && !collapsedBuilding) || activeFloor
                    ? "text-[#1967d2] hover:underline"
                    : "font-medium"
                }
              >
                {activeCampus.name}校区
              </button>
            </>
          ) : null}
          {activeBuilding && !collapsedBuilding ? (
            <>
              <ArrowRight className="h-3.5 w-3.5 text-[#9aa0a6]" />
              <button
                type="button"
                onClick={() => update({ floor: null, room: null })}
                className={
                  activeFloor ? "text-[#1967d2] hover:underline" : "font-medium"
                }
              >
                {activeBuilding.name}
              </button>
            </>
          ) : null}
          {activeFloor ? (
            <>
              <ArrowRight className="h-3.5 w-3.5 text-[#9aa0a6]" />
              <span className="font-medium">{activeFloor.level}楼</span>
            </>
          ) : null}
        </nav>
      </header>

      {error ? (
        <div className="mt-5 rounded-xl border border-[#f2b8b5] bg-[#fce8e6] p-4 text-sm text-[#8c1d18] dark:border-[#8c1d18] dark:bg-[#3c2020] dark:text-[#f2b8b5]">
          {error}
        </div>
      ) : null}
      {!index && !error ? (
        <div className="mt-7 h-48 animate-pulse rounded-2xl bg-[#f1f3f4] dark:bg-[#292a2d]" />
      ) : null}

      {index && activeCampus && !activeBuilding ? (
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold">
                {activeCampus.name}校区
              </h2>
              <p className="mt-1 text-sm text-[#5f6368] dark:text-[#bdc1c6]">
                选择楼栋
              </p>
            </div>
            <span className="text-sm text-[#5f6368]">
              {buildings.length} 栋
            </span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {buildings.map((item) => {
              const floorCount = index.space.floors.filter(
                (floorItem) => floorItem.building_id === item.building_id,
              ).length;
              return (
                <button
                  key={item.building_id}
                  type="button"
                  onClick={() =>
                    update({ building: item.name, floor: null, room: null })
                  }
                  className="group rounded-2xl border border-[#dadce0] bg-white p-5 text-left transition hover:border-[#8ab4f8] dark:border-[#3c4043] dark:bg-[#292a2d]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f0fe] text-[#1967d2] dark:bg-[#23334d] dark:text-[#8ab4f8]">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <span className="mt-4 flex items-center justify-between">
                    <strong className="text-lg">{item.name}</strong>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <small className="mt-1 block text-[#5f6368] dark:text-[#bdc1c6]">
                    {floorCount} 层
                  </small>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {index && activeBuilding && !activeFloor ? (
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold">
              {collapsedBuilding ? "选择楼层" : activeBuilding.name}
            </h2>
            <span className="text-sm text-[#5f6368]">{floors.length} 层</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {floors.map((item) => {
              const roomCount = index.space.families.filter(
                (family) => family.floor_id === item.floor_id,
              ).length;
              return (
                <button
                  key={item.floor_id}
                  type="button"
                  onClick={() => update({ floor: item.level, room: null })}
                  className="group rounded-2xl border border-[#dadce0] bg-white p-5 text-left transition hover:border-[#8ab4f8] dark:border-[#3c4043] dark:bg-[#292a2d]"
                >
                  <Layers3 className="h-5 w-5 text-[#1967d2]" />
                  <span className="mt-4 flex items-center justify-between">
                    <strong className="text-lg">{item.level}楼</strong>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <small className="mt-1 block text-[#5f6368] dark:text-[#bdc1c6]">
                    {roomCount} 间教室
                    {item.geometry_path ? "" : " · 暂无平面图"}
                  </small>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeFloor ? (
        <>
          <section className="mt-7 rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-4 dark:border-[#3c4043] dark:bg-[#292a2d]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">
                周次
                <select
                  name="week"
                  value={effectiveWeek}
                  onChange={(event) =>
                    update({
                      date: null,
                      week: event.target.value,
                      weekday: String(effectiveWeekday),
                    })
                  }
                  className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]"
                >
                  {index?.manifest.weeks.map((item) => (
                    <option key={item.week} value={item.week}>
                      第 {item.week} 周
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">
                星期
                <select
                  name="weekday"
                  value={effectiveWeekday}
                  onChange={(event) =>
                    update({
                      date: null,
                      week: String(effectiveWeek),
                      weekday: event.target.value,
                    })
                  }
                  className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]"
                >
                  {"一二三四五六日".split("").map((item, indexValue) => (
                    <option key={item} value={indexValue + 1}>
                      星期{item}
                    </option>
                  ))}
                </select>
              </label>
              <div className="col-span-2 grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6] sm:col-span-1">
                <span>当前时刻</span>
                <strong className="flex h-10 items-center text-sm text-[#202124] dark:text-[#e8eaed]">
                  第 {period} 节{result ? ` · ${result.date}` : ""}
                </strong>
              </div>
            </div>
            <div
              className="mt-4 border-t border-[#dadce0] pt-3 dark:border-[#3c4043]"
              aria-label="节次时间轴"
            >
              <div className="flex items-center justify-between text-xs text-[#5f6368] dark:text-[#bdc1c6]">
                <span>上午</span>
                <span>下午</span>
                <span>晚间</span>
              </div>
              <input
                className="mt-2 w-full accent-[#1a73e8]"
                name="period"
                type="range"
                min="1"
                max="12"
                step="1"
                value={period}
                onChange={(event) => update({ period: event.target.value })}
                aria-label="选择节次"
              />
              <div className="mt-2 grid grid-cols-12 gap-1 text-center text-[10px] text-[#5f6368] dark:text-[#bdc1c6]">
                {Array.from({ length: 12 }, (_, indexValue) => (
                  <button
                    key={indexValue}
                    type="button"
                    onClick={() => update({ period: String(indexValue + 1) })}
                    className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full transition ${room ? STATE_BADGE_CLASS[roomDayPeriodState(indexValue + 1)] : ""} ${period === indexValue + 1 ? "ring-2 ring-[#1a73e8] ring-offset-1 dark:ring-offset-[#292a2d]" : ""}`}
                    aria-label={`第 ${indexValue + 1} 节${roomDay ? `，${STATE_LABEL[roomDayPeriodState(indexValue + 1)]}` : ""}`}
                  >
                    {indexValue + 1}
                  </button>
                ))}
              </div>
            </div>
          </section>
          {!result && !error ? (
            <div className="mt-6 h-96 animate-pulse rounded-2xl bg-[#f1f3f4] dark:bg-[#292a2d]" />
          ) : null}
          {result && activeCampus && activeBuilding ? (
            <>
              <div className="mt-6">
                <SpatialViewport
                  client={client.spaceClient}
                  campusName={activeCampus.name}
                  buildingName={activeBuilding.name}
                  buildingId={activeBuilding.building_id}
                  floorId={activeFloor.floor_id}
                  floorLevel={activeFloor.level}
                  families={floorFamilies}
                  roomState={roomState}
                  selectedFamilyId={room}
                  onSelectedFamilyChange={(nextRoom) =>
                    update({ room: nextRoom })
                  }
                  detail={(roomView) => {
                    const focusPeriod = detailPeriod ?? period;
                    const visibleTeaching = roomDay
                      ? roomDay.teaching.filter(
                          (item) =>
                            detailPeriod === null ||
                            (item.start_period <= detailPeriod &&
                              item.end_period >= detailPeriod),
                        )
                      : [];
                    const visibleExams = roomDay
                      ? roomDay.exams.filter(
                          (item) =>
                            detailPeriod === null ||
                            examOccupiesPeriod(
                              item.start_timestamp,
                              item.end_timestamp,
                              detailPeriod,
                            ),
                        )
                      : [];
                    return (
                    <section className="mt-6">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">课程安排</h3>
                          <p className="mt-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">
                            {result.date} · {detailPeriod === null ? "全部时间" : `第 ${detailPeriod} 节`}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${STATE_BADGE_CLASS[roomState(roomView.family.space_family_id)]}`}>
                          {STATE_LABEL[roomState(roomView.family.space_family_id)]}
                        </span>
                      </div>
                      {!roomDay && !roomDayError ? (
                        <div className="mt-4 h-24 animate-pulse rounded-xl bg-[#f1f3f4] dark:bg-[#292a2d]" />
                      ) : null}
                      {roomDayError ? (
                        <p className="mt-4 rounded-xl bg-[#fce8e6] p-3 text-sm text-[#8c1d18] dark:bg-[#3c2020] dark:text-[#f2b8b5]">{roomDayError}</p>
                      ) : null}
                      {roomDay ? (
                        <>
                        <div className="mt-4 rounded-xl border border-[#dadce0] p-3 dark:border-[#3c4043]" aria-label="详情时间轴">
                          <div className="flex items-center justify-between text-xs text-[#5f6368] dark:text-[#bdc1c6]">
                            <span>选择时间点</span>
                            <span>{detailPeriod === null ? "全部时间" : `第 ${detailPeriod} 节`}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDetailPeriod(null)}
                              className={`rounded-full px-2.5 py-1 text-xs transition ${detailPeriod === null ? "bg-[#1a73e8] text-white" : "bg-[#f1f3f4] text-[#3c4043] dark:bg-[#3c4043] dark:text-[#e8eaed]"}`}
                            >
                              全部
                            </button>
                            {Array.from({ length: 12 }, (_, indexValue) => {
                              const point = indexValue + 1;
                              const state = roomDayPeriodState(point);
                              return (
                                <button
                                  key={point}
                                  type="button"
                                  onClick={() => setDetailPeriod(point)}
                                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition ${STATE_BADGE_CLASS[state]} ${detailPeriod === point ? "ring-2 ring-[#1a73e8] ring-offset-1 dark:ring-offset-[#292a2d]" : ""}`}
                                  aria-label={`第 ${point} 节，${STATE_LABEL[state]}`}
                                >
                                  {point}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3">
                          {visibleTeaching.map((item) => {
                            const startTime = index?.manifest.periods.find((entry) => entry.period === item.start_period)?.start_time;
                            const endTime = index?.manifest.periods.find((entry) => entry.period === item.end_period)?.end_time;
                            const active = item.start_period <= focusPeriod && item.end_period >= focusPeriod;
                            return (
                              <article key={item.meeting_id} className={`rounded-xl border p-3 ${active ? "border-[#34a853] bg-[#e6f4ea] dark:border-[#5bb974] dark:bg-[#173b27]" : "border-[#dadce0] dark:border-[#3c4043]"}`}>
                                <p className="flex items-start gap-2 text-sm font-medium">
                                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#137333] dark:text-[#81c995]" />
                                  {item.course_name}
                                </p>
                                <p className="mt-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">
                                  第 {item.start_period}–{item.end_period} 节{startTime && endTime ? ` · ${startTime}–${endTime}` : ""}
                                  {item.teacher ? ` · ${item.teacher}` : ""}
                                </p>
                                {item.class_ids.length ? <p className="mt-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">{item.class_ids.join("、")}</p> : null}
                              </article>
                            );
                          })}
                          {visibleExams.map((item) => {
                            const active = examOccupiesPeriod(item.start_timestamp, item.end_timestamp, focusPeriod);
                            return (
                              <article key={item.exam_id} className={`rounded-xl border p-3 ${active ? "border-[#f9ab00] bg-[#fef7e0] dark:border-[#f6c453] dark:bg-[#493a14]" : "border-[#dadce0] dark:border-[#3c4043]"}`}>
                                <p className="flex items-start gap-2 text-sm font-medium">
                                  <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-[#8d5b00] dark:text-[#fdd663]" />
                                  {item.course_name}
                                </p>
                                <p className="mt-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">
                                  {formatTimestampTime(item.start_timestamp)}–{formatTimestampTime(item.end_timestamp)} · {item.class_name}
                                </p>
                              </article>
                            );
                          })}
                          {!visibleTeaching.length && !visibleExams.length ? (
                            <p className="rounded-xl bg-[#f1f3f4] p-4 text-sm dark:bg-[#292a2d]">{detailPeriod === null ? "当天空闲。" : "该时间点空闲。"}</p>
                          ) : null}
                        </div>
                        </>
                      ) : null}
                    </section>
                    );
                  }}
                />
              </div>
              <section className="mt-8" aria-labelledby="floor-rooms-heading">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2
                    id="floor-rooms-heading"
                    className="text-xl font-semibold"
                  >
                    本层教室
                  </h2>
                  <p className="text-sm font-medium text-[#1967d2] dark:text-[#8ab4f8]">
                    {freeCount} 间空闲 · 共 {floorFamilies.length} 间教室
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {floorFamilies.map((roomView) => {
                    const state = roomState(roomView.family.space_family_id);
                    return (
                      <button
                        key={roomView.family.space_family_id}
                        type="button"
                        onClick={() =>
                          update({ room: roomView.family.space_family_id })
                        }
                        className="rounded-xl border border-[#dadce0] bg-white p-4 text-left transition hover:border-[#8ab4f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#292a2d]"
                        aria-label={`${roomView.family.room_number}，${STATE_LABEL[state]}，打开详情`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <MapPin
                            className="h-4 w-4 text-[#5f6368]"
                            aria-hidden="true"
                          />
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] ${STATE_BADGE_CLASS[state]}`}
                          >
                            {STATE_LABEL[state]}
                          </span>
                        </span>
                        <strong className="mt-3 block text-lg">
                          {roomView.family.room_number}
                        </strong>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
