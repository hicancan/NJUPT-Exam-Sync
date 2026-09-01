import {
    assertSpaceManifestIdentity,
    parseBuildings,
    parseCampuses,
    parseFloors,
    parseSpaceFamilies,
    parseSpaceGeometry,
    parseSpaceManifest,
    parseSpaceUnits,
} from '@njupt-search/academics-space';
import type {
    Building,
    Campus,
    Floor,
    SpaceArtifactRef,
    SpaceFamily,
    SpaceGeometry,
    SpaceManifest,
    SpaceUnit,
} from '@njupt-search/academics-space';
import { waitForAbort } from '@/shared/lib/abort';
import { fetchArtifactBytes, fetchArtifactJson, fetchJson } from '@/shared/lib/fetch';

export interface SpaceIndex {
    manifest: SpaceManifest;
    campuses: Campus[];
    buildings: Building[];
    floors: Floor[];
    families: SpaceFamily[];
}

export interface SpaceFamilyView {
    family: SpaceFamily;
    campus: Campus;
    building: Building;
    floor: Floor;
}

const artifactUrl = (baseUrl: string, snapshotId: string, artifact: SpaceArtifactRef): string => (
    `${baseUrl}/${snapshotId}/${artifact.path}?sha256=${artifact.sha256}`
);

export class SpaceClient {
    readonly #baseUrl: string;
    #index: SpaceIndex | null = null;
    #indexPromise: Promise<SpaceIndex> | null = null;
    #initializeController: AbortController | null = null;
    #unitCache = new Map<string, SpaceUnit[]>();
    #geometryCache = new Map<string, SpaceGeometry>();
    #planCache = new Map<string, string>();
    #disposed = false;

    constructor(baseUrl: string) {
        this.#baseUrl = baseUrl.replace(/\/+$/, '');
    }

