import { lazy, Suspense, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { buildExamCalendarFilename } from '@/features/exam-search/lib/downloadFilename';
import { generateICSContent } from '@njupt-search/exam-core/calendar';
import { Exam } from '@/shared/lib/contracts';
import type { ExamClassHistory, ExamHistoryManifest } from '@/shared/lib/contracts';
import type { ExamExportStatus } from '../model/examSelection';
import { ExamCard } from './ExamCard';
import { ReminderSettings } from './ReminderSettings';

const ExamHistoryPanel = lazy(() => import('./ExamHistoryPanel').then(module => ({ default: module.ExamHistoryPanel })));

type Notice = {
    message: string;
} | null;

interface ExamDetailProps {
    className: string;
    exams: Exam[];
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onExportComplete: (exams: Exam[]) => void;
    getExamStatus: (exam: Exam) => ExamExportStatus;
    reminders: number[];
    onRemindersChange: (reminders: number[]) => void;
    sourceUrl?: string | null;
    sourceTitle?: string | null;
    generatedAt?: string | null;
    totalRecords?: number | null;
    examHistoryManifest?: ExamHistoryManifest | null;
    examClassHistory?: ExamClassHistory | null;
    examHistoryLoading?: boolean;
    examHistoryError?: string | null;
}

export function ExamDetail({
    className,
    exams,
    selectedIds,
    onToggleSelection,
    onSelectAll,
    onClearSelection,
    onExportComplete,
    getExamStatus,
    reminders,
    onRemindersChange,
    sourceUrl,
    sourceTitle,
    generatedAt,
    totalRecords,
    examHistoryManifest,
    examClassHistory,
    examHistoryLoading = false,
    examHistoryError = null,
}: ExamDetailProps) {
    const [copyState, setCopyState] = useState<boolean>(false);
    const [notice, setNotice] = useState<Notice>(null);
    const allSelected = exams.length > 0 && selectedIds.size === exams.length;
    const noneSelected = selectedIds.size === 0;

    const showErrorNotice = (nextNotice: NonNullable<Notice>) => {
        setNotice(nextNotice);
        window.setTimeout(() => {
            setNotice(current => current?.message === nextNotice.message ? null : current);
        }, 3000);
    };

    const copyShareLink = () => {
        const url = window.location.href;
        if (!navigator.clipboard) {
            showErrorNotice({ message: '复制失败，请手动复制浏览器地址栏链接' });
            return;
        }

        navigator.clipboard.writeText(url)
            .then(() => {
                setCopyState(true);
                setTimeout(() => setCopyState(false), 2000);
            })
            .catch(() => {
                showErrorNotice({ message: '复制失败，请手动复制浏览器地址栏链接' });
            });
    };

    const downloadICS = () => {
        const selectedExams = exams.filter(e => selectedIds.has(e.id));
        const validExams = selectedExams.filter(e => e.start_timestamp && e.end_timestamp);

        if (validExams.length === 0) {
            showErrorNotice({ message: '请至少勾选一门包含有效时间的考试' });
            return;
        }

        try {
            const content = generateICSContent(validExams, className, reminders);
            const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = buildExamCalendarFilename(className);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
            onExportComplete(validExams);
        } catch (err) {
            console.error('ICS generation failed:', err);
            showErrorNotice({ message: '日历文件生成失败，请稍后重试或联系开发者' });
        }
    };

    return (
        <div className="fade-in w-full">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-[28px] font-normal text-[#202124] dark:text-[#e8eaed] leading-tight mb-2">
                        {className} 期末考试安排
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[#70757a] dark:text-[#9aa0a6]">
                        <span>已选 {selectedIds.size} / {exams.length} 门考试</span>
                        <span>•</span>
                        <button
                            onClick={onSelectAll}
                            type="button"
                            disabled={allSelected}
                            className={`hover:underline transition-colors ${allSelected ? 'text-[#9aa0a6] cursor-not-allowed no-underline' : 'text-[var(--color-google-blue)] dark:text-[var(--color-google-blue-dark)]'}`}
                        >
                            全选
                        </button>
                        <button
                            onClick={onClearSelection}
                            type="button"
                            disabled={noneSelected}
                            className={`hover:underline transition-colors ${noneSelected ? 'text-[#9aa0a6] cursor-not-allowed no-underline' : 'text-[var(--color-google-blue)] dark:text-[var(--color-google-blue-dark)]'}`}
                        >
                            全不选
                        </button>
                        <span>•</span>
                        <button
                            onClick={copyShareLink}
                            type="button"
                            className={`flex items-center gap-1 hover:underline transition-colors ${copyState ? 'text-[#34A853]' : 'text-[var(--color-google-blue)] dark:text-[var(--color-google-blue-dark)]'}`}
                        >
                            <Share2 className="w-4 h-4" aria-hidden="true" />
                            {copyState ? '链接已复制' : '分享此页面'}
                        </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#70757a] dark:text-[#9aa0a6]">
                        {sourceTitle ? (
                            sourceUrl ? (
                                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#1a73e8] dark:text-[#8ab4f8] hover:underline">
                                    来源：{sourceTitle}
                                </a>
                            ) : (
                                <span>来源：{sourceTitle}</span>
                            )
                        ) : null}
                        {generatedAt ? <span>更新：{new Date(generatedAt).toLocaleString('zh-CN')}</span> : null}
                        {totalRecords ? <span>数据记录：{totalRecords}</span> : null}
                    </div>
                </div>
                <button
                    onClick={downloadICS}
                    disabled={selectedIds.size === 0}
                    className={`
                        inline-flex items-center justify-center gap-2 px-6 py-2 rounded-full text-[14px] font-medium transition-all shrink-0
                        ${selectedIds.size > 0
                            ? 'bg-[var(--color-google-blue)] hover:bg-[#3b78e7] text-white shadow-sm'
                            : 'bg-[#f8f9fa] dark:bg-[#303134] text-[#9aa0a6] cursor-not-allowed border border-[#dadce0] dark:border-[#3c4043]'}
                    `}
                >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    导出日历 (.ics)
                </button>
            </div>

            {notice ? (
                <div className="mb-4 rounded-md border border-[#f4c7c3] bg-[#fce8e6] px-4 py-2 text-sm text-[#b3261e] dark:border-[#5f2b26] dark:bg-[#2b1715] dark:text-[#f28b82]">
                    {notice.message}
                </div>
            ) : null}

            <div className="mb-4">
                <Suspense fallback={<div className="rounded-xl border border-[#dadce0] bg-white/80 px-4 py-3 text-[14px] text-[#5f6368] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#9aa0a6]">正在读取考试历史...</div>}>
                    <ExamHistoryPanel
                        manifest={examHistoryManifest || null}
                        classHistory={examClassHistory || null}
                        className={className}
                        loading={examHistoryLoading}
                        error={examHistoryError}
                    />
                </Suspense>
            </div>

            <ReminderSettings selected={reminders} onChange={onRemindersChange} />

            <div className="space-y-0 border border-[#dadce0] dark:border-[#3c4043] rounded-lg overflow-hidden bg-white dark:bg-[#202124]">
                {exams.map((exam, idx) => (
                    <div key={exam.id || idx} className={idx !== exams.length - 1 ? "border-b border-[#dadce0] dark:border-[#3c4043]" : ""}>
                        <ExamCard
                            exam={exam}
                            isSelected={selectedIds.has(exam.id)}
                            exportStatus={getExamStatus(exam)}
                            onToggle={() => onToggleSelection(exam.id)}
                        />
                    </div>
                ))}
            </div>

        </div>
    );
}
