interface CampusLike {
  campus_id: string;
  name: string;
}

interface BuildingLike {
  building_id: string;
  campus_id: string;
  name: string;
}

export const sameSpaceLabel = (left: string, right: string): boolean =>
  left.trim().localeCompare(right.trim(), "zh-CN", { sensitivity: "base" }) ===
  0;

export const collapsedCampusBuilding = <T extends BuildingLike>(
  campus: CampusLike,
  buildings: readonly T[],
): T | null => {
  const campusBuildings = buildings.filter(
    (item) => item.campus_id === campus.campus_id,
  );
  if (campusBuildings.length !== 1) return null;
  const building = campusBuildings[0];
  return building && sameSpaceLabel(campus.name, building.name)
    ? building
    : null;
};
