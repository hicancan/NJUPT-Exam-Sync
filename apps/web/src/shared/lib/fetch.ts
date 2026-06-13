export type FetchResourceType =
    | 'manifest'
    | 'index'
    | 'shard'
    | 'exam-summary'
    | 'exam-class-index'
    | 'exam-class-data-versioned'
    | 'exam-history-class-versioned'
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
            return 'no-store';
        case 'exam-class-data-versioned':
        case 'exam-history-class-versioned':
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
