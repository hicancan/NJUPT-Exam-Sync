import { useEffect, useState } from 'react';
import { findFloorDateArtifact, pickDefaultDate } from '@njupt-search/academics-room';
import type { RoomBooking, RoomFloorOccupancy, RoomOccupancy } from '@njupt-search/academics-room';
import type { Floor } from '@njupt-search/academics-space';
import type { RoomOccupancyClient } from './RoomOccupancyClient';
import type { SpaceClient, SpaceFamilyView, SpaceIndex } from '@/space/model/SpaceClient';

interface UseRoomOccupancyInput {
    query: string;
    date: string | null;
    campus: string | null;
    building: string | null;
    floor: string | null;
}

export interface RoomOccupancyState {
    loading: boolean;
    error: string | null;
    index: RoomOccupancy | null;
    space: SpaceIndex | null;
    date: string | null;
    campus: string | null;
    building: string | null;
    floor: string | null;
    floorEntry: Floor | null;
    selectedRoom: SpaceFamilyView | null;
    rooms: SpaceFamilyView[];
    floorData: RoomFloorOccupancy | null;
    bookings: RoomBooking[];
}

const EMPTY_STATE: RoomOccupancyState = {
    loading: true,
    error: null,
    index: null,
    space: null,
    date: null,
    campus: null,
    building: null,
    floor: null,
    floorEntry: null,
    selectedRoom: null,
    rooms: [],
    floorData: null,
    bookings: [],
};

export function useRoomOccupancy(
    client: RoomOccupancyClient,
    spaceClient: SpaceClient,
    input: UseRoomOccupancyInput,
): RoomOccupancyState {
    const [state, setState] = useState<RoomOccupancyState>(EMPTY_STATE);

    useEffect(() => {
        const controller = new AbortController();
        const run = async (): Promise<void> => {
            setState(previous => ({ ...previous, loading: true, error: null }));
            const [index, space] = await Promise.all([
                client.initialize(controller.signal),
                spaceClient.initialize(controller.signal),
            ]);
            if (index.space_snapshot_id !== space.manifest.snapshot_id) throw new Error('考试占用与空间数据身份不一致');
            const date = input.date ?? pickDefaultDate(index);
            const matches = await spaceClient.listFamilies({
                campus: input.campus,
                building: input.building,
                floor: input.floor,
                query: input.query || null,
            }, controller.signal);
            const selectedRoom = input.query && matches.length === 1 ? matches[0] ?? null : null;
            const floorEntry = selectedRoom?.floor
                ?? (input.query ? matches[0]?.floor : null)
                ?? space.floors.find(item => {
                    const building = space.buildings.find(entry => entry.building_id === item.building_id);
                    const campus = building ? space.campuses.find(entry => entry.campus_id === building.campus_id) : null;
                    return (!input.campus || campus?.name === input.campus)
                        && (!input.building || building?.name === input.building)
                        && (!input.floor || item.level === input.floor);
                })
                ?? null;
            const buildingEntry = floorEntry ? space.buildings.find(item => item.building_id === floorEntry.building_id) ?? null : null;
            const campusEntry = buildingEntry ? space.campuses.find(item => item.campus_id === buildingEntry.campus_id) ?? null : null;
            const rooms = floorEntry
                ? await spaceClient.listFamilies({
                    campus: campusEntry?.name ?? null,
                    building: buildingEntry?.name ?? null,
                    floor: floorEntry.level,
                }, controller.signal)
                : [];
            const artifact = floorEntry ? findFloorDateArtifact(index, date, floorEntry.floor_id) : null;
            const floorData = artifact ? await client.loadFloor(artifact, index, controller.signal) : null;
            setState({
                loading: false,
                error: null,
                index,
                space,
                date,
                campus: campusEntry?.name ?? input.campus,
                building: buildingEntry?.name ?? input.building,
                floor: floorEntry?.level ?? input.floor,
                floorEntry,
                selectedRoom,
                rooms: selectedRoom ? [selectedRoom] : rooms,
                floorData,
                bookings: floorData?.bookings ?? [],
            });
        };
        void run().catch(error => {
            if (controller.signal.aborted) return;
            console.error(error);
            setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : '暂时无法加载考试教室信息。' }));
        });
        return () => controller.abort();
    }, [client, input.building, input.campus, input.date, input.floor, input.query, spaceClient]);

    return state;
}
