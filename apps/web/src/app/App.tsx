import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppRouter } from '@/app/routing/useAppRouter';
import { HomePage } from '@/home/HomePage';
import { AppFooter } from '@/app/shell/AppFooter';
import { Header } from '@/app/shell/Header';
import { SearchClient } from '@njupt-search/search-browser';
import { APP_CONFIG } from '@/app/config/constants';
import { ExamSnapshotClient } from '@/exams/model/ExamSnapshotClient';
import type { ExamHistoryClient } from '@/exams/model/ExamHistoryClient';
import { ExamRoomOccupancyClient } from '@/classrooms/model/ExamRoomOccupancyClient';
import type { ProductIntent } from '@/app/routing/intents';
import { ExamLanding } from '@/exams/ExamLanding';
import { applyPageSeo, resolvePageSeo } from '@/app/seo/pageSeo';
import { TeachingScheduleClient } from '@/timetable/model/TeachingScheduleClient';
import { ClassroomAvailabilityClient } from '@/classrooms/model/ClassroomAvailabilityClient';
import { TimetableLanding } from '@/timetable/TimetableLanding';
import { ClassroomsLanding } from '@/classrooms/ClassroomsLanding';
import { SpaceClient } from '@/space/model/SpaceClient';
import { searchScopeForRoute } from '@/search/searchScopes';

const loadSearchPage = () => import('@/search/SearchPage').then(module => ({ default: module.SearchPage }));
const loadExamPage = () => import('@/exams/ExamPage').then(module => ({ default: module.ExamPage }));
const loadTimetablePage = () => import('@/timetable/TimetablePage').then(module => ({ default: module.TimetablePage }));
const loadClassroomsPage = () => import('@/classrooms/ClassroomsPage').then(module => ({ default: module.ClassroomsPage }));
const SearchPage = lazy(loadSearchPage);
const ExamPage = lazy(loadExamPage);
const TimetablePage = lazy(loadTimetablePage);
const ClassroomsPage = lazy(loadClassroomsPage);

function RouteLoading() {
    return (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-6 pb-8">
            <div className="rounded-xl border border-[#dadce0] bg-white px-4 py-6 text-[14px] text-[#5f6368] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#bdc1c6]">
                正在打开页面…
            </div>
        </main>
    );
}

