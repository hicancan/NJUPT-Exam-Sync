import { describe, expect, it } from 'vitest';
import { parseSavedClassroomQuery } from './useAppRouter';

describe('saved classroom query', () => {
    it('restores a validated classroom path', () => {
        expect(parseSavedClassroomQuery(JSON.stringify({
            campus: '仙林',
            building: '教4',
            floor: '6',
            week: '1',
            weekday: '2',
            period: '3',
        }))).toEqual({
            week: '1',
            weekday: '2',
            period: '3',
            campus: '仙林',
            building: '教4',
            floor: '6',
        });
    });

    it('rejects unknown fields and entries without a campus', () => {
        expect(parseSavedClassroomQuery('{"campus":"仙林","token":"secret"}')).toBeNull();
        expect(parseSavedClassroomQuery('{"building":"教4"}')).toBeNull();
    });
});
