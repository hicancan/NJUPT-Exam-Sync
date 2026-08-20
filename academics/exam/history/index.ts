import type { ArtifactRef, ExamSnapshotManifest } from '../snapshot';

export type ExamHistoryValue = string | number | string[] | number[] | null;
export type ExamHistoryChangeType = 'added' | 'removed' | 'changed';
export type ExamClassHistoryStatus = 'first_seen' | 'changed' | 'removed' | 'reappeared';
export type ExamHistoryEventStatus = 'baseline' | 'changed' | 'unchanged';

export interface ExamHistoryManifest {
    format: 'njupt-exam-history';
    history_id: string;
    exam_period_id: string;
    academic_year: string;
    term_number: number;
    term_label: string;
    baseline_snapshot_id: string;
    current_snapshot_id: string;
    current_source_updated_at: string;
    observed_snapshot_count: number;
    events: ArtifactRef;
    class_index: ArtifactRef;
    class_chunks: ArtifactRef[];
}

export interface ExamHistoryGlobalEvent {
    snapshot_id: string;
    previous_snapshot_id: string | null;
    source_updated_at: string;
    status: ExamHistoryEventStatus;
    total_records: number;
    total_classes: number;
    affected_class_count: number;
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
}

export interface ExamHistoryEvents {
    format: 'njupt-exam-history-events';
    exam_period_id: string;
    baseline_snapshot_id: string;
    current_snapshot_id: string;
    observed_snapshot_count: number;
    events: ExamHistoryGlobalEvent[];
}

export interface ExamHistoryClassIndexEntry {
    class_name: string;
    class_key: string;
    observed_snapshot_count: number;
    affected_event_count: number;
    current_record_count: number;
    latest_affected_at: string | null;
    chunk_path: string;
    chunk_id: string;
}

export interface ExamHistoryClassIndex {
    format: 'njupt-exam-history-class-index';
    exam_period_id: string;
    current_snapshot_id: string;
    observed_snapshot_count: number;
    class_count: number;
    classes: ExamHistoryClassIndexEntry[];
}

export interface ExamHistoryFieldChange {
    field: string;
    before: ExamHistoryValue;
    after: ExamHistoryValue;
}

export interface ExamHistoryChange {
    type: ExamHistoryChangeType;
    history_key: string;
    course_name: string;
    course_code: string;
    teacher: string;
    fields: ExamHistoryFieldChange[];
}

export interface ExamClassHistoryEvent {
    snapshot_id: string;
    previous_snapshot_id: string | null;
    source_updated_at: string;
    status: ExamClassHistoryStatus;
    previous_record_count: number;
    current_record_count: number;
    changes: ExamHistoryChange[];
}

export interface ExamClassHistory {
    class_name: string;
    class_key: string;
    observed_snapshot_count: number;
    affected_event_count: number;
    current_record_count: number;
    latest_affected_at: string | null;
    events: ExamClassHistoryEvent[];
}

export interface ExamHistoryClassChunk {
    format: 'njupt-exam-history-class-chunk';
    exam_period_id: string;
    current_snapshot_id: string;
    chunk_id: string;
    classes: Record<string, ExamClassHistory>;
}

export class ExamHistoryContractError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExamHistoryContractError';
    }
}

