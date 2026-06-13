import { useMemo, useState } from 'react';
import { summarizeExamHistoryChange } from '@njupt-search/exam-core/history';
import type {
    ExamClassHistory,
    ExamHistoryChange,
    ExamHistoryCheckpoint,
    ExamHistoryManifest,
} from '@/shared/lib/contracts';

interface ExamHistoryPanelProps {
    manifest: ExamHistoryManifest | null;
    classHistory: ExamClassHistory | null;
    className?: string | null;
    loading?: boolean;
    error?: string | null;
}

const materialStatus = new Set(['first_seen', 'changed', 'removed', 'reappeared']);

const formatTime = (value?: string | null): string => {
    if (!value) return '未知';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
};

const statusText = (checkpoint: ExamHistoryCheckpoint | null): string => {
    if (!checkpoint) return '暂无历史快照';
    if (checkpoint.status === 'first_seen') return '教务系统初次发布';
    if (checkpoint.status === 'unchanged') return '相对上一次自动更新时间无实质变化';
    if (checkpoint.status === 'removed') return '本班在当前快照中已移除';
    return '相对上一次自动更新时间有变化';
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

const getExpansionStorageKey = (classKey: string, dataVersion: string): string => {
    return `njupt-search:exam-history-expanded:${classKey}:${dataVersion}`;
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

function ChangeList({ checkpoint }: { checkpoint: ExamHistoryCheckpoint }) {
    if (checkpoint.status === 'first_seen') {
        return (
            <p className="mt-2 text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
                本班在系统可回溯教务快照中首次出现，当前收录 {checkpoint.totals.current_records} 门考试。
            </p>
        );
    }
    if (!checkpoint.changes.length) return null;
    const visibleChanges = checkpoint.changes.slice(0, 8);
    return (
        <div className="mt-3 space-y-2">
            {visibleChanges.map((change, index) => (
                <div
                    key={`${change.type}-${change.course_name}-${change.teacher || ''}-${change.before_id || change.after_id || index}`}
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
            {checkpoint.changes.length > visibleChanges.length ? (
                <p className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
                    另有 {checkpoint.changes.length - visibleChanges.length} 条变化未展开。
                </p>
            ) : null}
        </div>
    );
}

function ClassHistoryContent({ classHistory }: { classHistory: ExamClassHistory }) {
    const currentCheckpoint = classHistory.checkpoints[classHistory.checkpoints.length - 1] || null;
    const latestMaterialCheckpoint = useMemo(() => [...classHistory.checkpoints]
        .reverse()
        .find(checkpoint => materialStatus.has(checkpoint.status)) || currentCheckpoint, [classHistory.checkpoints, currentCheckpoint]);
    const currentHasChange = currentCheckpoint?.status && currentCheckpoint.status !== 'unchanged';
    const expansionKey = latestMaterialCheckpoint
        ? getExpansionStorageKey(classHistory.class_key, latestMaterialCheckpoint.data_version)
        : null;
    const [expansionOverrides, setExpansionOverrides] = useState<Record<string, boolean>>({});
    const expanded = expansionKey
        ? expansionOverrides[expansionKey] ?? window.localStorage.getItem(expansionKey) !== 'collapsed'
        : true;

    const toggleExpanded = () => {
        if (!expansionKey) return;
        const next = !expanded;
        window.localStorage.setItem(expansionKey, next ? 'expanded' : 'collapsed');
        setExpansionOverrides(previous => ({ ...previous, [expansionKey]: next }));
    };

    return (
        <div className="rounded-xl border border-[#dadce0] bg-[#f8fbff] px-4 py-3 dark:border-[#3c4043] dark:bg-[#202124]">
            <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#1a73e8]" aria-hidden="true" />
                <span className="text-[14px] font-medium text-[#202124] dark:text-[#e8eaed]">
                    本班考试历史
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${currentHasChange ? 'bg-[#e8f0fe] text-[#1967d2] dark:bg-[#1f2d4d] dark:text-[#8ab4f8]' : 'bg-[#f1f3f4] text-[#5f6368] dark:bg-[#303134] dark:text-[#bdc1c6]'}`}>
                    {statusText(currentCheckpoint)}
                </span>
                {latestMaterialCheckpoint && latestMaterialCheckpoint.changes.length > 0 ? (
                    <button
                        type="button"
                        onClick={toggleExpanded}
                        className="rounded-full border border-[#dadce0] px-2 py-0.5 text-[12px] text-[#1a73e8] transition hover:bg-white dark:border-[#5f6368] dark:text-[#8ab4f8] dark:hover:bg-[#303134]"
                    >
                        {expanded ? '收起变化' : '展开变化'}
                    </button>
                ) : null}
            </div>
            <p className="mt-2 text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
                当前自动更新时间：{formatTime(classHistory.latest_auto_updated_at)}
                {currentCheckpoint?.previous_auto_updated_at ? `；上一次自动更新时间：${formatTime(currentCheckpoint.previous_auto_updated_at)}` : ''}
            </p>
            <p className="mt-1 text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
                最近一次实质变化：{latestMaterialCheckpoint?.status === 'first_seen' ? '教务系统初次发布' : formatTime(classHistory.latest_substantive_change.auto_updated_at)}
            </p>
            {expanded && latestMaterialCheckpoint ? <ChangeList checkpoint={latestMaterialCheckpoint} /> : null}
        </div>
    );
}

export function ExamHistoryPanel({
    manifest,
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

    if (!manifest) return null;

    if (!className) {
        return (
            <div className="rounded-xl border border-[#dadce0] bg-[#f8fbff] px-4 py-3 dark:border-[#3c4043] dark:bg-[#202124]">
                <div className="flex items-center gap-2 text-[14px] font-medium text-[#202124] dark:text-[#e8eaed]">
                    <span className="h-2 w-2 rounded-full bg-[#1a73e8]" aria-hidden="true" />
                    考试安排自动更新摘要
                </div>
                <p className="mt-2 text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
                    当前自动更新时间：{formatTime(manifest.latest_auto_updated_at)}；可回溯 {manifest.totals.snapshot_count} 个教务快照，覆盖 {manifest.totals.current_class_count} 个当前班级。
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
