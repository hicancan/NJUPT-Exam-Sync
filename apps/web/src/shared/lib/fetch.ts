export type FetchResourceType =
    | 'manifest'
    | 'index'
    | 'shard'
    | 'exam-summary'
    | 'exam-class-index'
    | 'exam-class-data-versioned'
    | 'exam-history-class-versioned'
    | 'room-occupancy'
    | 'room-floor-occupancy-versioned'
    | 'default';

const cacheModeFor = (resourceType: FetchResourceType): RequestCache => {
    switch (resourceType) {
        case 'manifest':
            return 'reload';
        case 'index':
        case 'shard':
            return 'force-cache';
        case 'exam-summary':
        case 'exam-class-index':
        case 'room-occupancy':
            return 'no-store';
        case 'exam-class-data-versioned':
        case 'exam-history-class-versioned':
        case 'room-floor-occupancy-versioned':
            return 'force-cache';
        default:
            return 'default';
    }
};

export const fetchJson = async <T = unknown>(
    url: string,
    signal?: AbortSignal,
    resourceType: FetchResourceType = 'default'
): Promise<T> => {
    const response = await fetch(url, { cache: cacheModeFor(resourceType), signal });

    if (!response.ok) {
        throw new Error(`数据请求失败: ${url} HTTP ${response.status}`);
    }

    const responseForError = response.clone();
    try {
        return await response.json() as T;
    } catch {
        let preview = '';
        try {
            preview = (await responseForError.text()).slice(0, 160).replace(/\s+/g, ' ');
        } catch {
            preview = '';
        }
        const contentType = response.headers.get('content-type') || 'unknown';
        throw new Error(`数据文件不是有效 JSON: ${url}；content-type=${contentType}${preview ? `；preview=${preview}` : ''}`);
    }
};

export interface ArtifactReference {
    path: string;
    bytes: number;
    sha256: string;
}

const sha256Hex = async (bytes: ArrayBuffer): Promise<string> => {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

export const fetchArtifactJson = async <T = unknown>(
    url: string,
    artifact: ArtifactReference,
    signal?: AbortSignal,
    resourceType: FetchResourceType = 'default',
): Promise<T> => {
    const response = await fetch(url, { cache: cacheModeFor(resourceType), signal });
    if (!response.ok) {
        throw new Error(`数据请求失败: ${url} HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.byteLength !== artifact.bytes) {
        throw new Error(`数据文件大小不匹配: ${artifact.path}`);
    }
    if (await sha256Hex(buffer) !== artifact.sha256) {
        throw new Error(`数据文件哈希不匹配: ${artifact.path}`);
    }
    try {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as T;
    } catch {
        throw new Error(`数据文件不是有效 JSON: ${artifact.path}`);
    }
};
