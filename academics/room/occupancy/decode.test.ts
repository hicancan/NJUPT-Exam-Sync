import { describe, expect, it } from 'vitest';
import {
    parseRoomFloorOccupancy,
    parseRoomOccupancy,
    RoomOccupancyContractError,
} from './decode';


const manifest = {
    format: 'njupt-room-occupancy-v3',
    occupancy_id: 'a'.repeat(64),
    generated_at: '2026-06-10T00:00:00+08:00',
    data_version: 'b'.repeat(64),
    exam_period_id: '2025-2026-2',
    academic_year: '2025-2026',
    term_number: 2,
    term_label: '第二学期',
    source_url: null,
    source_title: null,
    catalog_format: 'njupt-room-catalog-v2',
    catalog_id: 'c'.repeat(64),
    room_count: 1,
    floor_count: 1,
    date_count: 1,
    rooms: [{
        campus: '仙林',
        building: '教2',
        floor: '2',
        floor_key: 'floor-a',
        room: '201',
        room_key: 'room-a',
    }],
    floors: [{
        campus: '仙林',
        building: '教2',
        floor: '2',
        floor_key: 'floor-a',
        room_count: 1,
        room_keys: ['room-a'],
    }],
    dates: [{
        date: '2026-06-20',
        floor_count: 1,
        booking_count: 1,
        floors: [{
            floor_key: 'floor-a',
            artifact: {
                path: 'by-floor/2026-06-20/floor-a.json',
                bytes: 10,
                sha256: 'd'.repeat(64),
            },
            booking_count: 1,
        }],
    }],
    diagnostics: {
        path: 'diagnostics.json',
        bytes: 10,
        sha256: 'e'.repeat(64),
    },
} as const;


describe('RoomOccupancy decoder', () => {
    it('accepts the single current manifest and floor format', () => {
        expect(parseRoomOccupancy(manifest).occupancy_id).toBe(manifest.occupancy_id);
        const floor = parseRoomFloorOccupancy({
            format: 'njupt-room-occupancy-floor-v2',
            generated_at: manifest.generated_at,
            data_version: manifest.data_version,
            exam_period_id: manifest.exam_period_id,
            date: '2026-06-20',
            campus: '仙林',
            building: '教2',
            floor: '2',
            floor_key: 'floor-a',
            room_count: 1,
            booking_count: 0,
            bookings: [],
        });
        expect(floor.floor_key).toBe('floor-a');
    });

    it('rejects the replaced contract', () => {
        expect(() => parseRoomOccupancy({
            ...manifest,
            format: 'njupt-room-occupancy-v1',
        })).toThrow(RoomOccupancyContractError);
    });
});