const SHA256_RE = /^[a-f0-9]{64}$/;
const isObject = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);
const hasExactKeys = (value: Record<string, unknown>, expected: string[]): boolean => {
    const actual = Object.keys(value).sort();
    const required = [...expected].sort();
    return actual.length === required.length
        && actual.every((key, index) => key === required[index]);
};
const requireString = (value: unknown, field: string, source: string): string => {
    if (typeof value !== 'string' || !value) {
        throw new ExamHistoryContractError(`${source}: ${field} must be a non-empty string`);
    }
    return value;
};
const requireText = (value: unknown, field: string, source: string): string => {
    if (typeof value !== 'string') {
        throw new ExamHistoryContractError(`${source}: ${field} must be a string`);
    }
    return value;
};
const requireHash = (value: unknown, field: string, source: string): string => {
    const result = requireString(value, field, source);
    if (!SHA256_RE.test(result)) {
        throw new ExamHistoryContractError(`${source}: ${field} must be a SHA-256 hex string`);
    }
    return result;
};
const requireInteger = (value: unknown, field: string, source: string, minimum = 0): number => {
    if (!Number.isSafeInteger(value) || Number(value) < minimum) {
        throw new ExamHistoryContractError(`${source}: ${field} must be an integer >= ${minimum}`);
    }
    return Number(value);
};
const parseTimestamp = (value: unknown, field: string, source: string): string => {
    const result = requireString(value, field, source);
    if (Number.isNaN(Date.parse(result))) {
        throw new ExamHistoryContractError(`${source}: ${field} must be a timestamp`);
    }
    return result;
};
const parseNullableHash = (value: unknown, field: string, source: string): string | null => (
    value === null ? null : requireHash(value, field, source)
);
const parseNullableTimestamp = (value: unknown, field: string, source: string): string | null => (
    value === null ? null : parseTimestamp(value, field, source)
);
const parseArtifact = (value: unknown, source: string): ArtifactRef => {
    if (!isObject(value) || !hasExactKeys(value, ['path', 'bytes', 'sha256'])) {
        throw new ExamHistoryContractError(`${source}: invalid artifact reference`);
    }
    return {
        path: requireString(value.path, 'path', source),
        bytes: requireInteger(value.bytes, 'bytes', source, 1),
        sha256: requireHash(value.sha256, 'sha256', source),
    };
};
const parseValue = (value: unknown, field: string, source: string): ExamHistoryValue => {
    if (value === null || typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value) && value.length > 0) {
        if (value.every(item => typeof item === 'string')) return value as string[];
        if (value.every(item => typeof item === 'number' && Number.isFinite(item))) return value as number[];
    }
    throw new ExamHistoryContractError(`${source}: ${field} has an invalid history value`);
};

export const parseExamHistoryManifest = (
    value: unknown,
    source = 'history/manifest.json',
): ExamHistoryManifest => {
    if (!isObject(value) || !hasExactKeys(value, [
        'format', 'history_id', 'exam_period_id', 'academic_year', 'term_number',
        'term_label', 'baseline_snapshot_id', 'current_snapshot_id',
        'current_source_updated_at', 'observed_snapshot_count', 'events',
        'class_index', 'class_chunks',
    ]) || value.format !== 'njupt-exam-history' || !Array.isArray(value.class_chunks)) {
        throw new ExamHistoryContractError(`${source}: incompatible ExamHistory format`);
    }
    const classChunks = value.class_chunks.map((item, index) => parseArtifact(
        item, `${source}.class_chunks[${index}]`,
    ));
    const events = parseArtifact(value.events, `${source}.events`);
    const classIndex = parseArtifact(value.class_index, `${source}.class_index`);
    if (
        events.path !== 'events.json'
        || classIndex.path !== 'class-index.json'
        || classChunks.length === 0
        || classChunks.some((item, index) => item.path !== `classes-${index.toString().padStart(3, '0')}.json`)
    ) {
        throw new ExamHistoryContractError(`${source}: invalid artifact paths`);
    }
    return {
        format: 'njupt-exam-history',
        history_id: requireHash(value.history_id, 'history_id', source),
        exam_period_id: requireString(value.exam_period_id, 'exam_period_id', source),
        academic_year: requireString(value.academic_year, 'academic_year', source),
        term_number: requireInteger(value.term_number, 'term_number', source, 1),
        term_label: requireString(value.term_label, 'term_label', source),
        baseline_snapshot_id: requireHash(value.baseline_snapshot_id, 'baseline_snapshot_id', source),
        current_snapshot_id: requireHash(value.current_snapshot_id, 'current_snapshot_id', source),
        current_source_updated_at: parseTimestamp(value.current_source_updated_at, 'current_source_updated_at', source),
        observed_snapshot_count: requireInteger(value.observed_snapshot_count, 'observed_snapshot_count', source, 1),
        events,
        class_index: classIndex,
        class_chunks: classChunks,
    };
};

