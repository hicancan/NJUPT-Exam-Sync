import { describe, expect, it } from "vitest";
import { collapsedCampusBuilding } from "./spaceHierarchy";

describe("space hierarchy", () => {
  it("collapses a degenerate campus and building with the same label", () => {
    const campus = { campus_id: "campus-suojin", name: "锁金" };
    const building = {
      building_id: "building-suojin",
      campus_id: campus.campus_id,
      name: "锁金",
    };

    expect(collapsedCampusBuilding(campus, [building])).toEqual(building);
  });

  it("keeps a real multi-building campus hierarchy", () => {
    const campus = { campus_id: "campus-xianlin", name: "仙林" };
    const buildings = [
      {
        building_id: "building-jiao-1",
        campus_id: campus.campus_id,
        name: "教1",
      },
      {
        building_id: "building-jiao-2",
        campus_id: campus.campus_id,
        name: "教2",
      },
    ];

    expect(collapsedCampusBuilding(campus, buildings)).toBeNull();
  });

  it("does not collapse a unique building with a distinct label", () => {
    const campus = { campus_id: "campus-sanpailou", name: "三牌楼" };
    const building = {
      building_id: "building-jiao-xi",
      campus_id: campus.campus_id,
      name: "教西",
    };

    expect(collapsedCampusBuilding(campus, [building])).toBeNull();
  });
});
