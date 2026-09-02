import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  Layers3,
  MapPin,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ClassroomAvailability,
  ClassroomAvailabilityClient,
  ClassroomIndex,
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
  free: "未发现占用",
  teaching: "课程占用",
  exam: "考试占用",
  both: "课程与考试占用",
  "non-teaching": "其他房间",
};
const STATE_BADGE_CLASS: Record<SpatialRoomState, string> = {
  free: "bg-[#e8f0fe] text-[#174ea6] dark:bg-[#183153] dark:text-[#aecbfa]",
  teaching: "bg-[#e6f4ea] text-[#137333] dark:bg-[#173b27] dark:text-[#81c995]",
  exam: "bg-[#fef7e0] text-[#8d5b00] dark:bg-[#493a14] dark:text-[#fdd663]",
  both: "bg-[#f3e8fd] text-[#7627bb] dark:bg-[#39214d] dark:text-[#d7aefb]",
  "non-teaching":
    "bg-[#e8eaed] text-[#5f6368] dark:bg-[#303134] dark:text-[#bdc1c6]",
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
  const [loadState, setLoadState] = useState<{
    key: string;
    result: ClassroomAvailability | null;
    error: string | null;
  }>({ key: "", result: null, error: null });

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
        setLoadState({ key: requestKey, result: nextResult, error: null });
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setLoadState({
          key: requestKey,
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
  ]);

  const result = loadState.key === requestKey ? loadState.result : null;
  const error =
    indexError ?? (loadState.key === requestKey ? loadState.error : null);
  const effectiveWeek = result?.week ?? week ?? 1;
  const effectiveWeekday = result?.weekday ?? weekday ?? 1;
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
    if (!family) return "non-teaching";
    if (family.family.availability_eligible === "ineligible")
      return "non-teaching";
    const sources = result?.occupied.get(familyId);
    if (!sources) return "free";
    if (sources.teaching.length && sources.exams.length) return "both";
    return sources.teaching.length ? "teaching" : "exam";
  };
  const freeCount = floorFamilies.filter(
    (item) => roomState(item.family.space_family_id) === "free",
  ).length;

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
                    {roomCount} 个房间
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
              <div className="mt-1 grid grid-cols-12 text-center text-[10px] text-[#5f6368] dark:text-[#bdc1c6]">
                {Array.from({ length: 12 }, (_, indexValue) => (
                  <span key={indexValue}>{indexValue + 1}</span>
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
                    const sources = result.occupied.get(
                      roomView.family.space_family_id,
                    );
                    return sources ? (
                      <section className="mt-6">
                        <h3 className="font-semibold">占用详情</h3>
                        {sources.teaching.map((item) => (
                          <p
                            key={item.meeting_id}
                            className="mt-2 flex items-start gap-2 text-sm"
                          >
                            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#1967d2]" />
                            课程：{item.course_name} ·{" "}
                            {item.class_ids.join("、")}
                          </p>
                        ))}
                        {sources.exams.map((item) => (
                          <p
                            key={item.exam_id}
                            className="mt-2 flex items-start gap-2 text-sm"
                          >
                            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-[#8d5b00]" />
                            考试：{item.course_name} · {item.class_name}
                          </p>
                        ))}
                      </section>
                    ) : (
                      <p className="mt-6 text-sm">
                        该时段没有发现课程或考试占用。
                      </p>
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
                    本层房间
                  </h2>
                  <p className="text-sm font-medium text-[#1967d2] dark:text-[#8ab4f8]">
                    {freeCount} 个未发现占用 · 共 {floorFamilies.length} 个房间
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
              <aside className="mt-8 flex gap-3 rounded-xl bg-[#f1f3f4] p-4 text-xs leading-6 text-[#5f6368] dark:bg-[#292a2d] dark:text-[#bdc1c6]">
                <CalendarDays
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p>
                  “未发现占用”只表示已发布的课程和考试数据中没有记录；不包含临时借用、调课、补课、活动、维修、封闭或尚未同步的变化。
                </p>
              </aside>
            </>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
