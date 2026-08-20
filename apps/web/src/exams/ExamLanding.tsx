import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExamSnapshotClient } from './model/ExamSnapshotClient';

interface ExamLandingProps {
    savedClass: string | null;
    onSubmit: (value: string) => void;
    onOpenClass: (className: string) => void;
    client: ExamSnapshotClient;
}

export function ExamLanding({ savedClass, onSubmit, onOpenClass, client }: ExamLandingProps) {
    const [classInput, setClassInput] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        void client.initialize(controller.signal).catch(() => {
            // The detail route reports artifact failures if the user submits a class.
        });
        return () => controller.abort();
    }, [client]);
    return (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
            <section className="mt-8">
                <div className="border border-[#dadce0] dark:border-[#3c4043] rounded-xl bg-[#f8fafc] dark:bg-[#2d2e30] p-8 text-center max-w-[692px] mx-auto shadow-sm">
                    <div className="mx-auto w-16 h-16 bg-[#e8f0fe] dark:bg-[#3b4043] rounded-full flex items-center justify-center mb-4">
                        <CalendarDays className="w-8 h-8 text-[#1a73e8] dark:text-[#8ab4f8]" aria-hidden="true" />
                    </div>
                    <h1 className="text-2xl font-semibold text-[#202124] dark:text-[#e8eaed] mb-2">查询考试安排</h1>
                    <p className="text-[15px] text-[#4d5156] dark:text-[#bdc1c6]">
                        输入班级号，查看考试时间、地点和考场。
                    </p>
                    <form
                        className="mx-auto mt-6 flex max-w-[440px] flex-col gap-3 sm:flex-row"
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
                            className="h-11 min-w-0 flex-1 rounded-lg border border-[#dadce0] bg-white px-3 text-[15px] text-[#202124] outline-none focus:border-[#1a73e8] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#e8eaed]"
                        />
                        <button
                            type="submit"
                            className="h-11 rounded-lg bg-[#1a73e8] px-5 text-[14px] font-medium text-white hover:bg-[#1765cc]"
                        >
                            查询
                        </button>
                    </form>
                    <p className="mt-3 text-[13px] text-[#70757a] dark:text-[#9aa0a6]">
                        试试 <button type="button" onClick={() => onSubmit('B240402')} className="font-mono text-[#1a73e8] hover:underline dark:text-[#8ab4f8]">B240402</button>
                    </p>
                    {savedClass ? (
                        <button
                            type="button"
                            onClick={() => onOpenClass(savedClass)}
                            className="mt-5 rounded-full border border-[#d2e3fc] bg-white px-4 py-2 text-[14px] font-medium text-[#174ea6] hover:bg-[#e8f0fe] dark:border-[#394457] dark:bg-[#202124] dark:text-[#8ab4f8] dark:hover:bg-[#1f2430]"
                        >
                            继续查看 {savedClass}
                        </button>
                    ) : null}
                </div>
            </section>
        </main>
    );
}
