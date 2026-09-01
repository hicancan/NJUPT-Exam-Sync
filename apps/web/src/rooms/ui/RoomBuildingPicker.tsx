import type { SpaceIndex } from '@/space/model/SpaceClient';

interface RoomBuildingPickerProps {
    space: SpaceIndex;
    heading: string;
    onSelect: (campus: string, building: string) => void;
}

export function RoomBuildingPicker({ space, heading, onSelect }: RoomBuildingPickerProps) {
    return (
        <section aria-labelledby="room-building-picker-heading">
            <h2 id="room-building-picker-heading" className="text-[16px] font-medium text-[#202124] dark:text-[#e8eaed]">{heading}</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
                {space.campuses.map(campus => {
                    const buildings = space.buildings
                        .filter(building => building.campus_id === campus.campus_id)
                        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
                    return (
                        <div key={campus.campus_id} className="rounded-xl border border-[#dadce0] bg-white p-3 dark:border-[#3c4043] dark:bg-[#202124]">
                            <div className="mb-2 text-[14px] font-medium text-[#202124] dark:text-[#e8eaed]">{campus.name}</div>
                            <div className="flex flex-wrap gap-2">
                                {buildings.map(building => (
                                    <button
                                        key={building.building_id}
                                        type="button"
                                        onClick={() => onSelect(campus.name, building.name)}
                                        className="inline-flex h-9 items-center rounded-full border border-[#d2e3fc] bg-white px-3 text-[13px] text-[#174ea6] hover:bg-[#e8f0fe] dark:border-[#394457] dark:bg-[#202124] dark:text-[#8ab4f8] dark:hover:bg-[#1f2430]"
                                    >
                                        {building.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
