import type {
    RoomArtifactRef,
    RoomBooking,
    RoomDateEntry,
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

export const parseRoomOccupancy = (
    value: unknown,
    source = 'RoomOccupancy manifest'
): RoomOccupancy => {
    if (!isObject(value) || !hasExactKeys(value, [
        'format',
        'occupancy_id',
        'exam_snapshot_id',
        'space_snapshot_id',
        'exam_period_id',
        'source_updated_at',
        'unresolved_locations',
        'dates',
    ]) || value.format !== 'njupt-room-occupancy') {
        throw new RoomOccupancyContractError(`${source}: incompatible RoomOccupancy format`);
    }
    if (!Array.isArray(value.unresolved_locations) || !Array.isArray(value.dates)) {
        throw new RoomOccupancyContractError(`${source}: unresolved_locations and dates must be arrays`);
    }
    const unresolvedLocations = value.unresolved_locations.map((item, index) => {
        const itemSource = `${source}.unresolved_locations[${index}]`;
        if (!isObject(item) || !hasExactKeys(item, ['location', 'count'])) {
            throw new RoomOccupancyContractError(`${itemSource}: invalid unresolved location`);
        }
        return { location: text(item.location, 'location', itemSource), count: integer(item.count, 'count', itemSource) };
    });
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
                    'floor_id',
                    'booking_count',
                    'artifact',
                ])) {
                    throw new RoomOccupancyContractError(`${floorSource}: invalid floor entry`);
                }
                const floorId = text(floor.floor_id, 'floor_id', floorSource);
                const ref = artifact(floor.artifact, `${floorSource}.artifact`);
                if (
                    seenDateFloors.has(floorId)
                    || ref.path !== `floors/${date}-${floorId}.json`
                ) {
                    throw new RoomOccupancyContractError(`${floorSource}: invalid floor reference`);
                }
                seenDateFloors.add(floorId);
                return {
                    floor_id: floorId,
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
        space_snapshot_id: hash(value.space_snapshot_id, 'space_snapshot_id', source),
        exam_period_id: examPeriodId,
        source_updated_at: text(value.source_updated_at, 'source_updated_at', source),
        unresolved_locations: unresolvedLocations,
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
        'floor_id',
        'room',
        'space_family_id',
        'space_unit_id',
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
        floor_id: text(value.floor_id, 'floor_id', source),
        room: text(value.room, 'room', source),
        space_family_id: text(value.space_family_id, 'space_family_id', source),
        space_unit_id: value.space_unit_id === null ? null : text(value.space_unit_id, 'space_unit_id', source),
    };
};

export const parseRoomFloorOccupancy = (
    value: unknown,
    source = 'RoomOccupancy floor'
): RoomFloorOccupancy => {
    if (!isObject(value) || !hasExactKeys(value, [
        'format',
        'exam_snapshot_id',
        'space_snapshot_id',
        'date',
        'campus',
        'building',
        'floor',
        'floor_id',
        'booking_count',
        'bookings',
    ]) || value.format !== 'njupt-room-floor-occupancy' || !Array.isArray(value.bookings)) {
        throw new RoomOccupancyContractError(`${source}: incompatible floor occupancy`);
    }
    const bookings = value.bookings.map((item, index) => parseBooking(item, `${source}.bookings[${index}]`));
    const result: RoomFloorOccupancy = {
        format: 'njupt-room-floor-occupancy',
        exam_snapshot_id: hash(value.exam_snapshot_id, 'exam_snapshot_id', source),
        space_snapshot_id: hash(value.space_snapshot_id, 'space_snapshot_id', source),
        date: text(value.date, 'date', source),
        campus: text(value.campus, 'campus', source),
        building: text(value.building, 'building', source),
        floor: text(value.floor, 'floor', source),
        floor_id: text(value.floor_id, 'floor_id', source),
        booking_count: integer(value.booking_count, 'booking_count', source),
        bookings,
    };
    if (
        result.booking_count !== bookings.length
        || bookings.some(booking => booking.date !== result.date || booking.floor_id !== result.floor_id)
    ) {
        throw new RoomOccupancyContractError(`${source}: booking identity mismatch`);
    }
    return result;
};
