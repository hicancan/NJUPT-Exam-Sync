import type { SitegraphDocMeta, SitegraphFullDocument, SitegraphLocalBodyIndex, SitegraphLocalLightIndex, SitegraphSearchFilters } from '@njupt-search/contracts';
import { sitegraphDocumentMatchesFilters } from './sitegraphFilters';
import { SITEGRAPH_FIELD_WEIGHTS } from './ranking/rankDocument';
import { normalizeSearchText as normalize } from './tokenizer';
import { SearchContractError } from './sitegraphContract';
import { sortedScoreEntries } from './sitegraphScoreRuntime';
import type { LoadedLocalBodyRuntimeIndex, LoadedLocalLightRuntimeIndex, PackedImpactRetrievalMetrics, PackedImpactRetrievalResult, PackedImpactRetrievalSession, PackedImpactRetriever, SearchTelemetry } from './sitegraphSearchTypes';

export const textBlob = (document: SitegraphFullDocument | SitegraphDocMeta, fields: Array<keyof SitegraphFullDocument | keyof SitegraphDocMeta>): string => {
    const values: string[] = [];
    for (const field of fields) {
        const value = document[field as keyof typeof document];
        if (Array.isArray(value)) values.push(...value.map(String));
        else if (value !== null && value !== undefined) values.push(String(value));
    }
    return normalize(values.join(' '));
};

export const fullScanBlob = (document: SitegraphFullDocument): string => normalize([
    document.title,
    document.section,
    document.nav_path_text,
    document.nav_path.join(' '),
    document.summary,
    document.content,
    document.url,
    document.attachments
        .map(attachment => [attachment.name, attachment.extension, attachment.url, attachment.section, attachment.parent_url].filter(Boolean).join(' '))
        .join(' ')
].join(' '));

interface ImpactBlock {
    key: string;
    impact: number;
    ids: number[];
}

export const competitiveThreshold = (scores: Map<number, number>, target: number): number => {
    if (scores.size < target) return Number.NEGATIVE_INFINITY;
    return sortedScoreEntries(scores)[Math.max(0, target - 1)]?.[1] ?? Number.NEGATIVE_INFINITY;
};

export const impactBlocksForTerms = (
    index: SitegraphLocalLightIndex | SitegraphLocalBodyIndex,
    terms: string[]
): ImpactBlock[] => {
    const blocks: ImpactBlock[] = [];
    const blockSize = Math.max(8, index.block_size || 32);
    for (const term of terms) {
        const termPayload = index.terms[term];
        if (!termPayload) continue;
        for (const [field, ids] of Object.entries(termPayload)) {
            const impact = (index.field_impacts[field] || SITEGRAPH_FIELD_WEIGHTS[field] || 8) + Math.min(term.length, 8);
            for (let offset = 0; offset < ids.length; offset += blockSize) {
                blocks.push({
                    key: `${term}\u0000${field}`,
                    impact,
                    ids: ids.slice(offset, offset + blockSize),
                });
            }
        }
    }
    return blocks.sort((a, b) => b.impact - a.impact || a.key.localeCompare(b.key));
};

export const suffixUniqueImpact = (blocks: ImpactBlock[]): number[] => {
    const suffix = new Array<number>(blocks.length + 1).fill(0);
    const seen = new Set<string>();
    let sum = 0;
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
        const block = blocks[index];
        if (block && !seen.has(block.key)) {
            seen.add(block.key);
            sum += block.impact;
        }
        suffix[index] = sum;
    }
    return suffix;
};

export const applyImpactIndex = (
    scores: Map<number, number>,
    index: SitegraphLocalLightIndex | SitegraphLocalBodyIndex,
    terms: string[],
    targetCandidates: number,
    telemetry: SearchTelemetry
): void => {
    const blocks = impactBlocksForTerms(index, terms);
    const suffix = suffixUniqueImpact(blocks);
    telemetry.retrieval.dynamicPruning = true;
    for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        if (!block) continue;
        const threshold = competitiveThreshold(scores, targetCandidates);
        telemetry.retrieval.competitiveThreshold = Number.isFinite(threshold) ? threshold : telemetry.retrieval.competitiveThreshold;
        const maxPossibleForUnseenDoc = block.impact + (suffix[index + 1] ?? 0);
        const hasKnownCandidate = block.ids.some(docIndex => scores.has(docIndex));
        if (!hasKnownCandidate && scores.size >= targetCandidates && maxPossibleForUnseenDoc <= threshold) {
            telemetry.retrieval.impactBlocksPruned += 1;
            telemetry.retrieval.postingsPruned += block.ids.length;
            continue;
        }
        telemetry.retrieval.impactBlocksVisited += 1;
        for (const docIndex of block.ids) {
            telemetry.retrieval.postingsVisited += 1;
            scores.set(docIndex, (scores.get(docIndex) || 0) + block.impact);
        }
    }
};

export const markRetrievalEngine = (
    telemetry: SearchTelemetry,
    engine: SearchTelemetry['retrieval']['engine']
): void => {
    if (engine === 'mixed') {
        telemetry.retrieval.engine = 'mixed';
        return;
    }
    if (telemetry.retrieval.engine !== engine) {
        telemetry.retrieval.engine = telemetry.retrieval.typescriptCalls + telemetry.retrieval.wasmCalls > 0 ? 'mixed' : engine;
    }
};

