import type {
    RoomArtifactRef,
    Room,
    RoomBooking,
    RoomDateEntry,
    RoomFloor,
    RoomOccupancy,
} from '../occupancy/model';

export interface RoomFilters {
    query: string;
    date: string | null;
    campus: string | null;
    building: string | null;
    floor: string | null;
    start: string | null;
    end: string | null;
}

export interface RoomBookingGroup {
    group_id: string;
    course_name: string;
    course_code: string;
    teacher: string;
    start_timestamp: string;
    end_timestamp: string;
    duration_minutes: number;
    location: string;
    class_names: string[];
    class_summaries: Array<{ class_name: string; count: number }>;
    class_count: number;
    total_count: number;
    source_bookings: RoomBooking[];
}

export type RoomIntent =
    | { kind: 'entry' }
    | { kind: 'candidate'; input: string };

export type RoomSearchTarget =
    | { kind: 'entry' }
    | { kind: 'building'; campus: string; building: string; display: string }
    | { kind: 'room'; campus: string; building: string; floor: string; room: string; display: string };

const ENTRY_TERMS = new Set(['考试占用教室', '教室']);

export const uniqueValues = (items: string[]): string[] => Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, 'zh-CN'));

export const sortRoomDates = (dates: string[]): string[] => {
    return Array.from(new Set(dates)).sort();
};

export const findAdjacentRoomDate = (
    dates: string[],
    value: string | null,
    direction: 'previous' | 'next'
): string | null => {
    const sorted = sortRoomDates(dates);
    if (!sorted.length) return null;
    if (!value) return direction === 'next' ? sorted[0] ?? null : sorted[sorted.length - 1] ?? null;
    if (direction === 'previous') {
        for (let index = sorted.length - 1; index >= 0; index -= 1) {
            const candidate = sorted[index];
            if (candidate && candidate < value) return candidate;
        }
        return null;
    }
    return sorted.find(candidate => candidate > value) || null;
};

export const findNearestRoomDate = (dates: string[], value: string | null): string | null => {
    const sorted = sortRoomDates(dates);
    if (!sorted.length) return null;
    if (!value) return sorted[0] ?? null;
    if (sorted.includes(value)) return value;
    return sorted.find(candidate => candidate > value) || sorted[sorted.length - 1] || null;
};

export const pickDefaultDate = (index: RoomOccupancy): string => {
    const today = new Date().toISOString().slice(0, 10);
    return index.dates.find(item => item.date >= today)?.date || index.dates[0]?.date || today;
};

export const findFloor = (
    index: RoomOccupancy,
    campus: string | null,
    building: string | null,
    floor: string | null
): RoomFloor | null => {
    if (!campus && !building && !floor) return null;
    const floors = index.floors;
    const matched = floors.find(item =>
        (!campus || item.campus === campus)
        && (!building || item.building === building)
        && (!floor || item.floor === floor)
    );
    return matched || null;
};

export const roomsForFloor = (index: RoomOccupancy, floor: RoomFloor): Room[] => {
    const roomByKey = new Map(index.rooms.map(room => [room.room_key, room]));
    return floor.room_keys
        .map(key => roomByKey.get(key))
        .filter((room): room is Room => Boolean(room))
        .sort((a, b) => a.room.localeCompare(b.room, 'zh-CN', { numeric: true }));
};

export const findFloorDateArtifact = (
    index: RoomOccupancy,
    date: string,
    floorKey: string
): RoomArtifactRef | null => {
    const dateEntry: RoomDateEntry | undefined = index.dates.find(item => item.date === date);
    return dateEntry?.floors.find(item => item.floor_key === floorKey)?.artifact || null;
};

const minutesOfDay = (timestamp: string): number => {
    const date = new Date(timestamp);
    return date.getHours() * 60 + date.getMinutes();
};

const parseClock = (value: string | null, defaultMinute: number): number => {
    if (!value) return defaultMinute;
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return defaultMinute;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return defaultMinute;
    return hours * 60 + minutes;
};

export const canonicalRoomLabel = (room: Room): string => `${room.building}-${room.room}`;

export const parseRoomIntent = (query: string): RoomIntent | null => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    if (ENTRY_TERMS.has(trimmed)) return { kind: 'entry' };
    const looksLikeRoom = /楼$|^教(?:\d|东|西)$|^[^\s]+-[^\s]+$|^(?:图|无)[^\s]+$/.test(trimmed);
    return looksLikeRoom ? { kind: 'candidate', input: trimmed } : null;
};

export const isRoomSearchInput = (query: string): boolean => parseRoomIntent(query) !== null;

