import { APP_CONFIG } from '@/app/config/constants';
import { fetchArtifactJson, fetchJson } from '@/shared/lib/fetch';
import {
    assertRoomOccupancyIdentity,
    parseRoomFloorOccupancy,
    parseRoomOccupancy,
} from '@njupt-search/academics-room';
import type {
    RoomFloorOccupancy,
    RoomOccupancy,
} from '@njupt-search/academics-room';

const artifactUrl = (path: string, sha256: string): string => {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}sha256=${sha256}`;
};

export async function loadRoomOccupancy(signal?: AbortSignal): Promise<RoomOccupancy> {
    const payload = await fetchJson(
        `${APP_CONFIG.DATA_URLS.ROOM}/manifest.json`,
        { signal, cache: 'no-store' },
    );
    const manifest = parseRoomOccupancy(payload, `${APP_CONFIG.DATA_URLS.ROOM}/manifest.json`);
    await assertRoomOccupancyIdentity(manifest);
    return manifest;
}

export async function loadRoomFloorOccupancy(
    artifact: RoomOccupancy['dates'][number]['floors'][number]['artifact'],
    manifest: RoomOccupancy,
    signal?: AbortSignal,
): Promise<RoomFloorOccupancy> {
    const payload = await fetchArtifactJson(
        artifactUrl(`${APP_CONFIG.DATA_URLS.ROOM}/${artifact.path}`, artifact.sha256),
        artifact,
        { signal, cache: 'force-cache' },
    );
    const floor = parseRoomFloorOccupancy(payload, artifact.path);
    if (
        floor.exam_snapshot_id !== manifest.exam_snapshot_id
        || floor.room_catalog_id !== manifest.room_catalog_id
    ) {
        throw new Error(`教室占用分片与索引身份不一致: ${artifact.path}`);
    }
    return floor;
}
