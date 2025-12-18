import { useState } from 'react';
import { Exam } from '@/types';
import { generateICSContent } from '@/utils/icsGenerator';
import { ExamCard } from './ExamCard';
import { ReminderSettings } from './ReminderSettings';

interface ExamDetailProps {
    className: string;
    exams: Exam[];
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    reminders: number[];
    onRemindersChange: (reminders: number[]) => void;
}

export function ExamDetail({
    className,
    exams,
    selectedIds,
    onToggleSelection,
    reminders,
    onRemindersChange
}: ExamDetailProps) {
    const [copyState, setCopyState] = useState<boolean>(false);

    const copyShareLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setCopyState(true);
            setTimeout(() => setCopyState(false), 2000);
        });
    };

    const downloadICS = () => {
        const selectedExams = exams.filter(e => selectedIds.has(e.id));
        const validExams = selectedExams.filter(e => e.start_timestamp);

        if (validExams.length === 0) {
            alert('请至少勾选一门包含有效时间的考试');
            return;
        }

        const content = generateICSContent(validExams, className, reminders);
        const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `NJUPT_Exams_${className}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fade-in pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-mono tracking-tight">
                            {className}
                        </h2>
                        <button
                            onClick={copyShareLink}
                            type="button"
                            className={`text-xs px-2 py-1 rounded border transition-all ${copyState
                                ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                                : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-indigo-500 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800'
                                }`}
                        >
                            {copyState ? '✅ 已复制' : '🔗 分享链接'}
                        </button>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        已选 {selectedIds.size} / {exams.length} 门考试
                    </p>
                </div>
                <button
                    onClick={downloadICS}
                    disabled={selectedIds.size === 0}
                    className={`
                        inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shrink-0
                        ${selectedIds.size > 0
                            ? 'bg-slate-900 hover:bg-black text-white shadow-slate-200'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                    `}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    导出日历
                </button>
            </div>

            <ReminderSettings selected={reminders} onChange={onRemindersChange} />

            <div className="space-y-4">
                {exams.map((exam, idx) => (
                    <ExamCard
                        key={exam.id || idx}
                        exam={exam}
                        isSelected={selectedIds.has(exam.id)}
                        onToggle={() => onToggleSelection(exam.id)}
                    />
                ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-400">
                    请务必登录教务系统核对，一切以官方最新通知为准
                </p>
            </div>
        </div>
    );
}
