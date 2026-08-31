import { CalendarClock, ChevronLeft, ChevronRight, Download, LayoutGrid, Rows3 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TeachingMeeting } from '@njupt-search/academics-timetable';
import type { LoadedClassSchedule, TeachingScheduleClient } from './model/TeachingScheduleClient';
import { allocateCourseTones } from './model/courseColors';
import { buildClassCalendar, downloadCalendar, todayInShanghai, weekdayInShanghai } from './model/calendar';
import { TimetableGrid } from './ui/TimetableGrid';
import { CourseDetailPanel } from './ui/CourseDetailPanel';
import './timetable.css';

interface TimetablePageProps {
    className: string;
    week: number | null;
    client: TeachingScheduleClient;
    onChange: (params: Record<string, string | null>, replace?: boolean) => void;
}

const currentWeek = (loaded: LoadedClassSchedule): number => {
    const today = todayInShanghai();
    return loaded.term.weeks.find(week => today >= week.start_date && today <= week.end_date)?.week ?? 1;
};

export function TimetablePage({ className, week: requestedWeek, client, onChange }: TimetablePageProps) {
    const [loadState, setLoadState] = useState<{ className: string; loaded: LoadedClassSchedule | null; error: string | null }>({ className: '', loaded: null, error: null });
    const loaded = loadState.className === className ? loadState.loaded : null;
    const error = loadState.className === className ? loadState.error : null;
    const [view, setView] = useState<'week' | 'day'>('week');
    const [day, setDay] = useState(weekdayInShanghai);
    const [selected, setSelected] = useState<TeachingMeeting | null>(null);
    const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        client.loadClass(className, controller.signal).then(nextLoaded => {
            setLoadState({ className, loaded: nextLoaded, error: null });
        }).catch(reason => {
            if (reason instanceof DOMException && reason.name === 'AbortError') return;
            setLoadState({ className, loaded: null, error: reason instanceof Error ? reason.message : '课表加载失败' });
        });
        return () => controller.abort();
    }, [className, client]);

    useEffect(() => {
        if (!loaded) return;
        const week = requestedWeek && loaded.term.weeks.some(item => item.week === requestedWeek) ? requestedWeek : currentWeek(loaded);
        if (week !== requestedWeek || loaded.classInfo.class_name !== className) {
            onChange({ class: loaded.classInfo.class_name, week: String(week) }, true);
        }
    }, [className, loaded, onChange, requestedWeek]);

    useEffect(() => {
        const pop = () => setSelected(null);
        window.addEventListener('popstate', pop);
        return () => window.removeEventListener('popstate', pop);
    }, []);

    const openMeeting = useCallback((meeting: TeachingMeeting, target: HTMLElement) => {
        setReturnFocus(target);
        setSelected(meeting);
        if (window.history.state?.courseDetail) window.history.replaceState({ ...window.history.state, courseDetail: meeting.meeting_id }, '', window.location.href);
        else window.history.pushState({ ...window.history.state, courseDetail: meeting.meeting_id }, '', window.location.href);
    }, []);
    const closeMeeting = useCallback(() => {
        if (window.history.state?.courseDetail) window.history.back();
        else setSelected(null);
    }, []);

    const tones = useMemo(() => loaded ? allocateCourseTones(loaded.meetings) : new Map<string, number>(), [loaded]);
    if (error) return <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-10"><div className="rounded-xl border border-[#f2b8b5] bg-[#fce8e6] p-5 text-[#8c1d18] dark:border-[#8c1d18] dark:bg-[#3c2020] dark:text-[#f2b8b5]"><h1 className="text-xl font-semibold">班级课表暂时无法打开</h1><p className="mt-2 text-sm">{error}</p><button className="mt-4 rounded-full bg-[#1a73e8] px-4 py-2 text-sm text-white" onClick={() => window.location.reload()}>重新加载</button></div></main>;
    if (!loaded) return <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8"><div className="h-28 animate-pulse rounded-2xl bg-[#f1f3f4] dark:bg-[#303134]" /><div className="mt-4 h-[680px] animate-pulse rounded-2xl bg-[#f8f9fa] dark:bg-[#292a2d]" /></main>;
    const weekNumber = requestedWeek && loaded.term.weeks.some(item => item.week === requestedWeek) ? requestedWeek : currentWeek(loaded);
    const week = loaded.term.weeks.find(item => item.week === weekNumber) ?? loaded.term.weeks[0];
    if (!week) return null;
    const changeWeek = (next: number) => onChange({ class: loaded.classInfo.class_name, week: String(Math.min(loaded.term.weeks.length, Math.max(1, next))) });
    const exportAll = () => downloadCalendar(`${loaded.classInfo.class_name}-${loaded.term.academic_year}-${loaded.term.term_number}.ics`, buildClassCalendar(loaded.classInfo.class_name, loaded.meetings, loaded.term.weeks, loaded.periods.periods));
    const selectedTone = selected ? tones.get(selected.course_code?.trim().toUpperCase() || selected.course_name.trim().replace(/\s+/g, ' ')) ?? 0 : 0;

    return (
        <main className="timetable-page flex-1 w-full max-w-[1320px] mx-auto px-3 py-5 sm:px-4 sm:py-7">
            <header className="timetable-toolbar">
                <div><p>{loaded.classInfo.class_name} · {loaded.term.academic_year} 第{loaded.term.term_number}学期</p><h1>第{weekNumber}周</h1><span>{week.start_date} 至 {week.end_date}</span></div>
                <div className="timetable-toolbar-actions">
                    <div className="timetable-week-switcher"><button type="button" onClick={() => changeWeek(weekNumber - 1)} disabled={weekNumber <= 1} aria-label="上一周"><ChevronLeft /></button><button type="button" onClick={() => changeWeek(currentWeek(loaded))}><CalendarClock />回到本周</button><button type="button" onClick={() => changeWeek(weekNumber + 1)} disabled={weekNumber >= loaded.term.weeks.length} aria-label="下一周"><ChevronRight /></button></div>
                    <div className="timetable-view-switch" aria-label="课表视图"><button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}><LayoutGrid />周</button><button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}><Rows3 />日</button></div>
                    <button type="button" className="timetable-export" onClick={exportAll}><Download />导出日历</button>
                </div>
                {view === 'day' ? <div className="timetable-day-switch">{[1,2,3,4,5,6,7].map(item => <button key={item} type="button" aria-pressed={day === item} onClick={() => setDay(item)}>周{'一二三四五六日'[item - 1]}</button>)}</div> : null}
            </header>
            <TimetableGrid meetings={loaded.meetings} week={week} periods={loaded.periods.periods} tones={tones} view={view} day={day} onOpen={openMeeting} />
            {selected ? <CourseDetailPanel className={loaded.classInfo.class_name} meeting={selected} week={week} weeks={loaded.term.weeks} periods={loaded.periods.periods} tone={selectedTone} updatedAt={loaded.manifest.observed_at} returnFocus={returnFocus} onClose={closeMeeting} /> : null}
        </main>
    );
}
