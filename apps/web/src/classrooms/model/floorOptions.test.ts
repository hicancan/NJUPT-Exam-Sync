import { describe, expect, it } from 'vitest';
import type { SpaceIndex } from '@/space/model/SpaceClient';
import { resolveFloorOptions } from './floorOptions';

const space = {
    campuses: [
        { campus_id: 'campus-xianlin', name: '仙林' },
        { campus_id: 'campus-sanpailou', name: '三牌楼' },
    ],
    buildings: [
        { building_id: 'building-1', campus_id: 'campus-xianlin', name: '教1' },
        { building_id: 'building-2', campus_id: 'campus-xianlin', name: '教2' },
        { building_id: 'building-3', campus_id: 'campus-sanpailou', name: '教学楼' },
    ],
    floors: [
        { floor_id: 'floor-1-1', building_id: 'building-1', level: '1' },
        { floor_id: 'floor-1-2', building_id: 'building-1', level: '2' },
        { floor_id: 'floor-2-1', building_id: 'building-2', level: '1' },
        { floor_id: 'floor-2-3', building_id: 'building-2', level: '3' },
        { floor_id: 'floor-3-1', building_id: 'building-3', level: '1' },
    ],
} as unknown as SpaceIndex;

describe('resolveFloorOptions', () => {
    it('deduplicates floor levels across buildings in the selected campus', () => {
        expect(resolveFloorOptions(space, '仙林', null)).toEqual(['1', '2', '3']);
    });

    it('limits floor levels to the selected building', () => {
        expect(resolveFloorOptions(space, '仙林', '教1')).toEqual(['1', '2']);
    });
});
