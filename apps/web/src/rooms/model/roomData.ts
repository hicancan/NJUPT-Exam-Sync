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

const roomIndexUrlWithNonce = (nonce = Date.now().toString(36)): string => (
    `${APP_CONFIG.DATA_URLS.ROOM}/manifest.json?fresh=${encodeURIComponent(nonce)}`
);

const versionedRoomDataUrl = (path: string, dataVersion: string): string => {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}v=${encodeURIComponent(dataVersion)}`;
};

export async function loadRoomOccupancy(signal?: AbortSignal): Promise<RoomOccupancy> {
    const payload = await fetchJson(
        roomIndexUrlWithNonce(),
        signal,
        'room-occupancy',
    );
    const manifest = parseRoomOccupancy(payload, `${APP_CONFIG.DATA_URLS.ROOM}/manifest.json`);
    await assertRoomOccupancyIdentity(manifest);
    return manifest;
}

export async function loadRoomFloorOccupancy(
    artifact: RoomOccupancy['dates'][number]['floors'][number]['artifact'],
    dataVersion: string,
    signal?: AbortSignal,
): Promise<RoomFloorOccupancy> {
    const payload = await fetchArtifactJson(
        versionedRoomDataUrl(`${APP_CONFIG.DATA_URLS.ROOM}/${artifact.path}`, artifact.sha256),
        artifact,
        signal,
        'room-floor-occupancy-versioned',
    );
    const floor = parseRoomFloorOccupancy(payload, artifact.path);
    if (floor.data_version !== dataVersion) {
        throw new Error(`教室占用分片与索引版本不一致: ${artifact.path}`);
    }
    return floor;
}
