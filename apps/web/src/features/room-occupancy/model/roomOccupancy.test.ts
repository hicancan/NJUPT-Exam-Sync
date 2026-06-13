import { describe, expect, it } from 'vitest';
import { parseRoomQuery } from './roomOccupancy';

describe('room occupancy query parsing', () => {
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
        expect(parseRoomQuery('无线楼无6')).toMatchObject({
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
});
