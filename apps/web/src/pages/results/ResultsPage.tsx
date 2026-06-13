import { CalendarDays } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { CollectionResultsSkeleton } from '@/features/collection-search/ui/CollectionResultsSkeleton';
import { ExamDetailSkeleton } from '@/features/exam-search/ui/ExamDetailSkeleton';
import { ExamListSkeleton } from '@/features/exam-search/ui/ExamListSkeleton';
import { CollectionSearchSection } from '@/features/collection-search/ui/CollectionSearchSection';
import { ExamDetail } from '@/features/exam-search/ui/ExamDetail';
import { ExamList } from '@/features/exam-search/ui/ExamList';
import type { ExamExportStatus } from '@/features/exam-search/model/examSelection';
import {
    RankedSitegraphDocument,
    SearchResult,
    SitegraphFilterOptions,
    SitegraphQueryStats,
    SitegraphSearchFilters,
    SitegraphSearchCoverage,
    SitegraphSearchPhase,
    SitegraphSortMode,
    Exam,
    ExamClassHistory,
    ExamClassIndex,
} from '@/shared/lib/contracts';

type ResultsLoadingKind = 'collection' | 'exam-list' | 'exam-detail';

const ExamHistoryPanel = lazy(() => import('@/features/exam-search/ui/ExamHistoryPanel').then(module => ({ default: module.ExamHistoryPanel })));

interface ResultsPageProps {
    isLoading?: boolean;
    loadingKind: ResultsLoadingKind;
    query: string;
    results: RankedSitegraphDocument[];
    queryStats: SitegraphQueryStats | null;
    queryCoverage: SitegraphSearchCoverage | null;
    searchPhase: SitegraphSearchPhase | null;
    searching: boolean;
    sortMode: SitegraphSortMode;
    filters: SitegraphSearchFilters;
    filterOptions: SitegraphFilterOptions | null;
    onSortModeChange: (sortMode: SitegraphSortMode) => void;
    onFiltersChange: (patch: SitegraphSearchFilters) => void;
    classMode: SearchResult;
    selectedIds: Set<string>;
    reminders: number[];
    onOpenClass: (className: string) => void;
    onToggleSelection: (id: string) => void;
    onSelectAllExams: () => void;
    onClearExamSelection: () => void;
    onExamExportComplete: (exams: Exam[]) => void;
    getExamStatus: (exam: Exam) => ExamExportStatus;
    onRemindersChange: (reminders: number[]) => void;
    sourceUrl: string | null;
    sourceTitle: string | null;
    generatedAt: string | null;
    examClassIndex: ExamClassIndex | null;
    examClassHistory: ExamClassHistory | null;
    examHistoryLoading: boolean;
    examHistoryError: string | null;
}

export function ResultsPage({
    isLoading,
    loadingKind,
    query,
    results,
    queryStats,
    queryCoverage,
    searchPhase,
    searching,
    sortMode,
    filters,
    filterOptions,
    onSortModeChange,
    onFiltersChange,
    classMode,
    selectedIds,
    reminders,
    onOpenClass,
    onToggleSelection,
    onSelectAllExams,
    onClearExamSelection,
    onExamExportComplete,
    getExamStatus,
    onRemindersChange,
    sourceUrl,
    sourceTitle,
    generatedAt,
    examClassIndex,
    examClassHistory,
    examHistoryLoading,
    examHistoryError,
}: ResultsPageProps) {
    const trimmedQuery = query.trim();
    const hasClassDetail = classMode.mode === 'DETAIL' && classMode.exams.length > 0;
    const showSearchResultsSection = !(hasClassDetail && results.length === 0);
    const loadingSkeleton = loadingKind === 'exam-detail' ? (
        <section className="mt-6">
            <ExamDetailSkeleton />
        </section>
    ) : loadingKind === 'exam-list' ? (
        <section className="mt-6">
            <ExamListSkeleton />
        </section>
    ) : (
        <CollectionResultsSkeleton />
    );

    return (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
            {isLoading ? (
                loadingSkeleton
            ) : (
                <div className="w-full">
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
                                onToggleSelection={onToggleSelection}
                                onSelectAll={onSelectAllExams}
                                onClearSelection={onClearExamSelection}
                                onExportComplete={onExamExportComplete}
                                getExamStatus={getExamStatus}
                                reminders={reminders}
                                onRemindersChange={onRemindersChange}
                                sourceUrl={sourceUrl}
                                sourceTitle={sourceTitle}
                                generatedAt={generatedAt}
                                examClassIndex={examClassIndex}
                                examClassHistory={examClassHistory}
                                examHistoryLoading={examHistoryLoading}
                                examHistoryError={examHistoryError}
                            />
                        </section>
                    ) : null}

                    {trimmedQuery === '考试安排' && classMode.mode === 'NOT_FOUND' ? (
                        <section className="mt-8">
                            <div className="border border-[#dadce0] dark:border-[#3c4043] rounded-xl bg-[#f8fafc] dark:bg-[#2d2e30] p-8 text-center max-w-[692px] mx-auto shadow-sm">
                                <div className="mx-auto w-16 h-16 bg-[#e8f0fe] dark:bg-[#3b4043] rounded-full flex items-center justify-center mb-4">
                                    <CalendarDays className="w-8 h-8 text-[#1a73e8] dark:text-[#8ab4f8]" aria-hidden="true" />
                                </div>
                                <h2 className="text-2xl font-semibold text-[#202124] dark:text-[#e8eaed] mb-2">考试日程助手已就绪</h2>
                                <p className="text-[15px] text-[#4d5156] dark:text-[#bdc1c6] mb-6">
                                    请在顶部搜索框输入完整班级号，例如 <span className="font-mono bg-[#e8eaed] dark:bg-[#3c4043] px-1.5 py-0.5 rounded text-[#202124] dark:text-[#e8eaed]">B250403</span>。
                                </p>
                            </div>
                            <div className="mx-auto mt-4 max-w-[692px]">
                                <Suspense fallback={<div className="rounded-xl border border-[#dadce0] bg-white/80 px-4 py-3 text-[14px] text-[#5f6368] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#9aa0a6]">正在读取考试历史...</div>}>
                                    <ExamHistoryPanel
                                        classIndex={examClassIndex}
                                        classHistory={null}
                                        loading={examHistoryLoading}
                                        error={examHistoryError}
                                    />
                                </Suspense>
                            </div>
                        </section>
                    ) : showSearchResultsSection ? (
                        <CollectionSearchSection
                            query={query}
                            results={results}
                            queryStats={queryStats}
                            queryCoverage={queryCoverage}
                            searchPhase={searchPhase}
                            searching={searching}
                            sortMode={sortMode}
                            filters={filters}
                            filterOptions={filterOptions}
                            onSortModeChange={onSortModeChange}
                            onFiltersChange={onFiltersChange}
                        />
                    ) : null}
                </div>
            )}
        </main>
    );
}
