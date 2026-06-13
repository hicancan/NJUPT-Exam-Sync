import { useEffect, useMemo, useState } from 'react';
import {
    findFloor,
    findFloorDatePath,
    loadRoomFloorDateData,
    loadRoomIndex,
    parseRoomQuery,
    pickDefaultDate,
    roomsForFloor,
} from './roomOccupancy';
import type {
    ExamRoom,
    ExamRoomBooking,
    ExamRoomFloor,
    ExamRoomFloorDateData,
    ExamRoomIndex,
} from '@/shared/lib/contracts';

interface UseRoomOccupancyInput {
    query: string;
    date: string | null;
    campus: string | null;
    building: string | null;
    floor: string | null;
    start: string | null;
    end: string | null;
}

export interface RoomOccupancyState {
    loading: boolean;
    error: string | null;
    index: ExamRoomIndex | null;
    date: string | null;
    campus: string | null;
    building: string | null;
    floor: string | null;
    floorEntry: ExamRoomFloor | null;
    rooms: ExamRoom[];
    floorData: ExamRoomFloorDateData | null;
    bookings: ExamRoomBooking[];
}

export function useRoomOccupancy(input: UseRoomOccupancyInput): RoomOccupancyState {
    const [indexState, setIndexState] = useState<{
        data: ExamRoomIndex | null;
        error: string | null;
        loaded: boolean;
    }>({ data: null, error: null, loaded: false });
    const [floorState, setFloorState] = useState<{
        path: string | null;
        data: ExamRoomFloorDateData | null;
        error: string | null;
    }>({ path: null, data: null, error: null });

    useEffect(() => {
        const controller = new AbortController();
        loadRoomIndex(controller.signal)
            .then((data) => setIndexState({ data, error: null, loaded: true }))
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error(err);
                setIndexState({ data: null, error: err instanceof Error ? err.message : '无法加载教室占用索引', loaded: true });
            });
        return () => controller.abort();
    }, []);

    const queryFilters = useMemo(() => parseRoomQuery(input.query), [input.query]);
    const index = indexState.data;
    const selected = useMemo(() => {
        if (!index) return null;
        const date = input.date || pickDefaultDate(index);
        const campus = input.campus || queryFilters.campus || null;
        const building = input.building || queryFilters.building || null;
        const floor = input.floor || queryFilters.floor || null;
        const floorEntry = findFloor(index, campus, building, floor);
        return {
            date,
            floorEntry,
            campus: floorEntry.campus,
            building: floorEntry.building,
            floor: floorEntry.floor,
            path: findFloorDatePath(index, date, floorEntry.floor_key),
            rooms: roomsForFloor(index, floorEntry),
        };
    }, [index, input.building, input.campus, input.date, input.floor, queryFilters]);

    useEffect(() => {
        if (!index || !selected) return;
        if (!selected.path) return;
        const controller = new AbortController();
        loadRoomFloorDateData(selected.path, index.data_version, controller.signal)
            .then((data) => setFloorState({ path: selected.path, data, error: null }))
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error(err);
                setFloorState({ path: selected.path, data: null, error: err instanceof Error ? err.message : '无法加载楼层占用数据' });
            });
        return () => controller.abort();
    }, [index, selected]);

    const currentFloorData = selected?.path && floorState.path === selected.path ? floorState.data : null;
    const currentFloorError = selected?.path && floorState.path === selected.path ? floorState.error : null;
    const loading = !indexState.loaded || Boolean(selected?.path && floorState.path !== selected.path);
    const error = indexState.error || currentFloorError;

    return {
        loading,
        error,
        index,
        date: selected?.date || null,
        campus: selected?.campus || null,
        building: selected?.building || null,
        floor: selected?.floor || null,
        floorEntry: selected?.floorEntry || null,
        rooms: selected?.rooms || [],
        floorData: currentFloorData,
        bookings: currentFloorData?.bookings || [],
    };
}