export const recordPackedImpactRetrieval = (
    result: PackedImpactRetrievalMetrics,
    telemetry: SearchTelemetry
): void => {
    telemetry.retrieval.dynamicPruning = true;
    markRetrievalEngine(telemetry, 'rust_wasm_packed_impact');
    telemetry.retrieval.wasmCalls += 1;
    telemetry.retrieval.impactBlocksVisited += result.impactBlocksVisited;
    telemetry.retrieval.impactBlocksPruned += result.impactBlocksPruned;
    telemetry.retrieval.postingsVisited += result.postingsVisited;
    telemetry.retrieval.postingsPruned += result.postingsPruned;
    telemetry.retrieval.competitiveThreshold = Number.isFinite(result.competitiveThreshold)
        ? result.competitiveThreshold
        : telemetry.retrieval.competitiveThreshold;
};

export const addPackedImpactScoreEntries = (
    scores: Map<number, number>,
    entries: Array<readonly [number, number]>,
    telemetry: SearchTelemetry
): void => {
    telemetry.retrieval.scoreEntriesReturned += entries.length;
    for (const [docIndex, score] of entries) {
        scores.set(docIndex, (scores.get(docIndex) || 0) + score);
    }
};

export const setPackedImpactScoreEntries = (
    scores: Map<number, number>,
    entries: Array<readonly [number, number]>,
    telemetry: SearchTelemetry
): void => {
    telemetry.retrieval.scoreEntriesReturned += entries.length;
    for (const [docIndex, score] of entries) {
        scores.set(docIndex, score);
    }
};

export const applyPackedImpactRetrieval = (
    scores: Map<number, number>,
    result: PackedImpactRetrievalResult,
    telemetry: SearchTelemetry
): void => {
    recordPackedImpactRetrieval(result, telemetry);
    addPackedImpactScoreEntries(scores, result.scoreEntries, telemetry);
};

export const syncPackedImpactSessionScores = async (
    scores: Map<number, number>,
    retrievalSession: PackedImpactRetrievalSession | undefined,
    telemetry: SearchTelemetry
): Promise<void> => {
    if (!retrievalSession) return;
    const entries = await retrievalSession.readScoreEntries();
    setPackedImpactScoreEntries(scores, entries, telemetry);
};

export const applyImpactIndexRuntime = async (
    scores: Map<number, number>,
    runtimeIndex: LoadedLocalLightRuntimeIndex | LoadedLocalBodyRuntimeIndex,
    terms: string[],
    targetCandidates: number,
    telemetry: SearchTelemetry,
    packedImpactRetriever?: PackedImpactRetriever,
    retrievalSession?: PackedImpactRetrievalSession
): Promise<boolean> => {
    if (runtimeIndex.packedBytes && runtimeIndex.packedPath && retrievalSession) {
        const result = await retrievalSession.applyPackedImpactScores({
            bytes: runtimeIndex.packedBytes,
            terms,
            targetCandidates,
            source: runtimeIndex.packedPath,
        });
        recordPackedImpactRetrieval(result, telemetry);
        return true;
    }
    if (runtimeIndex.packedBytes && runtimeIndex.packedPath && packedImpactRetriever) {
        const result = await packedImpactRetriever.retrievePackedImpactScores({
            bytes: runtimeIndex.packedBytes,
            terms,
            targetCandidates,
            source: runtimeIndex.packedPath,
        });
        applyPackedImpactRetrieval(scores, result, telemetry);
        return false;
    }
    if (!runtimeIndex.index) {
        throw new SearchContractError('Packed impact index runtime is missing a TypeScript index and WASM retriever');
    }
    markRetrievalEngine(telemetry, 'typescript_impact_index');
    telemetry.retrieval.typescriptCalls += 1;
    applyImpactIndex(scores, runtimeIndex.index, terms, targetCandidates, telemetry);
    return false;
};

export const applyLocalMetaFallback = (
    docsByIndex: Map<number, SitegraphDocMeta>,
    scores: Map<number, number>,
    normalizedQuery: string,
    filters: SitegraphSearchFilters,
    now: number
): number[] => {
    if (!normalizedQuery) return [];
    let filteredScoreCount = 0;
    for (const docIndex of scores.keys()) {
        const meta = docsByIndex.get(docIndex);
        if (meta && sitegraphDocumentMatchesFilters(meta, filters, now)) filteredScoreCount += 1;
        if (filteredScoreCount >= 8) return [];
    }
    const matchedIndices: number[] = [];
    for (const meta of docsByIndex.values()) {
        if (!sitegraphDocumentMatchesFilters(meta, filters, now)) continue;
        const haystack = textBlob(meta, ['title', 'section', 'nav_path_text']);
        if (haystack.includes(normalizedQuery)) {
            scores.set(meta.doc_index, (scores.get(meta.doc_index) || 0) + 90);
            matchedIndices.push(meta.doc_index);
        }
    }
    return matchedIndices;
};
