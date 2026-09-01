export interface ArtifactReference {
    path: string;
    bytes: number;
    sha256: string;
}

export interface FetchOptions {
    signal?: AbortSignal;
    cache?: RequestCache;
}

export const fetchJson = async <T = unknown>(
    url: string,
    options: FetchOptions = {}
): Promise<T> => {
    const response = await fetch(url, {
        cache: options.cache ?? 'default',
        signal: options.signal
    });
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

const sha256Hex = async (bytes: ArrayBuffer): Promise<string> => {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

export const fetchArtifactJson = async <T = unknown>(
    url: string,
    artifact: ArtifactReference,
    options: FetchOptions = {}
): Promise<T> => {
    const response = await fetch(url, {
        cache: options.cache ?? 'default',
        signal: options.signal
    });
    if (!response.ok) {
        throw new Error(`数据请求失败: ${url} HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== artifact.bytes) {
        throw new Error(`数据文件大小不匹配: ${artifact.path}`);
    }
    if (await sha256Hex(buffer) !== artifact.sha256) {
        throw new Error(`数据文件哈希不匹配: ${artifact.path}`);
    }
    try {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)) as T;
    } catch {
        throw new Error(`数据文件不是有效 JSON: ${artifact.path}`);
    }
};

export const fetchArtifactBytes = async (
    url: string,
    artifact: ArtifactReference,
    options: FetchOptions = {},
): Promise<ArrayBuffer> => {
    const response = await fetch(url, {
        cache: options.cache ?? 'default',
        signal: options.signal,
    });
    if (!response.ok) throw new Error(`数据请求失败: ${url} HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== artifact.bytes) throw new Error(`数据文件大小不匹配: ${artifact.path}`);
    if (await sha256Hex(buffer) !== artifact.sha256) throw new Error(`数据文件哈希不匹配: ${artifact.path}`);
    return buffer;
};
