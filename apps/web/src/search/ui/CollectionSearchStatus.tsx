interface CollectionSearchStatusProps {
    documentCount: number;
    elapsedMicros: number | null;
    statusText: string;
}

export function CollectionSearchStatus({
    documentCount,
    elapsedMicros,
    statusText,
}: CollectionSearchStatusProps) {
    return (
        <div className="mt-1 flex max-w-[880px] flex-col gap-1 text-sm text-[#70757a] dark:text-[#9aa0a6] sm:flex-row sm:items-center sm:justify-between">
            <p>{statusText}</p>
            {documentCount > 0 ? (
                <p className="shrink-0 text-[12px]">
                    语料 {documentCount.toLocaleString('zh-CN')} 篇
                    {elapsedMicros === null ? '' : ` · 内核 ${(elapsedMicros / 1000).toFixed(1)} ms`}
                </p>
            ) : null}
        </div>
    );
}
