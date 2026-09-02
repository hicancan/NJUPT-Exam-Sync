import { CalendarRange } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProductLandingCard } from '@/shared/ui/ProductLandingCard';
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
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 sm:py-12">
            <ProductLandingCard
                icon={<CalendarRange className="h-7 w-7" aria-hidden="true" />}
                title="查询班级课表"
                description="输入班级号，按周查看课程、时间和教室。"
            >
                <form className="mt-7" onSubmit={event => { event.preventDefault(); submit(); }}>
                    <label htmlFor="timetable-class" className="sr-only">班级号</label>
                    <div className="mx-auto grid max-w-[440px] grid-cols-[minmax(0,1fr)_88px] gap-2 sm:grid-cols-[minmax(0,1fr)_96px] sm:gap-3">
                        <input
                            id="timetable-class"
                            value={query}
                            onChange={event => { setQuery(event.target.value); setError(null); }}
                            placeholder="输入班级号"
                            autoComplete="off"
                            className="h-12 min-w-0 w-full rounded-lg border border-[#dadce0] bg-white px-3 text-[15px] outline-none transition focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20 dark:border-[#3c4043] dark:bg-[#202124]"
                            aria-controls="timetable-suggestions"
                        />
                        <button type="submit" className="h-12 w-full rounded-lg bg-[#1a73e8] px-3 text-sm font-medium text-white transition hover:bg-[#1765cc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a73e8]">查询</button>
                    </div>
                    {visibleSuggestions.length ? (
                        <div id="timetable-suggestions" className="mx-auto mt-2 max-w-[440px] overflow-hidden rounded-xl border border-[#dadce0] bg-white text-left dark:border-[#3c4043] dark:bg-[#202124]">
                            {visibleSuggestions.slice(0, 6).map(item => (
                                <button key={item} type="button" onClick={() => { setQuery(item); onOpenClass(item); }} className="block w-full px-4 py-2.5 text-sm hover:bg-[#f1f3f4] focus:bg-[#f1f3f4] dark:hover:bg-[#303134] dark:focus:bg-[#303134]">
                                    {item}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </form>
                {error ? <p className="mt-3 text-sm text-[#b3261e] dark:text-[#f2b8b5]">{error}</p> : null}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[13px]">
                    {savedClass ? (
                        <button type="button" onClick={() => onOpenClass(savedClass)} className="inline-flex h-9 items-center rounded-full border border-[#d2e3fc] bg-white px-3 font-medium text-[#174ea6] hover:bg-[#e8f0fe] dark:border-[#394457] dark:bg-[#202124] dark:text-[#8ab4f8] dark:hover:bg-[#1f2430]">
                            继续查看 {savedClass}
                        </button>
                    ) : null}
                    <button type="button" onClick={() => onOpenClass('B240402')} className="inline-flex h-9 items-center rounded-full px-3 text-[#5f6368] hover:bg-white dark:text-[#bdc1c6] dark:hover:bg-[#202124]">
                        试一试&nbsp;<span className="font-mono text-[#1a73e8] dark:text-[#8ab4f8]">B240402</span>
                    </button>
                </div>
            </ProductLandingCard>
        </main>
    );
}
