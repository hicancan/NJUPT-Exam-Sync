import { ArrowRight, Building2, Layers3, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ClassroomAvailabilityClient,
  ClassroomIndex,
} from "./model/ClassroomAvailabilityClient";
import type { SpaceFamilyView } from "@/space/model/SpaceClient";
import {
  todayInShanghai,
  weekdayInShanghai,
} from "../timetable/model/calendar";
import { collapsedCampusBuilding } from "./model/spaceHierarchy";
import type { SavedClassroomQuery } from "@/app/routing/useAppRouter";

interface ClassroomsLandingProps {
  client: ClassroomAvailabilityClient;
  onChange: (params: Record<string, string | null>) => void;
  query?: string;
  recentQuery?: SavedClassroomQuery | null;
}

const natural = (left: string, right: string) =>
  left.localeCompare(right, "zh-CN", { numeric: true, sensitivity: "base" });

export function ClassroomsLanding({
  client,
  onChange,
  query = "",
  recentQuery = null,
}: ClassroomsLandingProps) {
  const [index, setIndex] = useState<ClassroomIndex | null>(null);
  const [matches, setMatches] = useState<SpaceFamilyView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    client
      .initialize(controller.signal)
      .then((next) => {
        setIndex(next);
        if (!query.trim()) return [];
        return client.spaceClient.listFamilies({ query }, controller.signal);
      })
      .then((nextMatches) => {
        if (nextMatches)
          setMatches(
            nextMatches.sort((left, right) =>
              natural(
                `${left.campus.name}-${left.building.name}-${left.floor.level}-${left.family.room_number}`,
                `${right.campus.name}-${right.building.name}-${right.floor.level}-${right.family.room_number}`,
              ),
            ),
          );
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error ? reason.message : "教室空间数据加载失败",
        );
      });
    return () => controller.abort();
  }, [client, query]);

  const moment = useMemo(() => {
    const today = todayInShanghai();
    const current = index?.manifest.weeks.find(
      (item) => today >= item.start_date && today <= item.end_date,
    );
    return {
      week: current?.week ?? 1,
      weekday: weekdayInShanghai(),
      period: 1,
    };
  }, [index]);
  const enter = (params: Record<string, string | null>) =>
    onChange({
      week: String(moment.week),
      weekday: String(moment.weekday),
      period: String(moment.period),
      q: null,
      ...params,
    });
  const campuses = useMemo(
    () =>
      [...(index?.space.campuses ?? [])].sort((left, right) =>
        natural(left.name, right.name),
      ),
    [index],
  );
  const campusDestination = (
    campus: ClassroomIndex["space"]["campuses"][number],
  ) => {
    const collapsedBuilding = collapsedCampusBuilding(
      campus,
      index?.space.buildings ?? [],
    );
    return {
      campus: campus.name,
      building: collapsedBuilding?.name ?? null,
      floor: null,
    };
  };
  const sampleQuery = useMemo(() => {
    if (!index) return null;
    const campus = campuses.find((item) => item.name === "仙林") ?? campuses[0];
    if (!campus) return null;
    const campusBuildings = index.space.buildings
      .filter((item) => item.campus_id === campus.campus_id)
      .sort((left, right) => natural(left.name, right.name));
    const building = campusBuildings.find((item) => item.name === "教4") ?? campusBuildings[0];
    if (!building) return { campus: campus.name };
    const buildingFloors = index.space.floors
      .filter((item) => item.building_id === building.building_id)
      .sort((left, right) => natural(left.level, right.level));
    const floor = buildingFloors.find((item) => item.level === "6") ?? buildingFloors[0];
    return {
      campus: campus.name,
      building: building.name,
      ...(floor ? { floor: floor.level } : {}),
    };
  }, [campuses, index]);
  const queryLabel = (params: SavedClassroomQuery | Record<string, string>) =>
    [params.campus, params.building, params.floor ? `${params.floor}楼` : null]
      .filter(Boolean)
      .join(" · ");
  const matchingCampuses = useMemo(
    () =>
      campuses.filter((item) =>
        item.name
          .toLocaleLowerCase("zh-CN")
          .includes(query.trim().toLocaleLowerCase("zh-CN")),
      ),
    [campuses, query],
  );
  const matchingBuildings = useMemo(() => {
    if (!index || !query.trim()) return [];
    const campusById = new Map(
      index.space.campuses.map((item) => [item.campus_id, item]),
    );
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    return index.space.buildings
      .map((building) => ({
        building,
        campus: campusById.get(building.campus_id),
      }))
      .filter(
        (item) =>
          item.campus &&
          `${item.campus.name} ${item.building.name} ${item.building.aliases.join(" ")}`
            .toLocaleLowerCase("zh-CN")
            .includes(needle),
      )
      .sort((left, right) =>
        natural(
          `${left.campus?.name}-${left.building.name}`,
          `${right.campus?.name}-${right.building.name}`,
        ),
      );
  }, [index, query]);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 sm:py-10">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-[#1967d2] dark:text-[#8ab4f8]">
          校园空间
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">教室</h1>
      </header>

      {recentQuery || sampleQuery ? (
        <section className="mt-6 flex flex-wrap items-center gap-2" aria-label="教室快捷入口">
          {recentQuery ? (
            <button
              type="button"
              onClick={() => enter(recentQuery)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#d2e3fc] bg-[#e8f0fe] px-4 text-sm font-medium text-[#174ea6] transition hover:bg-[#d2e3fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] dark:border-[#405985] dark:bg-[#23334d] dark:text-[#aecbfa]"
            >
              继续查看 {queryLabel(recentQuery)}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          {sampleQuery ? (
            <button
              type="button"
              onClick={() => enter(sampleQuery)}
              className="inline-flex min-h-10 items-center rounded-full px-4 text-sm text-[#5f6368] transition hover:bg-[#f1f3f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] dark:text-[#bdc1c6] dark:hover:bg-[#292a2d]"
            >
              试一试&nbsp;<span className="font-medium text-[#1967d2] dark:text-[#8ab4f8]">{queryLabel(sampleQuery)}</span>
            </button>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-xl border border-[#f2b8b5] bg-[#fce8e6] p-4 text-sm text-[#8c1d18] dark:border-[#8c1d18] dark:bg-[#3c2020] dark:text-[#f2b8b5]">
          {error}
        </div>
      ) : null}
      {!index && !error ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, indexValue) => (
            <div
              key={indexValue}
              className="h-40 animate-pulse rounded-2xl bg-[#f1f3f4] dark:bg-[#292a2d]"
            />
          ))}
        </div>
      ) : null}

      {index && !query.trim() ? (
        <section className="mt-9" aria-labelledby="campus-heading">
          <div className="flex items-end justify-between gap-4">
            <h2 id="campus-heading" className="text-2xl font-semibold">
              选择校区
            </h2>
            <span className="text-sm text-[#5f6368] dark:text-[#bdc1c6]">
              {campuses.length} 个校区
            </span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {campuses.map((campus) => {
              const buildingCount = index.space.buildings.filter(
                (item) => item.campus_id === campus.campus_id,
              ).length;
              return (
                <button
                  key={campus.campus_id}
                  type="button"
                  onClick={() => enter(campusDestination(campus))}
                  className="group min-h-40 rounded-2xl border border-[#dadce0] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#8ab4f8] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#292a2d]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f0fe] text-[#1967d2] dark:bg-[#23334d] dark:text-[#8ab4f8]">
                    <MapPin className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="mt-5 flex items-center justify-between gap-3">
                    <strong className="text-xl">{campus.name}</strong>
                    <ArrowRight
                      className="h-5 w-5 text-[#9aa0a6] transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-2 block text-sm text-[#5f6368] dark:text-[#bdc1c6]">
                    {buildingCount} 栋楼
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {index && query.trim() ? (
        <section className="mt-9" aria-labelledby="classroom-search-heading">
          <div className="flex items-end justify-between gap-4">
            <h2
              id="classroom-search-heading"
              className="flex items-center gap-2 text-2xl font-semibold"
            >
              <Search className="h-5 w-5" aria-hidden="true" />“{query.trim()}”
            </h2>
            <span className="text-sm text-[#5f6368] dark:text-[#bdc1c6]">
              {matches.length} 间教室匹配
            </span>
          </div>
          {matchingCampuses.length ? (
            <div className="mt-5">
              <h3 className="text-sm font-medium text-[#5f6368] dark:text-[#bdc1c6]">
                校区
              </h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {matchingCampuses.map((campus) => (
                  <button
                    key={campus.campus_id}
                    type="button"
                    onClick={() => enter(campusDestination(campus))}
                    className="flex items-center justify-between rounded-xl border border-[#dadce0] p-4 text-left dark:border-[#3c4043]"
                  >
                    <span className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-[#1967d2]" />
                      {campus.name}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {matchingBuildings.length ? (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-[#5f6368] dark:text-[#bdc1c6]">
                楼栋
              </h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {matchingBuildings.map(({ campus, building }) => (
                  <button
                    key={building.building_id}
                    type="button"
                    onClick={() =>
                      enter({
                        campus: campus?.name ?? null,
                        building: building.name,
                        floor: null,
                      })
                    }
                    className="flex items-center justify-between rounded-xl border border-[#dadce0] p-4 text-left dark:border-[#3c4043]"
                  >
                    <span>
                      <span className="flex items-center gap-2 font-medium">
                        <Building2 className="h-4 w-4 text-[#1967d2]" />
                        {building.name}
                      </span>
                      <small className="mt-1 block text-[#5f6368] dark:text-[#bdc1c6]">
                        {campus?.name}
                      </small>
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {matches.length ? (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-[#5f6368] dark:text-[#bdc1c6]">
                教室
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {matches.slice(0, 100).map((room) => (
                  <button
                    key={room.family.space_family_id}
                    type="button"
                    onClick={() =>
                      enter({
                        campus: room.campus.name,
                        building: room.building.name,
                        floor: room.floor.level,
                        room: room.family.space_family_id,
                      })
                    }
                    className="rounded-xl border border-[#dadce0] bg-white p-4 text-left dark:border-[#3c4043] dark:bg-[#292a2d]"
                  >
                    <Layers3 className="h-4 w-4 text-[#5f6368]" />
                    <strong className="mt-3 block">
                      {room.family.room_number}
                    </strong>
                    <small className="mt-1 block leading-5 text-[#5f6368] dark:text-[#bdc1c6]">
                      {room.campus.name} · {room.building.name} ·{" "}
                      {room.floor.level}楼
                    </small>
                  </button>
                ))}
              </div>
              {matches.length > 100 ? (
                <p className="mt-3 text-xs text-[#5f6368]">
                  仅显示前 100 间教室，请输入更完整的楼栋或教室号。
                </p>
              ) : null}
            </div>
          ) : null}
          {!matchingCampuses.length &&
          !matchingBuildings.length &&
          !matches.length ? (
            <div className="mt-6 rounded-2xl bg-[#f8f9fa] p-8 text-center dark:bg-[#292a2d]">
              <p className="font-medium">没有找到对应教室</p>
              <p className="mt-2 text-sm text-[#5f6368] dark:text-[#bdc1c6]">
                可搜索校区、楼栋或完整教室号。
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
