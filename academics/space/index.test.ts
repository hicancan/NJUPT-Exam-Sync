import { describe, expect, it } from "vitest";
import {
  parseSpaceFamilies,
  parseSpaceGeometry,
  parseSpaceManifest,
  SpaceContractError,
} from "./index";

const hash = (value: string): string => value.repeat(64).slice(0, 64);
const artifact = (path: string) => ({ path, bytes: 1, sha256: hash("a") });

describe("SpaceSnapshot decoder", () => {
  it("accepts only the current content-addressed manifest shape", () => {
    const manifest = parseSpaceManifest({
      format: "njupt-space-snapshot",
      snapshot_id: hash("b"),
      source_id: hash("c"),
      campus_count: 3,
      building_count: 11,
      floor_count: 41,
      space_family_count: 531,
      space_unit_count: 598,
      geometry_unit_count: 356,
      unresolved_count: 28,
      artifacts: {
        campuses: artifact("campuses.json"),
        buildings: artifact("buildings.json"),
        floors: artifact("floors.json"),
        space_families: artifact("space-families.json"),
        space_units: [artifact("space-units-building.json")],
        aliases: artifact("aliases.json"),
        connectors: artifact("connectors.json"),
        geometry: [artifact("geometry-floor.json")],
        audit: artifact("audit.json"),
      },
    });
    expect(manifest.space_family_count).toBe(531);
    expect(() =>
      parseSpaceManifest({ ...manifest, room_catalog_id: hash("d") }),
    ).toThrow(SpaceContractError);
  });

  it("rejects open or out-of-range public geometry", () => {
    const base = {
      format: "njupt-space-geometry",
      source_id: hash("d"),
      floor_id: "floor-1",
      coordinate_system: "schematic-normalized-image",
      geometry_accuracy: "schematic",
      view_box: [1000, 400],
      plan: artifact("plans/plan-floor-1.svg"),
    };
    expect(() =>
      parseSpaceGeometry({
        ...base,
        space_units: [
          {
            space_unit_id: "unit-1",
            geometry_status: "reviewed",
            label_point: [0.5, 0.5],
            polygon: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
          },
        ],
      }),
    ).toThrow(SpaceContractError);
    expect(() =>
      parseSpaceGeometry({
        ...base,
        space_units: [
          {
            space_unit_id: "unit-1",
            geometry_status: "reviewed",
            label_point: [2, 0.5],
            polygon: null,
          },
        ],
      }),
    ).toThrow(SpaceContractError);
    const oldGeometry = {
      format: base.format,
      source_id: base.source_id,
      floor_id: base.floor_id,
      coordinate_system: base.coordinate_system,
      geometry_accuracy: base.geometry_accuracy,
    };
    expect(() =>
      parseSpaceGeometry({ ...oldGeometry, space_units: [] }),
    ).toThrow(SpaceContractError);
  });

  it("requires a terminal public availability classification", () => {
    const family = {
      space_family_id: "family-1",
      building_id: "building-1",
      floor_id: "floor-1",
      room_number: "101",
      aliases: [],
      space_unit_ids: ["unit-1"],
      evidence_status: "floor_plan_only",
      availability_eligible: "ineligible",
    };

    expect(
      parseSpaceFamilies({
        format: "njupt-space-families",
        source_id: hash("e"),
        space_families: [family],
      })[0]?.availability_eligible,
    ).toBe("ineligible");
    expect(() =>
      parseSpaceFamilies({
        format: "njupt-space-families",
        source_id: hash("e"),
        space_families: [{ ...family, availability_eligible: "unknown" }],
      }),
    ).toThrow(SpaceContractError);
  });
});
