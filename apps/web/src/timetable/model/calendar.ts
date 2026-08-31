import type { TeachingMeeting, TeachingPeriod, TeachingWeek } from '@njupt-search/academics-timetable';

const escape = (value: string): string => value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
const compact = (value: string): string => value.replace(/[-:]/g, '');

export const todayInShanghai = (): string => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
};

export const weekdayInShanghai = (): number => {
    const weekday = new Date(`${todayInShanghai()}T00:00:00Z`).getUTCDay();
    return weekday === 0 ? 7 : weekday;
};

export const meetingDate = (week: TeachingWeek, weekday: number): string => {
    const date = new Date(`${week.start_date}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + weekday - 1);
    return date.toISOString().slice(0, 10);
};

export const buildClassCalendar = (
    className: string,
    meetings: TeachingMeeting[],
    weeks: TeachingWeek[],
    periods: TeachingPeriod[],
): string => {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//njupt-search//Teaching Schedule//ZH-CN', 'CALSCALE:GREGORIAN'];
    for (const meeting of meetings) {
        const startPeriod = periods.find(item => item.period === meeting.start_period);
        const endPeriod = periods.find(item => item.period === meeting.end_period);
        if (!startPeriod || !endPeriod) continue;
        for (const weekNumber of meeting.week_numbers) {
            const week = weeks.find(item => item.week === weekNumber);
            if (!week) continue;
            const date = meetingDate(week, meeting.weekday);
            const uid = `${meeting.meeting_id}-${weekNumber}@njupt-search`;
            lines.push(
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${compact(new Date().toISOString().slice(0, 19))}Z`,
                `DTSTART;TZID=Asia/Shanghai:${compact(date)}T${compact(startPeriod.start_time)}00`,
                `DTEND;TZID=Asia/Shanghai:${compact(date)}T${compact(endPeriod.end_time)}00`,
                `SUMMARY:${escape(meeting.course_name)}`,
                `LOCATION:${escape(meeting.location ?? '')}`,
                `DESCRIPTION:${escape([className, meeting.teacher].filter(Boolean).join(' · '))}`,
                'END:VEVENT',
            );
        }
    }
    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
};

export const downloadCalendar = (filename: string, content: string): void => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