function App() {
    const router = useAppRouter();
    useEffect(() => {
        applyPageSeo(resolvePageSeo(router.route, router.hasQueryParams));
    }, [router.hasQueryParams, router.route]);
    const searchClient = useMemo(() => new SearchClient({
        baseUrl: APP_CONFIG.DATA_URLS.SEARCH,
    }), []);
    const examClient = useMemo(() => new ExamSnapshotClient(APP_CONFIG.DATA_URLS.EXAM), []);
    const historyClientRef = useRef<ExamHistoryClient | null>(null);
    const historyClientPromiseRef = useRef<Promise<ExamHistoryClient> | null>(null);
    const [examHistoryClient, setExamHistoryClient] = useState<ExamHistoryClient | null>(null);
    const loadExamHistoryClient = useCallback((): Promise<ExamHistoryClient> => {
        if (historyClientRef.current) return Promise.resolve(historyClientRef.current);
        if (!historyClientPromiseRef.current) {
            historyClientPromiseRef.current = import('@/exams/model/ExamHistoryClient').then(module => {
                const client = new module.ExamHistoryClient(APP_CONFIG.DATA_URLS.EXAM_HISTORY, examClient);
                historyClientRef.current = client;
                setExamHistoryClient(client);
                return client;
            });
        }
        return historyClientPromiseRef.current;
    }, [examClient]);
    const examOccupancyClient = useMemo(() => new ExamRoomOccupancyClient(APP_CONFIG.DATA_URLS.ROOM), []);
    const spaceClient = useMemo(() => new SpaceClient(APP_CONFIG.DATA_URLS.SPACE), []);
    const teachingClient = useMemo(() => new TeachingScheduleClient(APP_CONFIG.DATA_URLS.TIMETABLE), []);
    const classroomClient = useMemo(() => new ClassroomAvailabilityClient(APP_CONFIG.DATA_URLS.CLASSROOMS, examOccupancyClient, spaceClient), [examOccupancyClient, spaceClient]);
    useEffect(() => () => {
        searchClient.dispose();
        examClient.dispose();
        historyClientRef.current?.dispose();
        examOccupancyClient.dispose();
        spaceClient.dispose();
        teachingClient.dispose();
        classroomClient.dispose();
    }, [classroomClient, examClient, examOccupancyClient, searchClient, spaceClient, teachingClient]);
    useEffect(() => {
        if (router.route !== 'exam') return;
        void loadExamHistoryClient()
            .then(client => client.initialize())
            .catch(() => {
                // Exam history is supplementary and reports its own failure state.
            });
    }, [loadExamHistoryClient, router.route]);
    const warmSearch = () => {
        void loadSearchPage();
        void searchClient.initialize().catch(() => {
            // SearchPage presents initialization errors and can retry this client.
        });
    };
    const warmIntent = (intent: ProductIntent) => {
        if (intent.kind === 'search' || intent.kind === 'community' || intent.kind === 'materials') {
            warmSearch();
            return;
        }
        if (intent.kind === 'exam') {
            void loadExamPage();
            void examClient.initialize().catch(() => {
                // ExamPage presents artifact errors and can retry through navigation.
            });
            void loadExamHistoryClient()
                .then(client => client.initialize())
                .catch(() => {
                    // Exam history is supplementary and reports its own failure state.
                });
            return;
        }
        if (intent.kind === 'timetable') {
            void loadTimetablePage();
            void teachingClient.initialize().catch(() => undefined);
            return;
        }
        if (intent.kind === 'classrooms') {
            void loadClassroomsPage();
            void classroomClient.initialize().catch(() => undefined);
            return;
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] transition-colors duration-200 font-sans">
            {router.route !== 'home' ? (
                <Header
                    inputValue={router.inputValue}
                    onInputChange={router.onInputChange}
                    onSubmit={router.onSubmit}
                    onGoHome={router.onGoHome}
                    route={router.route}
                />
            ) : null}

            {router.route === 'home' ? (
                <HomePage
                    inputValue={router.inputValue}
                    onQuickSearch={(intent) => {
                        warmIntent(intent);
                        router.onQuickSearch(intent);
                    }}
                    onInputChange={router.onInputChange}
                    onSubmit={router.onSubmit}
                    onSearchWarm={warmSearch}
                    onIntentWarm={warmIntent}
                />
            ) : null}

            <Suspense fallback={<RouteLoading />}>
                {router.route === 'search' || router.route === 'community' || router.route === 'materials' ? (
                    <SearchPage
                        key={router.route}
                        query={router.search.query}
                        client={searchClient}
                        scope={searchScopeForRoute(router.route)}
                    />
                ) : null}

                {router.route === 'exam' ? (
                    !router.exam.query && !router.exam.className ? (
                        <ExamLanding
                            savedClass={router.exam.savedClass}
                            onSubmit={router.onSubmit}
                            onOpenClass={(className) => router.onSubmit(className)}
                            client={examClient}
                            historyClient={examHistoryClient}
                        />
                    ) : (
                        <ExamPage
                            query={router.exam.query}
                            className={router.exam.className}
                            onOpenClass={(className) => router.onSubmit(className)}
                            client={examClient}
                            historyClient={examHistoryClient}
                        />
                    )
                ) : null}

                {router.route === 'timetable' ? (
                    !router.timetable.className ? (
                        <TimetableLanding
                            client={teachingClient}
                            savedClass={router.timetable.savedClass}
                            initialQuery={router.timetable.query}
                            onOpenClass={(className) => router.navigateTimetable({ class: className, week: null })}
                        />
                    ) : (
                        <TimetablePage
                            className={router.timetable.className}
                            week={router.timetable.week}
                            client={teachingClient}
                            onChange={router.navigateTimetable}
                        />
                    )
                ) : null}

                {router.route === 'classrooms' ? (
                    (!router.classrooms.date && (!router.classrooms.week || !router.classrooms.weekday)) || !router.classrooms.period ? (
                        <ClassroomsLanding client={classroomClient} onChange={router.navigateClassrooms} query={router.classrooms.query} />
                    ) : (
                        <ClassroomsPage
                            date={router.classrooms.date}
                            week={router.classrooms.week}
                            weekday={router.classrooms.weekday}
                            period={router.classrooms.period}
                            campus={router.classrooms.campus}
                            building={router.classrooms.building}
                            floor={router.classrooms.floor}
                            room={router.classrooms.room}
                            query={router.classrooms.query}
                            client={classroomClient}
                            onChange={router.navigateClassrooms}
                        />
                    )
                ) : null}
            </Suspense>

            <AppFooter />
        </div>
    );
}

export default App;
