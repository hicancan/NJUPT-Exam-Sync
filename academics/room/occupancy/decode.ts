import type {
    Room,
    RoomArtifactRef,
    RoomBooking,
    RoomDateEntry,
    RoomFloor,
    RoomFloorOccupancy,
    RoomOccupancy,
} from './model';

export class RoomOccupancyContractError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RoomOccupancyContractError';
    }
}

const SHA256_RE = /^[a-f0-9]{64}$/;
const PERIOD_RE = /^\d{4}-\d{4}-[1-4]$/;

const isObject = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const hasExactKeys = (value: Record<string, unknown>, expected: string[]): boolean => {
    const actual = Object.keys(value).sort();
    const required = [...expected].sort();
    return actual.length === required.length
        && actual.every((key, index) => key === required[index]);
};

const text = (value: unknown, field: string, source: string): string => {
    if (typeof value !== 'string' || !value) {
        throw new RoomOccupancyContractError(`${source}: ${field} must be a non-empty string`);
    }
    return value;
};

const hash = (value: unknown, field: string, source: string): string => {
    const result = text(value, field, source);
    if (!SHA256_RE.test(result)) {
        throw new RoomOccupancyContractError(`${source}: ${field} must be a SHA-256 hex string`);
    }
    return result;
};

const integer = (value: unknown, field: string, source: string): number => {
    if (!Number.isSafeInteger(value) || Number(value) < 0) {
        throw new RoomOccupancyContractError(`${source}: ${field} must be a non-negative integer`);
    }
    return Number(value);
};

const artifact = (value: unknown, source: string): RoomArtifactRef => {
    if (!isObject(value) || !hasExactKeys(value, ['path', 'bytes', 'sha256'])) {
        throw new RoomOccupancyContractError(`${source}: invalid artifact`);
    }
    return {
        path: text(value.path, 'path', source),
        bytes: integer(value.bytes, 'bytes', source),
        sha256: hash(value.sha256, 'sha256', source),
    };
};

const parseRoom = (value: unknown, source: string): Room => {
    if (!isObject(value) || !hasExactKeys(value, [
        'campus',
        'building',
        'floor',
        'floor_key',
        'room',
        'room_key',
    ])) throw new RoomOccupancyContractError(`${source}: room must be an object`);
    return {
        campus: text(value.campus, 'campus', source),
        building: text(value.building, 'building', source),
        floor: text(value.floor, 'floor', source),
        floor_key: text(value.floor_key, 'floor_key', source),
        room: text(value.room, 'room', source),
        room_key: text(value.room_key, 'room_key', source),
    };
};

const parseFloor = (value: unknown, source: string): RoomFloor => {
    if (!isObject(value) || !hasExactKeys(value, [
        'campus',
        'building',
        'floor',
        'floor_key',
        'room_keys',
    ]) || !Array.isArray(value.room_keys)) {
        throw new RoomOccupancyContractError(`${source}: floor must be an object`);
    }
    return {
        campus: text(value.campus, 'campus', source),
        building: text(value.building, 'building', source),
        floor: text(value.floor, 'floor', source),
        floor_key: text(value.floor_key, 'floor_key', source),
        room_keys: value.room_keys.map((item, index) => text(item, `room_keys[${index}]`, source)),
    };
};

export const parseRoomOccupancy = (
    value: unknown,
    source = 'RoomOccupancy manifest'
): RoomOccupancy => {
    if (!isObject(value) || !hasExactKeys(value, [
        'format',
        'occupancy_id',
        'exam_snapshot_id',
        'room_catalog_id',
        'exam_period_id',
        'source_updated_at',
        'rooms',
        'floors',
        'dates',
    ]) || value.format !== 'njupt-room-occupancy') {
        throw new RoomOccupancyContractError(`${source}: incompatible RoomOccupancy format`);
    }
    if (!Array.isArray(value.rooms) || !Array.isArray(value.floors) || !Array.isArray(value.dates)) {
        throw new RoomOccupancyContractError(`${source}: rooms, floors and dates must be arrays`);
    }
    const rooms = value.rooms.map((item, index) => parseRoom(item, `${source}.rooms[${index}]`));
    const floors = value.floors.map((item, index) => parseFloor(item, `${source}.floors[${index}]`));
    const roomKeys = new Set(rooms.map(room => room.room_key));
    const floorKeys = new Set(floors.map(floor => floor.floor_key));
    if (roomKeys.size !== rooms.length || floorKeys.size !== floors.length) {
        throw new RoomOccupancyContractError(`${source}: duplicate room or floor identity`);
    }
    const assignedRoomKeys = floors.flatMap(floor => floor.room_keys);
    if (
        assignedRoomKeys.some(roomKey => !roomKeys.has(roomKey))
        || new Set(assignedRoomKeys).size !== assignedRoomKeys.length
        || assignedRoomKeys.length !== rooms.length
    ) {
        throw new RoomOccupancyContractError(`${source}: floor references an unknown room`);
    }
    const seenDates = new Set<string>();
    const dates: RoomDateEntry[] = value.dates.map((item, dateIndex) => {
        const dateSource = `${source}.dates[${dateIndex}]`;
        if (!isObject(item) || !hasExactKeys(item, ['date', 'floors']) || !Array.isArray(item.floors)) {
            throw new RoomOccupancyContractError(`${dateSource}: invalid date entry`);
        }
        const date = text(item.date, 'date', dateSource);
        if (seenDates.has(date)) {
            throw new RoomOccupancyContractError(`${dateSource}: duplicate date`);
        }
        seenDates.add(date);
        const seenDateFloors = new Set<string>();
        return {
            date,
            floors: item.floors.map((floor, floorIndex) => {
                const floorSource = `${dateSource}.floors[${floorIndex}]`;
                if (!isObject(floor) || !hasExactKeys(floor, [
                    'floor_key',
                    'booking_count',
                    'artifact',
                ])) {
                    throw new RoomOccupancyContractError(`${floorSource}: invalid floor entry`);
                }
                const floorKey = text(floor.floor_key, 'floor_key', floorSource);
                const ref = artifact(floor.artifact, `${floorSource}.artifact`);
                if (
                    !floorKeys.has(floorKey)
                    || seenDateFloors.has(floorKey)
                    || ref.path !== `floors/${date}-${floorKey}.json`
                ) {
                    throw new RoomOccupancyContractError(`${floorSource}: invalid floor reference`);
                }
                seenDateFloors.add(floorKey);
                return {
                    floor_key: floorKey,
                    booking_count: integer(floor.booking_count, 'booking_count', floorSource),
                    artifact: ref,
                };
            })
        };
    });
    const examPeriodId = text(value.exam_period_id, 'exam_period_id', source);
    if (!PERIOD_RE.test(examPeriodId)) {
        throw new RoomOccupancyContractError(`${source}: invalid exam_period_id`);
    }
    return {
        format: 'njupt-room-occupancy',
        occupancy_id: hash(value.occupancy_id, 'occupancy_id', source),
        exam_snapshot_id: hash(value.exam_snapshot_id, 'exam_snapshot_id', source),
        room_catalog_id: hash(value.room_catalog_id, 'room_catalog_id', source),
        exam_period_id: examPeriodId,
        source_updated_at: text(value.source_updated_at, 'source_updated_at', source),
        rooms,
        floors,
        dates,
    };
};

