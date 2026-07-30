import { useEffect, useMemo, useState } from 'react';
import {
    findFloor,
    findFloorDateArtifact,
    findRoomByTarget,
    parseRoomIntent,
    pickDefaultDate,
    resolveRoomTarget,
    roomsForFloor,
} from '@njupt-search/academics-room';
import { loadRoomFloorOccupancy, loadRoomOccupancy } from './roomData';
import type {
    Room,
    RoomArtifactRef,
    RoomBooking,
    RoomFloor,
    RoomFloorOccupancy,
    RoomOccupancy,
} from '@njupt-search/academics-room';

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
    index: RoomOccupancy | null;
    date: string | null;
    campus: string | null;
    building: string | null;
    floor: string | null;
    floorEntry: RoomFloor | null;
    selectedRoom: Room | null;
    rooms: Room[];
    floorData: RoomFloorOccupancy | null;
    bookings: RoomBooking[];
}

type RoomSelection =
    | {
        error: null;
        date: string;
        campus: string;
        building: string;
        floor: string;
        floorEntry: RoomFloor;
        selectedRoom: Room | null;
        rooms: Room[];
        artifact: RoomArtifactRef | null;
    }
    | { error: string }
    | null;

export function useRoomOccupancy(input: UseRoomOccupancyInput): RoomOccupancyState {
    const [indexState, setIndexState] = useState<{
        data: RoomOccupancy | null;
        error: string | null;
        loaded: boolean;
    }>({ data: null, error: null, loaded: false });
    const [floorState, setFloorState] = useState<{
        path: string | null;
        data: RoomFloorOccupancy | null;
        error: string | null;
    }>({ path: null, data: null, error: null });

    useEffect(() => {
        const controller = new AbortController();
        loadRoomOccupancy(controller.signal)
            .then((data) => setIndexState({ data, error: null, loaded: true }))
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error(err);
                setIndexState({ data: null, error: err instanceof Error ? err.message : '无法加载教室占用索引', loaded: true });
            });
        return () => controller.abort();
    }, []);

    const index = indexState.data;
    const roomTarget = useMemo(
        () => index ? resolveRoomTarget(index, parseRoomIntent(input.query)) : null,
        [index, input.query]
    );
    const selected = useMemo<RoomSelection>(() => {
        if (!index) return null;
        const date = input.date || pickDefaultDate(index);
        const selectedRoom = findRoomByTarget(index, roomTarget);
        if (roomTarget?.kind === 'room' && !selectedRoom) {
            return { error: `教室目录中不存在：${roomTarget.display}` };
        }
        const campus = input.campus || (roomTarget?.kind !== 'entry' ? roomTarget?.campus : null) || null;
        const building = input.building || (roomTarget?.kind !== 'entry' ? roomTarget?.building : null) || null;
        const floor = selectedRoom?.floor || input.floor || (roomTarget?.kind === 'room' ? roomTarget.floor : null) || null;
        const floorEntry = findFloor(index, campus, building, floor);
        if (!floorEntry) {
            if (campus || building || floor) {
                return { error: `教室目录中不存在：${[campus, building, floor].filter(Boolean).join(' ')}` };
            }
            return null;
        }
        const floorRooms = roomsForFloor(index, floorEntry);
        return {
            date,
            floorEntry,
            campus: floorEntry.campus,
            building: floorEntry.building,
            floor: floorEntry.floor,
            artifact: findFloorDateArtifact(index, date, floorEntry.floor_key),
            selectedRoom,
            rooms: selectedRoom ? [selectedRoom] : floorRooms,
            error: null,
        };
    }, [index, input.building, input.campus, input.date, input.floor, roomTarget]);

    useEffect(() => {
        if (!index || !selected) return;
        if (!('artifact' in selected) || !selected.artifact) return;
        const controller = new AbortController();
        loadRoomFloorOccupancy(selected.artifact, index, controller.signal)
            .then((data) => setFloorState({ path: selected.artifact?.path || null, data, error: null }))
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error(err);
                setFloorState({ path: selected.artifact?.path || null, data: null, error: err instanceof Error ? err.message : '无法加载楼层占用数据' });
            });
        return () => controller.abort();
    }, [index, selected]);

    const selectedPath = selected && 'artifact' in selected ? selected.artifact?.path || null : null;
    const currentFloorData = selectedPath && floorState.path === selectedPath ? floorState.data : null;
    const currentFloorError = selectedPath && floorState.path === selectedPath ? floorState.error : null;
    const loading = !indexState.loaded || Boolean(selectedPath && floorState.path !== selectedPath);
    const selectionError = selected && 'error' in selected ? selected.error : null;
    const error = indexState.error || selectionError || currentFloorError;

    return {
        loading,
        error,
        index,
        date: selected && 'date' in selected ? selected.date : null,
        campus: selected && 'campus' in selected ? selected.campus : null,
        building: selected && 'building' in selected ? selected.building : null,
        floor: selected && 'floor' in selected ? selected.floor : null,
        floorEntry: selected && 'floorEntry' in selected ? selected.floorEntry : null,
        selectedRoom: selected && 'selectedRoom' in selected ? selected.selectedRoom : null,
        rooms: selected && 'rooms' in selected ? selected.rooms : [],
        floorData: currentFloorData,
        bookings: currentFloorData?.bookings || [],
    };
}
