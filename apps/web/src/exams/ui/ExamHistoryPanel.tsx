import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { summarizeExamHistoryChange } from '@njupt-search/academics-exam/history';
import type {
    ExamClassHistory,
    ExamClassIndex,
    ExamHistoryChange,
    ExamHistoryTimelineNode,
} from '@njupt-search/academics-exam/records';

interface ExamHistoryPanelProps {
    classIndex: ExamClassIndex | null;
    classHistory: ExamClassHistory | null;
    className?: string | null;
    loading?: boolean;
    error?: string | null;
}

const formatTime = (value?: string | null): string => {
    if (!value) return '未知';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
};

const statusText = (status: ExamHistoryTimelineNode['status']): string => {
    switch (status) {
        case 'first_seen':
            return '初次发布';
        case 'changed':
            return '本班变化';
        case 'unchanged':
            return '本班无变化';
        case 'removed':
            return '本班移除';
        case 'reappeared':
            return '重新出现';
    }
};

const statusDotClass = (status: ExamHistoryTimelineNode['status']): string => {
    switch (status) {
        case 'first_seen':
            return 'bg-[#34a853] ring-[#d7f0df] dark:ring-[#143820]';
        case 'changed':
            return 'bg-[#1a73e8] ring-[#d2e3fc] dark:ring-[#1f2d4d]';
        case 'unchanged':
            return 'bg-[#9aa0a6] ring-[#f1f3f4] dark:ring-[#303134]';
        case 'removed':
            return 'bg-[#d93025] ring-[#fce8e6] dark:ring-[#3b1715]';
        case 'reappeared':
            return 'bg-[#a142f4] ring-[#f3e8fd] dark:ring-[#332040]';
    }
};

const statusBadgeClass = (status: ExamHistoryTimelineNode['status']): string => {
    switch (status) {
        case 'first_seen':
            return 'bg-[#e6f4ea] text-[#137333] dark:bg-[#143820] dark:text-[#81c995]';
        case 'changed':
            return 'bg-[#e8f0fe] text-[#1967d2] dark:bg-[#1f2d4d] dark:text-[#8ab4f8]';
        case 'unchanged':
            return 'bg-[#f1f3f4] text-[#5f6368] dark:bg-[#303134] dark:text-[#bdc1c6]';
        case 'removed':
            return 'bg-[#fce8e6] text-[#b3261e] dark:bg-[#3b1715] dark:text-[#f28b82]';
        case 'reappeared':
            return 'bg-[#f3e8fd] text-[#8430ce] dark:bg-[#332040] dark:text-[#d7aefb]';
    }
};

const changeTypeText = (change: ExamHistoryChange): string => {
    if (change.type === 'added') return '新增';
    if (change.type === 'removed') return '删除';
    return '修改';
};

const changeBadgeClass = (change: ExamHistoryChange): string => {
    if (change.type === 'added') return 'bg-[#e6f4ea] text-[#137333] dark:bg-[#143820] dark:text-[#81c995]';
    if (change.type === 'removed') return 'bg-[#fce8e6] text-[#b3261e] dark:bg-[#3b1715] dark:text-[#f28b82]';
    return 'bg-[#e8f0fe] text-[#1967d2] dark:bg-[#1f2d4d] dark:text-[#8ab4f8]';
};

const getExpansionStorageKey = (examPeriodId: string, classKey: string, dataVersion: string): string => {
    return `njupt-search:exam-history-timeline-expanded:${examPeriodId}:${classKey}:${dataVersion}`;
};

function ChangeSummaries({ change }: { change: ExamHistoryChange }) {
    const summaries = summarizeExamHistoryChange(change);
    if (!summaries.length) return null;
    return (
        <ul className="mt-2 grid gap-1 text-[13px] text-[#3c4043] dark:text-[#e8eaed]">
            {summaries.map((summary) => (
                <li key={summary}>{summary}</li>
            ))}
        </ul>
    );
}

