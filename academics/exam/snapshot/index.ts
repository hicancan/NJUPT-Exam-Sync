import type { Exam } from '../records';

export type { Exam } from '../records';

export interface ArtifactRef {
    path: string;
    bytes: number;
    sha256: string;
}

export interface ExamSnapshotManifest {
    format: 'njupt-exam-snapshot';
    snapshot_id: string;
    source_id: string;
    records_id: string;
    source_updated_at: string;
    source_url?: string | null;
    source_title?: string | null;
    exam_period: {
        id: string;
        academic_year: string;
        term_number: number;
        term_label: string;
    };
    total_records: number;
    records: ArtifactRef;
    class_index: ArtifactRef;
    class_chunks: ArtifactRef[];
}

export interface ExamClassIndexEntry {
    class_name: string;
    class_key: string;
    record_count: number;
    chunk_path: string;
    chunk_id: string;
}

export interface ExamClassIndex {
    format: 'njupt-exam-class-index';
    records_id: string;
    total_records: number;
    class_count: number;
    classes: ExamClassIndexEntry[];
}

export interface ExamClassChunkEntry {
    class_name: string;
    exams: Exam[];
}

export interface ExamClassChunk {
    format: 'njupt-exam-class-chunk';
    records_id: string;
    chunk_id: string;
    classes: Record<string, ExamClassChunkEntry>;
}

export class ExamSnapshotContractError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExamSnapshotContractError';
    }
}

const SHA256_RE = /^[a-f0-9]{64}$/;
const PERIOD_RE = /^\d{4}-\d{4}-[1-4]$/;

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
    if (typeof value !== 'string' || value.length === 0) {
        throw new ExamSnapshotContractError(`${source}: ${field} must be a non-empty string`);
    }
    return value;
};

const requireText = (value: unknown, field: string, source: string): string => {
    if (typeof value !== 'string') {
        throw new ExamSnapshotContractError(`${source}: ${field} must be a string`);
    }
    return value;
};

const requireHash = (value: unknown, field: string, source: string): string => {
    const text = requireString(value, field, source);
    if (!SHA256_RE.test(text)) {
        throw new ExamSnapshotContractError(`${source}: ${field} must be a SHA-256 hex string`);
    }
    return text;
};

const requireInteger = (value: unknown, field: string, source: string, minimum = 0): number => {
    if (!Number.isSafeInteger(value) || Number(value) < minimum) {
        throw new ExamSnapshotContractError(`${source}: ${field} must be an integer >= ${minimum}`);
    }
    return Number(value);
};

const parseArtifact = (value: unknown, source: string): ArtifactRef => {
    if (!isObject(value) || Object.keys(value).sort().join(',') !== 'bytes,path,sha256') {
        throw new ExamSnapshotContractError(`${source}: invalid artifact reference`);
    }
    return {
        path: requireString(value.path, 'path', source),
        bytes: requireInteger(value.bytes, 'bytes', source, 1),
        sha256: requireHash(value.sha256, 'sha256', source),
    };
};

const parseTimestamp = (value: unknown, field: string, source: string): string => {
    const timestamp = requireString(value, field, source);
    if (Number.isNaN(Date.parse(timestamp))) {
        throw new ExamSnapshotContractError(`${source}: ${field} must be a timestamp`);
    }
    return timestamp;
};

const parseExam = (value: unknown, source: string): Exam => {
    if (!isObject(value) || !hasExactKeys(value, [
        'id',
        'stable_key',
        'history_key',
        'content_fingerprint',
        'exam_period_id',
        'class_name',
        'course_name',
        'course_code',
        'teacher',
        'campus',
        'location',
        'raw_time',
        'count',
        'start_timestamp',
        'end_timestamp',
        'duration_minutes',
        'date',
        'notes',
    ])) {
        throw new ExamSnapshotContractError(`${source}: exam must be an object`);
    }
    const examPeriodId = requireString(value.exam_period_id, 'exam_period_id', source);
    if (!PERIOD_RE.test(examPeriodId)) {
        throw new ExamSnapshotContractError(`${source}: invalid exam_period_id`);
    }
    const exam: Exam = {
        id: requireString(value.id, 'id', source),
        stable_key: requireString(value.stable_key, 'stable_key', source),
        history_key: requireString(value.history_key, 'history_key', source),
        content_fingerprint: requireHash(value.content_fingerprint, 'content_fingerprint', source),
        exam_period_id: examPeriodId,
        class_name: requireString(value.class_name, 'class_name', source),
        course_name: requireString(value.course_name, 'course_name', source),
        course_code: requireString(value.course_code, 'course_code', source),
        teacher: requireString(value.teacher, 'teacher', source),
        campus: requireString(value.campus, 'campus', source),
        location: requireString(value.location, 'location', source),
        raw_time: requireString(value.raw_time, 'raw_time', source),
        count: requireInteger(value.count, 'count', source),
        start_timestamp: parseTimestamp(value.start_timestamp, 'start_timestamp', source),
        end_timestamp: parseTimestamp(value.end_timestamp, 'end_timestamp', source),
        duration_minutes: requireInteger(value.duration_minutes, 'duration_minutes', source, 1),
        date: requireString(value.date, 'date', source),
        notes: requireText(value.notes, 'notes', source),
    };
    return exam;
};

