import { AppFooter } from '@/app/shell/AppFooter';
import { Header } from '@/app/shell/Header';
import { ExamLanding } from '@/exams/ExamLanding';
import type { ExamSnapshotClient } from '@/exams/model/ExamSnapshotClient';
import { HomePage } from '@/home/HomePage';
import type { AppRoute } from '@/app/routing/useUrlState';
import { SearchLanding } from '@/search/SearchLanding';
import { TimetableLanding } from '@/timetable/TimetableLanding';
import type { TeachingScheduleClient } from '@/timetable/model/TeachingScheduleClient';
import { ClassroomsLanding } from '@/classrooms/ClassroomsLanding';
import type { ClassroomAvailabilityClient } from '@/classrooms/model/ClassroomAvailabilityClient';

const never = new Promise<never>(() => undefined);
const examClient = { initialize: () => never } as unknown as ExamSnapshotClient;
const teachingClient = { initialize: () => never } as unknown as TeachingScheduleClient;
const classroomClient = { initialize: () => never } as unknown as ClassroomAvailabilityClient;
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
            <Header inputValue="" onInputChange={noop} onSubmit={noop} onGoHome={noop} route={route} />
            {route === 'exam' ? (
                <ExamLanding
                    savedClass={null}
                    onSubmit={noop}
                    onOpenClass={noop}
                    client={examClient}
            historyClient={null}
                />
            ) : null}
            {route === 'search' ? <SearchLanding /> : null}
            {route === 'timetable' ? <TimetableLanding client={teachingClient} savedClass={null} onOpenClass={noop} /> : null}
            {route === 'classrooms' ? <ClassroomsLanding client={classroomClient} onChange={noop} /> : null}
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
