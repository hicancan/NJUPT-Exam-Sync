import type { RoomFloorOccupancy, RoomOccupancy } from './model';

export class RoomOccupancyContractError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RoomOccupancyContractError';
    }
}

const SHA256_RE = /^[a-f0-9]{64}$/;
const PERIOD_RE = /^\d{4}-\d{4}-[1-4]$/;

export const parseRoomOccupancy = (
    payload: unknown,
    source = 'RoomOccupancy manifest',
): RoomOccupancy => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new RoomOccupancyContractError(`Validation failed for ${source}: payload must be an object`);
    }
    const value = payload as Partial<RoomOccupancy>;
    if (
        value.format !== 'njupt-room-occupancy-v3'
        || typeof value.occupancy_id !== 'string'
        || !SHA256_RE.test(value.occupancy_id)
        || value.catalog_format !== 'njupt-room-catalog-v2'
        || typeof value.catalog_id !== 'string'
        || !SHA256_RE.test(value.catalog_id)
    ) {
        throw new RoomOccupancyContractError(`Validation failed for ${source}: incompatible identity`);
    }
    if (typeof value.data_version !== 'string' || !SHA256_RE.test(value.data_version)) {
        throw new RoomOccupancyContractError(`Validation failed for ${source}: invalid data_version`);
    }
    if (typeof value.exam_period_id !== 'string' || !PERIOD_RE.test(value.exam_period_id)) {
        throw new RoomOccupancyContractError(`Validation failed for ${source}: invalid exam_period_id`);
    }
    if (!Array.isArray(value.rooms) || !Array.isArray(value.floors) || !Array.isArray(value.dates)) {
        throw new RoomOccupancyContractError(`Validation failed for ${source}: rooms, floors and dates must be arrays`);
    }
    if (
        value.room_count !== value.rooms.length
        || value.floor_count !== value.floors.length
        || value.date_count !== value.dates.length
        || !value.diagnostics
        || value.diagnostics.path !== 'diagnostics.json'
        || !Number.isSafeInteger(value.diagnostics.bytes)
        || value.diagnostics.bytes <= 0
        || !SHA256_RE.test(value.diagnostics.sha256)
    ) {
        throw new RoomOccupancyContractError(`Validation failed for ${source}: manifest counts or paths mismatch`);
    }
    const roomKeys = new Set<string>();
    for (const room of value.rooms) {
        if (
            !room.room_key?.startsWith('room-')
            || !room.floor_key?.startsWith('floor-')
            || !room.campus
            || !room.building
            || !room.floor
            || !room.room
            || roomKeys.has(room.room_key)
        ) {
            throw new RoomOccupancyContractError(`Validation failed for ${source}: invalid room entry`);
        }
        roomKeys.add(room.room_key);
    }
    const floorKeys = new Set<string>();
    for (const floor of value.floors) {
        if (
            !floor.floor_key?.startsWith('floor-')
            || !Array.isArray(floor.room_keys)
            || floor.room_count !== floor.room_keys.length
            || floor.room_keys.some(roomKey => !roomKeys.has(roomKey))
            || floorKeys.has(floor.floor_key)
        ) {
            throw new RoomOccupancyContractError(`Validation failed for ${source}: invalid floor entry`);
        }
        floorKeys.add(floor.floor_key);
    }
    for (const date of value.dates) {
        if (
            !Array.isArray(date.floors)
            || date.floor_count !== date.floors.length
            || date.booking_count !== date.floors.reduce((sum, floor) => sum + floor.booking_count, 0)
            || date.floors.some(floor => (
                !floorKeys.has(floor.floor_key)
                || !floor.artifact
                || !new RegExp(`^by-floor/${date.date}/[^/]+\\.json$`).test(floor.artifact.path)
                || !Number.isSafeInteger(floor.artifact.bytes)
                || floor.artifact.bytes <= 0
                || !SHA256_RE.test(floor.artifact.sha256)
            ))
        ) {
            throw new RoomOccupancyContractError(`Validation failed for ${source}: invalid date entry`);
        }
    }
    return value as RoomOccupancy;
};

const digestHex = async (value: string): Promise<string> => {
    const bytes = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

export const roomOccupancyIdentityText = (manifest: RoomOccupancy): string => {
    const parts = [manifest.format, manifest.data_version, manifest.catalog_id];
    for (const date of manifest.dates) {
        for (const floor of date.floors) {
            const artifact = floor.artifact;
            parts.push(artifact.path, String(artifact.bytes), artifact.sha256);
        }
    }
    parts.push(
        manifest.diagnostics.path,
        String(manifest.diagnostics.bytes),
        manifest.diagnostics.sha256,
    );
    return parts.join('\0');
};

export const assertRoomOccupancyIdentity = async (
    manifest: RoomOccupancy,
): Promise<void> => {
    if (await digestHex(roomOccupancyIdentityText(manifest)) !== manifest.occupancy_id) {
        throw new RoomOccupancyContractError('Validation failed for RoomOccupancy: content identity mismatch');
    }
};

export const parseRoomFloorOccupancy = (
    payload: unknown,
    source = 'RoomOccupancy floor/date',
): RoomFloorOccupancy => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new RoomOccupancyContractError(`Validation failed for ${source}: payload must be an object`);
    }
    const value = payload as Partial<RoomFloorOccupancy>;
    if (
        value.format !== 'njupt-room-occupancy-floor-v2'
        || typeof value.data_version !== 'string'
        || !SHA256_RE.test(value.data_version)
        || typeof value.exam_period_id !== 'string'
        || !PERIOD_RE.test(value.exam_period_id)
        || !value.floor_key?.startsWith('floor-')
        || !value.date
        || !Array.isArray(value.bookings)
        || value.booking_count !== value.bookings.length
    ) {
        throw new RoomOccupancyContractError(`Validation failed for ${source}: incompatible floor/date data`);
    }
    for (const booking of value.bookings) {
        if (
            booking.date !== value.date
            || booking.floor_key !== value.floor_key
            || !booking.room_key?.startsWith('room-')
            || !booking.start_timestamp
            || !booking.end_timestamp
        ) {
            throw new RoomOccupancyContractError(`Validation failed for ${source}: invalid booking entry`);
        }
    }
    return value as RoomFloorOccupancy;
};