const parseGlobalEvent = (value: unknown, source: string): ExamHistoryGlobalEvent => {
    if (!isObject(value) || !hasExactKeys(value, [
        'snapshot_id', 'previous_snapshot_id', 'source_updated_at', 'status',
        'total_records', 'total_classes', 'affected_class_count', 'added',
        'removed', 'changed', 'unchanged',
    ]) || !['baseline', 'changed', 'unchanged'].includes(String(value.status))) {
        throw new ExamHistoryContractError(`${source}: invalid global event`);
    }
    return {
        snapshot_id: requireHash(value.snapshot_id, 'snapshot_id', source),
        previous_snapshot_id: parseNullableHash(value.previous_snapshot_id, 'previous_snapshot_id', source),
        source_updated_at: parseTimestamp(value.source_updated_at, 'source_updated_at', source),
        status: value.status as ExamHistoryEventStatus,
        total_records: requireInteger(value.total_records, 'total_records', source),
        total_classes: requireInteger(value.total_classes, 'total_classes', source),
        affected_class_count: requireInteger(value.affected_class_count, 'affected_class_count', source),
        added: requireInteger(value.added, 'added', source),
        removed: requireInteger(value.removed, 'removed', source),
        changed: requireInteger(value.changed, 'changed', source),
        unchanged: requireInteger(value.unchanged, 'unchanged', source),
    };
};

export const parseExamHistoryEvents = (
    value: unknown,
    source = 'history/events.json',
): ExamHistoryEvents => {
    if (!isObject(value) || !hasExactKeys(value, [
        'format', 'exam_period_id', 'baseline_snapshot_id', 'current_snapshot_id',
        'observed_snapshot_count', 'events',
    ]) || value.format !== 'njupt-exam-history-events' || !Array.isArray(value.events)) {
        throw new ExamHistoryContractError(`${source}: incompatible history events`);
    }
    const events = value.events.map((item, index) => parseGlobalEvent(item, `${source}.events[${index}]`));
    const observed = requireInteger(value.observed_snapshot_count, 'observed_snapshot_count', source, 1);
    if (events.length !== observed || events[0]?.status !== 'baseline') {
        throw new ExamHistoryContractError(`${source}: invalid history event chain length`);
    }
    events.forEach((event, index) => {
        const expectedPrevious = index === 0 ? null : events[index - 1]?.snapshot_id;
        if (event.previous_snapshot_id !== expectedPrevious) {
            throw new ExamHistoryContractError(`${source}: broken history event chain`);
        }
    });
    const currentSnapshotId = requireHash(value.current_snapshot_id, 'current_snapshot_id', source);
    if (events[events.length - 1]?.snapshot_id !== currentSnapshotId) {
        throw new ExamHistoryContractError(`${source}: current snapshot is not the event head`);
    }
    return {
        format: 'njupt-exam-history-events',
        exam_period_id: requireString(value.exam_period_id, 'exam_period_id', source),
        baseline_snapshot_id: requireHash(value.baseline_snapshot_id, 'baseline_snapshot_id', source),
        current_snapshot_id: currentSnapshotId,
        observed_snapshot_count: observed,
        events,
    };
};

