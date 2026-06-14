import { describe, expect, it } from 'vitest';
import { isRoomSearchInput, parseRoomQuery, parseRoomSearchInput } from './roomOccupancy';

describe('room occupancy query parsing', () => {
    it('accepts only deterministic room vertical entries', () => {
        expect(parseRoomSearchInput('空教室')).toEqual({ kind: 'entry' });
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
});
