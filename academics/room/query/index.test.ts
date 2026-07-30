import { describe, expect, it } from 'vitest';
import type { RoomBooking, RoomOccupancy } from '../occupancy/model';
import {
    findAdjacentRoomDate,
    findNearestRoomDate,
    groupRoomBookings,
    isRoomSearchInput,
    parseRoomIntent,
    resolveRoomTarget,
    sortRoomDates,
} from './index';

const booking = (className: string, count = 1): RoomBooking => ({
    exam_id: `exam-${className}`,
    stable_key: `stable-${className}`,
    class_name: className,
    course_name: '人工智能导论及其Python应用实践',
    course_code: 'JS170201S',
    teacher: '蒋平',
    count,
    date: '2026-06-28',
    start_timestamp: '2026-06-28T10:25:00+08:00',
    end_timestamp: '2026-06-28T12:15:00+08:00',
    duration_minutes: 110,
    location: '教4－101',
    campus: '仙林',
    building: '教4',
    floor: '1',
    floor_key: 'floor-2497ba2a4413469c',
    room: '101',
    room_key: 'room-26904f0c06438a91',
});

const occupancy: RoomOccupancy = {
    format: 'njupt-room-occupancy',
    occupancy_id: 'a'.repeat(64),
    exam_snapshot_id: 'b'.repeat(64),
    room_catalog_id: 'c'.repeat(64),
    exam_period_id: '2025-2026-2',
    source_updated_at: '2026-06-10T08:14:13+00:00',
    rooms: [{
        campus: '仙林',
        building: '教2',
        floor: '3',
        floor_key: 'floor-1',
        room: '313',
        room_key: 'room-1',
    }],
    floors: [{
        campus: '仙林',
        building: '教2',
        floor: '3',
        floor_key: 'floor-1',
        room_keys: ['room-1'],
    }],
    dates: [],
};

describe('room occupancy query parsing', () => {
    it('separates intent recognition from catalog-backed resolution', () => {
        expect(parseRoomIntent('考试占用教室')).toEqual({ kind: 'entry' });
        expect(parseRoomIntent('教室')).toEqual({ kind: 'entry' });
        expect(parseRoomIntent('空教室')).toBeNull();
        expect(parseRoomIntent('教2')).toEqual({ kind: 'candidate', input: '教2' });
        expect(resolveRoomTarget(occupancy, parseRoomIntent('教2'))).toEqual({
            kind: 'building',
            campus: '仙林',
            building: '教2',
            display: '教2',
        });
        expect(resolveRoomTarget(occupancy, parseRoomIntent('教2-313'))).toEqual({
            kind: 'room',
            campus: '仙林',
            building: '教2',
            floor: '3',
            room: '313',
            display: '教2-313',
        });
    });

    it('does not guess malformed or natural-language room queries', () => {
        expect(isRoomSearchInput('教2313')).toBe(false);
        expect(isRoomSearchInput('明天14点教2三楼空教室')).toBe(false);
        expect(isRoomSearchInput('教2 313')).toBe(false);
    });

    it('does not invent a target absent from the actual RoomCatalog projection', () => {
        expect(resolveRoomTarget(occupancy, parseRoomIntent('无线楼-无6'))).toBeNull();
    });

    it('groups same room, same time and same exam into one occupancy block with all classes', () => {
        const groups = groupRoomBookings([
            booking('B240402', 2),
            booking('B240401', 1),
            booking('B240403', 3),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            course_name: '人工智能导论及其Python应用实践',
            class_count: 3,
            class_names: ['B240401', 'B240402', 'B240403'],
            class_summaries: [
                { class_name: 'B240401', count: 1 },
                { class_name: 'B240402', count: 2 },
                { class_name: 'B240403', count: 3 },
            ],
            total_count: 6,
        });
        expect(groups[0]?.source_bookings.map(item => item.class_name)).toEqual(['B240401', 'B240402', 'B240403']);
    });
});

describe('room occupancy date helpers', () => {
    const dates = ['2026-06-20', '2026-06-18', '2026-06-20', '2026-06-25'];

    it('sorts and deduplicates room dates', () => {
        expect(sortRoomDates(dates)).toEqual(['2026-06-18', '2026-06-20', '2026-06-25']);
    });

    it('finds adjacent valid exam dates around arbitrary input', () => {
        expect(findAdjacentRoomDate(dates, '2026-06-20', 'previous')).toBe('2026-06-18');
        expect(findAdjacentRoomDate(dates, '2026-06-20', 'next')).toBe('2026-06-25');
        expect(findAdjacentRoomDate(dates, '2026-06-21', 'previous')).toBe('2026-06-20');
        expect(findAdjacentRoomDate(dates, '2026-06-21', 'next')).toBe('2026-06-25');
    });

    it('maps empty or no-exam dates to the nearest selectable exam date', () => {
        expect(findNearestRoomDate(dates, null)).toBe('2026-06-18');
        expect(findNearestRoomDate(dates, '2026-06-19')).toBe('2026-06-20');
        expect(findNearestRoomDate(dates, '2026-07-01')).toBe('2026-06-25');
    });
});
