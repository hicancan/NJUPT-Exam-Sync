export const sameSpaceLabel = (left: string, right: string): boolean =>
  left.trim().localeCompare(right.trim(), "zh-CN", { sensitivity: "base" }) ===
  0;

export const formatCampusBuildingLabel = (
  campusName: string,
  buildingName: string,
): string =>
  sameSpaceLabel(campusName, buildingName)
    ? `${campusName}校区`
    : `${campusName}校区 · ${buildingName}`;
