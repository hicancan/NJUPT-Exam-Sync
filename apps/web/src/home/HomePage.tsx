import { Building2, CalendarDays, Download, FileText, GraduationCap, Shuffle, Trophy } from 'lucide-react';
import type { ProductIntent } from '@/app/routing/intents';
import { QUICK_SEARCHES, QuickSearchIcon } from './searchPresets';
import { ThemeToggle } from '@/shared/ui/ThemeToggle';
import { SearchInput } from '@/shared/ui/SearchInput';
import { resolveQuickIntent } from '@/app/routing/routeContract';
import { buildPath } from '@/app/routing/useUrlState';

const QUICK_SEARCH_ICONS: Record<QuickSearchIcon, typeof CalendarDays> = {
    timetable: GraduationCap,
    classrooms: Building2,
    calendar: CalendarDays,
    shuffle: Shuffle,
    download: Download,
    trophy: Trophy,
    'file-text': FileText,
};

interface HomePageProps {
    inputValue: string;
    onQuickSearch: (intent: ProductIntent) => void;
    onInputChange: (value: string) => void;
    onSubmit: (value: string) => void;
    onSearchWarm: () => void;
    onIntentWarm: (intent: ProductIntent) => void;
}

export function HomePage({
    inputValue,
    onQuickSearch,
    onInputChange,
    onSubmit,
    onSearchWarm,
    onIntentWarm,
}: HomePageProps) {
    return (
        <main className="flex-1 px-4">
            <div className="max-w-6xl mx-auto pt-5 flex justify-end">
                <ThemeToggle />
            </div>
            <section className="max-w-[680px] mx-auto min-h-[calc(100vh-176px)] flex flex-col items-center justify-center pb-20">
                <img src="/assets/logo.png" alt="" className="w-16 h-16 rounded-2xl" />
                <h1 className="mt-5 text-5xl sm:text-6xl font-normal text-[#202124] dark:text-[#e8eaed] leading-tight">njupt-search</h1>

                <div className="mt-7 w-full">
                    <SearchInput
                        value={inputValue}
                        onChange={(value) => {
                            if (value.trim().length === 1) onSearchWarm();
                            onInputChange(value);
                        }}
                        onSubmit={onSubmit}
                        onUserFocus={onSearchWarm}
                    />
                </div>

                <div className="mt-6 w-full space-y-4">
                    {(['日常教学', '考试', '校园信息'] as const).map(group => (
                        <section key={group} aria-labelledby={`home-group-${group}`}>
                            <h2 id={`home-group-${group}`} className="mb-2 text-center text-xs font-medium tracking-[0.12em] text-[#80868b] dark:text-[#9aa0a6]">
                                {group === '校园信息' ? (
                                    <a className="transition-colors hover:text-[#1a73e8] focus-visible:text-[#1a73e8]" href="/search">{group}</a>
                                ) : group}
                            </h2>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                {QUICK_SEARCHES.filter(item => item.group === group).map(item => {
                                    const Icon = QUICK_SEARCH_ICONS[item.icon];
                                    return (
                                        <a
                                            key={item.label}
                                            href={buildPath(resolveQuickIntent(item.intent))}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                onQuickSearch(item.intent);
                                            }}
                                            onPointerEnter={() => onIntentWarm(item.intent)}
                                            onPointerDown={() => onIntentWarm(item.intent)}
                                            onFocus={() => onIntentWarm(item.intent)}
                                            className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] text-sm text-[#3c4043] dark:text-[#e8eaed] hover:border-[#8ab4f8] transition-colors"
                                        >
                                            <Icon className="w-4 h-4" aria-hidden="true" />
                                            {item.label}
                                        </a>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            </section>
        </main>
    );
}
