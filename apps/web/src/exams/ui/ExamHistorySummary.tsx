import type {
    ExamHistoryEvents,
    ExamHistoryManifest,
} from '@njupt-search/academics-exam/history';

interface ExamHistorySummaryProps {
    manifest: ExamHistoryManifest | null;
    events: ExamHistoryEvents | null;
    loading: boolean;
    error: string | null;
}

const formatTime = (value: string): string => new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

export function ExamHistorySummary({ manifest, events, loading, error }: ExamHistorySummaryProps) {
    if (loading) {
        return <p className="mt-4 text-center text-[13px] text-[#70757a] dark:text-[#9aa0a6]">正在读取更新记录…</p>;
    }
    if (error) {
        return <p className="mt-4 text-center text-[13px] text-[#b3261e] dark:text-[#f28b82]">{error}</p>;
    }
    const latest = events?.events[events.events.length - 1];
    if (!manifest || !latest) return null;
    return (
        <section className="mx-auto mt-4 max-w-[692px] rounded-xl border border-[#dadce0] bg-white px-4 py-4 text-left dark:border-[#3c4043] dark:bg-[#202124] sm:px-5" aria-label="考试安排更新摘要">
            <h2 className="text-[16px] font-medium text-[#202124] dark:text-[#e8eaed]">考试安排更新记录</h2>
            <p className="mt-1 text-[14px] text-[#4d5156] dark:text-[#bdc1c6]">
                考试安排更新于 {formatTime(latest.source_updated_at)}，已记录 {manifest.observed_snapshot_count} 次更新。
            </p>
            {latest.status === 'baseline' ? (
                <p className="mt-2 text-[13px] text-[#70757a] dark:text-[#9aa0a6]">从本次考试安排开始记录后续变化。</p>
            ) : latest.status === 'unchanged' ? (
                <p className="mt-2 text-[13px] text-[#70757a] dark:text-[#9aa0a6]">本次更新没有改变考试安排。</p>
            ) : (
                <p className="mt-2 text-[13px] text-[#70757a] dark:text-[#9aa0a6]">
                    本次更新涉及 {latest.affected_class_count} 个班级：新增 {latest.added} 门、调整 {latest.changed} 门、移除 {latest.removed} 条记录。
                </p>
            )}
        </section>
    );
}
