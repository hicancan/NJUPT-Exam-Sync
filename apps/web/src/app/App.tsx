import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useAppRouter } from '@/app/routing/useAppRouter';
import { HomePage } from '@/home/HomePage';
import { AppFooter } from '@/app/shell/AppFooter';
import { Header } from '@/app/shell/Header';
import { SearchClient } from '@njupt-search/search-browser';
import { APP_CONFIG } from '@/app/config/constants';
import { ExamSnapshotClient } from '@/exams/model/ExamSnapshotClient';
import { RoomOccupancyClient } from '@/rooms/model/RoomOccupancyClient';
import type { ProductIntent } from '@/app/routing/intents';
import { ExamLanding } from '@/exams/ExamLanding';
import { RoomsLanding } from '@/rooms/RoomsLanding';
import { applyPageSeo, resolvePageSeo } from '@/app/seo/pageSeo';

const loadSearchPage = () => import('@/search/SearchPage').then(module => ({ default: module.SearchPage }));
const loadExamPage = () => import('@/exams/ExamPage').then(module => ({ default: module.ExamPage }));
const loadRoomsPage = () => import('@/rooms/RoomsPage').then(module => ({ default: module.RoomsPage }));
const SearchPage = lazy(loadSearchPage);
const ExamPage = lazy(loadExamPage);
const RoomsPage = lazy(loadRoomsPage);

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
    const roomClient = useMemo(() => new RoomOccupancyClient(APP_CONFIG.DATA_URLS.ROOM), []);
    useEffect(() => () => {
        searchClient.dispose();
        examClient.dispose();
        roomClient.dispose();
    }, [examClient, roomClient, searchClient]);
    const warmSearch = () => {
        void loadSearchPage();
        void searchClient.initialize().catch(() => {
            // SearchPage presents initialization errors and can retry this client.
        });
    };
    const warmIntent = (intent: ProductIntent) => {
        if (intent.kind === 'search') {
            warmSearch();
            return;
        }
        if (intent.kind === 'exam') {
            void loadExamPage();
            void examClient.initialize().catch(() => {
                // ExamPage presents artifact errors and can retry through navigation.
            });
            return;
        }
        void loadRoomsPage();
        void roomClient.initialize().catch(() => {
            // RoomsPage presents artifact errors and can retry through navigation.
        });
    };

    return (
        <div className="min-h-screen flex flex-col bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] transition-colors duration-200 font-sans">
            {router.route !== 'home' ? (
                <Header
                    inputValue={router.inputValue}
                    onInputChange={router.onInputChange}
                    onSubmit={router.onSubmit}
                    onGoHome={router.onGoHome}
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
                {router.route === 'search' ? (
                    <SearchPage query={router.search.query} client={searchClient} />
                ) : null}

                {router.route === 'exam' ? (
                    !router.exam.query && !router.exam.className ? (
                        <ExamLanding
                            savedClass={router.exam.savedClass}
                            onSubmit={router.onSubmit}
                            onOpenClass={(className) => router.onSubmit(className)}
                            client={examClient}
                        />
                    ) : (
                        <ExamPage
                            query={router.exam.query}
                            className={router.exam.className}
                            onOpenClass={(className) => router.onSubmit(className)}
                            client={examClient}
                        />
                    )
                ) : null}

                {router.route === 'rooms' ? (
                    !router.rooms.query && !router.rooms.campus && !router.rooms.building && !router.rooms.floor ? (
                        <RoomsLanding
                            client={roomClient}
                            savedRoom={router.rooms.savedRoom}
                            onChange={router.navigateRooms}
                            onSubmit={router.onSubmit}
                        />
                    ) : (
                        <RoomsPage
                            query={router.rooms.query}
                            date={router.rooms.date}
                            campus={router.rooms.campus}
                            building={router.rooms.building}
                            floor={router.rooms.floor}
                            start={router.rooms.start}
                            end={router.rooms.end}
                            onChange={router.navigateRooms}
                            client={roomClient}
                        />
                    )
                ) : null}
            </Suspense>

            <AppFooter />
        </div>
    );
}

export default App;