const parseClassIndexEntry = (value: unknown, source: string): ExamHistoryClassIndexEntry => {
    if (!isObject(value) || !hasExactKeys(value, [
        'class_name', 'class_key', 'observed_snapshot_count', 'affected_event_count',
        'current_record_count', 'latest_affected_at', 'chunk_path', 'chunk_id',
    ])) {
        throw new ExamHistoryContractError(`${source}: invalid class index entry`);
    }
    return {
        class_name: requireString(value.class_name, 'class_name', source),
        class_key: requireString(value.class_key, 'class_key', source),
        observed_snapshot_count: requireInteger(value.observed_snapshot_count, 'observed_snapshot_count', source, 1),
        affected_event_count: requireInteger(value.affected_event_count, 'affected_event_count', source),
        current_record_count: requireInteger(value.current_record_count, 'current_record_count', source),
        latest_affected_at: parseNullableTimestamp(value.latest_affected_at, 'latest_affected_at', source),
        chunk_path: requireString(value.chunk_path, 'chunk_path', source),
        chunk_id: requireHash(value.chunk_id, 'chunk_id', source),
    };
};

export const parseExamHistoryClassIndex = (
    value: unknown,
    source = 'history/class-index.json',
): ExamHistoryClassIndex => {
    if (!isObject(value) || !hasExactKeys(value, [
        'format', 'exam_period_id', 'current_snapshot_id', 'observed_snapshot_count',
        'class_count', 'classes',
    ]) || value.format !== 'njupt-exam-history-class-index' || !Array.isArray(value.classes)) {
        throw new ExamHistoryContractError(`${source}: incompatible history class index`);
    }
    const classes = value.classes.map((item, index) => parseClassIndexEntry(item, `${source}.classes[${index}]`));
    const classCount = requireInteger(value.class_count, 'class_count', source, 1);
    if (
        classes.length !== classCount
        || new Set(classes.map(item => item.class_name)).size !== classes.length
        || new Set(classes.map(item => item.class_key)).size !== classes.length
    ) {
        throw new ExamHistoryContractError(`${source}: class identity mismatch`);
    }
    return {
        format: 'njupt-exam-history-class-index',
        exam_period_id: requireString(value.exam_period_id, 'exam_period_id', source),
        current_snapshot_id: requireHash(value.current_snapshot_id, 'current_snapshot_id', source),
        observed_snapshot_count: requireInteger(value.observed_snapshot_count, 'observed_snapshot_count', source, 1),
        class_count: classCount,
        classes,
    };
};

const parseChange = (value: unknown, source: string): ExamHistoryChange => {
    if (!isObject(value) || !hasExactKeys(value, [
        'type', 'history_key', 'course_name', 'course_code', 'teacher', 'fields',
    ]) || !['added', 'removed', 'changed'].includes(String(value.type)) || !Array.isArray(value.fields)) {
        throw new ExamHistoryContractError(`${source}: invalid history change`);
    }
    const fields = value.fields.map((item, index): ExamHistoryFieldChange => {
        const itemSource = `${source}.fields[${index}]`;
        if (!isObject(item) || !hasExactKeys(item, ['field', 'before', 'after'])) {
            throw new ExamHistoryContractError(`${itemSource}: invalid field change`);
        }
        const before = parseValue(item.before, 'before', itemSource);
        const after = parseValue(item.after, 'after', itemSource);
        if (JSON.stringify(before) === JSON.stringify(after)) {
            throw new ExamHistoryContractError(`${itemSource}: field value did not change`);
        }
        return {
            field: requireString(item.field, 'field', itemSource),
            before,
            after,
        };
    });
    if (fields.length === 0 || new Set(fields.map(item => item.field)).size !== fields.length) {
        throw new ExamHistoryContractError(`${source}: changed fields are empty or duplicated`);
    }
    return {
        type: value.type as ExamHistoryChangeType,
        history_key: requireString(value.history_key, 'history_key', source),
        course_name: requireString(value.course_name, 'course_name', source),
        course_code: requireString(value.course_code, 'course_code', source),
        teacher: requireText(value.teacher, 'teacher', source),
        fields,
    };
};

