import { describe, expect, it } from 'vitest';
import {
    parseRoomFloorOccupancy,
    parseRoomOccupancy,
    RoomOccupancyContractError,
} from './decode';

const hash = (character: string) => character.repeat(64);
const manifest = {
    format: 'njupt-room-occupancy',
    occupancy_id: hash('a'),
    exam_snapshot_id: hash('b'),
    room_catalog_id: hash('c'),
    exam_period_id: '2025-2026-2',
    source_updated_at: '2026-06-10T08:14:13+00:00',
    rooms: [{
        campus: '仙林',
        building: '教2',
        floor: '3',
        floor_key: 'floor-key',
        room: '313',
        room_key: 'room-key',
    }],
    floors: [{
        campus: '仙林',
        building: '教2',
        floor: '3',
        floor_key: 'floor-key',
        room_keys: ['room-key'],
    }],
    dates: [{
        date: '2026-07-01',
        floors: [{
            floor_key: 'floor-key',
            booking_count: 1,
            artifact: {
                path: 'floors/2026-07-01-floor-key.json',
                bytes: 100,
                sha256: hash('d'),
            },
        }],
    }],
};

describe('RoomOccupancy decoder', () => {
    it('reads a catalog-backed manifest and floor artifact', () => {
        const parsed = parseRoomOccupancy(manifest);
        const floor = parseRoomFloorOccupancy({
            format: 'njupt-room-floor-occupancy',
            exam_snapshot_id: parsed.exam_snapshot_id,
            room_catalog_id: parsed.room_catalog_id,
            date: '2026-07-01',
            campus: '仙林',
            building: '教2',
            floor: '3',
            floor_key: 'floor-key',
            booking_count: 1,
            bookings: [{
                exam_id: 'exam-1',
                stable_key: 'stable-1',
                class_name: 'B240402',
                course_name: '算法分析与设计',
                course_code: 'JS113400S',
                teacher: '张三',
                count: 31,
                date: '2026-07-01',
                start_timestamp: '2026-07-01T08:00:00+08:00',
                end_timestamp: '2026-07-01T09:50:00+08:00',
                duration_minutes: 110,
                location: '教2-313',
                campus: '仙林',
                building: '教2',
                floor: '3',
                floor_key: 'floor-key',
                room: '313',
                room_key: 'room-key',
            }],
        });
        expect(parsed.rooms).toHaveLength(1);
        expect(floor.bookings).toHaveLength(1);
    });

    it('rejects a floor reference outside the maintained catalog projection', () => {
        const date = manifest.dates[0];
        const floor = date?.floors[0];
        if (!date || !floor) throw new Error('fixture has no floor/date reference');
        expect(() => parseRoomOccupancy({
            ...manifest,
            dates: [{
                ...date,
                floors: [{
                    ...floor,
                    floor_key: 'missing-floor',
                }]
            }]
        }))
            .toThrow(RoomOccupancyContractError);
    });

    it('rejects fields outside the current producer contract', () => {
        expect(() => parseRoomOccupancy({ ...manifest, unexpected: true }))
            .toThrow(RoomOccupancyContractError);
    });
});
