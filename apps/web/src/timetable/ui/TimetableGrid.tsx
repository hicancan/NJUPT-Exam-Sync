import type { CSSProperties } from 'react';
import type { TeachingMeeting, TeachingPeriod, TeachingWeek } from '@njupt-search/academics-timetable';
import { courseIdentity } from '../model/courseColors';
import { meetingDate, todayInShanghai } from '../model/calendar';
import { groupOverlappingMeetings } from '../model/conflictLayout';
import { alternatingWeekLabel, showAsInactiveAlternating } from '../model/weekPattern';

interface TimetableGridProps {
    meetings: TeachingMeeting[];
    week: TeachingWeek;
    periods: TeachingPeriod[];
    tones: Map<string, number>;
    view: 'week' | 'day';
    day: number;
    onOpen: (meeting: TeachingMeeting, target: HTMLElement) => void;
}

const weekdayLabel = ['一', '二', '三', '四', '五', '六', '日'];
const shortDate = (value: string) => `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`;

const courseButton = (
    meeting: TeachingMeeting,
    tones: Map<string, number>,
    view: 'week' | 'day',
    conflictCount: number,
    activeThisWeek: boolean,
    onOpen: TimetableGridProps['onOpen'],
    style?: CSSProperties,
) => {
    const tone = tones.get(courseIdentity(meeting)) ?? 0;
    const conflict = activeThisWeek && conflictCount > 1;
    const alternating = alternatingWeekLabel(meeting);
    return (
        <button
            key={meeting.meeting_id}
            type="button"
            className={`timetable-course course-tone-${tone} ${activeThisWeek ? '' : 'is-inactive'} ${conflict ? 'has-conflict' : ''}`}
            style={style}
            onClick={event => onOpen(meeting, event.currentTarget)}
            aria-label={`${meeting.course_name}，${meeting.location ?? '地点未注明'}，第${meeting.start_period}至${meeting.end_period}节${activeThisWeek ? '' : `，${alternating ?? ''}课程，本周不上课`}${conflict ? `，共有${conflictCount}条时间冲突安排` : ''}`}
        >
            <strong>{meeting.course_name}</strong>
            {meeting.location ? <span>{meeting.location}</span> : null}
            {view === 'day' && meeting.teacher ? <small>{meeting.teacher}</small> : null}
            {!activeThisWeek ? <em>{alternating} · 本周不上课</em> : conflict ? <em>冲突 {conflictCount} 项</em> : null}
        </button>
    );
};

export function TimetableGrid({ meetings, week, periods, tones, view, day, onOpen }: TimetableGridProps) {
    const visibleDays = view === 'day' ? [day] : [1, 2, 3, 4, 5, 6, 7];
    const active = meetings.filter(meeting => meeting.week_numbers.includes(week.week) && visibleDays.includes(meeting.weekday));
    const visible = meetings.filter(meeting => visibleDays.includes(meeting.weekday) && (meeting.week_numbers.includes(week.week) || showAsInactiveAlternating(meeting, week.week)));
    const activeIds = new Set(active.map(meeting => meeting.meeting_id));
    const today = todayInShanghai();
    const columns = view === 'day' ? 1 : 7;
    const groups = groupOverlappingMeetings(visible);
    const conflictCount = (meeting: TeachingMeeting): number => activeIds.has(meeting.meeting_id)
        ? active.filter(other => other.weekday === meeting.weekday && other.start_period <= meeting.end_period && other.end_period >= meeting.start_period).length
        : 0;
    return (
        <div className={`timetable-scroll timetable-${view}`}>
            <div className="timetable-grid" style={{ '--day-count': columns } as CSSProperties}>
                <div className="timetable-corner" aria-hidden="true" />
                {visibleDays.map((weekday, index) => {
                    const date = meetingDate(week, weekday);
                    return <div key={weekday} className={`timetable-day-head ${date === today ? 'is-today' : ''}`} style={{ gridColumn: index + 2, gridRow: 1 }}><strong>周{weekdayLabel[weekday - 1]}</strong><span>{shortDate(date)}</span></div>;
                })}
                {periods.map(period => (
                    <div key={`line-${period.period}`} className={`timetable-period-line ${[6, 10].includes(period.period) ? 'day-part-start' : ''}`} style={{ gridColumn: '1 / -1', gridRow: period.period + 1 }} aria-hidden="true" />
                ))}
                {periods.map(period => (
                    <div key={period.period} className="timetable-period-label" style={{ gridColumn: 1, gridRow: period.period + 1 }}><strong>{period.period}</strong><span>{period.start_time}</span><span>{period.end_time}</span></div>
                ))}
                {groups.map(group => {
                    const column = view === 'day' ? 2 : group.weekday + 1;
                    if (group.positioned.length === 1) {
                        const meeting = group.positioned[0]?.meeting;
                        return meeting ? courseButton(meeting, tones, view, conflictCount(meeting), activeIds.has(meeting.meeting_id), onOpen, { gridColumn: column, gridRow: `${meeting.start_period + 1} / ${meeting.end_period + 2}` }) : null;
                    }
                    return (
                        <div
                            key={`${group.weekday}:${group.startPeriod}:${group.positioned.map(item => item.meeting.meeting_id).join(':')}`}
                            className="timetable-conflict-group"
                            style={{
                                '--conflict-columns': group.slotCount,
                                '--conflict-rows': group.endPeriod - group.startPeriod + 1,
                                gridColumn: column,
                                gridRow: `${group.startPeriod + 1} / ${group.endPeriod + 2}`,
                            } as CSSProperties}
                            aria-label={`${group.positioned.length}条时间冲突安排`}
                        >
                            {group.positioned.map(({ meeting, slot }) => courseButton(meeting, tones, view, conflictCount(meeting), activeIds.has(meeting.meeting_id), onOpen, {
                                gridColumn: slot + 1,
                                gridRow: `${meeting.start_period - group.startPeriod + 1} / ${meeting.end_period - group.startPeriod + 2}`,
                            }))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
