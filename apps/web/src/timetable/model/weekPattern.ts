import type { TeachingMeeting } from '@njupt-search/academics-timetable';

export const alternatingWeekLabel = (meeting: TeachingMeeting): '单周' | '双周' | null => {
    if (meeting.week_numbers.length < 2) return null;
    const first = meeting.week_numbers[0];
    if (first === undefined) return null;
    const parity = first % 2;
    return meeting.week_numbers.every(week => week % 2 === parity) ? (parity === 1 ? '单周' : '双周') : null;
};

export const showAsInactiveAlternating = (meeting: TeachingMeeting, week: number): boolean => {
    if (meeting.week_numbers.includes(week) || !alternatingWeekLabel(meeting)) return false;
    const first = Math.min(...meeting.week_numbers);
    const last = Math.max(...meeting.week_numbers);
    return week >= first - 1 && week <= last + 1;
};

export const formatWeekNumbers = (weeks: number[]): string => {
    if (!weeks.length) return '未注明';
    const sorted = [...new Set(weeks)].sort((left, right) => left - right);
    const first = sorted[0];
    if (first === undefined) return '未注明';
    const parity = sorted.length >= 2 && sorted.every(week => week % 2 === first % 2)
        ? (first % 2 === 1 ? '单周' : '双周')
        : null;
    if (parity) return `第${first}–${sorted[sorted.length - 1] ?? first}周（${parity}）`;
    const ranges: string[] = [];
    let start = first;
    let end = first;
    for (const week of sorted.slice(1)) {
        if (week === end + 1) end = week;
        else {
            ranges.push(start === end ? String(start) : `${start}–${end}`);
            start = week;
            end = week;
        }
    }
    ranges.push(start === end ? String(start) : `${start}–${end}`);
    return `第${ranges.join('、')}周`;
};
