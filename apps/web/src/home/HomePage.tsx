import { CalendarDays, Download, FileText, Shuffle, Trophy, Waypoints } from 'lucide-react';
import { QUICK_SEARCHES, QuickSearchIcon } from './searchPresets';
import { ThemeToggle } from '@/shared/ui/ThemeToggle';
import { SearchInput } from '@/shared/ui/SearchInput';
import type { ProductIntent } from '@/app/routing/intents';

const QUICK_SEARCH_ICONS: Record<QuickSearchIcon, typeof CalendarDays> = {
    calendar: CalendarDays,
    shuffle: Shuffle,
    download: Download,
    waypoints: Waypoints,
    trophy: Trophy,
    'file-text': FileText,
};

interface HomePageProps {
    inputValue: string;
    onQuickSearch: (intent: ProductIntent) => void;
    onInputChange: (value: string) => void;
    onSubmit: (value: string) => void;
    onSearchWarm: () => void;
}

export function HomePage({
    inputValue,
    onQuickSearch,
    onInputChange,
    onSubmit,
    onSearchWarm,
}: HomePageProps) {
    return (
        <main className="flex-1 px-4">
            <div className="max-w-6xl mx-auto pt-5 flex justify-end">
                <ThemeToggle />
            </div>
            <section className="max-w-[680px] mx-auto min-h-[calc(100vh-176px)] flex flex-col items-center justify-center pb-20">
                <img src="/assets/logo.png" alt="" className="w-16 h-16 rounded-2xl" />
                <h1 className="mt-5 text-5xl sm:text-6xl font-normal text-[#202124] dark:text-[#e8eaed] leading-tight">njupt-search</h1>

                <div className="mt-8 w-full">
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

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    {QUICK_SEARCHES.map(item => {
                        const Icon = QUICK_SEARCH_ICONS[item.icon];
                        return (
                            <button
                                key={item.label}
                                type="button"
                                onClick={() => onQuickSearch(item.intent)}
                                className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] text-sm text-[#3c4043] dark:text-[#e8eaed] hover:border-[#8ab4f8] transition-colors"
                            >
                                <Icon className="w-4 h-4" aria-hidden="true" />
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            </section>
        </main>
    );
}
