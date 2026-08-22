import { Search } from 'lucide-react';

const BUILDING_CLOSURE_SEARCH_URL = `/search?q=${encodeURIComponent('封楼')}`;

interface RoomsProductHeaderProps {
    description: string;
    roomCount?: number;
    dateCount?: number;
    pendingLabel?: string;
}

export function RoomsProductHeader({ description, roomCount, dateCount, pendingLabel }: RoomsProductHeaderProps) {
    const hasCoverage = roomCount !== undefined && dateCount !== undefined;
    return (
        <header className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-[24px] font-semibold leading-tight text-[#202124] dark:text-[#e8eaed] sm:text-[28px] sm:font-normal">
                    考试教室查询
                </h1>
                <p className="mt-1.5 text-[14px] leading-6 text-[#5f6368] dark:text-[#bdc1c6]">
                    {description}
                </p>
                <a
                    href={BUILDING_CLOSURE_SEARCH_URL}
                    className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-[#1a73e8] hover:underline dark:text-[#8ab4f8]"
                >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    查看封楼通知
                </a>
            </div>
            {hasCoverage ? (
                <div className="self-start whitespace-nowrap rounded-full bg-[#f1f3f4] px-3 py-1 text-[12px] text-[#5f6368] dark:bg-[#303134] dark:text-[#bdc1c6] sm:self-auto">
                    覆盖 {roomCount} 间教室、{dateCount} 个考试日期
                </div>
            ) : pendingLabel ? (
                <div className="self-start text-[12px] text-[#70757a] dark:text-[#9aa0a6]" aria-live="polite">
                    {pendingLabel}
                </div>
            ) : null}
        </header>
    );
}
