export interface RoomArtifactRef {
    path: string;
    bytes: number;
    sha256: string;
}

export interface RoomDateFloorEntry {
    floor_id: string;
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
    space_snapshot_id: string;
    exam_period_id: string;
    source_updated_at: string;
    unresolved_locations: Array<{ location: string; count: number }>;
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
    floor_id: string;
    room: string;
    space_family_id: string;
    space_unit_id: string | null;
}

export interface RoomFloorOccupancy {
    format: 'njupt-room-floor-occupancy';
    exam_snapshot_id: string;
    space_snapshot_id: string;
    date: string;
    campus: string;
    building: string;
    floor: string;
    floor_id: string;
    booking_count: number;
    bookings: RoomBooking[];
}