const parseClassHistory = (value: unknown, source: string): ExamClassHistory => {
    if (!isObject(value) || !hasExactKeys(value, [
        'class_name', 'class_key', 'observed_snapshot_count', 'affected_event_count',
        'current_record_count', 'latest_affected_at', 'events',
    ]) || !Array.isArray(value.events)) {
        throw new ExamHistoryContractError(`${source}: invalid class history`);
    }
    const events = value.events.map((item, index): ExamClassHistoryEvent => {
        const itemSource = `${source}.events[${index}]`;
        if (!isObject(item) || !hasExactKeys(item, [
            'snapshot_id', 'previous_snapshot_id', 'source_updated_at', 'status',
            'previous_record_count', 'current_record_count', 'changes',
        ]) || !['first_seen', 'changed', 'removed', 'reappeared'].includes(String(item.status)) || !Array.isArray(item.changes)) {
            throw new ExamHistoryContractError(`${itemSource}: invalid class event`);
        }
        return {
            snapshot_id: requireHash(item.snapshot_id, 'snapshot_id', itemSource),
            previous_snapshot_id: parseNullableHash(item.previous_snapshot_id, 'previous_snapshot_id', itemSource),
            source_updated_at: parseTimestamp(item.source_updated_at, 'source_updated_at', itemSource),
            status: item.status as ExamClassHistoryStatus,
            previous_record_count: requireInteger(item.previous_record_count, 'previous_record_count', itemSource),
            current_record_count: requireInteger(item.current_record_count, 'current_record_count', itemSource),
            changes: item.changes.map((change, changeIndex) => parseChange(change, `${itemSource}.changes[${changeIndex}]`)),
        };
    });
    if (events.length === 0) {
        throw new ExamHistoryContractError(`${source}: class history has no events`);
    }
    const affectedEventCount = requireInteger(value.affected_event_count, 'affected_event_count', source);
    if (events.filter(event => event.previous_snapshot_id !== null).length !== affectedEventCount) {
        throw new ExamHistoryContractError(`${source}: affected event count mismatch`);
    }
    const latestAffectedAt = parseNullableTimestamp(value.latest_affected_at, 'latest_affected_at', source);
    if ((affectedEventCount === 0) !== (latestAffectedAt === null)) {
        throw new ExamHistoryContractError(`${source}: latest affected time mismatch`);
    }
    return {
        class_name: requireString(value.class_name, 'class_name', source),
        class_key: requireString(value.class_key, 'class_key', source),
        observed_snapshot_count: requireInteger(value.observed_snapshot_count, 'observed_snapshot_count', source, 1),
        affected_event_count: affectedEventCount,
        current_record_count: requireInteger(value.current_record_count, 'current_record_count', source),
        latest_affected_at: latestAffectedAt,
        events,
    };
};

export const parseExamHistoryClassChunk = (
    value: unknown,
    source = 'history class chunk',
): ExamHistoryClassChunk => {
    if (!isObject(value) || !hasExactKeys(value, [
        'format', 'exam_period_id', 'current_snapshot_id', 'chunk_id', 'classes',
    ]) || value.format !== 'njupt-exam-history-class-chunk' || !isObject(value.classes)) {
        throw new ExamHistoryContractError(`${source}: incompatible history class chunk`);
    }
    const classes: Record<string, ExamClassHistory> = {};
    for (const [classKey, item] of Object.entries(value.classes)) {
        const parsed = parseClassHistory(item, `${source}.${classKey}`);
        if (parsed.class_key !== classKey) {
            throw new ExamHistoryContractError(`${source}: class key mismatch`);
        }
        classes[classKey] = parsed;
    }
    if (Object.keys(classes).length === 0) {
        throw new ExamHistoryContractError(`${source}: history class chunk is empty`);
    }
    return {
        format: 'njupt-exam-history-class-chunk',
        exam_period_id: requireString(value.exam_period_id, 'exam_period_id', source),
        current_snapshot_id: requireHash(value.current_snapshot_id, 'current_snapshot_id', source),
        chunk_id: requireHash(value.chunk_id, 'chunk_id', source),
        classes,
    };
};

