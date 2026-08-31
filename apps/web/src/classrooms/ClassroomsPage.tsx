import { BookOpen, Building2, CalendarDays, GraduationCap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ClassroomAvailability, ClassroomAvailabilityClient } from './model/ClassroomAvailabilityClient';

interface ClassroomsPageProps {
    week: number;
    weekday: number;
    period: number;
    campus: string | null;
    building: string | null;
    floor: string | null;
    client: ClassroomAvailabilityClient;
    onChange: (params: Record<string, string | null>, replace?: boolean) => void;
}

export function ClassroomsPage({ week, weekday, period, campus, building, floor, client, onChange }: ClassroomsPageProps) {
    const requestKey = `${week}:${weekday}:${period}:${campus ?? ''}:${building ?? ''}:${floor ?? ''}`;
    const [loadState, setLoadState] = useState<{ key: string; result: ClassroomAvailability | null; error: string | null }>({ key: '', result: null, error: null });
    const result = loadState.key === requestKey ? loadState.result : null;
    const error = loadState.key === requestKey ? loadState.error : null;

    useEffect(() => {
        const controller = new AbortController();
        client.query({ week, weekday, period, campus, building, floor }, controller.signal).then(nextResult => {
            setLoadState({ key: requestKey, result: nextResult, error: null });
        }).catch(reason => {
            if (reason instanceof DOMException && reason.name === 'AbortError') return;
            setLoadState({ key: requestKey, result: null, error: reason instanceof Error ? reason.message : '空教室数据加载失败' });
        });
        return () => controller.abort();
    }, [building, campus, client, floor, period, requestKey, week, weekday]);

    const buildings = useMemo(() => result ? [...new Set(result.manifest.rooms.filter(room => !campus || room.campus === campus).map(room => room.building))].sort() : [], [campus, result]);
    const floors = useMemo(() => result ? [...new Set(result.manifest.rooms.filter(room => (!campus || room.campus === campus) && (!building || room.building === building)).map(room => room.floor))].sort() : [], [building, campus, result]);
    const campuses = useMemo(() => result ? [...new Set(result.manifest.rooms.map(room => room.campus))].sort() : [], [result]);
    const update = (next: Record<string, string | null>) => onChange({ week: String(week), weekday: String(weekday), period: String(period), campus, building, floor, ...next });

    return (
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-7">
            <header className="mb-6">
                <h1 className="text-3xl font-semibold tracking-tight">空教室</h1>
                <p className="mt-2 text-sm text-[#5f6368] dark:text-[#bdc1c6]">第 {week} 周 · 星期{'一二三四五六日'[weekday - 1]} · 第 {period} 节{result ? ` · ${result.date}` : ''}</p>
            </header>
            <section className="grid gap-3 rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-4 dark:border-[#3c4043] dark:bg-[#292a2d] sm:grid-cols-3 lg:grid-cols-6">
                <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">周次<select value={week} onChange={event => update({ week: event.target.value })} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]">{result?.manifest.weeks.map(item => <option key={item.week} value={item.week}>第 {item.week} 周</option>)}</select></label>
                <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">星期<select value={weekday} onChange={event => update({ weekday: event.target.value })} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]">{'一二三四五六日'.split('').map((item,index) => <option key={item} value={index+1}>星期{item}</option>)}</select></label>
                <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">节次<select value={period} onChange={event => update({ period: event.target.value })} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]">{result?.manifest.periods.map(item => <option key={item.period} value={item.period}>第 {item.period} 节</option>)}</select></label>
                <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">校区<select value={campus ?? ''} onChange={event => update({ campus:event.target.value || null, building:null, floor:null })} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]"><option value="">全部</option>{campuses.map(item => <option key={item}>{item}</option>)}</select></label>
                <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">楼栋<select value={building ?? ''} onChange={event => update({ building:event.target.value || null, floor:null })} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]"><option value="">全部</option>{buildings.map(item => <option key={item}>{item}</option>)}</select></label>
                <label className="grid gap-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">楼层<select value={floor ?? ''} onChange={event => update({ floor:event.target.value || null })} className="h-10 rounded-lg border border-[#bdc1c6] bg-white px-2 text-sm text-[#202124] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed]"><option value="">全部</option>{floors.map(item => <option key={item}>{item}</option>)}</select></label>
            </section>
            {error ? <div className="mt-5 rounded-xl border border-[#f2b8b5] bg-[#fce8e6] p-4 text-sm text-[#8c1d18] dark:border-[#8c1d18] dark:bg-[#3c2020] dark:text-[#f2b8b5]">{error}</div> : null}
            {!result && !error ? <div className="mt-6 h-60 animate-pulse rounded-2xl bg-[#f1f3f4] dark:bg-[#292a2d]" /> : null}
            {result ? (
                <>
                    <section className="mt-7">
                        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">未发现占用的教室</h2><p className="mt-1 text-sm text-[#5f6368] dark:text-[#bdc1c6]">该时段没有发现课程或考试占用。</p></div><p className="text-sm font-medium text-[#1967d2] dark:text-[#8ab4f8]">{result.freeRooms.length} / {result.candidates.length} 间</p></div>
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{result.freeRooms.map(room => <article key={room.room_key} className="rounded-xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#292a2d]"><Building2 className="h-5 w-5 text-[#5f6368] dark:text-[#bdc1c6]" aria-hidden="true" /><h3 className="mt-3 font-semibold">{room.room}</h3><p className="mt-1 text-xs text-[#5f6368] dark:text-[#bdc1c6]">{room.campus} · {room.building} · {room.floor}</p></article>)}</div>
                    </section>
                    {result.occupied.size ? <section className="mt-9"><h2 className="text-lg font-semibold">已发现占用</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...result.occupied.entries()].map(([roomKey, sources]) => {
                        const room = result.candidates.find(item => item.room_key === roomKey);
                        return <article key={roomKey} className="rounded-xl border border-[#dadce0] p-4 dark:border-[#3c4043]"><h3 className="font-semibold">{room?.room ?? roomKey}</h3><div className="mt-3 flex flex-wrap gap-2">{sources.teaching.length ? <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f0fe] px-2.5 py-1 text-xs text-[#174ea6] dark:bg-[#183153] dark:text-[#aecbfa]"><BookOpen className="h-3.5 w-3.5" />课程占用</span> : null}{sources.exams.length ? <span className="inline-flex items-center gap-1 rounded-full bg-[#fef7e0] px-2.5 py-1 text-xs text-[#8d5b00] dark:bg-[#493a14] dark:text-[#fdd663]"><GraduationCap className="h-3.5 w-3.5" />考试占用</span> : null}</div>{sources.teaching.slice(0,2).map(item => <p key={item.meeting_id} className="mt-2 text-xs text-[#5f6368] dark:text-[#bdc1c6]">{item.course_name} · {item.class_ids.join('、')}</p>)}</article>;
                    })}</div></section> : null}
                    <aside className="mt-8 flex gap-3 rounded-xl bg-[#f1f3f4] p-4 text-xs leading-6 text-[#5f6368] dark:bg-[#292a2d] dark:text-[#bdc1c6]"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>结果不包含临时借用、临时调课、补课、活动、维修或封闭，以及尚未同步的临时变化；请不要据此判断教室在现实中一定空闲。</p></aside>
                </>
            ) : null}
        </main>
    );
}
