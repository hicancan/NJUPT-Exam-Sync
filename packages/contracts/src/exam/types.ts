export interface Exam {
    id: string;
    stable_key: string;
    content_fingerprint: string;
    exam_period_id: string;
    duplicate_count: number;
    source_refs?: Array<{
        id: string;
        source_file: string;
        row_index: number;
    }>;
    class_name: string;
    course_name: string;
    location: string;
    start_timestamp: string;
    end_timestamp: string;
    duration_minutes: number;
    teacher?: string;
    notes?: string;
    campus?: string;
    course_code?: string;
    count?: number;
    raw_time?: string;
    school?: string;
    student_school?: string;
    major?: string;
    grade?: string;
    date?: string;
}

export interface Manifest {
    generated_at: string;
    data_version: string;
    exam_period_id: string;
    academic_year: string;
    term_number: number;
    term_label: string;
    files_processed: string[];
    total_records: number;
    source_url?: string;
    source_title?: string;
}

export type SearchMode = 'EMPTY' | 'NOT_FOUND' | 'LIST' | 'DETAIL';

export interface SearchResult {
    mode: SearchMode;
    classes: string[];
    exams: Exam[];
}

export interface ExamClassIndexEntry {
    class_name: string;
    class_key: string;
    exam_period_id: string;
    record_count: number;
    path: string;
    history_path: string;
}

export interface ExamClassIndex {
    version: 'exam-class-index-v1';
    generated_at: string;
    data_version: string;
    exam_period_id: string;
    academic_year: string;
    term_number: number;
    term_label: string;
    source_url?: string | null;
    source_title?: string | null;
    total_records: number;
    class_count: number;
    classes: ExamClassIndexEntry[];
}

export interface ExamClassData {
    version: 'exam-class-data-v1';
    exam_period_id: string;
    academic_year: string;
    term_number: number;
    term_label: string;
    data_version: string;
    generated_at: string;
    source_url?: string | null;
    source_title?: string | null;
    class_name: string;
    class_key: string;
    record_count: number;
    exams: Exam[];
}

export type ExamHistoryStatus = 'first_seen' | 'changed' | 'unchanged' | 'removed' | 'reappeared';
export type ExamHistoryChangeType = 'added' | 'removed' | 'changed';

export interface ExamHistoryFieldChange {
    field: string;
    label: string;
    before?: unknown;
    after?: unknown;
}

export interface ExamHistoryChange {
    type: ExamHistoryChangeType;
    identity_key: string;
    course_name: string;
    course_code?: string | null;
    teacher?: string | null;
    before_id?: string | null;
    after_id?: string | null;
    fields?: ExamHistoryFieldChange[];
    before?: Partial<Exam>;
    after?: Partial<Exam>;
}

export interface ExamHistoryEventTotals {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
    previous_records: number;
    current_records: number;
}

export interface ExamHistoryTimelineNode {
    data_version: string;
    auto_updated_at: string;
    exam_period_id: string;
    source_url?: string | null;
    source_title?: string | null;
    previous_data_version?: string | null;
    previous_auto_updated_at?: string | null;
    status: ExamHistoryStatus;
    totals: ExamHistoryEventTotals;
    changes: ExamHistoryChange[];
}

export interface ExamHistorySnapshot {
    data_version: string;
    auto_updated_at: string;
    exam_period_id: string;
    source_url?: string | null;
    source_title?: string | null;
    record_count: number;
    class_count: number;
}

export interface ExamClassHistoryIndex {
    class_name: string;
    class_key: string;
    path: string;
    exam_period_id: string;
    first_seen_data_version: string;
    first_seen_at: string;
    latest_status: ExamHistoryStatus;
    latest_affected_data_version: string;
    latest_affected_at: string;
    current_record_count: number;
    timeline_count: number;
    affected_count: number;
}

export interface ExamHistoryManifest {
    version: 'exam-history-manifest-v1';
    generated_at: string;
    exam_period_id: string;
    academic_year: string;
    term_number: number;
    term_label: string;
    latest_data_version: string;
    latest_auto_updated_at: string;
    snapshots: ExamHistorySnapshot[];
    totals: {
        snapshot_count: number;
        class_count: number;
        current_class_count: number;
        current_record_count: number;
    };
    classes: ExamClassHistoryIndex[];
}

export interface ExamClassHistory {
    version: 'exam-class-history-v3';
    exam_period_id: string;
    academic_year: string;
    term_number: number;
    term_label: string;
    class_name: string;
    class_key: string;
    generated_at: string;
    latest_data_version: string;
    latest_auto_updated_at: string;
    first_seen: {
        data_version: string;
        auto_updated_at: string;
    };
    timeline: ExamHistoryTimelineNode[];
}

export interface ExamRoom {
    campus: string;
    building: string;
    floor: string;
    floor_key: string;
    room: string;
    room_key: string;
    source: 'observed' | 'inferred_range' | 'manual_confirmed';
}

export interface ExamRoomFloor {
    campus: string;
    building: string;
    floor: string;
    floor_key: string;
    room_count: number;
    room_keys: string[];
}

export interface ExamRoomDateFloorEntry {
    floor_key: string;
    path: string;
    booking_count: number;
}

export interface ExamRoomDateEntry {
    date: string;
    floor_count: number;
    booking_count: number;
    floors: ExamRoomDateFloorEntry[];
}

export interface ExamRoomIndex {
    version: 'exam-room-index-v1';
    generated_at: string;
    data_version: string;
    exam_period_id: string;
    academic_year: string;
    term_number: number;
    term_label: string;
    source_url?: string | null;
    source_title?: string | null;
    catalog_version: 'njupt-room-catalog-v1';
    room_count: number;
    floor_count: number;
    date_count: number;
    rooms: ExamRoom[];
    floors: ExamRoomFloor[];
    dates: ExamRoomDateEntry[];
    audit_path: string;
}

export interface ExamRoomBooking {
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

export interface ExamRoomFloorDateData {
    version: 'exam-room-floor-date-v1';
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
    bookings: ExamRoomBooking[];
}


