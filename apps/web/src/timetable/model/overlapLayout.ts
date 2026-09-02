import type { TeachingMeeting } from '@njupt-search/academics-timetable';
import { courseIdentity } from './courseColors';

export interface PositionedMeeting {
    meeting: TeachingMeeting;
    slot: number;
}

export interface MeetingGroup {
    weekday: number;
    startPeriod: number;
    endPeriod: number;
    slotCount: number;
    positioned: PositionedMeeting[];
}

export interface MeetingOverlap {
    count: number;
    kind: 'parallel' | 'overlap';
}

const intersects = (left: TeachingMeeting, right: TeachingMeeting): boolean => (
    left.weekday === right.weekday
    && left.start_period <= right.end_period
    && left.end_period >= right.start_period
);

export const describeMeetingOverlap = (
    meeting: TeachingMeeting,
    activeMeetings: TeachingMeeting[],
): MeetingOverlap | null => {
    const overlapping = activeMeetings.filter(other => intersects(meeting, other));
    if (overlapping.length <= 1) return null;
    const identity = courseIdentity(meeting);
    return {
        count: overlapping.length,
        kind: overlapping.every(other => courseIdentity(other) === identity) ? 'parallel' : 'overlap',
    };
};

export const groupOverlappingMeetings = (meetings: TeachingMeeting[]): MeetingGroup[] => {
    const groups: MeetingGroup[] = [];
    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
        const sorted = meetings
            .filter(meeting => meeting.weekday === weekday)
            .sort((left, right) => left.start_period - right.start_period || left.end_period - right.end_period || left.meeting_id.localeCompare(right.meeting_id));
        let component: TeachingMeeting[] = [];
        let componentEnd = 0;
        const flush = () => {
            if (!component.length) return;
            const slotEnds: number[] = [];
            const positioned = component.map(meeting => {
                const available = slotEnds.findIndex(end => end < meeting.start_period);
                const slot = available === -1 ? slotEnds.length : available;
                slotEnds[slot] = meeting.end_period;
                return { meeting, slot };
            });
            groups.push({
                weekday,
                startPeriod: Math.min(...component.map(meeting => meeting.start_period)),
                endPeriod: Math.max(...component.map(meeting => meeting.end_period)),
                slotCount: slotEnds.length,
                positioned,
            });
            component = [];
            componentEnd = 0;
        };
        for (const meeting of sorted) {
            if (component.length && meeting.start_period > componentEnd) flush();
            component.push(meeting);
            componentEnd = Math.max(componentEnd, meeting.end_period);
        }
        flush();
    }
    return groups;
};