export const resolveRoomTarget = (
    index: RoomOccupancy,
    intent: RoomIntent | null
): RoomSearchTarget | null => {
    if (!intent) return null;
    if (intent.kind === 'entry') return intent;
    const buildings = uniqueValues(index.floors.map(floor => floor.building));
    if (buildings.includes(intent.input)) {
        const floors = index.floors.filter(floor => floor.building === intent.input);
        const campuses = uniqueValues(floors.map(floor => floor.campus));
        if (campuses.length !== 1 || !campuses[0]) return null;
        return {
            kind: 'building',
            campus: campuses[0],
            building: intent.input,
            display: intent.input
        };
    }
    const rooms = index.rooms.filter(room => (
        canonicalRoomLabel(room) === intent.input || room.room === intent.input
    ));
    if (rooms.length !== 1 || !rooms[0]) return null;
    const room = rooms[0];
    return {
        kind: 'room',
        campus: room.campus,
        building: room.building,
        floor: room.floor,
        room: room.room,
        display: canonicalRoomLabel(room)
    };
};

export const findRoomByTarget = (index: RoomOccupancy, target: RoomSearchTarget | null): Room | null => {
    if (!target || target.kind !== 'room') return null;
    return index.rooms.find(room =>
        room.room === target.room
        && room.building === target.building
        && room.campus === target.campus
    ) || null;
};

type TimeRange = Pick<RoomBooking, 'start_timestamp' | 'end_timestamp'>;

export const overlapsWindow = (booking: TimeRange, start: string | null, end: string | null): boolean => {
    const startMinute = parseClock(start, 8 * 60);
    const endMinute = parseClock(end, 22 * 60);
    const bookingStart = minutesOfDay(booking.start_timestamp);
    const bookingEnd = minutesOfDay(booking.end_timestamp);
    return bookingStart < endMinute && bookingEnd > startMinute;
};

const bookingGroupKey = (booking: RoomBooking): string => [
    booking.room_key,
    booking.start_timestamp,
    booking.end_timestamp,
    booking.course_code,
    booking.course_name,
    booking.teacher,
    booking.location,
].join('\u001f');

export const groupRoomBookings = (bookings: RoomBooking[]): RoomBookingGroup[] => {
    const grouped = new Map<string, RoomBooking[]>();
    for (const booking of bookings) {
        const key = bookingGroupKey(booking);
        const current = grouped.get(key) || [];
        current.push(booking);
        grouped.set(key, current);
    }
    return Array.from(grouped.entries()).map(([key, groupBookings]) => {
        const first = groupBookings[0];
        if (!first) {
            throw new Error(`Room booking group is empty: ${key}`);
        }
        const classCounts = new Map<string, number>();
        for (const booking of groupBookings) {
            classCounts.set(booking.class_name, (classCounts.get(booking.class_name) || 0) + booking.count);
        }
        const classSummaries = Array.from(classCounts.entries())
            .map(([className, count]) => ({ class_name: className, count }))
            .sort((a, b) => a.class_name.localeCompare(b.class_name, 'zh-CN', { numeric: true }));
        const classNames = classSummaries.map(item => item.class_name);
        return {
            group_id: `room-booking-group:${key}`,
            course_name: first.course_name,
            course_code: first.course_code,
            teacher: first.teacher,
            start_timestamp: first.start_timestamp,
            end_timestamp: first.end_timestamp,
            duration_minutes: first.duration_minutes,
            location: first.location,
            class_names: classNames,
            class_summaries: classSummaries,
            class_count: classNames.length,
            total_count: classSummaries.reduce((sum, item) => sum + item.count, 0),
            source_bookings: [...groupBookings].sort((a, b) => a.class_name.localeCompare(b.class_name, 'zh-CN', { numeric: true })),
        };
    }).sort((a, b) =>
        minutesOfDay(a.start_timestamp) - minutesOfDay(b.start_timestamp)
        || minutesOfDay(a.end_timestamp) - minutesOfDay(b.end_timestamp)
        || a.course_name.localeCompare(b.course_name, 'zh-CN')
        || a.teacher.localeCompare(b.teacher, 'zh-CN')
    );
};

export const parseRoomQuery = (index: RoomOccupancy, query: string): Partial<RoomFilters> => {
    const target = resolveRoomTarget(index, parseRoomIntent(query));
    const result: Partial<RoomFilters> = {};
    if (!target || target.kind === 'entry') return result;
    result.campus = target.campus;
    result.building = target.building;
    if (target.kind === 'room') result.floor = target.floor;
    return result;
};
