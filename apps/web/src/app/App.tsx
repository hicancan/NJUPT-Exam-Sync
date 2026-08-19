import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useAppRouter } from '@/app/routing/useAppRouter';
import { HomePage } from '@/home/HomePage';
import { AppFooter } from '@/app/shell/AppFooter';
import { Header } from '@/app/shell/Header';
import { SearchClient } from '@njupt-search/search-browser';
import { APP_CONFIG } from '@/app/config/constants';

const SearchPage = lazy(() => import('@/search/SearchPage').then(module => ({ default: module.SearchPage })));
const ExamPage = lazy(() => import('@/exams/ExamPage').then(module => ({ default: module.ExamPage })));
const RoomsPage = lazy(() => import('@/rooms/RoomsPage').then(module => ({ default: module.RoomsPage })));

function RouteLoading() {
    return (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-6 pb-8">
            <div className="rounded-xl border border-[#dadce0] bg-white px-4 py-6 text-[14px] text-[#5f6368] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#bdc1c6]">
                正在加载...
            </div>
        </main>
    );
}

function App() {
    const router = useAppRouter();
    const searchClient = useMemo(() => new SearchClient({
        baseUrl: APP_CONFIG.DATA_URLS.SEARCH,
    }), []);
    useEffect(() => () => searchClient.dispose(), [searchClient]);
    const warmSearch = () => {
        void searchClient.initialize().catch(() => {
            // SearchPage presents initialization errors and can retry this client.
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
                        if (intent.kind === 'search') warmSearch();
                        router.onQuickSearch(intent);
                    }}
                    onInputChange={router.onInputChange}
                    onSubmit={router.onSubmit}
                    onSearchWarm={warmSearch}
                />
            ) : null}

            <Suspense fallback={<RouteLoading />}>
                {router.route === 'search' ? (
                    <SearchPage query={router.search.query} client={searchClient} />
                ) : null}

                {router.route === 'exam' ? (
                    <ExamPage
                        query={router.exam.query}
                        className={router.exam.className}
                        onOpenClass={(className) => router.onSubmit(className)}
                    />
                ) : null}

                {router.route === 'rooms' ? (
                    <RoomsPage
                        query={router.rooms.query}
                        date={router.rooms.date}
                        campus={router.rooms.campus}
                        building={router.rooms.building}
                        floor={router.rooms.floor}
                        start={router.rooms.start}
                        end={router.rooms.end}
                        onChange={router.navigateRooms}
                    />
                ) : null}
            </Suspense>

            <AppFooter />
        </div>
    );
}

export default App;
