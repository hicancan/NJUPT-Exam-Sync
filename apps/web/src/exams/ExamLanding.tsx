import { CalendarDays } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { ExamSnapshotClient } from './model/ExamSnapshotClient';
import type { ExamHistoryClient } from './model/ExamHistoryClient';

const ExamHistoryLanding = lazy(() => import('./ExamHistoryLanding').then(module => ({
    default: module.ExamHistoryLanding,
})));

interface ExamLandingProps {
    savedClass: string | null;
    onSubmit: (value: string) => void;
    onOpenClass: (className: string) => void;
    client: ExamSnapshotClient;
    historyClient: ExamHistoryClient | null;
}

export function ExamLanding({ savedClass, onSubmit, onOpenClass, client, historyClient }: ExamLandingProps) {
    const [classInput, setClassInput] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        void client.initialize(controller.signal).catch(() => {
            // The detail route reports artifact failures if the user submits a class.
        });
        return () => controller.abort();
    }, [client]);
    return (
        <main className="mx-auto flex-1 w-full max-w-6xl px-4 pb-6 pt-2 sm:pt-3">
            <section className="mt-4 sm:mt-8">
                <div className="mx-auto max-w-[692px] rounded-xl border border-[#dadce0] bg-[#f8fafc] px-5 py-6 text-center shadow-sm dark:border-[#3c4043] dark:bg-[#2d2e30] sm:p-8">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f0fe] dark:bg-[#3b4043] sm:mb-4 sm:h-16 sm:w-16">
                        <CalendarDays className="h-6 w-6 text-[#1a73e8] dark:text-[#8ab4f8] sm:h-8 sm:w-8" aria-hidden="true" />
                    </div>
                    <h1 className="mb-2 text-[23px] font-semibold leading-tight text-[#202124] dark:text-[#e8eaed] sm:text-2xl">查询考试安排</h1>
                    <p className="text-[14px] leading-6 text-[#4d5156] dark:text-[#bdc1c6] sm:text-[15px]">
                        输入班级号，查看考试时间、地点和考场。
                    </p>
                    <form
                        className="mx-auto mt-5 grid max-w-[440px] grid-cols-[minmax(0,1fr)_88px] gap-2 sm:mt-6 sm:grid-cols-[minmax(0,1fr)_96px] sm:gap-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (classInput.trim()) onSubmit(classInput);
                        }}
                    >
                        <label className="sr-only" htmlFor="exam-class-input">班级号</label>
                        <input
                            id="exam-class-input"
                            value={classInput}
                            onChange={event => setClassInput(event.target.value)}
                            placeholder="输入班级号"
                            autoComplete="off"
                            className="h-12 min-w-0 w-full rounded-lg border border-[#dadce0] bg-white px-3 text-[15px] text-[#202124] outline-none focus:border-[#1a73e8] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#e8eaed] sm:h-11"
                        />
                        <button
                            type="submit"
                            className="h-12 w-full rounded-lg bg-[#1a73e8] px-3 text-[14px] font-medium text-white hover:bg-[#1765cc] sm:h-11"
                        >
                            查询
                        </button>
                    </form>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[13px]">
                        <button
                            type="button"
                            onClick={() => onSubmit('B240402')}
                            className="inline-flex h-9 items-center rounded-full px-3 text-[#5f6368] hover:bg-white dark:text-[#bdc1c6] dark:hover:bg-[#202124]"
                        >
                            试试&nbsp;<span className="font-mono text-[#1a73e8] dark:text-[#8ab4f8]">B240402</span>
                        </button>
                        {savedClass ? (
                            <button
                                type="button"
                                onClick={() => onOpenClass(savedClass)}
                                className="inline-flex h-9 items-center rounded-full border border-[#d2e3fc] bg-white px-3 font-medium text-[#174ea6] hover:bg-[#e8f0fe] dark:border-[#394457] dark:bg-[#202124] dark:text-[#8ab4f8] dark:hover:bg-[#1f2430]"
                            >
                                继续查看 {savedClass}
                            </button>
                        ) : null}
                    </div>
                </div>
                {historyClient ? (
                    <Suspense fallback={null}>
                        <ExamHistoryLanding client={historyClient} />
                    </Suspense>
                ) : null}
            </section>
        </main>
    );
}