function ChangeList({ node }: { node: ExamHistoryTimelineNode }) {
    if (node.status === 'first_seen') {
        return (
            <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
                本班首次出现在考试记录中，当时收录 {node.totals.current_records} 门考试。
            </p>
        );
    }

    if (node.status === 'unchanged') {
        return (
            <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
                本次更新未改变本班考试安排。
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {node.changes.map((change, index) => (
                <div
                    key={`${node.data_version}-${change.type}-${change.identity_key}-${index}`}
                    className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 dark:border-[#3c4043] dark:bg-[#202124]"
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${changeBadgeClass(change)}`}>
                            {changeTypeText(change)}
                        </span>
                        <span className="font-medium text-[#202124] dark:text-[#e8eaed]">{change.course_name}</span>
                        {change.teacher ? <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">{change.teacher}</span> : null}
                        {change.course_code ? <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">{change.course_code}</span> : null}
                    </div>
                    <ChangeSummaries change={change} />
                </div>
            ))}
        </div>
    );
}

function TimelineNodeCard({ classHistory, node }: { classHistory: ExamClassHistory; node: ExamHistoryTimelineNode }) {
    const expansionKey = getExpansionStorageKey(classHistory.exam_period_id, classHistory.class_key, node.data_version);
    const [expansionOverrides, setExpansionOverrides] = useState<Record<string, boolean>>({});
    const expanded = expansionOverrides[expansionKey] ?? (
        typeof window !== 'undefined' && window.localStorage.getItem(expansionKey) === 'expanded'
    );

    const toggleExpanded = () => {
        const next = !expanded;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(expansionKey, next ? 'expanded' : 'collapsed');
        }
        setExpansionOverrides(previous => ({ ...previous, [expansionKey]: next }));
    };

    return (
        <li className="relative pl-8">
            <span
                className={`absolute left-0 top-3 h-3 w-3 rounded-full ring-4 ${statusDotClass(node.status)}`}
                aria-hidden="true"
            />
            <button
                type="button"
                onClick={toggleExpanded}
                className="w-full rounded-lg border border-[#dadce0] bg-white px-3 py-3 text-left transition hover:border-[#1a73e8] hover:bg-[#f8fbff] dark:border-[#3c4043] dark:bg-[#202124] dark:hover:border-[#8ab4f8] dark:hover:bg-[#242b35]"
            >
                <div className="flex flex-wrap items-center gap-2">
                    {expanded ? <ChevronDown className="h-4 w-4 text-[#5f6368]" /> : <ChevronRight className="h-4 w-4 text-[#5f6368]" />}
                    <span className="text-[13px] font-medium text-[#202124] dark:text-[#e8eaed]">
                        {formatTime(node.auto_updated_at)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${statusBadgeClass(node.status)}`}>
                        {statusText(node.status)}
                    </span>
                    {node.status === 'changed' ? (
                        <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
                            {node.totals.changed} 修改 / {node.totals.added} 新增 / {node.totals.removed} 删除
                        </span>
                    ) : null}
                </div>
            </button>
            {expanded ? (
                <div className="mt-2 rounded-lg border border-[#dadce0] bg-[#f8fbff] px-3 py-3 dark:border-[#3c4043] dark:bg-[#202124]">
                    <ChangeList node={node} />
                </div>
            ) : null}
        </li>
    );
}

function ClassHistoryContent({ classHistory }: { classHistory: ExamClassHistory }) {
    const affectedCount = classHistory.timeline.filter(node => node.status !== 'unchanged').length;

    return (
        <div className="rounded-xl border border-[#dadce0] bg-[#f8fbff] px-4 py-3 dark:border-[#3c4043] dark:bg-[#202124]">
            <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#1a73e8]" aria-hidden="true" />
                <span className="text-[14px] font-medium text-[#202124] dark:text-[#e8eaed]">
                    本班考试历史
                </span>
                <span className="rounded-full bg-[#f1f3f4] px-2 py-0.5 text-[12px] font-medium text-[#5f6368] dark:bg-[#303134] dark:text-[#bdc1c6]">
                    共 {classHistory.timeline.length} 次更新，{affectedCount} 次影响本班
                </span>
            </div>
            <p className="mt-2 text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
                考试周期：{classHistory.academic_year}学年{classHistory.term_label}
            </p>
            <ol className="relative mt-4 space-y-3 before:absolute before:left-[5px] before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-[#dadce0] dark:before:bg-[#3c4043]">
                {classHistory.timeline.map(node => (
                    <TimelineNodeCard
                        key={`${node.status}-${node.data_version}`}
                        classHistory={classHistory}
                        node={node}
                    />
                ))}
            </ol>
        </div>
    );
}

export function ExamHistoryPanel({
    classIndex,
    classHistory,
    className,
    loading = false,
    error = null,
}: ExamHistoryPanelProps) {
    if (loading) {
        return (
            <div className="rounded-xl border border-[#dadce0] bg-white/80 px-4 py-3 text-[14px] text-[#5f6368] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#9aa0a6]">
                正在读取考试历史...
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-[#f4c7c3] bg-[#fce8e6] px-4 py-3 text-[14px] text-[#b3261e] dark:border-[#5f2b26] dark:bg-[#2b1715] dark:text-[#f28b82]">
                {error}
            </div>
        );
    }

    if (!className) {
        if (!classIndex) return null;
        return (
            <div className="rounded-xl border border-[#dadce0] bg-[#f8fbff] px-4 py-3 dark:border-[#3c4043] dark:bg-[#202124]">
                <div className="flex items-center gap-2 text-[14px] font-medium text-[#202124] dark:text-[#e8eaed]">
                    <span className="h-2 w-2 rounded-full bg-[#1a73e8]" aria-hidden="true" />
                    考试安排更新摘要
                </div>
                <p className="mt-2 text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
                    考试周期：{classIndex.academic_year}学年{classIndex.term_label}，更新时间：{formatTime(classIndex.generated_at)}，覆盖 {classIndex.class_count} 个班级、{classIndex.total_records} 条记录。
                </p>
            </div>
        );
    }

    if (!classHistory) {
        return (
            <div className="rounded-xl border border-[#dadce0] bg-white px-4 py-3 text-[14px] text-[#5f6368] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#9aa0a6]">
                暂无 {className} 的考试历史链。
            </div>
        );
    }

    return <ClassHistoryContent classHistory={classHistory} />;
}