    initialize(signal?: AbortSignal): Promise<SpaceIndex> {
        this.#assertUsable();
        if (this.#index) return waitForAbort(Promise.resolve(this.#index), signal);
        if (!this.#indexPromise) {
            const controller = new AbortController();
            this.#initializeController = controller;
            this.#indexPromise = this.#loadIndex(controller.signal).then(index => {
                this.#index = index;
                return index;
            }).catch(error => {
                this.#indexPromise = null;
                throw error;
            }).finally(() => {
                if (this.#initializeController === controller) this.#initializeController = null;
            });
        }
        return waitForAbort(this.#indexPromise, signal);
    }

    async listFamilies(
        filters: { campus?: string | null; building?: string | null; floor?: string | null; query?: string | null },
        signal?: AbortSignal,
    ): Promise<SpaceFamilyView[]> {
        const index = await this.initialize(signal);
        const campuses = new Map(index.campuses.map(item => [item.campus_id, item]));
        const buildings = new Map(index.buildings.map(item => [item.building_id, item]));
        const floors = new Map(index.floors.map(item => [item.floor_id, item]));
        const query = filters.query?.trim().toLocaleLowerCase('zh-CN') ?? '';
        return index.families.flatMap(family => {
            const building = buildings.get(family.building_id);
            const floor = floors.get(family.floor_id);
            const campus = building ? campuses.get(building.campus_id) : undefined;
            if (!campus || !building || !floor) return [];
            const searchable = [campus.name, building.name, floor.level, family.room_number, ...family.aliases].join(' ').toLocaleLowerCase('zh-CN');
            if (
                (filters.campus && campus.name !== filters.campus)
                || (filters.building && building.name !== filters.building)
                || (filters.floor && floor.level !== filters.floor)
                || (query && !searchable.includes(query))
            ) return [];
            return [{ family, campus, building, floor }];
        });
    }

    async loadBuildingUnits(buildingId: string, signal?: AbortSignal): Promise<SpaceUnit[]> {
        const index = await this.initialize(signal);
        const key = `${index.manifest.snapshot_id}:${buildingId}`;
        const cached = this.#unitCache.get(key);
        if (cached) return waitForAbort(Promise.resolve(cached), signal);
        const expectedPath = `space-units-${buildingId}.json`;
        const reference = index.manifest.artifacts.space_units.find(item => item.path === expectedPath);
        if (!reference) throw new Error(`当前空间数据没有楼栋 ${buildingId} 的空间分片`);
        const values = parseSpaceUnits(
            await fetchArtifactJson(artifactUrl(this.#baseUrl, index.manifest.snapshot_id, reference), reference, { signal, cache: 'force-cache' }),
            expectedPath,
        );
        this.#unitCache.set(key, values);
        return values;
    }

    async loadFloorGeometry(floorId: string, signal?: AbortSignal): Promise<SpaceGeometry | null> {
        const index = await this.initialize(signal);
        const floor = index.floors.find(item => item.floor_id === floorId);
        if (!floor?.geometry_path) return null;
        const key = `${index.manifest.snapshot_id}:${floorId}`;
        const cached = this.#geometryCache.get(key);
        if (cached) return waitForAbort(Promise.resolve(cached), signal);
        const reference = index.manifest.artifacts.geometry.find(item => item.path === floor.geometry_path);
        if (!reference) throw new Error(`楼层 ${floorId} 的几何引用不存在`);
        const geometry = parseSpaceGeometry(
            await fetchArtifactJson(artifactUrl(this.#baseUrl, index.manifest.snapshot_id, reference), reference, { signal, cache: 'force-cache' }),
            floor.geometry_path,
        );
        if (geometry.floor_id !== floorId || geometry.source_id !== index.manifest.source_id) throw new Error('楼层几何与当前空间数据不一致');
        this.#geometryCache.set(key, geometry);
        return geometry;
    }

    async loadFloorPlan(geometry: SpaceGeometry, signal?: AbortSignal): Promise<string> {
        const index = await this.initialize(signal);
        if (geometry.source_id !== index.manifest.source_id) throw new Error('楼层线稿与当前空间数据不一致');
        const key = `${index.manifest.snapshot_id}:${geometry.plan.sha256}`;
        const cached = this.#planCache.get(key);
        if (cached) return waitForAbort(Promise.resolve(cached), signal);
        const buffer = await fetchArtifactBytes(
            artifactUrl(this.#baseUrl, index.manifest.snapshot_id, geometry.plan),
            geometry.plan,
            { signal, cache: 'force-cache' },
        );
        const url = URL.createObjectURL(new Blob([buffer], { type: 'image/svg+xml' }));
        this.#planCache.set(key, url);
        return url;
    }

    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#initializeController?.abort();
        this.#index = null;
        this.#indexPromise = null;
        this.#unitCache.clear();
        this.#geometryCache.clear();
        for (const url of this.#planCache.values()) URL.revokeObjectURL(url);
        this.#planCache.clear();
    }

    async #loadIndex(signal?: AbortSignal): Promise<SpaceIndex> {
        const manifestUrl = `${this.#baseUrl}/manifest.json`;
        const manifest = parseSpaceManifest(await fetchJson(manifestUrl, { signal, cache: 'no-cache' }), manifestUrl);
        await assertSpaceManifestIdentity(manifest);
        const load = async (reference: SpaceArtifactRef): Promise<unknown> => fetchArtifactJson(
            artifactUrl(this.#baseUrl, manifest.snapshot_id, reference), reference, { signal, cache: 'force-cache' }
        );
        const [campuses, buildings, floors, families] = await Promise.all([
            load(manifest.artifacts.campuses).then(value => parseCampuses(value, manifest.artifacts.campuses.path)),
            load(manifest.artifacts.buildings).then(value => parseBuildings(value, manifest.artifacts.buildings.path)),
            load(manifest.artifacts.floors).then(value => parseFloors(value, manifest.artifacts.floors.path)),
            load(manifest.artifacts.space_families).then(value => parseSpaceFamilies(value, manifest.artifacts.space_families.path)),
        ]);
        if (
            campuses.length !== manifest.campus_count
            || buildings.length !== manifest.building_count
            || floors.length !== manifest.floor_count
            || families.length !== manifest.space_family_count
        ) throw new Error('空间索引数量与当前版本不一致');
        return { manifest, campuses, buildings, floors, families };
    }

    #assertUsable(): void {
        if (this.#disposed) throw new Error('SpaceClient has been disposed');
    }
}
