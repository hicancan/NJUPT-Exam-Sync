import { CalendarRange } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TeachingScheduleClient } from './model/TeachingScheduleClient';

interface TimetableLandingProps {
    client: TeachingScheduleClient;
    savedClass: string | null;
    onOpenClass: (className: string) => void;
    initialQuery?: string;
}

export function TimetableLanding({ client, savedClass, onOpenClass, initialQuery = '' }: TimetableLandingProps) {
    const [query, setQuery] = useState(initialQuery);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const visibleSuggestions = query.trim().length >= 2 ? suggestions : [];

    useEffect(() => {
        if (query.trim().length < 2) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            client.suggest(query, controller.signal).then(setSuggestions).catch(reason => {
                if (reason instanceof DOMException && reason.name === 'AbortError') return;
                setError(reason instanceof Error ? reason.message : '班级列表加载失败');
            });
        }, 160);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [client, query]);

    const submit = () => {
        const target = visibleSuggestions.find(item => item.toUpperCase() === query.trim().toUpperCase()) ?? query.trim();
        if (!target) return;
        onOpenClass(target);
    };

    return (
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-10 pb-12">
            <section className="max-w-xl mx-auto rounded-2xl border border-[#dadce0] bg-white px-5 py-8 text-center dark:border-[#3c4043] dark:bg-[#292a2d] sm:px-9 sm:py-10">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1967d2] dark:bg-[#23334d] dark:text-[#8ab4f8]">
                    <CalendarRange className="h-7 w-7" aria-hidden="true" />
                </span>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight">查询班级课表</h1>
                <p className="mt-3 text-[15px] leading-7 text-[#5f6368] dark:text-[#bdc1c6]">输入班级号，按周查看课程、时间和教室。</p>
                <form className="mt-7" onSubmit={event => { event.preventDefault(); submit(); }}>
                    <label htmlFor="timetable-class" className="sr-only">班级号</label>
                    <input
                        id="timetable-class"
                        value={query}
                        onChange={event => { setQuery(event.target.value); setError(null); }}
                        placeholder="输入班级号，例如 B240402"
                        autoComplete="off"
                        className="h-12 w-full rounded-xl border border-[#bdc1c6] bg-white px-4 text-base outline-none transition focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20 dark:border-[#5f6368] dark:bg-[#202124]"
                        aria-controls="timetable-suggestions"
                    />
                    {visibleSuggestions.length ? (
                        <div id="timetable-suggestions" className="mt-2 overflow-hidden rounded-xl border border-[#dadce0] bg-white text-left dark:border-[#3c4043] dark:bg-[#202124]">
                            {visibleSuggestions.slice(0, 6).map(item => (
                                <button key={item} type="button" onClick={() => { setQuery(item); onOpenClass(item); }} className="block w-full px-4 py-2.5 text-sm hover:bg-[#f1f3f4] focus:bg-[#f1f3f4] dark:hover:bg-[#303134] dark:focus:bg-[#303134]">
                                    {item}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    <button type="submit" className="mt-3 h-12 w-full rounded-xl bg-[#1a73e8] font-medium text-white transition hover:bg-[#1765cc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a73e8]">查询课表</button>
                </form>
                {error ? <p className="mt-3 text-sm text-[#b3261e] dark:text-[#f2b8b5]">{error}</p> : null}
                {savedClass ? (
                    <button type="button" onClick={() => onOpenClass(savedClass)} className="mt-5 rounded-full border border-[#c6dafc] px-4 py-2 text-sm font-medium text-[#1967d2] dark:border-[#405985] dark:text-[#8ab4f8]">
                        继续查看 {savedClass}
                    </button>
                ) : null}
            </section>
        </main>
    );
}
