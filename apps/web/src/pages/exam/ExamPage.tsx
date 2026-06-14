import { CalendarDays } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ExamDetailSkeleton } from '@/features/exam-schedule/ui/ExamDetailSkeleton';
import { ExamListSkeleton } from '@/features/exam-schedule/ui/ExamListSkeleton';
import { ExamDetail } from '@/features/exam-schedule/ui/ExamDetail';
import { ExamList } from '@/features/exam-schedule/ui/ExamList';
import { useExamData } from '@/features/exam-schedule/model/useExamData';
import { useExamHistory } from '@/features/exam-schedule/model/useExamHistory';
import { useSelectedExamIds } from '@/features/exam-schedule/model/useSelectedExamIds';
import { InlineErrorBanner } from '@/widgets/app-shell/InlineErrorBanner';

const ExamHistoryPanel = lazy(() => import('@/features/exam-schedule/ui/ExamHistoryPanel').then(module => ({ default: module.ExamHistoryPanel })));

interface ExamPageProps {
    query: string;
    className: string | null;
    onOpenClass: (className: string) => void;
}

export function ExamPage({ query, className, onOpenClass }: ExamPageProps) {
    const [reminders, setReminders] = useState<number[]>([30, 60]);
    const {
        classMode,
        loading,
        error,
        sourceUrl,
        sourceTitle,
        generatedAt,
        dataVersion,
        examPeriodId,
        classIndex,
        currentClassEntry,
    } = useExamData(true, className || query || '考试安排', className);
    const currentClass = classMode.mode === 'DETAIL' ? classMode.classes[0] || null : null;
    const {
        classHistory,
        loading: historyLoading,
        error: historyError,
    } = useExamHistory(Boolean(currentClassEntry), currentClassEntry, dataVersion);
    const {
        selectedIds,
        toggleExamSelection,
        selectAllExamIds,
        clearExamSelection,
        markExamsExported,
        getExamStatus,
    } = useSelectedExamIds(currentClass, classMode.exams, dataVersion, examPeriodId, generatedAt);

    useEffect(() => {
        if (currentClass) {
            localStorage.setItem('SAVED_CLASS', currentClass);
        }
    }, [currentClass]);

    if (loading) {
        return (
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
                <section className="mt-6">
                    {className || query ? <ExamDetailSkeleton /> : <ExamListSkeleton />}
                </section>
            </main>
        );
    }

    return (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
            <InlineErrorBanner message={error} />

            {classMode.mode === 'LIST' ? (
                <section className="mt-6">
                    <ExamList classes={classMode.classes} onClassClick={onOpenClass} />
                </section>
            ) : null}

            {classMode.mode === 'DETAIL' ? (
                <section className="mt-6">
                    <ExamDetail
                        className={classMode.classes[0] || ''}
                        exams={classMode.exams}
                        selectedIds={selectedIds}
                        onToggleSelection={toggleExamSelection}
                        onSelectAll={selectAllExamIds}
                        onClearSelection={clearExamSelection}
                        onExportComplete={markExamsExported}
                        getExamStatus={getExamStatus}
                        reminders={reminders}
                        onRemindersChange={setReminders}
                        sourceUrl={sourceUrl}
                        sourceTitle={sourceTitle}
                        generatedAt={generatedAt}
                        examClassIndex={classIndex}
                        examClassHistory={classHistory}
                        examHistoryLoading={historyLoading}
                        examHistoryError={historyError}
                    />
                </section>
            ) : null}

            {query === '考试安排' && classMode.mode === 'NOT_FOUND' ? (
                <section className="mt-8">
                    <div className="border border-[#dadce0] dark:border-[#3c4043] rounded-xl bg-[#f8fafc] dark:bg-[#2d2e30] p-8 text-center max-w-[692px] mx-auto shadow-sm">
                        <div className="mx-auto w-16 h-16 bg-[#e8f0fe] dark:bg-[#3b4043] rounded-full flex items-center justify-center mb-4">
                            <CalendarDays className="w-8 h-8 text-[#1a73e8] dark:text-[#8ab4f8]" aria-hidden="true" />
                        </div>
                        <h2 className="text-2xl font-semibold text-[#202124] dark:text-[#e8eaed] mb-2">考试日程已就绪</h2>
                        <p className="text-[15px] text-[#4d5156] dark:text-[#bdc1c6] mb-6">
                            在顶部搜索框输入完整班级号，例如 <span className="font-mono bg-[#e8eaed] dark:bg-[#3c4043] px-1.5 py-0.5 rounded text-[#202124] dark:text-[#e8eaed]">B250403</span>。
                        </p>
                    </div>
                    <div className="mx-auto mt-4 max-w-[692px]">
                        <Suspense fallback={<div className="rounded-xl border border-[#dadce0] bg-white/80 px-4 py-3 text-[14px] text-[#5f6368] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#9aa0a6]">正在读取考试历史...</div>}>
                            <ExamHistoryPanel
                                classIndex={classIndex}
                                classHistory={null}
                                loading={historyLoading}
                                error={historyError}
                            />
                        </Suspense>
                    </div>
                </section>
            ) : null}
        </main>
    );
}
