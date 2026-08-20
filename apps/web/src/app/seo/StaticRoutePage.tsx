import { AppFooter } from '@/app/shell/AppFooter';
import { Header } from '@/app/shell/Header';
import { ExamLanding } from '@/exams/ExamLanding';
import type { ExamSnapshotClient } from '@/exams/model/ExamSnapshotClient';
import { HomePage } from '@/home/HomePage';
import { RoomsLanding } from '@/rooms/RoomsLanding';
import type { RoomOccupancyClient } from '@/rooms/model/RoomOccupancyClient';
import type { AppRoute } from '@/app/routing/useUrlState';
import { SearchLanding } from '@/search/SearchLanding';

const never = new Promise<never>(() => undefined);
const examClient = { initialize: () => never } as unknown as ExamSnapshotClient;
const roomClient = { initialize: () => never } as unknown as RoomOccupancyClient;
const noop = () => undefined;

export function StaticRoutePage({ route }: { route: AppRoute }) {
    if (route === 'home') {
        return (
            <div className="min-h-screen flex flex-col bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] font-sans">
                <HomePage
                    inputValue=""
                    onQuickSearch={noop}
                    onInputChange={noop}
                    onSubmit={noop}
                    onSearchWarm={noop}
                    onIntentWarm={noop}
                />
                <AppFooter />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] font-sans">
            <Header inputValue="" onInputChange={noop} onSubmit={noop} onGoHome={noop} />
            {route === 'exam' ? (
                <ExamLanding
                    savedClass={null}
                    onSubmit={noop}
                    onOpenClass={noop}
                    client={examClient}
                />
            ) : null}
            {route === 'rooms' ? (
                <RoomsLanding
                    client={roomClient}
                    savedRoom={null}
                    onChange={noop}
                    onSubmit={noop}
                />
            ) : null}
            {route === 'search' ? <SearchLanding /> : null}
            <AppFooter />
        </div>
    );
}

export function StaticNotFoundPage() {
    return (
        <main className="min-h-screen bg-white px-4 py-24 text-center text-[#202124] dark:bg-[#202124] dark:text-[#e8eaed]">
            <img src="/assets/logo.png" alt="" className="mx-auto h-14 w-14 rounded-xl" />
            <h1 className="mt-5 text-3xl font-normal">找不到这个页面</h1>
            <a href="/" className="mt-6 inline-flex rounded-full bg-[#1a73e8] px-5 py-2.5 text-sm font-medium text-white">
                返回首页
            </a>
        </main>
    );
}
