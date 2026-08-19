import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArtifactSource } from './artifacts';
import { CacheStore } from './cache';
import type { ArtifactRef, SearchBundleManifest } from './artifacts';

const bundleId = '5b61cfcadf0592d78c9c39798ac4de6c1ff4ffb7b99af575becc967cfbd79cca';
const bytes = new Uint8Array([1, 2, 3]);
const reference: ArtifactRef = {
    path: 'documents.bin',
    bytes: bytes.byteLength,
    decoded_bytes: 3,
    sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
};
const manifest: SearchBundleManifest = {
    format: 'njupt-search-bundle',
    bundle_id: bundleId,
    corpus_snapshot_id: 'b'.repeat(64),
    documents: reference,
    lexicon: { ...reference, path: 'lexicon.bin' },
    postings: [{ ...reference, path: 'postings-0000.bin' }],
    content: [{ ...reference, path: 'content-0000.bin' }],
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ArtifactSource', () => {
    it('binds immutable artifact requests to the bundle identity', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(
                new Response(JSON.stringify(manifest), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }),
            )
            .mockResolvedValueOnce(new Response(bytes, { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const source = new ArtifactSource(
            '/generated/search',
            new CacheStore(1024),
        );
        await source.bytes(reference);

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            `/generated/search/${bundleId}/documents.bin`,
            expect.objectContaining({ cache: 'force-cache' }),
        );
    });

    it('rejects a manifest with a false bundle identity', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ ...manifest, bundle_id: '0'.repeat(64) }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        ));
        const source = new ArtifactSource('/generated/search', new CacheStore(1024));

        await expect(source.manifest()).rejects.toThrow('SearchBundle identity mismatch');
    });

    it('rejects missing and corrupted immutable artifacts', async () => {
        const missingFetch = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(manifest), { status: 200 }))
            .mockResolvedValueOnce(new Response('missing', { status: 404 }));
        vi.stubGlobal('fetch', missingFetch);
        const missing = new ArtifactSource('/generated/search', new CacheStore(1024));
        await expect(missing.bytes(reference)).rejects.toThrow(
            'failed to load SearchBundle artifact documents.bin (404)',
        );

        const corruptFetch = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(manifest), { status: 200 }))
            .mockResolvedValueOnce(new Response(new Uint8Array([3, 2, 1]), { status: 200 }));
        vi.stubGlobal('fetch', corruptFetch);
        const corrupt = new ArtifactSource('/generated/search', new CacheStore(1024));
        await expect(corrupt.bytes(reference)).rejects.toThrow(
            'hash mismatch for SearchBundle artifact documents.bin',
        );
    });

    it('uses one request for concurrent readers of the same immutable artifact', async () => {
        let release: ((response: Response) => void) | undefined;
        const artifactResponse = new Promise<Response>(resolve => { release = resolve; });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(manifest), { status: 200 }))
            .mockReturnValueOnce(artifactResponse);
        vi.stubGlobal('fetch', fetchMock);
        const source = new ArtifactSource('/generated/search', new CacheStore(1024));

        const first = source.bytes(reference);
        const second = source.bytes(reference);
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        release?.(new Response(bytes, { status: 200 }));

        await expect(Promise.all([first, second])).resolves.toHaveLength(2);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
