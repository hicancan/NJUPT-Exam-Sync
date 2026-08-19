import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface HeaderRule {
    source: string;
    headers: Array<{ key: string; value: string }>;
}

describe('academic artifact delivery rules', () => {
    it('revalidates stable manifests and makes identity paths immutable', () => {
        const configPath = fileURLToPath(new URL('../../../public/edgeone.json', import.meta.url));
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as { headers: HeaderRule[] };
        const cacheControl = (source: string) => config.headers
            .find(rule => rule.source === source)
            ?.headers.find(header => header.key.toLowerCase() === 'cache-control')?.value;

        expect(cacheControl('/generated/exam/*')).toBe('public, max-age=31536000, immutable');
        expect(cacheControl('/generated/rooms/*')).toBe('public, max-age=31536000, immutable');
        expect(cacheControl('/generated/exam/manifest.json')).toBe('no-cache, max-age=0, must-revalidate');
        expect(cacheControl('/generated/rooms/manifest.json')).toBe('no-cache, max-age=0, must-revalidate');
    });
});
