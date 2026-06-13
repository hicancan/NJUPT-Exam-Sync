import { z } from 'zod';

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

export const ExamSchema = z.object({
    id: z.string().min(1),
    stable_key: z.string().min(1),
    content_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    duplicate_count: z.number().int().positive(),
    source_refs: z.array(z.object({
        id: z.string().min(1),
        source_file: z.string().min(1),
        row_index: z.number().int().positive(),
    })).min(1).optional(),
    class_name: z.string().min(1),
    course_name: z.string().min(1),
    course_code: z.string().min(1),
    teacher: z.string().min(1),
    campus: z.string().min(1),
    location: z.string().min(1),
    raw_time: z.string().min(1),
    count: z.number().int().nonnegative(),
    duration_minutes: z.number().positive(),
    start_timestamp: z.string().min(1),
    end_timestamp: z.string().min(1),
    date: z.string().min(1),
}).passthrough().superRefine((val, ctx) => {
    const start = val.start_timestamp;
    const end = val.end_timestamp;

    if (Number.isNaN(new Date(start).getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'start_timestamp must be a parseable date-time string' });
    }
    if (Number.isNaN(new Date(end).getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'end_timestamp must be a parseable date-time string' });
    }
});

export const ManifestSchema = z.object({
    generated_at: z.string().min(1),
    data_version: z.string().regex(/^[a-f0-9]{64}$/),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    academic_year: z.string().regex(/^\d{4}-\d{4}$/),
    term_number: z.number().int().min(1).max(4),
    term_label: z.string().min(1),
    total_records: z.number(),
    files_processed: z.array(z.string()),
    source_url: z.string().nullable().optional(),
    source_title: z.string().nullable().optional(),
}).passthrough();

export const ExamClassIndexEntrySchema = z.object({
    class_name: z.string().min(1),
    class_key: z.string().min(1),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    record_count: z.number().int().nonnegative(),
    path: z.string().regex(/^generated\/exam\/classes\/[^/]+\.json$/),
    history_path: z.string().regex(/^generated\/exam\/history\/classes\/[^/]+\.json$/),
}).strict();