export const parseExamData = (value: unknown, source = 'exams.json'): Exam[] => {
    if (!Array.isArray(value) || value.length === 0) {
        throw new ExamSnapshotContractError(`${source}: records must be a non-empty array`);
    }
    const exams = value.map((entry, index) => parseExam(entry, `${source}[${index}]`));
    if (new Set(exams.map(exam => exam.id)).size !== exams.length) {
        throw new ExamSnapshotContractError(`${source}: duplicate exam id`);
    }
    return exams;
};

export const parseExamSnapshotManifest = (
    value: unknown,
    source = 'manifest.json'
): ExamSnapshotManifest => {
    if (!isObject(value) || !hasExactKeys(value, [
        'format',
        'snapshot_id',
        'source_id',
        'records_id',
        'source_updated_at',
        'source_url',
        'source_title',
        'exam_period',
        'total_records',
        'records',
        'class_index',
        'class_chunks',
    ]) || value.format !== 'njupt-exam-snapshot') {
        throw new ExamSnapshotContractError(`${source}: incompatible ExamSnapshot format`);
    }
    if (!isObject(value.exam_period) || !hasExactKeys(value.exam_period, [
        'id',
        'academic_year',
        'term_number',
        'term_label',
    ])) {
        throw new ExamSnapshotContractError(`${source}: exam_period must be an object`);
    }
    const periodId = requireString(value.exam_period.id, 'exam_period.id', source);
    if (!PERIOD_RE.test(periodId)) {
        throw new ExamSnapshotContractError(`${source}: invalid exam_period.id`);
    }
    if (!Array.isArray(value.class_chunks) || value.class_chunks.length === 0) {
        throw new ExamSnapshotContractError(`${source}: class_chunks must be non-empty`);
    }
    const records = parseArtifact(value.records, `${source}.records`);
    const classIndex = parseArtifact(value.class_index, `${source}.class_index`);
    const classChunks = value.class_chunks.map(
        (item, index) => parseArtifact(item, `${source}.class_chunks[${index}]`)
    );
    if (
        records.path !== 'exams.json'
        || classIndex.path !== 'class-index.json'
        || classChunks.some((item, index) => (
            item.path !== `classes-${index.toString().padStart(3, '0')}.json`
        ))
        || new Set(classChunks.map(item => item.path)).size !== classChunks.length
    ) {
        throw new ExamSnapshotContractError(`${source}: invalid artifact paths`);
    }
    return {
        format: 'njupt-exam-snapshot',
        snapshot_id: requireHash(value.snapshot_id, 'snapshot_id', source),
        source_id: requireHash(value.source_id, 'source_id', source),
        records_id: requireHash(value.records_id, 'records_id', source),
        source_updated_at: parseTimestamp(value.source_updated_at, 'source_updated_at', source),
        source_url: value.source_url == null ? null : requireString(value.source_url, 'source_url', source),
        source_title: value.source_title == null ? null : requireString(value.source_title, 'source_title', source),
        exam_period: {
            id: periodId,
            academic_year: requireString(value.exam_period.academic_year, 'exam_period.academic_year', source),
            term_number: requireInteger(value.exam_period.term_number, 'exam_period.term_number', source, 1),
            term_label: requireString(value.exam_period.term_label, 'exam_period.term_label', source),
        },
        total_records: requireInteger(value.total_records, 'total_records', source, 1),
        records,
        class_index: classIndex,
        class_chunks: classChunks,
    };
};

