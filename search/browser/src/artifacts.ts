import { CacheStore } from './cache';

export interface ArtifactRef {
    path: string;
    bytes: number;
    decoded_bytes: number;
    sha256: string;
}

export interface SearchBundleManifest {
    format: 'njupt-search-bundle';
    bundle_id: string;
    corpus_snapshot_id: string;
    documents: ArtifactRef;
    lexicon: ArtifactRef;
    postings: ArtifactRef[];
    content: ArtifactRef[];
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function hasExactKeys(value: object, expected: string[]): boolean {
    const actual = Object.keys(value).sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === [...expected].sort()[index]);
}

function artifactRef(value: unknown, label: string, expectedPath: string): ArtifactRef {
    if (!value || typeof value !== 'object') throw new Error(`missing artifact: ${label}`);
    const candidate = value as Partial<ArtifactRef>;
    if (
        !hasExactKeys(value, ['path', 'bytes', 'decoded_bytes', 'sha256'])
        || candidate.path !== expectedPath
        || !Number.isSafeInteger(candidate.bytes)
        || (candidate.bytes ?? 0) <= 0
        || !Number.isSafeInteger(candidate.decoded_bytes)
        || (candidate.decoded_bytes ?? 0) <= 0
        || (candidate.decoded_bytes ?? 0) > 0xffff_ffff
        || typeof candidate.sha256 !== 'string'
        || !SHA256_PATTERN.test(candidate.sha256)
    ) {
        throw new Error(`invalid artifact reference: ${label}`);
    }
    return candidate as ArtifactRef;
}

function parseManifest(value: unknown): SearchBundleManifest {
    if (!value || typeof value !== 'object') throw new Error('invalid SearchBundle manifest');
    const manifest = value as Partial<SearchBundleManifest>;
    if (!hasExactKeys(value, [
            'format',
            'bundle_id',
            'corpus_snapshot_id',
            'documents',
            'lexicon',
            'postings',
            'content',
        ])) throw new Error('invalid SearchBundle manifest fields');
    if (manifest.format !== 'njupt-search-bundle') {
        throw new Error('incompatible SearchBundle format');
    }
    if (typeof manifest.bundle_id !== 'string' || !SHA256_PATTERN.test(manifest.bundle_id)) {
        throw new Error('invalid SearchBundle identity');
    }
    if (
        typeof manifest.corpus_snapshot_id !== 'string'
        || !SHA256_PATTERN.test(manifest.corpus_snapshot_id)
    ) {
        throw new Error('invalid corpus snapshot identity');
    }
    if (!Array.isArray(manifest.postings) || manifest.postings.length === 0) {
        throw new Error('SearchBundle postings are missing');
    }
    if (!Array.isArray(manifest.content) || manifest.content.length === 0) {
        throw new Error('SearchBundle content is missing');
    }
    artifactRef(manifest.documents, 'documents', 'documents.bin');
    artifactRef(manifest.lexicon, 'lexicon', 'lexicon.bin');
    manifest.postings.forEach((entry, index) => (
        artifactRef(entry, `postings[${index}]`, `postings-${index.toString().padStart(4, '0')}.bin`)
    ));
    manifest.content.forEach((entry, index) => (
        artifactRef(entry, `content[${index}]`, `content-${index.toString().padStart(4, '0')}.bin`)
    ));
    return manifest as SearchBundleManifest;
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function bundleIdentity(manifest: SearchBundleManifest): Promise<string> {
    const artifacts = [
        manifest.documents,
        manifest.lexicon,
        ...manifest.postings,
        ...manifest.content,
    ];
    const identity = artifacts
        .map(artifact => `${artifact.path}\0${artifact.bytes}\0${artifact.sha256}\0`)
        .join('');
    return sha256(new TextEncoder().encode(identity).buffer as ArrayBuffer);
}

export class ArtifactSource {
    private readonly baseUrl: string;
    private readonly cache: CacheStore;
    private manifestValue: SearchBundleManifest | null = null;

    constructor(baseUrl: string, cache: CacheStore) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.cache = cache;
    }

    async manifest(signal?: AbortSignal): Promise<SearchBundleManifest> {
        if (this.manifestValue) return this.manifestValue;
        const response = await fetch(`${this.baseUrl}/manifest.json`, {
            cache: 'no-cache',
            signal,
        });
        if (!response.ok) {
            throw new Error(`failed to load SearchBundle manifest (${response.status})`);
        }
        const manifest = parseManifest(await response.json());
        if (await bundleIdentity(manifest) !== manifest.bundle_id) {
            throw new Error('SearchBundle identity mismatch');
        }
        this.manifestValue = manifest;
        return this.manifestValue;
    }

    async bytes(reference: ArtifactRef, signal?: AbortSignal): Promise<ArrayBuffer> {
        const manifest = await this.manifest(signal);
        const key = `${manifest.bundle_id}/${reference.path}`;
        const cached = this.cache.get(key);
        if (cached) return cached;

        const artifactUrl = (
            `${this.baseUrl}/${reference.path}`
            + `?bundle=${encodeURIComponent(manifest.bundle_id)}`
        );
        const response = await fetch(artifactUrl, {
            cache: 'force-cache',
            signal,
        });
        if (!response.ok) {
            throw new Error(`failed to load SearchBundle artifact ${reference.path} (${response.status})`);
        }
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== reference.bytes) {
            throw new Error(`size mismatch for SearchBundle artifact ${reference.path}`);
        }
        if (await sha256(bytes) !== reference.sha256) {
            throw new Error(`hash mismatch for SearchBundle artifact ${reference.path}`);
        }
        this.cache.set(key, bytes);
        return bytes;
    }
}
