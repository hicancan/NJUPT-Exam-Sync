import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomOccupancyClient } from './RoomOccupancyClient';

const encode = (value: unknown) => JSON.stringify(value);
const sha256 = async (value: string): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};
const canonicalJson = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
};

const createFixture = async (updatedAt: string) => {
    const examSnapshotId = 'b'.repeat(64);
    const spaceSnapshotId = 'c'.repeat(64);
    const floor = {
        format: 'njupt-room-floor-occupancy',
        exam_snapshot_id: examSnapshotId,
        space_snapshot_id: spaceSnapshotId,
        date: '2026-07-01',
        campus: '仙林',
        building: '教2',
        floor: '3',
        floor_id: 'floor-key',
        booking_count: 0,
        bookings: [],
    };
    const floorText = encode(floor);
    const identity = {
        format: 'njupt-room-occupancy',
        exam_snapshot_id: examSnapshotId,
        space_snapshot_id: spaceSnapshotId,
        exam_period_id: '2025-2026-2',
        source_updated_at: updatedAt,
        unresolved_locations: [],
        dates: [{
            date: '2026-07-01',
            floors: [{
                floor_id: 'floor-key',
                booking_count: 0,
                artifact: {
                    path: 'floors/2026-07-01-floor-key.json',
                    bytes: new TextEncoder().encode(floorText).byteLength,
                    sha256: await sha256(floorText),
                },
            }],
        }],
    };
    const manifest = {
        ...identity,
        occupancy_id: await sha256(canonicalJson(identity)),
    };
    return { manifest, manifestText: encode(manifest), floor, floorText };
};

afterEach(() => vi.restoreAllMocks());

describe('RoomOccupancyClient', () => {
    it('reuses one manifest and floor in an SPA session and addresses data by occupancy identity', async () => {
        const fixture = await createFixture('2026-06-10T08:14:13+00:00');
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/manifest.json')) return new Response(fixture.manifestText);
            if (url.includes('/floors/')) return new Response(fixture.floorText);
            return new Response('missing', { status: 404 });
        });
        vi.stubGlobal('fetch', fetchMock);

        const client = new RoomOccupancyClient('https://artifact.test/rooms');
        const manifest = await client.initialize();
        await client.initialize();
        const artifact = manifest.dates[0]?.floors[0]?.artifact;
        if (!artifact) throw new Error('fixture artifact is missing');
        await client.loadFloor(artifact, manifest);
        await client.loadFloor(artifact, manifest);

        expect(fetchMock.mock.calls.filter(call => String(call[0]).endsWith('/manifest.json'))).toHaveLength(1);
        const floorCalls = fetchMock.mock.calls.filter(call => String(call[0]).includes('/floors/'));
        expect(floorCalls).toHaveLength(1);
        expect(String(floorCalls[0]?.[0])).toContain(`/rooms/${manifest.occupancy_id}/floors/`);
        client.dispose();
    });

    it('reinitializes and evicts floor state when the manifest identity changes', async () => {
        const first = await createFixture('2026-06-10T08:14:13+00:00');
        const second = await createFixture('2026-06-11T08:14:13+00:00');
        let manifestRequest = 0;
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/manifest.json')) {
                manifestRequest += 1;
                return new Response(manifestRequest === 1 ? first.manifestText : second.manifestText);
            }
            return new Response(first.floorText);
        }));

        const client = new RoomOccupancyClient('https://artifact.test/rooms');
        expect((await client.initialize()).occupancy_id).toBe(first.manifest.occupancy_id);
        expect((await client.refresh()).occupancy_id).toBe(second.manifest.occupancy_id);
        expect(client.occupancyId).toBe(second.manifest.occupancy_id);
        client.dispose();
    });

    it('cancels an older floor request when a newer selection starts', async () => {
        const fixture = await createFixture('2026-06-10T08:14:13+00:00');
        let floorRequest = 0;
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.endsWith('/manifest.json')) return Promise.resolve(new Response(fixture.manifestText));
            floorRequest += 1;
            if (floorRequest === 1) {
                return new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
                });
            }
            return Promise.resolve(new Response(fixture.floorText));
        }));

        const client = new RoomOccupancyClient('https://artifact.test/rooms');
        const manifest = await client.initialize();
        const artifact = manifest.dates[0]?.floors[0]?.artifact;
        if (!artifact) throw new Error('fixture artifact is missing');
        const older = client.loadFloor(artifact, manifest);
        await Promise.resolve();
        const newer = client.loadFloor(artifact, manifest);
        await expect(older).rejects.toMatchObject({ name: 'AbortError' });
        await expect(newer).resolves.toEqual(fixture.floor);
        client.dispose();
    });
});
