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

export type RoomSearchTarget =
    | { kind: 'entry' }
    | { kind: 'building'; campus: string | null; building: string; display: string }
    | { kind: 'room'; campus: string | null; building: string; floor: string; room: string; display: string };

const ENTRY_TERMS = new Set(['空教室', '教室']);
const BUILDING_CAMPUSES: Record<string, string | null> = {
    '教1': '仙林',
    '教2': '仙林',
    '教3': '仙林',
    '教4': '仙林',
    '自动化学科楼': '仙林',
    '教东': '三牌楼',
    '教西': '三牌楼',
    '图科楼': '三牌楼',
    '无线楼': '三牌楼',
    '锁金': '锁金',
};

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
): ExamRoomFloor | null => {
    if (!campus && !building && !floor) return null;
    const floors = index.floors;
    const matched = floors.find(item =>
        (!campus || item.campus === campus)
        && (!building || item.building === building)
        && (!floor || item.floor === floor)
    );
    return matched || null;
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

const normalizeWirelessRoom = (room: string): string | null => {
    const wirelessNumber = wirelessRoomNumber(room);
    return wirelessNumber === null ? null : `无${wirelessNumber}`;
};

const roomFloor = (room: string): string | null => {
    const wirelessNumber = room.startsWith('无') ? wirelessRoomNumber(room) : null;
    if (wirelessNumber !== null) return String(Math.floor((wirelessNumber - 1) / 2) + 1);
    if (room === '图4') return '1';
    if (room === '图5') return '4';
    const match = /^(\d)/.exec(room);
    return match?.[1] || null;
};

export const canonicalRoomLabel = (room: ExamRoom): string => {
    if (room.building === '图科楼' && /^图[45]$/.test(room.room)) return room.room;
    if (room.building === '无线楼' && /^无[1-6]$/.test(room.room)) return room.room;
    return `${room.building}-${room.room}`;
};

export const parseRoomSearchInput = (query: string): RoomSearchTarget | null => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    if (ENTRY_TERMS.has(trimmed)) return { kind: 'entry' };
    if (trimmed in BUILDING_CAMPUSES) {
        return { kind: 'building', campus: BUILDING_CAMPUSES[trimmed] ?? null, building: trimmed, display: trimmed };
    }

    const bareWireless = /^无[1-6一二三四五六]$/.exec(trimmed);
    if (bareWireless) {
        const room = normalizeWirelessRoom(trimmed);
        const floor = room ? roomFloor(room) : null;
        if (!room || !floor) return null;
        return { kind: 'room', campus: '三牌楼', building: '无线楼', floor, room, display: room };
    }

    if (/^图[45]$/.test(trimmed)) {
        return {
            kind: 'room',
            campus: '三牌楼',
            building: '图科楼',
            floor: trimmed === '图4' ? '1' : '4',
            room: trimmed,
            display: trimmed,
        };
    }

    const explicitRoom = /^(教\d|教东|教西|无线楼|图科楼|自动化学科楼|锁金)-(\d{3,4}|无[1-6一二三四五六]|图[45])$/.exec(trimmed);
    if (!explicitRoom) return null;
    const building = explicitRoom[1];
    const rawRoom = explicitRoom[2];
    if (!building || !rawRoom) return null;
    const room = rawRoom.startsWith('无') ? normalizeWirelessRoom(rawRoom) : rawRoom;
    if (!room) return null;
    const floor = roomFloor(room);
    if (!floor) return null;
    const campus = building in BUILDING_CAMPUSES ? BUILDING_CAMPUSES[building] ?? null : null;
    const display = (building === '图科楼' && /^图[45]$/.test(room))
        || (building === '无线楼' && /^无[1-6]$/.test(room))
        ? room
        : `${building}-${room}`;
    return { kind: 'room', campus, building, floor, room, display };
};

export const isRoomSearchInput = (query: string): boolean => parseRoomSearchInput(query) !== null;

export const findRoomByTarget = (index: ExamRoomIndex, target: RoomSearchTarget | null): ExamRoom | null => {
    if (!target || target.kind !== 'room') return null;
    return index.rooms.find(room =>
        room.room === target.room
        && room.building === target.building
        && (!target.campus || room.campus === target.campus)
    ) || null;
};

export const overlapsWindow = (booking: ExamRoomBooking, start: string | null, end: string | null): boolean => {
    const startMinute = parseClock(start, 8 * 60);
    const endMinute = parseClock(end, 22 * 60);
    const bookingStart = minutesOfDay(booking.start_timestamp);
    const bookingEnd = minutesOfDay(booking.end_timestamp);
    return bookingStart < endMinute && bookingEnd > startMinute;
};

export const parseRoomQuery = (query: string): Partial<RoomFilters> => {
    const target = parseRoomSearchInput(query);
    const result: Partial<RoomFilters> = {};
    if (!target || target.kind === 'entry') return result;
    result.campus = target.campus;
    result.building = target.building;
    if (target.kind === 'room') result.floor = target.floor;
    return result;
};
