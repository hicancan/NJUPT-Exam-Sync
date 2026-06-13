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

export type ExamHistoryStatus = 'first_seen' | 'changed' | 'unchanged' | 'removed' | 'reappeared';
export type ExamHistoryEventStatus = Exclude<ExamHistoryStatus, 'unchanged'>;
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

export interface ExamHistoryEvent {
    data_version: string;
    auto_updated_at: string;
    exam_period_id: string;
    previous_data_version?: string | null;
    status: ExamHistoryEventStatus;
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
    latest_change_data_version: string;
    latest_change_at: string;
    current_record_count: number;
    event_count: number;
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
    version: 'exam-class-history-v2';
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
    latest_change_event: ExamHistoryEvent;
    events: ExamHistoryEvent[];
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
export const ExamHistoryEventStatusSchema = z.enum(['first_seen', 'changed', 'removed', 'reappeared']);

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

export const ExamHistoryEventSchema = z.object({
    data_version: z.string().min(1),
    auto_updated_at: z.string().min(1),
    exam_period_id: z.string().regex(/^\d{4}-\d{4}-[1-4]$/),
    previous_data_version: z.string().nullable().optional(),
    status: ExamHistoryEventStatusSchema,
    totals: ExamHistoryEventTotalsSchema,
    changes: z.array(ExamHistoryChangeSchema).min(1),
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
    latest_change_data_version: z.string().min(1),
    latest_change_at: z.string().min(1),
    current_record_count: z.number().int().nonnegative(),
    event_count: z.number().int().positive(),
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
    version: z.literal('exam-class-history-v2'),
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
    latest_change_event: ExamHistoryEventSchema,
    events: z.array(ExamHistoryEventSchema).min(1),
}).strict().superRefine((value, ctx) => {
    const firstEvent = value.events[0];
    if (!firstEvent) return;
    if (
        value.latest_change_event.data_version !== firstEvent.data_version
        || value.latest_change_event.auto_updated_at !== firstEvent.auto_updated_at
        || value.latest_change_event.status !== firstEvent.status
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'latest_change_event must match the first class history event',
        });
    }
});
