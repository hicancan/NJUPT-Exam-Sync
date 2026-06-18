import { useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    findAdjacentExamRoomDate,
    findNearestExamRoomDate,
    sortExamRoomDates,
} from '@/features/room-occupancy/model/roomOccupancy';

interface RoomDateFilterProps {
    value: string | null;
    dates: string[];
    onChange: (value: string) => void;
}

export function RoomDateFilter({ value, dates, onChange }: RoomDateFilterProps) {
    const sortedDates = useMemo(() => sortExamRoomDates(dates), [dates]);
    const selectedDate = value || sortedDates[0] || '';
    const minDate = sortedDates[0] || '';
    const maxDate = sortedDates[sortedDates.length - 1] || '';
    const previousDate = findAdjacentExamRoomDate(sortedDates, selectedDate, 'previous');
    const nextDate = findAdjacentExamRoomDate(sortedDates, selectedDate, 'next');
    const nearestDate = findNearestExamRoomDate(sortedDates, selectedDate);
    const knownDate = Boolean(selectedDate && sortedDates.includes(selectedDate));

    const dateInputId = 'room-occupancy-date';
    const dateOptionsId = 'room-occupancy-date-options';

    return (
        <div className="grid gap-1 text-[13px] text-[#5f6368] dark:text-[#bdc1c6] sm:col-span-2 lg:col-span-2">
            <label htmlFor={dateInputId} className="inline-flex items-center gap-1">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                <span>日期</span>
            </label>
            <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] gap-2">
                <button
                    type="button"
                    aria-label="上一场考试日期"
                    title="上一场考试日期"
                    disabled={!previousDate}
                    onClick={() => previousDate && onChange(previousDate)}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[#dadce0] bg-white text-[#3c4043] outline-none hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#e8eaed] dark:hover:bg-[#303134]"
                >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <input
                    id={dateInputId}
                    type="date"
                    value={selectedDate}
                    min={minDate}
                    max={maxDate}
                    list={dateOptionsId}
                    onChange={(event) => {
                        if (event.target.value) onChange(event.target.value);
                    }}
                    className="h-10 min-w-0 rounded-md border border-[#dadce0] bg-white px-3 text-[14px] text-[#202124] outline-none [color-scheme:light] focus:border-[#1a73e8] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#e8eaed] dark:[color-scheme:dark]"
                />
                <button
                    type="button"
                    aria-label="下一场考试日期"
                    title="下一场考试日期"
                    disabled={!nextDate}
                    onClick={() => nextDate && onChange(nextDate)}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[#dadce0] bg-white text-[#3c4043] outline-none hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#e8eaed] dark:hover:bg-[#303134]"
                >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
            <datalist id={dateOptionsId}>
                {sortedDates.map(date => <option key={date} value={date} />)}
            </datalist>
            {!knownDate && nearestDate ? (
                <div className="flex items-center justify-between gap-2 text-[12px] text-[#70757a] dark:text-[#9aa0a6]">
                    <span>当天没有考试占用记录</span>
                    <button
                        type="button"
                        onClick={() => onChange(nearestDate)}
                        className="font-medium text-[#1a73e8] hover:underline dark:text-[#8ab4f8]"
                    >
                        跳到最近考试日
                    </button>
                </div>
            ) : null}
        </div>
    );
}
