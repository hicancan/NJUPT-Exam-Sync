export interface Room {
    campus: string;
    building: string;
    floor: string;
    floor_key: string;
    room: string;
    room_key: string;
}

export interface RoomFloor {
    campus: string;
    building: string;
    floor: string;
    floor_key: string;
    room_keys: string[];
}

export interface RoomArtifactRef {
    path: string;
    bytes: number;
    sha256: string;
}

export interface RoomDateFloorEntry {
    floor_key: string;
    booking_count: number;
    artifact: RoomArtifactRef;
}

export interface RoomDateEntry {
    date: string;
    floors: RoomDateFloorEntry[];
}

export interface RoomOccupancy {
    format: 'njupt-room-occupancy';
    occupancy_id: string;
    exam_snapshot_id: string;
    room_catalog_id: string;
    exam_period_id: string;
    source_updated_at: string;
    rooms: Room[];
    floors: RoomFloor[];
    dates: RoomDateEntry[];
}

export interface RoomBooking {
    exam_id: string;
    stable_key: string;
    class_name: string;
    course_name: string;
    course_code: string;
    teacher: string;
    count: number;
    date: string;
    start_timestamp: string;
    end_timestamp: string;
    duration_minutes: number;
    location: string;
    campus: string;
    building: string;
    floor: string;
    floor_key: string;
    room: string;
    room_key: string;
}

export interface RoomFloorOccupancy {
    format: 'njupt-room-floor-occupancy';
    exam_snapshot_id: string;
    room_catalog_id: string;
    date: string;
    campus: string;
    building: string;
    floor: string;
    floor_key: string;
    booking_count: number;
    bookings: RoomBooking[];
}
