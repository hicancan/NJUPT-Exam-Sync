import { describe, expect, it } from 'vitest';
import type { TeachingMeeting } from '@njupt-search/academics-timetable';
import { groupOverlappingMeetings } from './conflictLayout';

const meeting = (meetingId: string, weekday: number, startPeriod: number, endPeriod: number): TeachingMeeting => ({
    meeting_id: meetingId,
    teaching_class_id: null,
    teaching_class_name: null,
    course_code: meetingId,
    course_name: meetingId,
    course_category: null,
    course_nature: null,
    teacher: null,
    teacher_title: null,
    instructor_role: null,
    campus: null,
    space_family_id: null,
    space_unit_id: null,
    location: null,
    location_type: null,
    weekday,
    start_period: startPeriod,
    end_period: endPeriod,
    week_numbers: [1],
    teaching_method: null,
    assessment_method: null,
    exam_method: null,
    credits: null,
    class_hours: null,
    course_total_hours: null,
    class_hours_composition: null,
    weekly_hours: null,
    teaching_class_size: null,
    enrollment_count: null,
    capacity: null,
    enrollment_note: null,
    direction: null,
    online_information: null,
    scheduling_flag: null,
    class_ids: ['B240402'],
});

describe('groupOverlappingMeetings', () => {
    it('uses separate deterministic columns for intersecting schedules', () => {
        const groups = groupOverlappingMeetings([
            meeting('later', 1, 2, 4),
            meeting('first', 1, 1, 2),
            meeting('third', 1, 3, 3),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({ weekday: 1, startPeriod: 1, endPeriod: 4, slotCount: 2 });
        expect(groups[0]?.positioned.map(item => [item.meeting.meeting_id, item.slot])).toEqual([
            ['first', 0],
            ['later', 1],
            ['third', 0],
        ]);
    });

    it('does not group adjacent or different-day schedules as conflicts', () => {
        const groups = groupOverlappingMeetings([
            meeting('one', 1, 1, 2),
            meeting('two', 1, 3, 4),
            meeting('three', 2, 1, 2),
        ]);
        expect(groups).toHaveLength(3);
        expect(groups.every(group => group.slotCount === 1)).toBe(true);
    });
});
