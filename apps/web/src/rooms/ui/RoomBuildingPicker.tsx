import { uniqueValues } from '@njupt-search/academics-room';
import type { RoomFloor } from '@njupt-search/academics-room';

interface RoomBuildingPickerProps {
    floors: RoomFloor[];
    heading: string;
    onSelect: (campus: string, building: string) => void;
}

export function RoomBuildingPicker({ floors, heading, onSelect }: RoomBuildingPickerProps) {
    const buildingsByCampus = Array.from(new Map(floors.map(item => [item.campus, uniqueValues(floors
        .filter(floor => floor.campus === item.campus)
        .map(floor => floor.building))])).entries());

    return (
        <section aria-labelledby="room-building-picker-heading">
            <h2 id="room-building-picker-heading" className="text-[16px] font-medium text-[#202124] dark:text-[#e8eaed]">
                {heading}
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
                {buildingsByCampus.map(([campusName, campusBuildings]) => (
                    <div key={campusName} className="rounded-xl border border-[#dadce0] bg-white p-3 dark:border-[#3c4043] dark:bg-[#202124]">
                        <div className="mb-2 text-[14px] font-medium text-[#202124] dark:text-[#e8eaed]">{campusName}</div>
                        <div className="flex flex-wrap gap-2">
                            {campusBuildings.map(building => (
                                <button
                                    key={`${campusName}-${building}`}
                                    type="button"
                                    onClick={() => onSelect(campusName, building)}
                                    className="inline-flex h-9 items-center rounded-full border border-[#d2e3fc] bg-white px-3 text-[13px] text-[#174ea6] hover:bg-[#e8f0fe] dark:border-[#394457] dark:bg-[#202124] dark:text-[#8ab4f8] dark:hover:bg-[#1f2430]"
                                >
                                    {building}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
