import type { RoomArtifactRef, RoomBooking, RoomDateEntry, RoomOccupancy } from '../occupancy/model';

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

export type RoomIntent = { kind: 'entry' } | { kind: 'candidate'; input: string };

const ENTRY_TERMS = new Set(['考试占用教室', '考试教室', '教室']);

export const uniqueValues = (items: string[]): string[] => Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
export const sortRoomDates = (dates: string[]): string[] => Array.from(new Set(dates)).sort();

export const findAdjacentRoomDate = (dates: string[], value: string | null, direction: 'previous' | 'next'): string | null => {
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
    return sorted.find(candidate => candidate > value) ?? null;
};

export const findNearestRoomDate = (dates: string[], value: string | null): string | null => {
    const sorted = sortRoomDates(dates);
    if (!sorted.length) return null;
    if (!value) return sorted[0] ?? null;
    if (sorted.includes(value)) return value;
    return sorted.find(candidate => candidate > value) ?? sorted[sorted.length - 1] ?? null;
};

export const pickDefaultDate = (index: RoomOccupancy): string => {
    const today = new Date().toISOString().slice(0, 10);
    return index.dates.find(item => item.date >= today)?.date ?? index.dates[0]?.date ?? today;
};

export const findFloorDateArtifact = (index: RoomOccupancy, date: string, floorId: string): RoomArtifactRef | null => {
    const dateEntry: RoomDateEntry | undefined = index.dates.find(item => item.date === date);
    return dateEntry?.floors.find(item => item.floor_id === floorId)?.artifact ?? null;
};

const minutesOfDay = (timestamp: string): number => {
    const date = new Date(timestamp);
    return date.getHours() * 60 + date.getMinutes();
};

const parseClock = (value: string | null, fallback: number): number => {
    if (!value) return fallback;
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return fallback;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 ? hours * 60 + minutes : fallback;
};

export const parseRoomIntent = (query: string): RoomIntent | null => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    if (ENTRY_TERMS.has(trimmed)) return { kind: 'entry' };
    const looksLikeSpace = /楼$|^教(?:\d|东|西)$|^[^\s]+-[^\s]+$|^(?:图|无)[^\s]+$/.test(trimmed);
    return looksLikeSpace ? { kind: 'candidate', input: trimmed } : null;
};

export const isRoomSearchInput = (query: string): boolean => parseRoomIntent(query) !== null;

type TimeRange = Pick<RoomBooking, 'start_timestamp' | 'end_timestamp'>;
export const overlapsWindow = (booking: TimeRange, start: string | null, end: string | null): boolean => {
    const bookingStart = minutesOfDay(booking.start_timestamp);
    const bookingEnd = minutesOfDay(booking.end_timestamp);
    return bookingStart < parseClock(end, 22 * 60) && bookingEnd > parseClock(start, 8 * 60);
};

const bookingGroupKey = (booking: RoomBooking): string => [
    booking.space_family_id,
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
        grouped.set(key, [...(grouped.get(key) ?? []), booking]);
    }
    return Array.from(grouped.entries()).map(([key, values]) => {
        const first = values[0];
        if (!first) throw new Error(`Room booking group is empty: ${key}`);
        const classCounts = new Map<string, number>();
        for (const booking of values) classCounts.set(booking.class_name, (classCounts.get(booking.class_name) ?? 0) + booking.count);
        const class_summaries = Array.from(classCounts.entries())
            .map(([class_name, count]) => ({ class_name, count }))
            .sort((a, b) => a.class_name.localeCompare(b.class_name, 'zh-CN', { numeric: true }));
        return {
            group_id: `room-booking-group:${key}`,
            course_name: first.course_name,
            course_code: first.course_code,
            teacher: first.teacher,
            start_timestamp: first.start_timestamp,
            end_timestamp: first.end_timestamp,
            duration_minutes: first.duration_minutes,
            location: first.location,
            class_names: class_summaries.map(item => item.class_name),
            class_summaries,
            class_count: class_summaries.length,
            total_count: class_summaries.reduce((sum, item) => sum + item.count, 0),
            source_bookings: [...values].sort((a, b) => a.class_name.localeCompare(b.class_name, 'zh-CN', { numeric: true })),
        };
    }).sort((a, b) => minutesOfDay(a.start_timestamp) - minutesOfDay(b.start_timestamp)
        || a.course_name.localeCompare(b.course_name, 'zh-CN'));
};
