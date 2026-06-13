import { APP_CONFIG } from '@/app/config/constants';
import { fetchJson } from '@/shared/lib/fetch';
import { parseExamRoomFloorDateData, parseExamRoomIndex } from '@njupt-search/exam-core/contract';
import type {
    ExamRoom,
    ExamRoomBooking,
    ExamRoomDateEntry,
    ExamRoomFloor,
    ExamRoomFloorDateData,
    ExamRoomIndex,
} from '@/shared/lib/contracts';

export interface RoomFilters {
    query: string;
    date: string | null;
    campus: string | null;
    building: string | null;
    floor: string | null;
    start: string | null;
    end: string | null;
}

export const roomIndexUrlWithNonce = (nonce = Date.now().toString(36)): string => {
    return `${APP_CONFIG.DATA_URLS.ROOM_INDEX}?fresh=${encodeURIComponent(nonce)}`;
};

export const versionedRoomDataUrl = (path: string, dataVersion: string): string => {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}v=${encodeURIComponent(dataVersion)}&schema=${encodeURIComponent(APP_CONFIG.EXAM_PUBLIC_SCHEMA_VERSION)}`;
};

export async function loadRoomIndex(signal?: AbortSignal): Promise<ExamRoomIndex> {
    const payload = await fetchJson(roomIndexUrlWithNonce(), signal, 'exam-room-index');
    return parseExamRoomIndex(payload, APP_CONFIG.DATA_URLS.ROOM_INDEX);
}

export async function loadRoomFloorDateData(
    path: string,
    dataVersion: string,
    signal?: AbortSignal
): Promise<ExamRoomFloorDateData> {
    const payload = await fetchJson(versionedRoomDataUrl(path, dataVersion), signal, 'exam-room-floor-date-versioned');
    return parseExamRoomFloorDateData(payload, path);
}

export const uniqueValues = (items: string[]): string[] => Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, 'zh-CN'));

export const pickDefaultDate = (index: ExamRoomIndex): string => {
    const today = new Date().toISOString().slice(0, 10);
    return index.dates.find(item => item.date >= today)?.date || index.dates[0]?.date || today;
};

export const findFloor = (
    index: ExamRoomIndex,
    campus: string | null,
    building: string | null,
    floor: string | null
): ExamRoomFloor => {
    const floors = index.floors;
    const matched = floors.find(item =>
        (!campus || item.campus === campus)
        && (!building || item.building === building)
        && (!floor || item.floor === floor)
    );
    if (matched) return matched;
    const fallback = floors[0];
    if (fallback) return fallback;
    throw new Error('Room index contains no floors');
};

export const roomsForFloor = (index: ExamRoomIndex, floor: ExamRoomFloor): ExamRoom[] => {
    const roomByKey = new Map(index.rooms.map(room => [room.room_key, room]));
    return floor.room_keys
        .map(key => roomByKey.get(key))
        .filter((room): room is ExamRoom => Boolean(room))
        .sort((a, b) => a.room.localeCompare(b.room, 'zh-CN', { numeric: true }));
};

export const findFloorDatePath = (
    index: ExamRoomIndex,
    date: string,
    floorKey: string
): string | null => {
    const dateEntry: ExamRoomDateEntry | undefined = index.dates.find(item => item.date === date);
    return dateEntry?.floors.find(item => item.floor_key === floorKey)?.path || null;
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
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
    return hours * 60 + minutes;
};

const wirelessRoomNumber = (room: string): number | null => {
    const value = room.slice(1);
    const digits: Record<string, number> = {
        '1': 1,
        '2': 2,
        '3': 3,
        '4': 4,
        '5': 5,
        '6': 6,
        '一': 1,
        '二': 2,
        '三': 3,
        '四': 4,
        '五': 5,
        '六': 6,
    };
    return digits[value] ?? null;
};

export const overlapsWindow = (booking: ExamRoomBooking, start: string | null, end: string | null): boolean => {
    const startMinute = parseClock(start, 8 * 60);
    const endMinute = parseClock(end, 22 * 60);
    const bookingStart = minutesOfDay(booking.start_timestamp);
    const bookingEnd = minutesOfDay(booking.end_timestamp);
    return bookingStart < endMinute && bookingEnd > startMinute;
};

export const parseRoomQuery = (query: string): Partial<RoomFilters> => {
    const trimmed = query.trim();
    const result: Partial<RoomFilters> = {};
    const bareWireless = /^无[1-6一二三四五六]$/.exec(trimmed);
    if (bareWireless) {
        const wirelessNumber = wirelessRoomNumber(trimmed);
        if (wirelessNumber !== null) {
            result.campus = '三牌楼';
            result.building = '无线楼';
            result.floor = String(Math.floor((wirelessNumber - 1) / 2) + 1);
        }
    }
    const bareLibraryScience = /^图[45]$/.exec(trimmed);
    if (bareLibraryScience) {
        result.campus = '三牌楼';
        result.building = '图科楼';
        result.floor = trimmed === '图4' ? '1' : '4';
    }
    const explicitRoom = /(教\d|教东|教西|无线楼|图科楼)[-\s]*(\d{3,4}|无[1-6一二三四五六]|图[45])/.exec(trimmed);
    if (explicitRoom) {
        const building = explicitRoom[1];
        const room = explicitRoom[2];
        if (!building || !room) return result;
        result.building = building;
        const wirelessNumber = room.startsWith('无') ? wirelessRoomNumber(room) : null;
        result.floor = wirelessNumber !== null
            ? String(Math.floor((wirelessNumber - 1) / 2) + 1)
            : room.startsWith('图')
                ? (room === '图4' ? '1' : '4')
                : room[0];
    }
    const buildingFloor = /(教\d|教东|教西|无线楼|图科楼)\s*(\d)\s*楼/.exec(trimmed);
    if (buildingFloor) {
        result.building = buildingFloor[1];
        result.floor = buildingFloor[2];
    }
    if (/三牌楼/.test(trimmed)) result.campus = '三牌楼';
    if (/仙林/.test(trimmed)) result.campus = '仙林';
    const time = /(\d{1,2}:\d{2})/.exec(trimmed);
    if (time) result.start = time[1];
    return result;
};
