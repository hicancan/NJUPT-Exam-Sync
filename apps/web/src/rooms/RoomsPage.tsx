import { useState } from 'react';
import { Building2, Clock, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { InlineErrorBanner } from '@/shared/ui/InlineErrorBanner';
import { canonicalRoomLabel, groupRoomBookings, overlapsWindow, uniqueValues } from '@njupt-search/academics-room';
import { useRoomOccupancy } from './model/useRoomOccupancy';
import { RoomDateFilter } from './ui/RoomDateFilter';
import type { RoomBookingGroup } from '@njupt-search/academics-room';
import type { Room, RoomBooking } from '@njupt-search/academics-room';
import type { RoomOccupancyClient } from './model/RoomOccupancyClient';

interface RoomsPageProps {
    query: string;
    date: string | null;
    campus: string | null;
    building: string | null;
    floor: string | null;
    start: string | null;
    end: string | null;
    onChange: (params: Record<string, string | null>, replace?: boolean) => void;
    client: RoomOccupancyClient;
}

const DAY_START = 8 * 60;
const DAY_END = 22 * 60;
const BUILDING_CLOSURE_SEARCH_URL = `#/search?q=${encodeURIComponent('封楼')}`;

const formatClock = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const minuteOfDay = (timestamp: string): number => {
    const date = new Date(timestamp);
    return date.getHours() * 60 + date.getMinutes();
};

const segmentStyle = (booking: RoomBookingGroup) => {
    const start = Math.max(DAY_START, minuteOfDay(booking.start_timestamp));
    const end = Math.min(DAY_END, minuteOfDay(booking.end_timestamp));
    const left = ((start - DAY_START) / (DAY_END - DAY_START)) * 100;
    const width = Math.max(2, ((end - start) / (DAY_END - DAY_START)) * 100);
    return { left: `${left}%`, width: `${width}%` };
};

function FilterSelect({
    label,
    value,
    values,
    onChange,
}: {
    label: string;
    value: string | null;
    values: string[];
    onChange: (value: string) => void;
}) {
    return (
        <label className="grid gap-1 text-[13px] text-[#5f6368] dark:text-[#bdc1c6]">
            <span>{label}</span>
            <select
                value={value || values[0] || ''}
                onChange={(event) => onChange(event.target.value)}
                className="h-10 rounded-md border border-[#dadce0] bg-white px-3 text-[14px] text-[#202124] outline-none focus:border-[#1a73e8] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#e8eaed]"
            >
                {values.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
        </label>
    );
}

function RoomCard({
    room,
    bookings,
    start,
    end,
}: {
    room: Room;
    bookings: RoomBooking[];
    start: string | null;
    end: string | null;
}) {
    const activeGroups = groupRoomBookings(bookings).filter(group => overlapsWindow(group, start, end));
    const occupied = activeGroups.length > 0;
    return (
        <div className={`rounded-lg border p-3 ${occupied
            ? 'border-[#fbbc04] bg-[#fff8e1] dark:border-[#8a6d00] dark:bg-[#2b240f]'
            : 'border-[#b7e1cd] bg-[#f0fff4] dark:border-[#215b39] dark:bg-[#10251a]'}`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-[16px] font-semibold text-[#202124] dark:text-[#e8eaed]">{room.room}</span>
                <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${occupied
                    ? 'bg-[#fef7e0] text-[#b06000] dark:bg-[#3a2a00] dark:text-[#fdd663]'
                    : 'bg-[#e6f4ea] text-[#137333] dark:bg-[#143820] dark:text-[#81c995]'}`}
                >
                    {occupied ? '占用' : '空闲'}
                </span>
            </div>
            {activeGroups.length ? (
                <div className="mt-2 space-y-1 text-[12px] text-[#5f6368] dark:text-[#bdc1c6]">
                    {activeGroups.map(group => (
                        <details key={group.group_id} className="rounded-md bg-white/60 px-2 py-1 dark:bg-black/10">
                            <summary className="cursor-pointer truncate">
                                {formatClock(group.start_timestamp)}-{formatClock(group.end_timestamp)} {group.course_name}
                                {group.class_count > 1 ? ` / ${group.class_count} 个班级` : ''}
                                {group.total_count > 0 ? ` / ${group.total_count} 人` : ''}
                            </summary>
                            <div className="mt-1 grid gap-1 text-[12px] leading-5">
                                <span>{group.teacher} / {group.course_code}</span>
                                <span>班级：{group.class_summaries.map(item => `${item.class_name}(${item.count}人)`).join(' / ')}</span>
                            </div>
                        </details>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function BookingDetail({ group }: { group: RoomBookingGroup }) {
    return (
        <div className="mt-2 rounded-md border border-[#d2e3fc] bg-[#f8fbff] p-3 text-[13px] text-[#3c4043] dark:border-[#394457] dark:bg-[#1f2430] dark:text-[#bdc1c6]">
            <div className="font-medium text-[#202124] dark:text-[#e8eaed]">{group.course_name}</div>
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
                <span>{formatClock(group.start_timestamp)}-{formatClock(group.end_timestamp)} / {group.duration_minutes} min</span>
                <span>{group.teacher}</span>
                <span>{group.course_code}</span>
                <span>{group.location}</span>
                <span>合计人数：{group.total_count} 人</span>
                <span className="sm:col-span-2">
                    班级：{group.class_summaries.map(item => `${item.class_name}(${item.count}人)`).join(' / ')}
                </span>
            </div>
        </div>
    );
}

function RoomTimeline({ room, bookings }: { room: Room; bookings: RoomBooking[] }) {
    const groups = groupRoomBookings(bookings);
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const expandedGroup = groups.find(group => group.group_id === expandedGroupId) || null;
    return (
        <div className="grid gap-2 rounded-lg border border-[#dadce0] bg-white p-3 dark:border-[#3c4043] dark:bg-[#202124] sm:grid-cols-[72px_1fr]">
            <div className="font-medium text-[#202124] dark:text-[#e8eaed]">{room.room}</div>
            <div>
                <div className="relative h-8 rounded-full bg-[#edf2f7] dark:bg-[#303134]">
                    {groups.map(group => (
                        <button
                            type="button"
                            key={group.group_id}
                            onClick={() => setExpandedGroupId(expandedGroupId === group.group_id ? null : group.group_id)}
                            className="absolute top-1 h-6 rounded-full bg-[#1a73e8] px-2 text-left text-[11px] leading-6 text-white shadow-sm outline-none focus:ring-2 focus:ring-[#8ab4f8]"
                            style={segmentStyle(group)}
                            title={`${group.course_name} ${formatClock(group.start_timestamp)}-${formatClock(group.end_timestamp)} ${group.class_names.join(' / ')}`}
                        >
                            <span className="hidden md:inline">
                                {group.course_name}{group.class_count > 1 ? ` · ${group.class_count}个班级` : ''}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-[#70757a] dark:text-[#9aa0a6]">
                    <span>08:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>22:00</span>
                </div>
                {expandedGroup ? <BookingDetail group={expandedGroup} /> : null}
            </div>
        </div>
    );
}

export function RoomsPage({ query, date, campus, building, floor, start, end, onChange, client }: RoomsPageProps) {
    const state = useRoomOccupancy(client, { query, date, campus, building, floor, start, end });
    const index = state.index;
    const rooms = state.rooms;
    const bookingsByRoom = new Map<string, RoomBooking[]>();
    for (const booking of state.bookings) {
        const next = bookingsByRoom.get(booking.room_key) || [];
        next.push(booking);
        bookingsByRoom.set(booking.room_key, next);
    }

    const campuses = index ? uniqueValues(index.floors.map(item => item.campus)) : [];
    const buildings = index ? uniqueValues(index.floors.filter(item => !state.campus || item.campus === state.campus).map(item => item.building)) : [];
    const floors = index ? uniqueValues(index.floors
        .filter(item => (!state.campus || item.campus === state.campus) && (!state.building || item.building === state.building))
        .map(item => item.floor)) : [];
    const dates = index ? index.dates.map(item => item.date) : [];
    const selectedDateEntry = index && state.date ? index.dates.find(item => item.date === state.date) || null : null;
    const floorDateEntry = state.floorEntry && selectedDateEntry
        ? selectedDateEntry.floors.find(item => item.floor_key === state.floorEntry?.floor_key) || null
        : null;
    const selectedDateHasAnyBooking = Boolean(selectedDateEntry);
    const selectedFloorHasBooking = Boolean(floorDateEntry);
    const floorRooms = index && state.floorEntry
        ? state.floorEntry.room_keys
            .map(key => index.rooms.find(room => room.room_key === key))
            .filter((room): room is Room => Boolean(room))
            .sort((a, b) => a.room.localeCompare(b.room, 'zh-CN', { numeric: true }))
        : [];
    const selectedRoomLabel = state.selectedRoom ? canonicalRoomLabel(state.selectedRoom) : null;
    const selectedObjectLabel = state.selectedRoom
        ? `${selectedRoomLabel} · ${state.selectedRoom.campus} ${state.selectedRoom.building} ${state.selectedRoom.floor}楼`
        : `${state.campus} ${state.building} ${state.floor}楼`;
    const roomSelectValues = ['整层', ...floorRooms.map(room => canonicalRoomLabel(room))];
    const hasTimeWindow = Boolean(start && end);
    const objectParams = state.selectedRoom
        ? { room: selectedRoomLabel, campus: null, building: null, floor: null }
        : { room: null, campus: state.campus, building: state.building, floor: state.floor };
    const buildingsByCampus = index
        ? Array.from(new Map(index.floors.map(item => [item.campus, uniqueValues(index.floors
            .filter(floorItem => floorItem.campus === item.campus)
            .map(floorItem => floorItem.building))])).entries())
        : [];

    return (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-6 pb-8">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-[28px] font-normal text-[#202124] dark:text-[#e8eaed]">
                        考试占用教室
                    </h2>
                    <p className="mt-2 text-[14px] text-[#5f6368] dark:text-[#bdc1c6]">
                        按日期、校区、楼栋、楼层查看教室占用情况。
                    </p>
                    <a
                        href={BUILDING_CLOSURE_SEARCH_URL}
                        className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[#1a73e8] hover:underline dark:text-[#8ab4f8]"
                    >
                        <Search className="h-4 w-4" aria-hidden="true" />
                        查看封楼通知
                    </a>
                </div>
                {index ? (
                    <div className="rounded-full bg-[#f1f3f4] px-3 py-1 text-[12px] text-[#5f6368] dark:bg-[#303134] dark:text-[#bdc1c6]">
                        {index.rooms.length} 间教室 / {index.dates.length} 个考试日期
                    </div>
                ) : null}
            </div>

            <InlineErrorBanner message={state.error} />

            {state.loading && !index ? (
                <div className="rounded-xl border border-[#dadce0] bg-white px-4 py-6 text-[#5f6368] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#bdc1c6]">
                    正在加载教室占用信息...
                </div>
            ) : null}

            {index ? (
                <>
                    {!state.floorEntry && !state.error ? (
                        <section className="rounded-xl border border-[#dadce0] bg-[#f8fbff] p-4 dark:border-[#3c4043] dark:bg-[#202124]">
                            <h3 className="text-[18px] font-medium text-[#202124] dark:text-[#e8eaed]">查看教室占用</h3>
                            <p className="mt-2 text-[14px] text-[#5f6368] dark:text-[#bdc1c6]">
                                在搜索框输入楼栋或教室号，或直接选择楼栋开始查看。
                            </p>
                            <p className="mt-2 text-[13px] text-[#70757a] dark:text-[#9aa0a6]">
                                示例：教2、教2-313、图科楼、图5、无线楼、无1
                            </p>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                {buildingsByCampus.map(([campusName, campusBuildings]) => (
                                    <div key={campusName} className="rounded-lg border border-[#dadce0] bg-white p-3 dark:border-[#3c4043] dark:bg-[#202124]">
                                        <div className="mb-2 text-[14px] font-medium text-[#202124] dark:text-[#e8eaed]">{campusName}</div>
                                        <div className="flex flex-wrap gap-2">
                                            {campusBuildings.map(item => (
                                                <button
                                                    key={`${campusName}-${item}`}
                                                    type="button"
                                                    onClick={() => onChange({ campus: campusName, building: item, room: null, floor: null, date: state.date, start: null, end: null })}
                                                    className="rounded-full border border-[#d2e3fc] bg-white px-3 py-1.5 text-[13px] text-[#174ea6] hover:bg-[#e8f0fe] dark:border-[#394457] dark:bg-[#202124] dark:text-[#8ab4f8] dark:hover:bg-[#1f2430]"
                                                >
                                                    {item}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {state.floorEntry ? (
                        <>
                    <section className="rounded-xl border border-[#dadce0] bg-[#f8fbff] p-4 dark:border-[#3c4043] dark:bg-[#202124]">
                        <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-[#202124] dark:text-[#e8eaed]">
                            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                            筛选
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                            <RoomDateFilter
                                value={state.date}
                                dates={dates}
                                onChange={(value) => onChange({ ...objectParams, date: value, start, end })}
                            />
                            <FilterSelect label="校区" value={state.campus} values={campuses} onChange={(value) => {
                                const firstBuilding = uniqueValues(index.floors.filter(item => item.campus === value).map(item => item.building))[0] || null;
                                onChange({ room: null, date: state.date, campus: value, building: firstBuilding, floor: null, start, end });
                            }} />
                            <FilterSelect label="楼栋" value={state.building} values={buildings} onChange={(value) => onChange({ room: null, date: state.date, campus: state.campus, building: value, floor: null, start, end })} />
                            <FilterSelect label="楼层" value={state.floor} values={floors} onChange={(value) => onChange({ room: null, date: state.date, campus: state.campus, building: state.building, floor: value, start, end })} />
                            <FilterSelect label="教室" value={selectedRoomLabel || '整层'} values={roomSelectValues} onChange={(value) => {
                                if (value === '整层') {
                                    onChange({ room: null, date: state.date, campus: state.campus, building: state.building, floor: state.floor, start, end });
                                } else {
                                    onChange({ room: value, date: state.date, campus: null, building: null, floor: null, start, end });
                                }
                            }} />
                            <label className="flex h-10 items-end gap-2 text-[13px] text-[#5f6368] dark:text-[#bdc1c6]">
                                <input
                                    type="checkbox"
                                    checked={hasTimeWindow}
                                    onChange={(event) => onChange({ ...objectParams, date: state.date, start: event.target.checked ? '08:00' : null, end: event.target.checked ? '22:00' : null })}
                                    className="mb-2"
                                />
                                <span className="mb-1">限定时间</span>
                            </label>
                        </div>
                        {hasTimeWindow ? (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                            <label className="grid gap-1 text-[13px] text-[#5f6368] dark:text-[#bdc1c6]">
                                <span>开始时间</span>
                                <input type="time" value={start || '08:00'} onChange={(event) => onChange({ ...objectParams, date: state.date, start: event.target.value, end })} className="h-10 rounded-md border border-[#dadce0] bg-white px-3 text-[14px] dark:border-[#3c4043] dark:bg-[#202124]" />
                            </label>
                            <label className="grid gap-1 text-[13px] text-[#5f6368] dark:text-[#bdc1c6]">
                                <span>结束时间</span>
                                <input type="time" value={end || '22:00'} onChange={(event) => onChange({ ...objectParams, date: state.date, start, end: event.target.value })} className="h-10 rounded-md border border-[#dadce0] bg-white px-3 text-[14px] dark:border-[#3c4043] dark:bg-[#202124]" />
                            </label>
                            </div>
                        ) : null}
                    </section>

                    <section className="mt-5 rounded-xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#202124]">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1 text-[15px] font-medium text-[#202124] dark:text-[#e8eaed]">
                                <Building2 className="h-4 w-4" aria-hidden="true" />
                                {selectedObjectLabel}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[13px] text-[#5f6368] dark:text-[#bdc1c6]">
                                <Clock className="h-4 w-4" aria-hidden="true" />
                                {state.date} {hasTimeWindow ? `${start}-${end}` : '全天时间轴'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[13px] text-[#5f6368] dark:text-[#bdc1c6]">
                                <MapPin className="h-4 w-4" aria-hidden="true" />
                                {rooms.length} 间
                            </span>
                        </div>
                        {state.date && (!selectedDateHasAnyBooking || !selectedFloorHasBooking) ? (
                            <div className="mb-3 rounded-md border border-[#d2e3fc] bg-[#f8fbff] px-3 py-2 text-[13px] text-[#3c4043] dark:border-[#394457] dark:bg-[#1f2430] dark:text-[#bdc1c6]">
                                {selectedDateHasAnyBooking ? '该楼层当天没有考试占用记录，当前教室按空闲显示。' : '当天没有考试占用记录，当前教室按空闲显示。'}
                            </div>
                        ) : null}
                        {state.loading ? (
                            <div className="space-y-2" aria-live="polite">
                                <div className="text-[13px] text-[#5f6368] dark:text-[#bdc1c6]">正在加载当前楼层占用数据…</div>
                                <div className="h-16 animate-pulse rounded-lg bg-[#edf2f7] dark:bg-[#303134]" aria-hidden="true" />
                                <div className="h-16 animate-pulse rounded-lg bg-[#edf2f7] dark:bg-[#303134]" aria-hidden="true" />
                            </div>
                        ) : hasTimeWindow ? (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {rooms.map(room => (
                                    <RoomCard
                                        key={room.room_key}
                                        room={room}
                                        bookings={bookingsByRoom.get(room.room_key) || []}
                                        start={start}
                                        end={end}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {rooms.map(room => (
                                    <RoomTimeline key={room.room_key} room={room} bookings={bookingsByRoom.get(room.room_key) || []} />
                                ))}
                            </div>
                        )}
                    </section>
                        </>
                    ) : null}
                </>
            ) : null}
        </main>
    );
}
