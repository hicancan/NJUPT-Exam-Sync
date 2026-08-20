import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { uniqueValues } from '@njupt-search/academics-room';
import { InlineErrorBanner } from '@/shared/ui/InlineErrorBanner';
import type { RoomOccupancy } from '@njupt-search/academics-room';
import type { SavedRoomRoute } from '@/app/routing/routeContract';
import type { RoomOccupancyClient } from './model/RoomOccupancyClient';

interface RoomsLandingProps {
    client: RoomOccupancyClient;
    savedRoom: SavedRoomRoute | null;
    onChange: (params: Record<string, string | null>, replace?: boolean) => void;
    onSubmit: (value: string) => void;
}

export function RoomsLanding({ client, savedRoom, onChange, onSubmit }: RoomsLandingProps) {
    const [query, setQuery] = useState('');
    const [manifest, setManifest] = useState<RoomOccupancy | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        client.initialize(controller.signal)
            .then(value => {
                if (!controller.signal.aborted) setManifest(value);
            })
            .catch(reason => {
                if (controller.signal.aborted) return;
                console.error(reason);
                setError('暂时无法加载教室信息，请刷新页面后重试。');
            });
        return () => controller.abort();
    }, [client]);

    const buildingsByCampus = manifest
        ? Array.from(new Map(manifest.floors.map(item => [item.campus, uniqueValues(manifest.floors
            .filter(floor => floor.campus === item.campus)
            .map(floor => floor.building))])).entries())
        : [];

    return (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-6 pb-8">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-[28px] font-normal text-[#202124] dark:text-[#e8eaed]">考试教室查询</h1>
                    <p className="mt-2 text-[14px] text-[#5f6368] dark:text-[#bdc1c6]">
                        输入楼栋或教室号，查看考试期间的教室占用情况。
                    </p>
                    <a href={`/search?q=${encodeURIComponent('封楼')}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[#1a73e8] hover:underline dark:text-[#8ab4f8]">
                        <Search className="h-4 w-4" aria-hidden="true" />
                        查看封楼通知
                    </a>
                </div>
                {manifest ? (
                    <div className="rounded-full bg-[#f1f3f4] px-3 py-1 text-[12px] text-[#5f6368] dark:bg-[#303134] dark:text-[#bdc1c6]">
                        覆盖 {manifest.rooms.length} 间教室、{manifest.dates.length} 个考试日期
                    </div>
                ) : error ? null : (
                    <div className="text-[12px] text-[#70757a] dark:text-[#9aa0a6]" aria-live="polite">正在加载校区和楼栋…</div>
                )}
            </div>

            <InlineErrorBanner message={error} />
            <section className="rounded-xl border border-[#dadce0] bg-[#f8fbff] p-4 dark:border-[#3c4043] dark:bg-[#202124]">
                <form
                    className="flex max-w-[500px] flex-col gap-3 sm:flex-row"
                    onSubmit={event => {
                        event.preventDefault();
                        if (query.trim()) onSubmit(query);
                    }}
                >
                    <label className="sr-only" htmlFor="room-query-input">楼栋或教室</label>
                    <input
                        id="room-query-input"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="输入楼栋或教室号"
                        autoComplete="off"
                        className="h-11 min-w-0 flex-1 rounded-lg border border-[#dadce0] bg-white px-3 text-[15px] text-[#202124] outline-none focus:border-[#1a73e8] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#e8eaed]"
                    />
                    <button type="submit" className="h-11 rounded-lg bg-[#1a73e8] px-5 text-[14px] font-medium text-white hover:bg-[#1765cc]">查询</button>
                </form>
                <p className="mt-2 text-[13px] text-[#70757a] dark:text-[#9aa0a6]">示例：教2、教2-313、图科楼、图5、无线楼、无1</p>

                {savedRoom ? (
                    <button
                        type="button"
                        onClick={() => onChange(savedRoom.params)}
                        className="mt-4 rounded-full border border-[#d2e3fc] bg-white px-4 py-2 text-[14px] font-medium text-[#174ea6] hover:bg-[#e8f0fe] dark:border-[#394457] dark:bg-[#202124] dark:text-[#8ab4f8] dark:hover:bg-[#1f2430]"
                    >
                        继续查看 {savedRoom.label}
                    </button>
                ) : null}

                {manifest ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {buildingsByCampus.map(([campusName, campusBuildings]) => (
                            <div key={campusName} className="rounded-lg border border-[#dadce0] bg-white p-3 dark:border-[#3c4043] dark:bg-[#202124]">
                                <div className="mb-2 text-[14px] font-medium text-[#202124] dark:text-[#e8eaed]">{campusName}</div>
                                <div className="flex flex-wrap gap-2">
                                    {campusBuildings.map(building => (
                                        <button
                                            key={`${campusName}-${building}`}
                                            type="button"
                                            onClick={() => onChange({ campus: campusName, building, room: null, floor: null, date: null, start: null, end: null })}
                                            className="rounded-full border border-[#d2e3fc] bg-white px-3 py-1.5 text-[13px] text-[#174ea6] hover:bg-[#e8f0fe] dark:border-[#394457] dark:bg-[#202124] dark:text-[#8ab4f8] dark:hover:bg-[#1f2430]"
                                        >
                                            {building}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? null : (
                    <div className="mt-5 h-20 animate-pulse rounded-lg bg-[#e8eaed] dark:bg-[#303134]" aria-hidden="true" />
                )}
            </section>
        </main>
    );
}
