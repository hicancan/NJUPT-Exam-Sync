import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArtifactSource } from './artifacts';
import { CacheStore } from './cache';
import type { ArtifactRef, SearchBundleManifest } from './artifacts';

const bundleId = '1f60c01d18d0c333553ec3aad4f209936059805e2fe92acf3656538971fc4812';
const bytes = new Uint8Array([1, 2, 3]);
const reference: ArtifactRef = {
    path: 'documents.bin',
    bytes: bytes.byteLength,
    decoded_bytes: 3,
    sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
};
const manifest: SearchBundleManifest = {
    format: 'njupt-search-bundle-v2',
    bundle_id: bundleId,
    corpus_snapshot_id: 'b'.repeat(64),
    artifacts: {
        documents: reference,
        lexicon: { ...reference, path: 'lexicon.bin' },
    },
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
            `/generated/search/documents.bin?bundle=${bundleId}`,
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
});
