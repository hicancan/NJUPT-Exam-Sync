import {
    type ExamHistoryChange,
    type ExamClassHistory,
    type ExamHistoryFieldChange,
    type ExamHistoryManifest,
    type ExamHistoryTimelineNode,
} from '@njupt-search/contracts/exam';

const isObject = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const requireString = (item: Record<string, unknown>, field: string, source: string): string => {
    const value = item[field];
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${source} does not match exam history contract: ${field} must be a non-empty string`);
    }
    return value;
};

const requireArray = <T = unknown>(item: Record<string, unknown>, field: string, source: string): T[] => {
    const value = item[field];
    if (!Array.isArray(value)) {
        throw new Error(`${source} does not match exam history contract: ${field} must be an array`);
    }
    return value as T[];
};

const requireObject = (item: Record<string, unknown>, field: string, source: string): Record<string, unknown> => {
    const value = item[field];
    if (!isObject(value)) {
        throw new Error(`${source} does not match exam history contract: ${field} must be an object`);
    }
    return value;
};

const requireHistoryStatus = (value: unknown, source: string) => {
    if (value !== 'first_seen' && value !== 'changed' && value !== 'unchanged' && value !== 'removed' && value !== 'reappeared') {
        throw new Error(`${source} does not match exam history contract: status is invalid`);
    }
};

export const parseExamHistoryManifest = (payload: unknown, source = 'exam history manifest'): ExamHistoryManifest => {
    if (!isObject(payload)) {
        throw new Error(`${source} does not match exam history manifest contract: payload must be an object`);
    }
    if (payload.version !== 'exam-history-manifest-v1') {
        throw new Error(`${source} does not match exam history manifest contract: invalid version`);
    }
    requireString(payload, 'exam_period_id', source);
    requireString(payload, 'latest_data_version', source);
    requireString(payload, 'latest_auto_updated_at', source);
    requireArray(payload, 'snapshots', source);
    requireArray(payload, 'classes', source);
    return payload as unknown as ExamHistoryManifest;
};

export const parseExamClassHistory = (payload: unknown, source = 'exam class history'): ExamClassHistory => {
    if (!isObject(payload)) {
        throw new Error(`${source} does not match exam class history contract: payload must be an object`);
    }
    if (payload.version !== 'exam-class-history-v3') {
        throw new Error(`${source} does not match exam class history contract: invalid version`);
    }
    const examPeriodId = requireString(payload, 'exam_period_id', source);
    requireString(payload, 'class_name', source);
    requireString(payload, 'class_key', source);
    requireString(payload, 'latest_data_version', source);
    requireString(payload, 'latest_auto_updated_at', source);
    requireObject(payload, 'first_seen', source);
    const timeline = requireArray<ExamHistoryTimelineNode>(payload, 'timeline', source);
    for (const [index, node] of timeline.entries()) {
        if (!isObject(node)) {
            throw new Error(`${source} does not match exam class history contract: timeline[${index}] must be an object`);
        }
        requireString(node, 'data_version', `${source}.timeline[${index}]`);
        requireString(node, 'auto_updated_at', `${source}.timeline[${index}]`);
        if (node.exam_period_id !== examPeriodId) {
            throw new Error(`${source} does not match exam class history contract: timeline[${index}] period mismatch`);
        }
        requireHistoryStatus(node.status, `${source}.timeline[${index}]`);
        requireObject(node, 'totals', `${source}.timeline[${index}]`);
        const changes = requireArray<ExamHistoryChange>(node, 'changes', `${source}.timeline[${index}]`);
        if ((node.status === 'changed' || node.status === 'removed' || node.status === 'reappeared') && changes.length === 0) {
            throw new Error(`${source} does not match exam class history contract: timeline[${index}] changed node needs changes`);
        }
        if ((node.status === 'first_seen' || node.status === 'unchanged') && changes.length !== 0) {
            throw new Error(`${source} does not match exam class history contract: timeline[${index}] unchanged node must not contain changes`);
        }
    }
    return payload as unknown as ExamClassHistory;
};

export const formatExamHistoryValue = (field: ExamHistoryFieldChange, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '空';
    if (field.field === 'duration_minutes' && typeof value === 'number') return `${value} 分钟`;
    if ((field.field === 'start_timestamp' || field.field === 'end_timestamp') && typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString('zh-CN');
    }
    return String(value);
};

const formatClockTime = (value: unknown): string => {
    if (typeof value !== 'string') return String(value ?? '未知');
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleTimeString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const formatDateTime = (value: unknown): string => {
    if (typeof value !== 'string') return String(value ?? '未知');
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const numberValue = (value: unknown): number | null => (
    typeof value === 'number' && Number.isFinite(value) ? value : null
);

export const summarizeExamHistoryChange = (change: ExamHistoryChange): string[] => {
    if (change.type !== 'changed' || !change.fields?.length) return [];

    const byField = new Map(change.fields.map(field => [field.field, field]));
    const consumed = new Set<string>();
    const summaries: string[] = [];

    const duration = byField.get('duration_minutes');
    if (duration) {
        const before = numberValue(duration.before);
        const after = numberValue(duration.after);
        if (before !== null && after !== null) {
            const delta = after - before;
            if (delta !== 0) {
                const direction = delta > 0 ? '延长' : '缩短';
                let summary = `考试时长${direction} ${Math.abs(delta)} 分钟`;
                const end = byField.get('end_timestamp');
                if (end) {
                    const beforeEnd = typeof end.before === 'string' ? new Date(end.before).getTime() : Number.NaN;
                    const afterEnd = typeof end.after === 'string' ? new Date(end.after).getTime() : Number.NaN;
                    const endDirection = Number.isFinite(beforeEnd) && Number.isFinite(afterEnd) && afterEnd < beforeEnd
                        ? '提前'
                        : '推后';
                    summary += `，结束时间${endDirection}至 ${formatClockTime(end.after)}`;
                    consumed.add('end_timestamp');
                }
                summaries.push(summary);
                consumed.add('duration_minutes');
                consumed.add('raw_time');
            }
        }
    }

    const start = byField.get('start_timestamp');
    if (start && !consumed.has('start_timestamp')) {
        summaries.push(`开始时间调整为 ${formatDateTime(start.after)}`);
        consumed.add('start_timestamp');
        consumed.add('raw_time');
    }

    const end = byField.get('end_timestamp');
    if (end && !consumed.has('end_timestamp')) {
        summaries.push(`结束时间调整为 ${formatDateTime(end.after)}`);
        consumed.add('end_timestamp');
        consumed.add('raw_time');
    }

    const fieldSummary: Record<string, (field: ExamHistoryFieldChange) => string> = {
        location: field => `考试地点调整为 ${formatExamHistoryValue(field, field.after)}`,
        campus: field => `校区调整为 ${formatExamHistoryValue(field, field.after)}`,
        count: field => `考试人数调整为 ${formatExamHistoryValue(field, field.after)}`,
        notes: field => `备注调整为 ${formatExamHistoryValue(field, field.after)}`,
        raw_time: field => `考试时间调整为 ${formatExamHistoryValue(field, field.after)}`,
    };

    for (const field of change.fields) {
        if (consumed.has(field.field)) continue;
        const formatter = fieldSummary[field.field];
        summaries.push(formatter
            ? formatter(field)
            : `${field.label}：${formatExamHistoryValue(field, field.before)} → ${formatExamHistoryValue(field, field.after)}`);
        consumed.add(field.field);
    }

    return summaries;
};

export const countAffectedTimelineNodes = (timeline: ExamHistoryTimelineNode[]): number => {
    return timeline.filter(node => node.status !== 'unchanged').length;
};
