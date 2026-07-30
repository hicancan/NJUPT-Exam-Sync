import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ExamDetailSkeleton } from './ui/ExamDetailSkeleton';
import { ExamListSkeleton } from './ui/ExamListSkeleton';
import { ExamDetail } from './ui/ExamDetail';
import { ExamList } from './ui/ExamList';
import { useExamData } from './model/useExamData';
import { useSelectedExamIds } from './model/useSelectedExamIds';
import { InlineErrorBanner } from '@/shared/ui/InlineErrorBanner';

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
        sourceUpdatedAt,
        snapshotId,
        examPeriodId,
    } = useExamData(true, className || query || '考试安排', className);
    const currentClass = classMode.mode === 'DETAIL' ? classMode.classes[0] || null : null;
    const {
        selectedIds,
        toggleExamSelection,
        selectAllExamIds,
        clearExamSelection,
        markExamsExported,
        getExamStatus,
    } = useSelectedExamIds(currentClass, classMode.exams, snapshotId, examPeriodId, sourceUpdatedAt);

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
                        sourceUpdatedAt={sourceUpdatedAt}
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
                </section>
            ) : null}
        </main>
    );
}
