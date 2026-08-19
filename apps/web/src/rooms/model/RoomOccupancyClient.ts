import { fetchArtifactJson, fetchJson } from '@/shared/lib/fetch';
import { forwardAbort, waitForAbort } from '@/shared/lib/abort';
import {
    assertRoomOccupancyIdentity,
    parseRoomFloorOccupancy,
    parseRoomOccupancy,
} from '@njupt-search/academics-room';
import type {
    RoomArtifactRef,
    RoomFloorOccupancy,
    RoomOccupancy,
} from '@njupt-search/academics-room';

const artifactUrl = (baseUrl: string, occupancyId: string, artifact: RoomArtifactRef): string => {
    const path = `${baseUrl}/${occupancyId}/${artifact.path}`;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}sha256=${artifact.sha256}`;
};

export class RoomOccupancyClient {
    readonly #baseUrl: string;
    #manifest: RoomOccupancy | null = null;
    #manifestPromise: Promise<RoomOccupancy> | null = null;
    #initializeController: AbortController | null = null;
    #activeFloorController: AbortController | null = null;
    #floorCache = new Map<string, RoomFloorOccupancy>();
    #disposed = false;

    constructor(baseUrl: string) {
        this.#baseUrl = baseUrl.replace(/\/+$/, '');
    }

    get occupancyId(): string | null {
        return this.#manifest?.occupancy_id ?? null;
    }

    initialize(signal?: AbortSignal): Promise<RoomOccupancy> {
        this.#assertUsable();
        if (this.#manifest) return waitForAbort(Promise.resolve(this.#manifest), signal);
        if (!this.#manifestPromise) {
            const controller = new AbortController();
            this.#initializeController = controller;
            this.#manifestPromise = this.#loadManifest(controller.signal)
                .then(manifest => {
                    this.#manifest = manifest;
                    return manifest;
                })
                .catch(error => {
                    this.#manifestPromise = null;
                    throw error;
                })
                .finally(() => {
                    if (this.#initializeController === controller) this.#initializeController = null;
                });
        }
        return waitForAbort(this.#manifestPromise, signal);
    }

    async refresh(signal?: AbortSignal): Promise<RoomOccupancy> {
        this.#assertUsable();
        this.#initializeController?.abort();
        this.#initializeController = null;
        this.#manifestPromise = null;
        const manifest = await this.#loadManifest(signal);
        if (this.#manifest?.occupancy_id !== manifest.occupancy_id) {
            this.#activeFloorController?.abort();
            this.#floorCache.clear();
        }
        this.#manifest = manifest;
        this.#manifestPromise = Promise.resolve(manifest);
        return manifest;
    }

    async loadFloor(
        artifact: RoomArtifactRef,
        manifest: RoomOccupancy,
        signal?: AbortSignal,
    ): Promise<RoomFloorOccupancy> {
        this.#assertUsable();
        const current = await this.initialize(signal);
        if (current.occupancy_id !== manifest.occupancy_id) {
            throw new Error('RoomOccupancy manifest changed before the floor request completed');
        }
        const cacheKey = `${manifest.occupancy_id}:${artifact.path}:${artifact.sha256}`;
        const cached = this.#floorCache.get(cacheKey);
        if (cached) return cached;

        this.#activeFloorController?.abort();
        const controller = new AbortController();
        this.#activeFloorController = controller;
        const detach = forwardAbort(signal, controller);
        try {
            const url = artifactUrl(this.#baseUrl, manifest.occupancy_id, artifact);
            const payload = await fetchArtifactJson(
                url,
                artifact,
                { signal: controller.signal, cache: 'force-cache' },
            );
            const floor = parseRoomFloorOccupancy(payload, artifact.path);
            if (
                floor.exam_snapshot_id !== manifest.exam_snapshot_id
                || floor.room_catalog_id !== manifest.room_catalog_id
            ) {
                throw new Error(`教室占用分片与索引身份不一致: ${artifact.path}`);
            }
            this.#floorCache.set(cacheKey, floor);
            return floor;
        } finally {
            detach();
            if (this.#activeFloorController === controller) this.#activeFloorController = null;
        }
    }

    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#initializeController?.abort();
        this.#activeFloorController?.abort();
        this.#initializeController = null;
        this.#activeFloorController = null;
        this.#manifest = null;
        this.#manifestPromise = null;
        this.#floorCache.clear();
    }

    async #loadManifest(signal?: AbortSignal): Promise<RoomOccupancy> {
        const manifestUrl = `${this.#baseUrl}/manifest.json`;
        const manifest = parseRoomOccupancy(
            await fetchJson(manifestUrl, { signal, cache: 'no-cache' }),
            manifestUrl,
        );
        await assertRoomOccupancyIdentity(manifest);
        return manifest;
    }

    #assertUsable(): void {
        if (this.#disposed) throw new Error('RoomOccupancyClient has been disposed');
    }
}