export const ExamClassIndexSchema = z.object({
    version: z.literal('exam-class-index-v1'),
    generated_at: z.string().min(1),
    data_version: z.string().regex(/^[a-f0-9]{64}$/),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    academic_year: z.string().regex(/^\d{4}-\d{4}$/),
    term_number: z.number().int().min(1).max(4),
    term_label: z.string().min(1),
    source_url: z.string().nullable().optional(),
    source_title: z.string().nullable().optional(),
    total_records: z.number().int().nonnegative(),
    class_count: z.number().int().nonnegative(),
    classes: z.array(ExamClassIndexEntrySchema),
}).strict().superRefine((value, ctx) => {
    if (value.class_count !== value.classes.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'class_count must match classes.length' });
    }
    const seen = new Set<string>();
    for (const item of value.classes) {
        if (item.exam_period_id !== value.exam_period_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `class index exam_period_id mismatch: ${item.class_name}` });
        }
        if (seen.has(item.class_key)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate class_key: ${item.class_key}` });
        }
        seen.add(item.class_key);
    }
});

export const ExamClassDataSchema = z.object({
    version: z.literal('exam-class-data-v1'),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    academic_year: z.string().regex(/^\d{4}-\d{4}$/),
    term_number: z.number().int().min(1).max(4),
    term_label: z.string().min(1),
    data_version: z.string().regex(/^[a-f0-9]{64}$/),
    generated_at: z.string().min(1),
    source_url: z.string().nullable().optional(),
    source_title: z.string().nullable().optional(),
    class_name: z.string().min(1),
    class_key: z.string().min(1),
    record_count: z.number().int().nonnegative(),
    exams: z.array(ExamSchema),
}).strict().superRefine((value, ctx) => {
    if (value.record_count !== value.exams.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'record_count must match exams.length' });
    }
    const ids = new Set<string>();
    const stableKeys = new Set<string>();
    for (const exam of value.exams) {
        if (exam.class_name !== value.class_name) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `exam class_name mismatch: ${exam.id}` });
        }
        if (exam.exam_period_id !== value.exam_period_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `exam exam_period_id mismatch: ${exam.id}` });
        }
        if (ids.has(exam.id)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate exam id: ${exam.id}` });
        }
        if (stableKeys.has(exam.stable_key)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate exam stable_key: ${exam.stable_key}` });
        }
        ids.add(exam.id);
        stableKeys.add(exam.stable_key);
    }
});

const ExamRecordSnapshotSchema = z.object({
    id: z.string().optional().nullable(),
    stable_key: z.string().optional().nullable(),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/).optional().nullable(),
    duplicate_count: z.number().int().positive().optional().nullable(),
    class_name: z.string().optional().nullable(),
    course_name: z.string().optional().nullable(),
    course_code: z.string().optional().nullable(),
    teacher: z.string().optional().nullable(),
    start_timestamp: z.string().optional().nullable(),
    end_timestamp: z.string().optional().nullable(),
    duration_minutes: z.number().optional().nullable(),
    location: z.string().optional().nullable(),
    campus: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    count: z.number().optional().nullable(),
    raw_time: z.string().optional().nullable(),
}).passthrough();

export const ExamHistoryStatusSchema = z.enum(['first_seen', 'changed', 'unchanged', 'removed', 'reappeared']);

export const ExamHistoryFieldChangeSchema = z.object({
    field: z.string().min(1),
    label: z.string().min(1),
    before: z.unknown().optional(),
    after: z.unknown().optional(),
});

export const ExamHistoryChangeSchema = z.object({
    type: z.enum(['added', 'removed', 'changed']),
    identity_key: z.string(),
    course_name: z.string().min(1),
    course_code: z.string().optional().nullable(),
    teacher: z.string().optional().nullable(),
    before_id: z.string().optional().nullable(),
    after_id: z.string().optional().nullable(),
    fields: z.array(ExamHistoryFieldChangeSchema).optional(),
    before: ExamRecordSnapshotSchema.optional(),
    after: ExamRecordSnapshotSchema.optional(),
}).superRefine((value, ctx) => {
    if (value.type === 'changed' && (!value.fields || value.fields.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'changed exam history entries must include fields' });
    }
    if (value.type === 'added' && !value.after) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'added exam history entries must include after snapshot' });
    }
    if (value.type === 'removed' && !value.before) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'removed exam history entries must include before snapshot' });
    }
});

export const ExamHistoryEventTotalsSchema = z.object({
    added: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
    changed: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
    previous_records: z.number().int().nonnegative(),
    current_records: z.number().int().nonnegative(),
});

export const ExamHistoryTimelineNodeSchema = z.object({
    data_version: z.string().min(1),
    auto_updated_at: z.string().min(1),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    source_url: z.string().nullable().optional(),
    source_title: z.string().nullable().optional(),
    previous_data_version: z.string().nullable().optional(),
    previous_auto_updated_at: z.string().nullable().optional(),
    status: ExamHistoryStatusSchema,
    totals: ExamHistoryEventTotalsSchema,
    changes: z.array(ExamHistoryChangeSchema),
}).strict().superRefine((value, ctx) => {
    if (['changed', 'removed', 'reappeared'].includes(value.status) && value.changes.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${value.status} timeline nodes must include changes` });
    }
    if ((value.status === 'first_seen' || value.status === 'unchanged') && value.changes.length !== 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${value.status} timeline nodes must not include changes` });
    }
});

export const ExamHistorySnapshotSchema = z.object({
    data_version: z.string().min(1),
    auto_updated_at: z.string().min(1),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    source_url: z.string().nullable().optional(),
    source_title: z.string().nullable().optional(),
    record_count: z.number().int().nonnegative(),
    class_count: z.number().int().nonnegative(),
});

export const ExamClassHistoryIndexSchema = z.object({
    class_name: z.string().min(1),
    class_key: z.string().min(1),
    path: z.string().regex(/^generated\/exam\/history\/classes\/[^/]+\.json$/),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    first_seen_data_version: z.string().min(1),
    first_seen_at: z.string().min(1),
    latest_status: ExamHistoryStatusSchema,
    latest_affected_data_version: z.string().min(1),
    latest_affected_at: z.string().min(1),
    current_record_count: z.number().int().nonnegative(),
    timeline_count: z.number().int().positive(),
    affected_count: z.number().int().positive(),
});

export const ExamHistoryManifestSchema = z.object({
    version: z.literal('exam-history-manifest-v1'),
    generated_at: z.string().min(1),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    academic_year: z.string().regex(/^\d{4}-\d{4}$/),
    term_number: z.number().int().min(1).max(4),
    term_label: z.string().min(1),
    latest_data_version: z.string().min(1),
    latest_auto_updated_at: z.string().min(1),
    snapshots: z.array(ExamHistorySnapshotSchema).min(1),
    totals: z.object({
        snapshot_count: z.number().int().positive(),
        class_count: z.number().int().positive(),
        current_class_count: z.number().int().positive(),
        current_record_count: z.number().int().positive(),
    }),
    classes: z.array(ExamClassHistoryIndexSchema).min(1),
});

export const ExamClassHistorySchema = z.object({
    version: z.literal('exam-class-history-v3'),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    academic_year: z.string().regex(/^\d{4}-\d{4}$/),
    term_number: z.number().int().min(1).max(4),
    term_label: z.string().min(1),
    class_name: z.string().min(1),
    class_key: z.string().min(1),
    generated_at: z.string().min(1),
    latest_data_version: z.string().min(1),
    latest_auto_updated_at: z.string().min(1),
    first_seen: z.object({
        data_version: z.string().min(1),
        auto_updated_at: z.string().min(1),
    }),
    timeline: z.array(ExamHistoryTimelineNodeSchema).min(1),
}).strict().superRefine((value, ctx) => {
    for (const node of value.timeline) {
        if (node.exam_period_id !== value.exam_period_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `timeline node exam_period_id mismatch: ${node.data_version}` });
        }
    }
});

export const ExamRoomSchema = z.object({
    campus: z.string().min(1),
    building: z.string().min(1),
    floor: z.string().min(1),
    floor_key: z.string().regex(/^floor-[a-f0-9]{16}$/),
    room: z.string().min(1),
    room_key: z.string().regex(/^room-[a-f0-9]{16}$/),
    source: z.enum(['observed', 'inferred_range', 'manual_confirmed']),
}).strict();

export const ExamRoomFloorSchema = z.object({
    campus: z.string().min(1),
    building: z.string().min(1),
    floor: z.string().min(1),
    floor_key: z.string().regex(/^floor-[a-f0-9]{16}$/),
    room_count: z.number().int().positive(),
    room_keys: z.array(z.string().regex(/^room-[a-f0-9]{16}$/)).min(1),
}).strict();

export const ExamRoomDateFloorEntrySchema = z.object({
    floor_key: z.string().regex(/^floor-[a-f0-9]{16}$/),
    path: z.string().regex(/^generated\/exam\/rooms\/by-floor\/\d{4}-\d{2}-\d{2}\/floor-[a-f0-9]{16}\.json$/),
    booking_count: z.number().int().positive(),
}).strict();

export const ExamRoomDateEntrySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    floor_count: z.number().int().nonnegative(),
    booking_count: z.number().int().positive(),
    floors: z.array(ExamRoomDateFloorEntrySchema),
}).strict().superRefine((value, ctx) => {
    if (value.floor_count !== value.floors.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'floor_count must match floors.length' });
    }
    const bookingCount = value.floors.reduce((sum, item) => sum + item.booking_count, 0);
    if (value.booking_count !== bookingCount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'booking_count must match floor booking totals' });
    }
});

export const ExamRoomIndexSchema = z.object({
    version: z.literal('exam-room-index-v1'),
    generated_at: z.string().min(1),
    data_version: z.string().regex(/^[a-f0-9]{64}$/),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    academic_year: z.string().regex(/^\d{4}-\d{4}$/),
    term_number: z.number().int().min(1).max(4),
    term_label: z.string().min(1),
    source_url: z.string().nullable().optional(),
    source_title: z.string().nullable().optional(),
    catalog_version: z.literal('njupt-room-catalog-v1'),
    room_count: z.number().int().positive(),
    floor_count: z.number().int().positive(),
    date_count: z.number().int().positive(),
    rooms: z.array(ExamRoomSchema).min(1),
    floors: z.array(ExamRoomFloorSchema).min(1),
    dates: z.array(ExamRoomDateEntrySchema).min(1),
    audit_path: z.literal('generated/exam/rooms/audit.json'),
}).strict().superRefine((value, ctx) => {
    if (value.room_count !== value.rooms.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'room_count must match rooms.length' });
    }
    if (value.floor_count !== value.floors.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'floor_count must match floors.length' });
    }
    if (value.date_count !== value.dates.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'date_count must match dates.length' });
    }
    const roomKeys = new Set(value.rooms.map(room => room.room_key));
    if (roomKeys.size !== value.rooms.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'room_key values must be unique' });
    }
    const floorKeys = new Set(value.floors.map(floor => floor.floor_key));
    if (floorKeys.size !== value.floors.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'floor_key values must be unique' });
    }
    for (const floor of value.floors) {
        if (floor.room_count !== floor.room_keys.length) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `room_count must match room_keys.length for ${floor.floor_key}` });
        }
        for (const roomKey of floor.room_keys) {
            if (!roomKeys.has(roomKey)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: `floor references unknown room_key ${roomKey}` });
            }
        }
    }
    for (const date of value.dates) {
        for (const floor of date.floors) {
            if (!floorKeys.has(floor.floor_key)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: `date references unknown floor_key ${floor.floor_key}` });
            }
        }
    }
});

export const ExamRoomBookingSchema = z.object({
    exam_id: z.string().min(1),
    stable_key: z.string().min(1),
    class_name: z.string().min(1),
    course_name: z.string().min(1),
    course_code: z.string().min(1),
    teacher: z.string().min(1),
    count: z.number().int().nonnegative(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_timestamp: z.string().min(1),
    end_timestamp: z.string().min(1),
    duration_minutes: z.number().int().positive(),
    location: z.string().min(1),
    campus: z.string().min(1),
    building: z.string().min(1),
    floor: z.string().min(1),
    floor_key: z.string().regex(/^floor-[a-f0-9]{16}$/),
    room: z.string().min(1),
    room_key: z.string().regex(/^room-[a-f0-9]{16}$/),
}).strict().superRefine((value, ctx) => {
    if (Number.isNaN(new Date(value.start_timestamp).getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'start_timestamp must be parseable' });
    }
    if (Number.isNaN(new Date(value.end_timestamp).getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'end_timestamp must be parseable' });
    }
});

export const ExamRoomFloorDateDataSchema = z.object({
    version: z.literal('exam-room-floor-date-v1'),
    generated_at: z.string().min(1),
    data_version: z.string().regex(/^[a-f0-9]{64}$/),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    campus: z.string().min(1),
    building: z.string().min(1),
    floor: z.string().min(1),
    floor_key: z.string().regex(/^floor-[a-f0-9]{16}$/),
    room_count: z.number().int().positive(),
    booking_count: z.number().int().nonnegative(),
    bookings: z.array(ExamRoomBookingSchema),
}).strict().superRefine((value, ctx) => {
    if (value.booking_count !== value.bookings.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'booking_count must match bookings.length' });
    }
    for (const booking of value.bookings) {
        if (booking.date !== value.date || booking.floor_key !== value.floor_key) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `booking does not belong to floor-date ${value.date}/${value.floor_key}` });
        }
    }
});
