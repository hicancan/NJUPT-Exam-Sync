import type {
    Exam,
    ExamClassData,
    ExamClassIndex,
    ExamClassIndexEntry,
    Manifest
} from '@njupt-search/contracts/exam';

export type {
    Exam,
    ExamClassData,
    ExamClassIndex,
    ExamClassIndexEntry,
    Manifest
} from '@njupt-search/contracts/exam';

export class DataContractError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DataContractError';
    }
}

const SHA256_RE = /^[a-f0-9]{64}$/;
const PERIOD_RE = /^\d{4}-\d{4}-[1-4]$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const requireString = (item: Record<string, unknown>, field: string, source: string): string => {
    const value = item[field];
    if (typeof value !== 'string' || value.length === 0) {
        throw new DataContractError(`Validation failed for ${source}: ${field} must be a non-empty string`);
    }
    return value;
};

const requireNumber = (item: Record<string, unknown>, field: string, source: string): number => {
    const value = item[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new DataContractError(`Validation failed for ${source}: ${field} must be a finite number`);
    }
    return value;
};

const requireInt = (item: Record<string, unknown>, field: string, source: string): number => {
    const value = requireNumber(item, field, source);
    if (!Number.isInteger(value)) {
        throw new DataContractError(`Validation failed for ${source}: ${field} must be an integer`);
    }
    return value;
};

const requireStringArray = (item: Record<string, unknown>, field: string, source: string): string[] => {
    const value = item[field];
    if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || entry.length === 0)) {
        throw new DataContractError(`Validation failed for ${source}: ${field} must be a non-empty string array`);
    }
    return value as string[];
};

const requireTimestamp = (item: Record<string, unknown>, field: string, source: string): string => {
    const value = requireString(item, field, source);
    if (Number.isNaN(Date.parse(value))) {
        throw new DataContractError(`Validation failed for ${source}: ${field} must be a valid timestamp`);
    }
    return value;
};

const validateExam = (payload: unknown, source: string): Exam => {
    if (!isPlainObject(payload)) {
        throw new DataContractError(`Validation failed for ${source}: exam entry must be an object`);
    }
    const exam = payload;
    const contentFingerprint = requireString(exam, 'content_fingerprint', source);
    if (!SHA256_RE.test(contentFingerprint)) {
        throw new DataContractError(`Validation failed for ${source}: content_fingerprint must be a SHA-256 hex string`);
    }
    const examPeriodId = requireString(exam, 'exam_period_id', source);
    if (!PERIOD_RE.test(examPeriodId)) {
        throw new DataContractError(`Validation failed for ${source}: exam_period_id is invalid`);
    }
    const duplicateCount = requireInt(exam, 'duplicate_count', source);
    if (duplicateCount <= 0) {
        throw new DataContractError(`Validation failed for ${source}: duplicate_count must be positive`);
    }
    const count = requireInt(exam, 'count', source);
    if (count < 0) {
        throw new DataContractError(`Validation failed for ${source}: count must be non-negative`);
    }
    const durationMinutes = requireNumber(exam, 'duration_minutes', source);
    if (durationMinutes <= 0) {
        throw new DataContractError(`Validation failed for ${source}: duration_minutes must be positive`);
    }
    requireString(exam, 'id', source);
    requireString(exam, 'stable_key', source);
    requireString(exam, 'class_name', source);
    requireString(exam, 'course_name', source);
    requireString(exam, 'course_code', source);
    requireString(exam, 'teacher', source);
    requireString(exam, 'campus', source);
    requireString(exam, 'location', source);
    requireString(exam, 'raw_time', source);
    requireTimestamp(exam, 'start_timestamp', source);
    requireTimestamp(exam, 'end_timestamp', source);
    return exam as unknown as Exam;
};

export const parseExamData = (payload: unknown, source = 'exam data'): Exam[] => {
    if (!Array.isArray(payload)) {
        throw new DataContractError(`Validation failed for ${source}: payload must be an array`);
    }
    const ids = new Set<string>();
    const exams = payload.map((item, index) => validateExam(item, `${source}[${index}]`));
    for (const item of exams) {
        if (ids.has(item.id)) {
            throw new DataContractError(`${source} contains duplicate id: ${item.id}`);
        }
        ids.add(item.id);
    }
    return exams;
};

export const parseManifest = (payload: unknown, source = 'data summary'): Manifest => {
    if (!isPlainObject(payload)) {
        throw new DataContractError(`Validation failed for ${source}: payload must be an object`);
    }
    const dataVersion = requireString(payload, 'data_version', source);
    if (!SHA256_RE.test(dataVersion)) {
        throw new DataContractError(`Validation failed for ${source}: data_version must be a SHA-256 hex string`);
    }
    const examPeriodId = requireString(payload, 'exam_period_id', source);
    if (!PERIOD_RE.test(examPeriodId)) {
        throw new DataContractError(`Validation failed for ${source}: exam_period_id is invalid`);
    }
    requireTimestamp(payload, 'generated_at', source);
    requireString(payload, 'academic_year', source);
    requireInt(payload, 'term_number', source);
    requireString(payload, 'term_label', source);
    requireStringArray(payload, 'files_processed', source);
    const totalRecords = requireInt(payload, 'total_records', source);
    if (totalRecords < 0) {
        throw new DataContractError(`Validation failed for ${source}: total_records must be non-negative`);
    }
    return payload as unknown as Manifest;
};