const digestHex = async (value: string): Promise<string> => {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};
const canonicalJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (isObject(value)) {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
};

export const examHistoryIdentityText = (manifest: ExamHistoryManifest): string => {
    const parts: Array<string | number> = [
        manifest.format,
        manifest.exam_period_id,
        manifest.academic_year,
        manifest.term_number,
        manifest.term_label,
        manifest.baseline_snapshot_id,
        manifest.current_snapshot_id,
        manifest.current_source_updated_at,
        manifest.observed_snapshot_count,
    ];
    const artifacts = [manifest.events, manifest.class_index, ...manifest.class_chunks]
        .sort((left, right) => left.path.localeCompare(right.path));
    for (const artifact of artifacts) {
        parts.push(artifact.path, artifact.bytes, artifact.sha256);
    }
    return `${parts.join('\0')}\0`;
};

export const assertExamHistoryIdentity = async (manifest: ExamHistoryManifest): Promise<void> => {
    if (await digestHex(examHistoryIdentityText(manifest)) !== manifest.history_id) {
        throw new ExamHistoryContractError('ExamHistory identity mismatch');
    }
};

export const assertExamHistoryClassChunkIdentity = async (
    chunk: ExamHistoryClassChunk,
): Promise<void> => {
    if (await digestHex(canonicalJson(chunk.classes)) !== chunk.chunk_id) {
        throw new ExamHistoryContractError('ExamHistory class chunk identity mismatch');
    }
};

export const assertExamHistoryMatchesSnapshot = (
    history: ExamHistoryManifest,
    snapshot: ExamSnapshotManifest,
): void => {
    if (
        history.current_snapshot_id !== snapshot.snapshot_id
        || history.exam_period_id !== snapshot.exam_period.id
        || history.current_source_updated_at !== snapshot.source_updated_at
    ) {
        throw new ExamHistoryContractError('ExamHistory does not match the current ExamSnapshot');
    }
};

export const assertExamHistoryPayloads = (
    manifest: ExamHistoryManifest,
    events: ExamHistoryEvents,
    index: ExamHistoryClassIndex,
): void => {
    if (
        events.exam_period_id !== manifest.exam_period_id
        || events.baseline_snapshot_id !== manifest.baseline_snapshot_id
        || events.current_snapshot_id !== manifest.current_snapshot_id
        || events.observed_snapshot_count !== manifest.observed_snapshot_count
        || index.exam_period_id !== manifest.exam_period_id
        || index.current_snapshot_id !== manifest.current_snapshot_id
        || index.observed_snapshot_count !== manifest.observed_snapshot_count
        || index.classes.some(entry => !manifest.class_chunks.some(chunk => chunk.path === entry.chunk_path))
    ) {
        throw new ExamHistoryContractError('ExamHistory payloads do not match the manifest');
    }
};

export const selectExamClassHistory = (
    manifest: ExamHistoryManifest,
    entry: ExamHistoryClassIndexEntry,
    chunk: ExamHistoryClassChunk,
): ExamClassHistory => {
    if (
        chunk.exam_period_id !== manifest.exam_period_id
        || chunk.current_snapshot_id !== manifest.current_snapshot_id
        || chunk.chunk_id !== entry.chunk_id
    ) {
        throw new ExamHistoryContractError(`ExamHistory chunk identity mismatch for ${entry.class_name}`);
    }
    const selected = chunk.classes[entry.class_key];
    if (
        !selected
        || selected.class_name !== entry.class_name
        || selected.observed_snapshot_count !== entry.observed_snapshot_count
        || selected.affected_event_count !== entry.affected_event_count
        || selected.current_record_count !== entry.current_record_count
        || selected.latest_affected_at !== entry.latest_affected_at
    ) {
        throw new ExamHistoryContractError(`ExamHistory class mapping mismatch for ${entry.class_name}`);
    }
    return selected;
};
