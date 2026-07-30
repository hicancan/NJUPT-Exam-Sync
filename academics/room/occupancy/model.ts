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
    room_count: number;
    room_keys: string[];
}

export interface RoomArtifactRef {
    path: string;
    bytes: number;
    sha256: string;
}

export interface RoomDateFloorEntry {
    floor_key: string;
    artifact: RoomArtifactRef;
    booking_count: number;
}

export interface RoomDateEntry {
    date: string;
    floor_count: number;
    booking_count: number;
    floors: RoomDateFloorEntry[];
}

export interface RoomOccupancy {
    format: 'njupt-room-occupancy-v3';
    occupancy_id: string;
    generated_at: string;
    data_version: string;
    exam_period_id: string;
    academic_year: string;
    term_number: number;
    term_label: string;
    source_url?: string | null;
    source_title?: string | null;
    catalog_format: 'njupt-room-catalog-v2';
    catalog_id: string;
    room_count: number;
    floor_count: number;
    date_count: number;
    rooms: Room[];
    floors: RoomFloor[];
    dates: RoomDateEntry[];
    diagnostics: RoomArtifactRef;
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
    format: 'njupt-room-occupancy-floor-v2';
    generated_at: string;
    data_version: string;
    exam_period_id: string;
    date: string;
    campus: string;
    building: string;
    floor: string;
    floor_key: string;
    room_count: number;
    booking_count: number;
    bookings: RoomBooking[];
}