const canonicalJson = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
};

export const assertRoomOccupancyIdentity = async (manifest: RoomOccupancy): Promise<void> => {
    const { occupancy_id: expected, ...identity } = manifest;
    const digest = await globalThis.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(canonicalJson(identity))
    );
    const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== expected) {
        throw new RoomOccupancyContractError('RoomOccupancy identity mismatch');
    }
};

const parseBooking = (value: unknown, source: string): RoomBooking => {
    if (!isObject(value) || !hasExactKeys(value, [
        'exam_id',
        'stable_key',
        'class_name',
        'course_name',
        'course_code',
        'teacher',
        'count',
        'date',
        'start_timestamp',
        'end_timestamp',
        'duration_minutes',
        'location',
        'campus',
        'building',
        'floor',
        'floor_key',
        'room',
        'room_key',
    ])) throw new RoomOccupancyContractError(`${source}: booking must be an object`);
    return {
        exam_id: text(value.exam_id, 'exam_id', source),
        stable_key: text(value.stable_key, 'stable_key', source),
        class_name: text(value.class_name, 'class_name', source),
        course_name: text(value.course_name, 'course_name', source),
        course_code: text(value.course_code, 'course_code', source),
        teacher: text(value.teacher, 'teacher', source),
        count: integer(value.count, 'count', source),
        date: text(value.date, 'date', source),
        start_timestamp: text(value.start_timestamp, 'start_timestamp', source),
        end_timestamp: text(value.end_timestamp, 'end_timestamp', source),
        duration_minutes: integer(value.duration_minutes, 'duration_minutes', source),
        location: text(value.location, 'location', source),
        campus: text(value.campus, 'campus', source),
        building: text(value.building, 'building', source),
        floor: text(value.floor, 'floor', source),
        floor_key: text(value.floor_key, 'floor_key', source),
        room: text(value.room, 'room', source),
        room_key: text(value.room_key, 'room_key', source),
    };
};

export const parseRoomFloorOccupancy = (
    value: unknown,
    source = 'RoomOccupancy floor'
): RoomFloorOccupancy => {
    if (!isObject(value) || !hasExactKeys(value, [
        'format',
        'exam_snapshot_id',
        'room_catalog_id',
        'date',
        'campus',
        'building',
        'floor',
        'floor_key',
        'booking_count',
        'bookings',
    ]) || value.format !== 'njupt-room-floor-occupancy' || !Array.isArray(value.bookings)) {
        throw new RoomOccupancyContractError(`${source}: incompatible floor occupancy`);
    }
    const bookings = value.bookings.map((item, index) => parseBooking(item, `${source}.bookings[${index}]`));
    const result: RoomFloorOccupancy = {
        format: 'njupt-room-floor-occupancy',
        exam_snapshot_id: hash(value.exam_snapshot_id, 'exam_snapshot_id', source),
        room_catalog_id: hash(value.room_catalog_id, 'room_catalog_id', source),
        date: text(value.date, 'date', source),
        campus: text(value.campus, 'campus', source),
        building: text(value.building, 'building', source),
        floor: text(value.floor, 'floor', source),
        floor_key: text(value.floor_key, 'floor_key', source),
        booking_count: integer(value.booking_count, 'booking_count', source),
        bookings,
    };
    if (
        result.booking_count !== bookings.length
        || bookings.some(booking => booking.date !== result.date || booking.floor_key !== result.floor_key)
    ) {
        throw new RoomOccupancyContractError(`${source}: booking identity mismatch`);
    }
    return result;
};