export const parseExamClassIndex = (
    value: unknown,
    source = 'class-index.json'
): ExamClassIndex => {
    if (!isObject(value) || !hasExactKeys(value, [
        'format',
        'records_id',
        'total_records',
        'class_count',
        'classes',
    ]) || value.format !== 'njupt-exam-class-index' || !Array.isArray(value.classes)) {
        throw new ExamSnapshotContractError(`${source}: incompatible class index`);
    }
    const classes = value.classes.map((entry, index): ExamClassIndexEntry => {
        const entrySource = `${source}.classes[${index}]`;
        if (!isObject(entry) || !hasExactKeys(entry, [
            'class_name',
            'class_key',
            'record_count',
            'chunk_path',
            'chunk_id',
        ])) {
            throw new ExamSnapshotContractError(`${entrySource}: entry must be an object`);
        }
        return {
            class_name: requireString(entry.class_name, 'class_name', entrySource),
            class_key: requireString(entry.class_key, 'class_key', entrySource),
            record_count: requireInteger(entry.record_count, 'record_count', entrySource, 1),
            chunk_path: requireString(entry.chunk_path, 'chunk_path', entrySource),
            chunk_id: requireHash(entry.chunk_id, 'chunk_id', entrySource),
        };
    });
    const classCount = requireInteger(value.class_count, 'class_count', source, 1);
    if (
        classCount !== classes.length
        || new Set(classes.map(item => item.class_name)).size !== classes.length
        || new Set(classes.map(item => item.class_key)).size !== classes.length
    ) {
        throw new ExamSnapshotContractError(`${source}: class count or identity mismatch`);
    }
    return {
        format: 'njupt-exam-class-index',
        records_id: requireHash(value.records_id, 'records_id', source),
        total_records: requireInteger(value.total_records, 'total_records', source, 1),
        class_count: classCount,
        classes,
    };
};

export const parseExamClassChunk = (
    value: unknown,
    source = 'class chunk'
): ExamClassChunk => {
    if (!isObject(value) || !hasExactKeys(value, [
        'format',
        'records_id',
        'chunk_id',
        'classes',
    ]) || value.format !== 'njupt-exam-class-chunk' || !isObject(value.classes)) {
        throw new ExamSnapshotContractError(`${source}: incompatible class chunk`);
    }
    if (Object.keys(value.classes).length === 0) {
        throw new ExamSnapshotContractError(`${source}: class chunk is empty`);
    }
    const classes: Record<string, ExamClassChunkEntry> = {};
    for (const [classKey, rawEntry] of Object.entries(value.classes)) {
        if (
            !isObject(rawEntry)
            || !hasExactKeys(rawEntry, ['class_name', 'exams'])
            || !Array.isArray(rawEntry.exams)
        ) {
            throw new ExamSnapshotContractError(`${source}: invalid class ${classKey}`);
        }
        const className = requireString(rawEntry.class_name, 'class_name', `${source}.${classKey}`);
        const exams = parseExamData(rawEntry.exams, `${source}.${classKey}.exams`);
        if (exams.some(exam => exam.class_name !== className)) {
            throw new ExamSnapshotContractError(`${source}: class record mismatch for ${className}`);
        }
        classes[classKey] = { class_name: className, exams };
    }
    return {
        format: 'njupt-exam-class-chunk',
        records_id: requireHash(value.records_id, 'records_id', source),
        chunk_id: requireHash(value.chunk_id, 'chunk_id', source),
        classes,
    };
};

const digestHex = async (value: string): Promise<string> => {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

export const examSnapshotIdentityText = (manifest: ExamSnapshotManifest): string => {
    const artifacts = [...[manifest.records, manifest.class_index, ...manifest.class_chunks]]
        .sort((left, right) => left.path.localeCompare(right.path));
    const parts = [manifest.format, manifest.source_id, manifest.records_id];
    for (const artifact of artifacts) {
        parts.push(artifact.path, String(artifact.bytes), artifact.sha256);
    }
    return `${parts.join('\0')}\0`;
};

export const assertExamSnapshotIdentity = async (
    manifest: ExamSnapshotManifest
): Promise<void> => {
    if (await digestHex(examSnapshotIdentityText(manifest)) !== manifest.snapshot_id) {
        throw new ExamSnapshotContractError('ExamSnapshot identity mismatch');
    }
};

export const assertClassIndexMatchesManifest = (
    manifest: ExamSnapshotManifest,
    index: ExamClassIndex
): void => {
    if (index.records_id !== manifest.records_id || index.total_records !== manifest.total_records) {
        throw new ExamSnapshotContractError('class index does not match ExamSnapshot');
    }
    const paths = new Set(manifest.class_chunks.map(artifact => artifact.path));
    if (index.classes.some(entry => !paths.has(entry.chunk_path))) {
        throw new ExamSnapshotContractError('class index references an unknown chunk');
    }
};

export const selectClassFromChunk = (
    manifest: ExamSnapshotManifest,
    entry: ExamClassIndexEntry,
    chunk: ExamClassChunk
): Exam[] => {
    if (chunk.records_id !== manifest.records_id || chunk.chunk_id !== entry.chunk_id) {
        throw new ExamSnapshotContractError(`class chunk identity mismatch for ${entry.class_name}`);
    }
    const selected = chunk.classes[entry.class_key];
    if (!selected || selected.class_name !== entry.class_name || selected.exams.length !== entry.record_count) {
        throw new ExamSnapshotContractError(`class chunk mapping mismatch for ${entry.class_name}`);
    }
    return selected.exams;
};
