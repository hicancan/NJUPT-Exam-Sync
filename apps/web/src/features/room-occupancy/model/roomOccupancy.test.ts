import { describe, expect, it } from 'vitest';
import type { ExamRoomBooking } from '@/shared/lib/contracts';
import { groupRoomBookings, isRoomSearchInput, parseRoomQuery, parseRoomSearchInput } from './roomOccupancy';

const booking = (className: string, count = 1): ExamRoomBooking => ({
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

describe('room occupancy query parsing', () => {
    it('accepts only deterministic room vertical entries', () => {
        expect(parseRoomSearchInput('考试占用教室')).toEqual({ kind: 'entry' });
        expect(parseRoomSearchInput('教室')).toEqual({ kind: 'entry' });
        expect(parseRoomSearchInput('空教室')).toBeNull();
        expect(parseRoomSearchInput('教1')).toMatchObject({ kind: 'building', building: '教1', campus: '仙林', display: '教1' });
        expect(parseRoomSearchInput('教2')).toMatchObject({ kind: 'building', building: '教2', campus: '仙林', display: '教2' });
        expect(parseRoomSearchInput('自动化学科楼')).toMatchObject({ kind: 'building', building: '自动化学科楼', campus: '仙林' });
        expect(parseRoomSearchInput('图科楼')).toMatchObject({ kind: 'building', building: '图科楼', campus: '三牌楼' });
        expect(parseRoomSearchInput('锁金')).toMatchObject({ kind: 'building', building: '锁金', campus: '锁金' });
        expect(parseRoomSearchInput('教2-313')).toMatchObject({ kind: 'room', campus: '仙林', building: '教2', room: '313', floor: '3', display: '教2-313' });
        expect(parseRoomSearchInput('自动化学科楼-228')).toMatchObject({ kind: 'room', campus: '仙林', building: '自动化学科楼', room: '228', floor: '2', display: '自动化学科楼-228' });
        expect(parseRoomSearchInput('图科楼-图5')).toMatchObject({ kind: 'room', building: '图科楼', room: '图5', floor: '4', display: '图5' });
        expect(parseRoomSearchInput('无线楼-无一')).toMatchObject({ kind: 'room', building: '无线楼', room: '无1', floor: '1', display: '无1' });
    });

    it('does not guess malformed or natural-language room queries', () => {
        expect(isRoomSearchInput('教2313')).toBe(false);
        expect(isRoomSearchInput('明天14点教2三楼空教室')).toBe(false);
        expect(isRoomSearchInput('教2 313')).toBe(false);
    });

    it('routes bare wireless building rooms to Sanpailou wireless building floors', () => {
        expect(parseRoomQuery('无一')).toMatchObject({
            campus: '三牌楼',
            building: '无线楼',
            floor: '1',
        });
        expect(parseRoomQuery('无4')).toMatchObject({
            campus: '三牌楼',
            building: '无线楼',
            floor: '2',
        });
        expect(parseRoomQuery('无线楼-无6')).toMatchObject({
            building: '无线楼',
            floor: '3',
        });
    });

    it('routes library science shorthand rooms to their confirmed floors', () => {
        expect(parseRoomQuery('图4')).toMatchObject({
            campus: '三牌楼',
            building: '图科楼',
            floor: '1',
        });
        expect(parseRoomQuery('图5')).toMatchObject({
            campus: '三牌楼',
            building: '图科楼',
            floor: '4',
        });
    });

    it('keeps time expressions out of the room entry parser', () => {
        expect(parseRoomQuery('教2-313 14:00')).toEqual({});
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
