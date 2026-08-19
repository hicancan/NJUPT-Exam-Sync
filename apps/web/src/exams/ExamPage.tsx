import { useEffect, useState } from 'react';
import { ExamDetailSkeleton } from './ui/ExamDetailSkeleton';
import { ExamListSkeleton } from './ui/ExamListSkeleton';
import { ExamDetail } from './ui/ExamDetail';
import { ExamList } from './ui/ExamList';
import { useExamData } from './model/useExamData';
import { useSelectedExamIds } from './model/useSelectedExamIds';
import { InlineErrorBanner } from '@/shared/ui/InlineErrorBanner';
import type { ExamSnapshotClient } from './model/ExamSnapshotClient';

interface ExamPageProps {
    query: string;
    className: string | null;
    onOpenClass: (className: string) => void;
    client: ExamSnapshotClient;
}

export function ExamPage({ query, className, onOpenClass, client }: ExamPageProps) {
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
    } = useExamData(client, true, className || query, className);
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

            {classMode.mode === 'NOT_FOUND' && !error ? (
                <section className="mt-6 rounded-xl border border-[#dadce0] bg-[#f8fbff] px-4 py-6 text-center dark:border-[#3c4043] dark:bg-[#202124]">
                    <h2 className="text-[20px] font-medium text-[#202124] dark:text-[#e8eaed]">未找到匹配班级</h2>
                    <p className="mt-2 text-[14px] text-[#5f6368] dark:text-[#bdc1c6]">请检查班级号后重试。</p>
                </section>
            ) : null}
        </main>
    );
}
