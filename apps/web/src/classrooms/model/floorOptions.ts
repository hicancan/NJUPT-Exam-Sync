import type { SpaceIndex } from '@/space/model/SpaceClient';

export const resolveFloorOptions = (
    space: SpaceIndex,
    campusName: string | null,
    buildingName: string | null,
): string[] => {
    const campusById = new Map(space.campuses.map(item => [item.campus_id, item]));
    const buildingIds = new Set(space.buildings
        .filter(item => (!campusName || campusById.get(item.campus_id)?.name === campusName)
            && (!buildingName || item.name === buildingName))
        .map(item => item.building_id));

    return [...new Set(space.floors
        .filter(item => buildingIds.has(item.building_id))
        .map(item => item.level))]
        .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
};
