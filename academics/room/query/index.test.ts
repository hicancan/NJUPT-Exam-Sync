import { describe, expect, it } from 'vitest';
import type { RoomBooking } from '../occupancy/model';
import {
    findAdjacentRoomDate,
    findNearestRoomDate,
    groupRoomBookings,
    parseRoomIntent,
    sortRoomDates,
} from './index';

const booking = (className: string, count = 1): RoomBooking => ({
    exam_id: `exam-${className}`, stable_key: `stable-${className}`, class_name: className,
    course_name: '人工智能导论及其Python应用实践', course_code: 'JS170201S', teacher: '蒋平', count,
    date: '2026-06-28', start_timestamp: '2026-06-28T10:25:00+08:00',
    end_timestamp: '2026-06-28T12:15:00+08:00', duration_minutes: 110,
    location: '教4－101', campus: '仙林', building: '教4', floor: '1', floor_id: 'floor-1',
    room: '101', space_family_id: 'family-1', space_unit_id: null,
});

describe('room occupancy query helpers', () => {
    it('recognizes route-local input without resolving space from occupancy data', () => {
        expect(parseRoomIntent('考试教室')).toEqual({ kind: 'entry' });
        expect(parseRoomIntent('教2-313')).toEqual({ kind: 'candidate', input: '教2-313' });
    });

    it('groups same space, time and exam into one block with all classes', () => {
        const groups = groupRoomBookings([booking('B240402', 2), booking('B240401', 1), booking('B240403', 3)]);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            class_count: 3,
            class_names: ['B240401', 'B240402', 'B240403'],
            total_count: 6,
        });
    });
});

describe('room occupancy date helpers', () => {
    const dates = ['2026-06-20', '2026-06-18', '2026-06-20', '2026-06-25'];
    it('sorts and deduplicates dates', () => expect(sortRoomDates(dates)).toEqual(['2026-06-18', '2026-06-20', '2026-06-25']));
    it('finds adjacent dates', () => {
        expect(findAdjacentRoomDate(dates, '2026-06-20', 'previous')).toBe('2026-06-18');
        expect(findAdjacentRoomDate(dates, '2026-06-21', 'next')).toBe('2026-06-25');
    });
    it('finds the nearest selectable date', () => expect(findNearestRoomDate(dates, '2026-06-19')).toBe('2026-06-20'));
});
