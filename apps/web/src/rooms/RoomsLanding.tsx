import { useEffect, useState } from 'react';
import { InlineErrorBanner } from '@/shared/ui/InlineErrorBanner';
import { RoomBuildingPicker } from './ui/RoomBuildingPicker';
import { RoomsProductHeader } from './ui/RoomsProductHeader';
import type { RoomOccupancy } from '@njupt-search/academics-room';
import type { SavedRoomRoute } from '@/app/routing/routeContract';
import type { RoomOccupancyClient } from './model/RoomOccupancyClient';
import type { SpaceClient, SpaceIndex } from '@/space/model/SpaceClient';

interface RoomsLandingProps {
    client: RoomOccupancyClient;
    spaceClient: SpaceClient;
    savedRoom: SavedRoomRoute | null;
    onChange: (params: Record<string, string | null>, replace?: boolean) => void;
    onSubmit: (value: string) => void;
}

export function RoomsLanding({ client, spaceClient, savedRoom, onChange, onSubmit }: RoomsLandingProps) {
    const [query, setQuery] = useState('');
    const [manifest, setManifest] = useState<RoomOccupancy | null>(null);
    const [space, setSpace] = useState<SpaceIndex | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        Promise.all([client.initialize(controller.signal), spaceClient.initialize(controller.signal)])
            .then(([value, spaceIndex]) => {
                if (value.space_snapshot_id !== spaceIndex.manifest.snapshot_id) throw new Error('考试占用与空间数据身份不一致');
                if (!controller.signal.aborted) {
                    setManifest(value);
                    setSpace(spaceIndex);
                }
            })
            .catch(reason => {
                if (controller.signal.aborted) return;
                console.error(reason);
                setError('暂时无法加载教室信息，请刷新页面后重试。');
            });
        return () => controller.abort();
    }, [client, spaceClient]);

    return (
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-8 pt-3 sm:pt-6">
            <RoomsProductHeader
                description="输入楼栋或教室号，查看考试期间的教室占用情况。"
                roomCount={space?.families.filter(item => item.availability_eligible === 'eligible').length}
                dateCount={manifest?.dates.length}
                pendingLabel={error ? undefined : '正在加载校区和楼栋…'}
            />

            <InlineErrorBanner message={error} />
            <section className="rounded-xl border border-[#dadce0] bg-[#f8fbff] p-4 dark:border-[#3c4043] dark:bg-[#202124] sm:p-5">
                <form
                    className="grid max-w-[500px] grid-cols-[minmax(0,1fr)_88px] gap-2 sm:grid-cols-[minmax(0,1fr)_96px] sm:gap-3"
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
                        className="h-12 min-w-0 w-full rounded-lg border border-[#dadce0] bg-white px-3 text-[15px] text-[#202124] outline-none focus:border-[#1a73e8] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#e8eaed] sm:h-11"
                    />
                    <button type="submit" className="h-12 w-full rounded-lg bg-[#1a73e8] px-3 text-[14px] font-medium text-white hover:bg-[#1765cc] sm:h-11">查询</button>
                </form>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="mr-auto text-[13px] leading-5 text-[#70757a] dark:text-[#9aa0a6]">例如：教2、教2-313、图5、无1</p>
                    {savedRoom ? (
                        <button
                            type="button"
                            onClick={() => onChange(savedRoom.params)}
                            className="inline-flex h-9 items-center rounded-full border border-[#d2e3fc] bg-white px-3 text-[13px] font-medium text-[#174ea6] hover:bg-[#e8f0fe] dark:border-[#394457] dark:bg-[#202124] dark:text-[#8ab4f8] dark:hover:bg-[#1f2430]"
                        >
                            继续查看 {savedRoom.label}
                        </button>
                    ) : null}
                </div>
            </section>

            {space ? (
                <div className="mt-5">
                    <RoomBuildingPicker
                        space={space}
                        heading="按楼栋查看"
                        onSelect={(campus, building) => onChange({ campus, building, room: null, floor: null, date: null, start: null, end: null })}
                    />
                </div>
            ) : error ? null : (
                <div className="mt-5 h-20 animate-pulse rounded-xl bg-[#e8eaed] dark:bg-[#303134]" aria-hidden="true" />
            )}
        </main>
    );
}
