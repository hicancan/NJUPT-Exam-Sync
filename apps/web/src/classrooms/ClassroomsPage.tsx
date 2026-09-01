import { BookOpen, Building2, CalendarDays, GraduationCap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ClassroomAvailability, ClassroomAvailabilityClient } from './model/ClassroomAvailabilityClient';
import { resolveFloorOptions } from './model/floorOptions';
import { SpatialViewport } from '@/space/SpatialViewport';

interface ClassroomsPageProps {
    date: string | null;
    week: number | null;
    weekday: number | null;
    period: number;
    campus: string | null;
    building: string | null;
    floor: string | null;
    query: string;
    client: ClassroomAvailabilityClient;
    onChange: (params: Record<string, string | null>, replace?: boolean) => void;
}

export function ClassroomsPage({ date, week, weekday, period, campus, building, floor, query, client, onChange }: ClassroomsPageProps) {
    const requestKey = `${date ?? ''}:${week ?? ''}:${weekday ?? ''}:${period}:${campus ?? ''}:${building ?? ''}:${floor ?? ''}:${query}`;
    const [loadState, setLoadState] = useState<{ key: string; result: ClassroomAvailability | null; error: string | null }>({ key: '', result: null, error: null });
    const result = loadState.key === requestKey ? loadState.result : null;
    const error = loadState.key === requestKey ? loadState.error : null;

    useEffect(() => {
        const controller = new AbortController();
        client.query({ date, week, weekday, period, campus, building, floor, query }, controller.signal).then(nextResult => {
            setLoadState({ key: requestKey, result: nextResult, error: null });
        }).catch(reason => {
            if (reason instanceof DOMException && reason.name === 'AbortError') return;
            setLoadState({ key: requestKey, result: null, error: reason instanceof Error ? reason.message : '空教室数据加载失败' });
        });
        return () => controller.abort();
    }, [building, campus, client, date, floor, period, query, requestKey, week, weekday]);

    const campuses = useMemo(() => result ? result.space.campuses.map(item => item.name).sort((a, b) => a.localeCompare(b, 'zh-CN')) : [], [result]);
    const buildings = useMemo(() => result ? result.space.buildings
        .filter(item => !campus || result.space.campuses.find(campusItem => campusItem.campus_id === item.campus_id)?.name === campus)
        .map(item => item.name).sort((a, b) => a.localeCompare(b, 'zh-CN')) : [], [campus, result]);
    const floors = useMemo(() => result ? resolveFloorOptions(result.space, campus, building) : [], [building, campus, result]);
    const effectiveWeek = result?.week ?? week ?? 1;
    const effectiveWeekday = result?.weekday ?? weekday ?? 1;
    const update = (next: Record<string, string | null>) => onChange({
        date,
        week: date ? null : String(effectiveWeek),
        weekday: date ? null : String(effectiveWeekday),
        period: String(period),
        campus,
        building,
        floor,
        q: query || null,
        ...next,
    });
    const activeBuilding = result?.space.buildings.find(item => item.name === building) ?? null;
    const activeCampus = activeBuilding && result ? result.space.campuses.find(item => item.campus_id === activeBuilding.campus_id) ?? null : null;
    const activeFloor = activeBuilding && result ? result.space.floors.find(item => item.building_id === activeBuilding.building_id && item.level === floor) ?? null : null;
    const floorFamilies = activeFloor && result ? result.spatialFamilies.filter(item => item.floor.floor_id === activeFloor.floor_id) : [];

    return (
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-7">
            <header className="mb-6">
                <h1 className="text-3xl font-semibold tracking-tight">空教室</h1>
                <p className="mt-2 text-sm text-[#5f6368] dark:text-[#bdc1c6]">第 {effectiveWeek} 周 · 星期{'一二三四五六日'[effectiveWeekday - 1]} · 第 {period} 节{result ? ` · ${result.date}` : date ? ` · ${date}` : ''}</p>
            </header>
            <section className="grid grid-cols-2 gap-3 rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-4 dark:border-[#3c4043] dark:bg-[#292a2d] sm:grid-cols-3 lg:grid-cols-6">
                <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">周次<select name="week" value={effectiveWeek} onChange={event => update({ date: null, week: event.target.value, weekday: String(effectiveWeekday) })} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]">{result?.manifest.weeks.map(item => <option key={item.week} value={item.week}>第 {item.week} 周</option>)}</select></label>
                <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">星期<select name="weekday" value={effectiveWeekday} onChange={event => update({ date: null, week: String(effectiveWeek), weekday: event.target.value })} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]">{'一二三四五六日'.split('').map((item,index) => <option key={item} value={index+1}>星期{item}</option>)}</select></label>
                <div className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]"><span>当前节次</span><strong className="flex h-10 items-center text-sm text-[#202124] dark:text-[#e8eaed]">第 {period} 节</strong></div>
                <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">校区<select name="campus" value={campus ?? ''} onChange={event => update({ campus:event.target.value || null, building:null, floor:null })} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]"><option value="">全部</option>{campuses.map(item => <option key={item}>{item}</option>)}</select></label>
                <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">楼栋<select name="building" value={building ?? ''} onChange={event => update({ building:event.target.value || null, floor:null })} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]"><option value="">全部</option>{buildings.map(item => <option key={item}>{item}</option>)}</select></label>
                <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">楼层<select name="floor" value={floor ?? ''} onChange={event => update({ floor:event.target.value || null })} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]"><option value="">全部</option>{floors.map(item => <option key={item}>{item}</option>)}</select></label>
            </section>
            {error ? <div className="mt-5 rounded-xl border border-[#f2b8b5] bg-[#fce8e6] p-4 text-sm text-[#8c1d18] dark:border-[#8c1d18] dark:bg-[#3c2020] dark:text-[#f2b8b5]">{error}</div> : null}
            {!result && !error ? <div className="mt-6 h-60 animate-pulse rounded-2xl bg-[#f1f3f4] dark:bg-[#292a2d]" /> : null}
            {result ? (
                <>
                    <section className="mt-5 rounded-2xl border border-[#dadce0] bg-white px-4 py-3 dark:border-[#3c4043] dark:bg-[#202124]" aria-label="节次时间轴">
                        <div className="flex items-center justify-between text-xs text-[#5f6368] dark:text-[#bdc1c6]"><span>上午</span><span>下午</span><span>晚间</span></div>
                        <input className="mt-2 w-full accent-[#1a73e8]" name="period" type="range" min="1" max="12" step="1" value={period} onChange={event => update({ period: event.target.value })} aria-label="选择节次" />
                        <div className="mt-1 grid grid-cols-12 text-center text-[10px] text-[#5f6368] dark:text-[#bdc1c6]">{Array.from({ length: 12 }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
                    </section>
                    {activeCampus && activeBuilding && activeFloor ? <div className="mt-6"><SpatialViewport
                        client={client.spaceClient}
                        campusName={activeCampus.name}
                        buildingName={activeBuilding.name}
                        buildingId={activeBuilding.building_id}
                        floorId={activeFloor.floor_id}
                        floorLevel={activeFloor.level}
                        northConfidence={activeFloor.north_confidence}
                        families={floorFamilies}
                        roomState={familyId => {
                            const family = floorFamilies.find(item => item.family.space_family_id === familyId);
                            if (!family || family.family.availability_eligible === 'unknown') return 'unknown';
                            if (family.family.availability_eligible === 'ineligible') return 'non-teaching';
                            const sources = result.occupied.get(familyId);
                            if (!sources) return 'free';
                            if (sources.teaching.length && sources.exams.length) return 'both';
                            return sources.teaching.length ? 'teaching' : 'exam';
                        }}
                        detail={room => { const sources = result.occupied.get(room.family.space_family_id); return sources ? <section className="mt-6"><h3 className="font-semibold">占用详情</h3>{sources.teaching.map(item => <p key={item.meeting_id} className="mt-2 text-sm">课程：{item.course_name} · {item.class_ids.join('、')}</p>)}{sources.exams.map(item => <p key={item.exam_id} className="mt-2 text-sm">考试：{item.course_name} · {item.class_name}</p>)}</section> : <p className="mt-6 text-sm">该时段没有发现课程或考试占用。</p>; }}
                    /></div> : null}
                    <section className="mt-7">
                        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">未发现占用的教室</h2><p className="mt-1 text-sm text-[#5f6368] dark:text-[#bdc1c6]">该时段没有发现课程或考试占用。</p></div><p className="text-sm font-medium text-[#1967d2] dark:text-[#8ab4f8]">{result.freeRooms.length} / {result.candidates.length} 间</p></div>
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{result.freeRooms.map(room => <article key={room.family.space_family_id} className="rounded-xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#292a2d]"><Building2 className="h-5 w-5 text-[#5f6368] dark:text-[#bdc1c6]" aria-hidden="true" /><h3 className="mt-3 font-semibold">{room.family.room_number}</h3><p className="mt-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">{room.campus.name} · {room.building.name} · {room.floor.level}楼</p></article>)}</div>
                    </section>
                    {result.occupied.size ? <section className="mt-9"><h2 className="text-lg font-semibold">已发现占用</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...result.occupied.entries()].map(([roomKey, sources]) => {
                        const room = result.candidates.find(item => item.family.space_family_id === roomKey);
                        return <article key={roomKey} className="rounded-xl border border-[#dadce0] p-4 dark:border-[#3c4043]"><h3 className="font-semibold">{room?.family.room_number ?? roomKey}</h3><div className="mt-3 flex flex-wrap gap-2">{sources.teaching.length ? <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f0fe] px-2.5 py-1 text-xs text-[#174ea6] dark:bg-[#183153] dark:text-[#aecbfa]"><BookOpen className="h-3.5 w-3.5" />课程占用</span> : null}{sources.exams.length ? <span className="inline-flex items-center gap-1 rounded-full bg-[#fef7e0] px-2.5 py-1 text-xs text-[#8d5b00] dark:bg-[#493a14] dark:text-[#fdd663]"><GraduationCap className="h-3.5 w-3.5" />考试占用</span> : null}</div>{sources.teaching.slice(0,2).map(item => <p key={item.meeting_id} className="mt-2 text-xs text-[#5f6368] dark:text-[#bdc1c6]">{item.course_name} · {item.class_ids.join('、')}</p>)}</article>;
                    })}</div></section> : null}
                    <aside className="mt-8 flex gap-3 rounded-xl bg-[#f1f3f4] p-4 text-xs leading-6 text-[#5f6368] dark:bg-[#292a2d] dark:text-[#bdc1c6]"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>结果不包含临时借用、临时调课、补课、活动、维修或封闭，以及尚未同步的临时变化；请不要据此判断教室在现实中一定空闲。</p></aside>
                </>
            ) : null}
        </main>
    );
}