export const parseExamClassIndex = (payload: unknown, source = 'exam class index'): ExamClassIndex => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new DataContractError(`Validation failed for ${source}: payload must be an object`);
    }
    const value = payload as Partial<ExamClassIndex>;
    if (value.version !== 'exam-class-index-v1') throw new DataContractError(`Validation failed for ${source}: invalid version`);
    if (typeof value.data_version !== 'string' || !SHA256_RE.test(value.data_version)) throw new DataContractError(`Validation failed for ${source}: invalid data_version`);
    if (typeof value.exam_period_id !== 'string' || !PERIOD_RE.test(value.exam_period_id)) throw new DataContractError(`Validation failed for ${source}: invalid exam_period_id`);
    if (!Array.isArray(value.classes)) throw new DataContractError(`Validation failed for ${source}: classes must be an array`);
    if (value.class_count !== value.classes.length) throw new DataContractError(`Validation failed for ${source}: class_count mismatch`);
    const seen = new Set<string>();
    for (const item of value.classes) {
        if (!item || typeof item !== 'object') throw new DataContractError(`Validation failed for ${source}: class entry must be an object`);
        if (!item.class_name || !item.class_key) throw new DataContractError(`Validation failed for ${source}: class entry missing identity`);
        if (item.exam_period_id !== value.exam_period_id) throw new DataContractError(`Validation failed for ${source}: class entry exam_period_id mismatch`);
        if (!/^generated\/exam\/classes\/[^/]+\.json$/.test(item.path)) throw new DataContractError(`Validation failed for ${source}: invalid class data path`);
        if (!/^generated\/exam\/history\/classes\/[^/]+\.json$/.test(item.history_path)) throw new DataContractError(`Validation failed for ${source}: invalid class history path`);
        if (seen.has(item.class_key)) throw new DataContractError(`Validation failed for ${source}: duplicate class_key ${item.class_key}`);
        seen.add(item.class_key);
    }
    return value as ExamClassIndex;
};

export const parseExamClassData = (payload: unknown, source = 'exam class data'): ExamClassData => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new DataContractError(`Validation failed for ${source}: payload must be an object`);
    }
    const value = payload as Partial<ExamClassData>;
    if (value.version !== 'exam-class-data-v1') throw new DataContractError(`Validation failed for ${source}: invalid version`);
    if (typeof value.data_version !== 'string' || !SHA256_RE.test(value.data_version)) throw new DataContractError(`Validation failed for ${source}: invalid data_version`);
    if (typeof value.exam_period_id !== 'string' || !PERIOD_RE.test(value.exam_period_id)) throw new DataContractError(`Validation failed for ${source}: invalid exam_period_id`);
    if (!value.class_name || !value.class_key) throw new DataContractError(`Validation failed for ${source}: missing class identity`);
    if (!Array.isArray(value.exams)) throw new DataContractError(`Validation failed for ${source}: exams must be an array`);
    const exams = parseExamData(value.exams, `${source}.exams`);
    if (value.record_count !== exams.length) throw new DataContractError(`Validation failed for ${source}: record_count mismatch`);
    for (const exam of exams) {
        if (exam.class_name !== value.class_name) throw new DataContractError(`Validation failed for ${source}: exam class_name mismatch`);
        if (exam.exam_period_id !== value.exam_period_id) throw new DataContractError(`Validation failed for ${source}: exam_period_id mismatch`);
    }
    return { ...value, exams } as ExamClassData;
};

export const resolveExamDataVersion = (manifest: Manifest): string => {
    const dataVersion = manifest.data_version.trim();
    if (!dataVersion) {
        throw new DataContractError('data_summary.data_version is required');
    }
    return dataVersion;
};

export const assertManifestMatchesExams = (manifest: Manifest, exams: Exam[]) => {
    if (manifest.total_records !== exams.length) {
        throw new DataContractError(
            `data_summary.total_records=${manifest.total_records} does not match all_exams.length=${exams.length}`
        );
    }
    for (const exam of exams) {
        if (exam.exam_period_id !== manifest.exam_period_id) {
            throw new DataContractError(
                `all_exams entry ${exam.id} has exam_period_id=${exam.exam_period_id}, expected ${manifest.exam_period_id}`
            );
        }
    }
};

export const assertClassIndexMatchesManifest = (manifest: Manifest, classIndex: ExamClassIndex) => {
    if (classIndex.data_version !== manifest.data_version) {
        throw new DataContractError('class_index.data_version does not match data_summary.data_version');
    }
    if (classIndex.exam_period_id !== manifest.exam_period_id) {
        throw new DataContractError('class_index.exam_period_id does not match data_summary.exam_period_id');
    }
    if (classIndex.total_records !== manifest.total_records) {
        throw new DataContractError('class_index.total_records does not match data_summary.total_records');
    }
};

export const assertClassDataMatchesIndex = (entry: ExamClassIndexEntry, classData: ExamClassData, dataVersion: string) => {
    if (classData.data_version !== dataVersion) {
        throw new DataContractError(`class data version mismatch for ${entry.class_name}`);
    }
    if (classData.class_key !== entry.class_key || classData.class_name !== entry.class_name) {
        throw new DataContractError(`class data identity mismatch for ${entry.class_name}`);
    }
    if (classData.record_count !== entry.record_count) {
        throw new DataContractError(`class data record_count mismatch for ${entry.class_name}`);
    }
};
