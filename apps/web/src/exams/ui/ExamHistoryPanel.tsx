import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type {
    ExamClassHistory,
    ExamClassHistoryEvent,
    ExamHistoryChange,
    ExamHistoryFieldChange,
    ExamHistoryValue,
} from '@njupt-search/academics-exam/history';

interface ExamHistoryPanelProps {
    history: ExamClassHistory | null;
    className: string;
    loading: boolean;
    error: string | null;
}

const fieldLabels: Record<string, string> = {
    teacher: '教师',
    campus: '校区',
    location: '考试地点',
    raw_time: '考试时间',
    count: '考试人数',
    start_timestamp: '开始时间',
    end_timestamp: '结束时间',
    duration_minutes: '考试时长',
    date: '考试日期',
    notes: '备注',
};
const formatTime = (value: string): string => new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});
const formatValue = (field: string, value: ExamHistoryValue): string => {
    if (value === null || value === '') return '未填写';
    if (Array.isArray(value)) return value.map(item => formatValue(field, item)).join('、');
    if (field === 'count') return `${value} 人`;
    if (field === 'duration_minutes') return `${value} 分钟`;
    if ((field === 'start_timestamp' || field === 'end_timestamp') && typeof value === 'string') {
        return formatTime(value);
    }
    return String(value);
};
const fieldSummary = (field: ExamHistoryFieldChange): string => (
    `${fieldLabels[field.field] ?? field.field}由${formatValue(field.field, field.before)}调整为${formatValue(field.field, field.after)}`
);

const visibleFieldChanges = (change: ExamHistoryChange): ExamHistoryFieldChange[] => {
    const hasRawTime = change.fields.some(field => field.field === 'raw_time');
    if (!hasRawTime) return change.fields;
    return change.fields.filter(field => ![
        'start_timestamp', 'end_timestamp', 'duration_minutes', 'date',
    ].includes(field.field));
};

function ChangeCard({ change }: { change: ExamHistoryChange }) {
    const label = change.type === 'added' ? '新增' : change.type === 'removed' ? '记录已移除' : '调整';
    const color = change.type === 'added'
        ? 'bg-[#e6f4ea] text-[#137333] dark:bg-[#143820] dark:text-[#81c995]'
        : change.type === 'removed'
            ? 'bg-[#fce8e6] text-[#b3261e] dark:bg-[#3b1715] dark:text-[#f28b82]'
            : 'bg-[#e8f0fe] text-[#1967d2] dark:bg-[#1f2d4d] dark:text-[#8ab4f8]';
    return (
        <li className="rounded-lg border border-[#dadce0] bg-white px-3 py-3 dark:border-[#3c4043] dark:bg-[#202124]">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${color}`}>{label}</span>
                <span className="font-medium text-[#202124] dark:text-[#e8eaed]">{change.course_name}</span>
                <span className="text-[12px] text-[#70757a] dark:text-[#9aa0a6]">{change.course_code}</span>
            </div>
            <ul className="mt-2 space-y-1 text-[13px] text-[#4d5156] dark:text-[#bdc1c6]">
                {visibleFieldChanges(change).map(field => (
                    <li key={field.field}>{fieldSummary(field)}。</li>
                ))}
            </ul>
        </li>
    );
}

const eventLabel = (event: ExamClassHistoryEvent): string => {
    if (event.previous_snapshot_id === null) return '开始记录';
    if (event.status === 'first_seen') return '首次出现';
    if (event.status === 'removed') return '记录已移除';
    if (event.status === 'reappeared') return '重新出现';
    return '有调整';
};

function HistoryEvent({ event, defaultExpanded }: { event: ExamClassHistoryEvent; defaultExpanded: boolean }) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    return (
        <li className="rounded-lg border border-[#dadce0] dark:border-[#3c4043]">
            <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded(value => !value)}
                className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-[#f8f9fa] dark:hover:bg-[#303134]"
            >
                {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                <span className="text-[14px] font-medium">{formatTime(event.source_updated_at)}</span>
                <span className="rounded-full bg-[#f1f3f4] px-2 py-0.5 text-[12px] text-[#5f6368] dark:bg-[#303134] dark:text-[#bdc1c6]">{eventLabel(event)}</span>
            </button>
            {expanded ? (
                <div className="border-t border-[#dadce0] bg-[#f8fbff] px-3 py-3 dark:border-[#3c4043] dark:bg-[#252629]">
                    {event.previous_snapshot_id === null ? (
                        <p className="text-[13px] text-[#5f6368] dark:text-[#bdc1c6]">从这次考试安排开始记录后续变化。</p>
                    ) : (
                        <ul className="space-y-2">{event.changes.map(change => <ChangeCard key={`${change.type}-${change.history_key}`} change={change} />)}</ul>
                    )}
                </div>
            ) : null}
        </li>
    );
}

export function ExamHistoryPanel({ history, className, loading, error }: ExamHistoryPanelProps) {
    return (
        <section className="mt-6" aria-labelledby="exam-history-title">
            <h2 id="exam-history-title" className="text-[22px] font-normal text-[#202124] dark:text-[#e8eaed]">考试安排更新记录</h2>
            {loading ? <p className="mt-3 text-[14px] text-[#70757a] dark:text-[#9aa0a6]">正在读取 {className} 的更新记录…</p> : null}
            {error ? <p className="mt-3 text-[14px] text-[#b3261e] dark:text-[#f28b82]">{error}</p> : null}
            {!loading && !error && !history ? <p className="mt-3 text-[14px] text-[#70757a] dark:text-[#9aa0a6]">暂时没有这个班级的更新记录。</p> : null}
            {history ? (
                <div className="mt-3 rounded-xl border border-[#dadce0] bg-[#f8fafc] p-4 dark:border-[#3c4043] dark:bg-[#2d2e30]">
                    <p className="text-[14px] text-[#4d5156] dark:text-[#bdc1c6]">
                        系统共更新 {history.observed_snapshot_count} 次，其中 {history.affected_event_count} 次影响本班。
                    </p>
                    {history.latest_affected_at ? (
                        <p className="mt-1 text-[13px] text-[#70757a] dark:text-[#9aa0a6]">最近一次影响本班：{formatTime(history.latest_affected_at)}。</p>
                    ) : (
                        <p className="mt-1 text-[13px] text-[#70757a] dark:text-[#9aa0a6]">从本次考试安排开始记录，暂时还没有后续变化。</p>
                    )}
                    <ol className="mt-4 space-y-2">
                        {[...history.events].reverse().map((event, index) => (
                            <HistoryEvent key={event.snapshot_id} event={event} defaultExpanded={index === 0 && history.affected_event_count > 0} />
                        ))}
                    </ol>
                </div>
            ) : null}
        </section>
    );
}
