import { Building2, Clock, MapPin } from 'lucide-react';
import { groupRoomBookings, overlapsWindow, uniqueValues } from '@njupt-search/academics-room';
import type { RoomBooking } from '@njupt-search/academics-room';
import type { SpaceFamilyView } from '@/space/model/SpaceClient';
import type { SpaceClient } from '@/space/model/SpaceClient';
import { InlineErrorBanner } from '@/shared/ui/InlineErrorBanner';
import { useRoomOccupancy } from './model/useRoomOccupancy';
import { RoomDateFilter } from './ui/RoomDateFilter';
import { RoomBuildingPicker } from './ui/RoomBuildingPicker';
import { RoomsProductHeader } from './ui/RoomsProductHeader';
import type { RoomOccupancyClient } from './model/RoomOccupancyClient';
import { SpatialViewport } from '@/space/SpatialViewport';

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
    spaceClient: SpaceClient;
}

const formatClock = (timestamp: string): string => new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
});

function Select({ label, name, value, values, onChange }: {
    label: string; name: string; value: string | null; values: string[]; onChange: (value: string) => void;
}) {
    return <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">{label}<select name={name} value={value ?? ''} onChange={event => onChange(event.target.value)} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]"><option value="">全部</option>{values.map(item => <option key={item} value={item}>{item}</option>)}</select></label>;
}

function RoomResult({ room, bookings, start, end }: {
    room: SpaceFamilyView; bookings: RoomBooking[]; start: string | null; end: string | null;
}) {
    const groups = groupRoomBookings(bookings).filter(item => overlapsWindow(item, start, end));
    return (
        <article className={`rounded-xl border p-4 ${groups.length ? 'border-[#f6c453] bg-[#fff8e1] dark:border-[#8a6d00] dark:bg-[#2b240f]' : 'border-[#dadce0] bg-white dark:border-[#3c4043] dark:bg-[#292a2d]'}`}>
            <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{room.family.room_number}</h3><p className="mt-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">{room.campus.name} · {room.building.name} · {room.floor.level}楼</p></div><span className="rounded-full bg-white/70 px-2 py-1 text-xs dark:bg-black/20">{groups.length ? '考试占用' : '未发现考试'}</span></div>
            {groups.map(group => <details key={group.group_id} className="mt-3 rounded-lg border border-black/5 bg-white/60 px-3 py-2 text-xs dark:bg-black/10"><summary className="cursor-pointer font-medium">{formatClock(group.start_timestamp)}–{formatClock(group.end_timestamp)} · {group.course_name}</summary><p className="mt-2 leading-5 text-[#5f6368] dark:text-[#bdc1c6]">{group.teacher} · {group.class_names.join('、')} · {group.total_count}人</p></details>)}
        </article>
    );
}

export function RoomsPage({ query, date, campus, building, floor, start, end, onChange, client, spaceClient }: RoomsPageProps) {
    const state = useRoomOccupancy(client, spaceClient, { query, date, campus, building, floor });
    const bookingsByFamily = new Map<string, RoomBooking[]>();
    for (const booking of state.bookings) bookingsByFamily.set(booking.space_family_id, [...(bookingsByFamily.get(booking.space_family_id) ?? []), booking]);
    const campuses = state.space?.campuses.map(item => item.name).sort((a, b) => a.localeCompare(b, 'zh-CN')) ?? [];
    const buildings = state.space ? state.space.buildings
        .filter(item => !state.campus || state.space?.campuses.find(campusItem => campusItem.campus_id === item.campus_id)?.name === state.campus)
        .map(item => item.name).sort((a, b) => a.localeCompare(b, 'zh-CN')) : [];
    const floors = state.space ? uniqueValues(state.space.floors.filter(item => {
        const itemBuilding = state.space?.buildings.find(entry => entry.building_id === item.building_id);
        return !state.building || itemBuilding?.name === state.building;
    }).map(item => item.level)) : [];
    const dates = state.index?.dates.map(item => item.date) ?? [];
    const update = (next: Record<string, string | null>) => onChange({ date: state.date, campus: state.campus, building: state.building, floor: state.floor, start, end, room: null, ...next });

    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-8 pt-4 sm:pt-6">
            <RoomsProductHeader description="按日期和空间层级查看考试占用。" roomCount={state.space?.families.filter(item => item.availability_eligible === 'eligible').length} dateCount={state.index?.dates.length} />
            <InlineErrorBanner message={state.error} />
            {state.space && !state.floorEntry && !state.loading ? <RoomBuildingPicker space={state.space} heading="选择楼栋" onSelect={(campusName, buildingName) => update({ campus: campusName, building: buildingName, floor: null })} /> : null}
            {state.floorEntry ? (
                <>
                    <section className="grid gap-3 rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-4 dark:border-[#3c4043] dark:bg-[#292a2d] sm:grid-cols-3 lg:grid-cols-6">
                        <RoomDateFilter value={state.date} dates={dates} onChange={value => update({ date: value })} />
                        <Select label="校区" name="campus" value={state.campus} values={campuses} onChange={value => update({ campus: value || null, building: null, floor: null })} />
                        <Select label="楼栋" name="building" value={state.building} values={buildings} onChange={value => update({ building: value || null, floor: null })} />
                        <Select label="楼层" name="floor" value={state.floor} values={floors} onChange={value => update({ floor: value || null })} />
                    </section>
                    <section className="mt-5 rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#202124]">
                        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm"><span className="inline-flex items-center gap-1 font-medium"><Building2 className="h-4 w-4" />{state.campus} · {state.building} · {state.floor}楼</span><span className="inline-flex items-center gap-1 text-[#5f6368] dark:text-[#bdc1c6]"><Clock className="h-4 w-4" />{state.date}</span><span className="inline-flex items-center gap-1 text-[#5f6368] dark:text-[#bdc1c6]"><MapPin className="h-4 w-4" />{state.rooms.length} 个空间</span></div>
                        {state.loading ? <div className="h-48 animate-pulse rounded-xl bg-[#f1f3f4] dark:bg-[#303134]" /> : state.floorEntry && state.space ? <SpatialViewport
                            client={spaceClient}
                            campusName={state.campus ?? ''}
                            buildingName={state.building ?? ''}
                            buildingId={state.floorEntry.building_id}
                            floorId={state.floorEntry.floor_id}
                            floorLevel={state.floorEntry.level}
                            northConfidence={state.floorEntry.north_confidence}
                            families={state.rooms}
                            roomState={familyId => (bookingsByFamily.get(familyId) ?? []).some(booking => overlapsWindow({ start_timestamp: booking.start_timestamp, end_timestamp: booking.end_timestamp }, start, end)) ? 'exam' : 'free'}
                            detail={room => <div className="mt-6"><RoomResult room={room} bookings={bookingsByFamily.get(room.family.space_family_id) ?? []} start={start} end={end} /></div>}
                        /> : null}
                    </section>
                </>
            ) : state.loading ? <div className="h-48 animate-pulse rounded-xl bg-[#f1f3f4] dark:bg-[#303134]" /> : null}
        </main>
    );
}
