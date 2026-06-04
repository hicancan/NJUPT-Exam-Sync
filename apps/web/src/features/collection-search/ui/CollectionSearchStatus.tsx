import { ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type {
    SitegraphQueryStats,
    SitegraphSearchCoverage,
} from '@/shared/lib/contracts';
import { getSearchCoverageProgress } from './searchCoverageProgress';
import {
    fieldLabel,
    firstResultSourceLabel,
    formatBytes,
    queryClassLabel,
} from './collectionSearchLabels';

interface CollectionSearchStatusProps {
    coverage: SitegraphSearchCoverage | null;
    queryStats: SitegraphQueryStats | null;
    showDiagnostics: boolean;
    statusText: string;
    onDiagnosticsToggle: () => void;
}

export function CollectionSearchStatus({
    coverage,
    queryStats,
    showDiagnostics,
    statusText,
    onDiagnosticsToggle,
}: CollectionSearchStatusProps) {
    const coverageProgress = coverage ? getSearchCoverageProgress(coverage) : null;

    return (
        <>
            <div className="mt-1 flex max-w-[880px] flex-col gap-2 text-sm text-[#70757a] dark:text-[#9aa0a6] sm:flex-row sm:items-center sm:justify-between">
                <p>
                    {statusText}
                </p>
                {coverageProgress ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
                        <span className="inline-flex items-center gap-1">
                            <ShieldCheck size={14} className="text-[#188038] dark:text-[#81c995]" aria-hidden="true" />
                            {coverageProgress.label}
                        </span>
                        {coverageProgress.showBar ? (
                            <div
                                className="h-1.5 w-28 overflow-hidden rounded-full bg-[#e8eaed] dark:bg-[#3c4043]"
                                aria-label={`官网信息核查进度 ${coverageProgress.percent}%`}
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={coverageProgress.percent}
                            >
                                <div
                                    className="h-full rounded-full bg-[#1a73e8] transition-[width] duration-300 ease-out dark:bg-[#8ab4f8]"
                                    style={{ width: `${coverageProgress.percent}%` }}
                                />
                            </div>
                        ) : null}
                        <button
                            type="button"
                            onClick={onDiagnosticsToggle}
                            className="inline-flex items-center gap-1 text-[#1a73e8] dark:text-[#8ab4f8] hover:underline"
                        >
                            {showDiagnostics ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                            技术细节
                        </button>
                    </div>
                ) : null}
            </div>
            {coverage && showDiagnostics ? (
                <div className="mt-2 max-w-[880px] rounded-md border border-[#dadce0] dark:border-[#3c4043] bg-[#f8fafc] dark:bg-[#2d2e30] px-3 py-2 text-[13px] text-[#4d5156] dark:text-[#bdc1c6]">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>已证明跳过 {coverage.proved_no_match_shards}</span>
                        <span>筛选排除 {coverage.excluded_by_filter_shards}</span>
                        <span>待证明 {coverage.pending_shards}</span>
                        <span>失败 {coverage.failed_shards}</span>
                        <span>已扫描 {coverage.scanned_shards}/{coverage.total_shards}</span>
                        <span>文档 {coverage.searched_documents}/{coverage.total_documents}</span>
                        <span>已加载 {formatBytes(coverage.loaded_bytes)}</span>
                        <span>新读 {formatBytes(coverage.uncached_loaded_bytes)}</span>
                        <span>缓存命中 {formatBytes(coverage.cached_artifact_bytes)} / {coverage.cache.artifact_hits}</span>
                        {coverage.cache.scope === 'browser_persistent_content_hash' ? (
                            <span>持久缓存 {coverage.cache.persistent_hits} / 内存 {coverage.cache.memory_hits}</span>
                        ) : null}
                        <span>阶段：{coverage.phase}</span>
                        <span>字段：{fieldLabel(coverage.searched_fields)}</span>
                        {queryStats ? (
                            <>
                                {firstResultSourceLabel(queryStats.first_result_source) ? (
                                    <span>首屏路径 {firstResultSourceLabel(queryStats.first_result_source)}</span>
                                ) : null}
                                {queryClassLabel(queryStats.query_class) ? (
                                    <span>查询类型 {queryClassLabel(queryStats.query_class)}</span>
                                ) : null}
                                <span>fast-start {queryStats.fast_start_used ? '是' : '否'}</span>
                                <span>局部元数据兜底 {queryStats.fallbacks.localMetaFallbackDocuments}</span>
                                <span>摘要兜底 {queryStats.fallbacks.snippetFallbackResults}</span>
                                <span>验证命中 {queryStats.fallbacks.verifiedFullScanMatches}</span>
                                <span>局部索引 {queryStats.loadedLocalIndexCount}</span>
                                {queryStats.retrieval.engine ? (
                                    <span>检索内核 {queryStats.retrieval.engine}</span>
                                ) : null}
                                <span>剪枝块 {queryStats.retrieval.impactBlocksPruned}</span>
                                <span>跳过 postings {queryStats.retrieval.postingsPruned}</span>
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </>
    );
}
