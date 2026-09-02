import { describe, expect, it } from 'vitest';
import { collectRoomTeachingBookings, resolveClassroomMoment } from './ClassroomAvailabilityClient';
import type { TeachingRoomDay } from '@njupt-search/academics-timetable';

const weeks = [
    { week: 1, start_date: '2026-08-31', end_date: '2026-09-06' },
    { week: 2, start_date: '2026-09-07', end_date: '2026-09-13' },
];

describe('classroom date routing', () => {
    it('maps a shareable date to the authoritative week and weekday', () => {
        expect(resolveClassroomMoment(weeks, { date: '2026-09-01' })).toEqual({
            date: '2026-09-01',
            week: 1,
            weekday: 2,
        });
    });

    it('keeps week and weekday routes deterministic', () => {
        expect(resolveClassroomMoment(weeks, { week: 2, weekday: 3 })).toEqual({
            date: '2026-09-09',
            week: 2,
            weekday: 3,
        });
    });

    it('rejects dates outside the published term', () => {
        expect(() => resolveClassroomMoment(weeks, { date: '2027-02-01' })).toThrow('当前学期不包含');
    });

    it('deduplicates one whole-day meeting repeated across occupied periods', () => {
        const booking = {
            meeting_id: 'meeting-1',
            course_name: '数据结构',
            course_code: 'B030001',
            class_ids: ['B240402'],
            teacher: '教师',
            campus: '仙林',
            building: '教4',
            floor: '2',
            floor_id: 'floor-2',
            room: '203',
            space_family_id: 'room-203',
            space_unit_id: null,
            location: '教4-203',
            start_period: 3,
            end_period: 4,
        };
        const day: TeachingRoomDay = {
            format: 'njupt-teaching-room-day',
            teaching_snapshot_id: 'a'.repeat(64),
            week: 1,
            weekday: 2,
            periods: { '3': [booking], '4': [booking] },
        };
        expect(collectRoomTeachingBookings(day, 'room-203')).toEqual([booking]);
    });
});
