import { Building2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ClassroomAvailabilityClient } from './model/ClassroomAvailabilityClient';
import { todayInShanghai, weekdayInShanghai } from '../timetable/model/calendar';

interface ClassroomsLandingProps {
    client: ClassroomAvailabilityClient;
    onChange: (params: Record<string, string | null>) => void;
}

export function ClassroomsLanding({ client, onChange }: ClassroomsLandingProps) {
    const [week, setWeek] = useState(1);
    const [weekday, setWeekday] = useState(weekdayInShanghai);
    const [period, setPeriod] = useState(1);
    const [campus, setCampus] = useState('');
    const [campuses, setCampuses] = useState<string[]>([]);
    const [weekCount, setWeekCount] = useState(20);
    const [periodCount, setPeriodCount] = useState(12);

    useEffect(() => {
        const controller = new AbortController();
        client.initialize(controller.signal).then(manifest => {
            setCampuses([...new Set(manifest.rooms.map(room => room.campus))].sort());
            setWeekCount(manifest.weeks.length);
            setPeriodCount(manifest.periods.length);
            const today = todayInShanghai();
            const current = manifest.weeks.find(item => today >= item.start_date && today <= item.end_date);
            if (current) setWeek(current.week);
        }).catch(() => undefined);
        return () => controller.abort();
    }, [client]);

    const weeks = useMemo(() => Array.from({ length: weekCount }, (_, index) => index + 1), [weekCount]);
    const periods = useMemo(() => Array.from({ length: periodCount }, (_, index) => index + 1), [periodCount]);

    return (
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-10 pb-12">
            <section className="mx-auto max-w-2xl rounded-2xl border border-[#dadce0] bg-white px-5 py-8 dark:border-[#3c4043] dark:bg-[#292a2d] sm:px-9 sm:py-10">
                <div className="text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1967d2] dark:bg-[#23334d] dark:text-[#8ab4f8]"><Building2 className="h-7 w-7" aria-hidden="true" /></span>
                    <h1 className="mt-5 text-3xl font-semibold tracking-tight">查询空教室</h1>
                    <p className="mt-3 text-[15px] leading-7 text-[#5f6368] dark:text-[#bdc1c6]">选择周次和节次，查看课程与考试数据中没有发现占用的教室。</p>
                </div>
                <form className="mt-7 grid gap-4 sm:grid-cols-2" onSubmit={event => {
                    event.preventDefault();
                    onChange({ week: String(week), weekday: String(weekday), period: String(period), campus: campus || null });
                }}>
                    <label className="grid gap-1.5 text-sm"><span>周次</span><select value={week} onChange={event => setWeek(Number(event.target.value))} className="h-12 rounded-xl border border-[#bdc1c6] bg-white px-3 dark:border-[#5f6368] dark:bg-[#202124]">{weeks.map(item => <option key={item} value={item}>第 {item} 周</option>)}</select></label>
                    <label className="grid gap-1.5 text-sm"><span>星期</span><select value={weekday} onChange={event => setWeekday(Number(event.target.value))} className="h-12 rounded-xl border border-[#bdc1c6] bg-white px-3 dark:border-[#5f6368] dark:bg-[#202124]">{'一二三四五六日'.split('').map((item, index) => <option key={item} value={index + 1}>星期{item}</option>)}</select></label>
                    <label className="grid gap-1.5 text-sm"><span>节次</span><select value={period} onChange={event => setPeriod(Number(event.target.value))} className="h-12 rounded-xl border border-[#bdc1c6] bg-white px-3 dark:border-[#5f6368] dark:bg-[#202124]">{periods.map(item => <option key={item} value={item}>第 {item} 节</option>)}</select></label>
                    <label className="grid gap-1.5 text-sm"><span>校区</span><select value={campus} onChange={event => setCampus(event.target.value)} className="h-12 rounded-xl border border-[#bdc1c6] bg-white px-3 dark:border-[#5f6368] dark:bg-[#202124]"><option value="">全部校区</option>{campuses.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
                    <button type="submit" className="mt-1 h-12 rounded-xl bg-[#1a73e8] font-medium text-white transition hover:bg-[#1765cc] sm:col-span-2">查询教室</button>
                </form>
                <p className="mt-5 text-xs leading-6 text-[#5f6368] dark:text-[#bdc1c6]">结果不包含临时借用、临时调课、补课、活动、维修或尚未同步的变化。</p>
            </section>
        </main>
    );
}
