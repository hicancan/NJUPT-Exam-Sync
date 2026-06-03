import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJsonArtifact } from '../src/fetchJson';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe('fetchJsonArtifact', () => {
    it('bypasses browser caches once for retryable immutable artifact failures', async () => {
        const calls: Array<{ url: string; cache?: RequestCache }> = [];
        globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            calls.push({ url: String(input), cache: init?.cache });
            if (calls.length === 1) {
                return new Response('missing edge artifact', { status: 404 });
            }
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }) as typeof fetch;

        const result = await fetchJsonArtifact('/generated/collections/njupt-public/sitegraph/full_shards/full.example.json', undefined, 'shard');

        expect(result.value).toEqual({ ok: true });
        expect(result.cacheHit).toBe(false);
        expect(calls).toHaveLength(2);
        expect(calls[0]).toEqual({
            url: '/generated/collections/njupt-public/sitegraph/full_shards/full.example.json',
            cache: 'force-cache',
        });
        expect(calls[1]?.url).toContain('/generated/collections/njupt-public/sitegraph/full_shards/full.example.json?__njupt_retry=');
        expect(calls[1]?.cache).toBe('reload');
    });
});
