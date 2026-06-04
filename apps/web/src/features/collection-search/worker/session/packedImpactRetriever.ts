import type {
    PackedImpactRetrievalMetrics,
    PackedImpactRetrievalResult,
    PackedImpactRetriever,
} from '@njupt-search/search-core';
import initPackedImpactDecoder, {
    PackedImpactRetrievalSession as WasmPackedImpactRetrievalSession,
    retrieve_packed_impact_topk_scores,
} from '../../wasm/packed_impact_decoder.js';
import packedImpactDecoderUrl from '../../wasm/packed_impact_decoder_bg.wasm?url';

const numeric = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;

const parseScoreEntries = (value: unknown): Array<readonly [number, number]> => {
    if (!Array.isArray(value)) return [];
    const entries: Array<readonly [number, number]> = [];
    for (const item of value) {
        if (!Array.isArray(item)) continue;
        const docIndex = numeric(item[0]);
        const score = numeric(item[1]);
        if (Number.isInteger(docIndex) && score > 0) entries.push([docIndex, score]);
    }
    return entries;
};

const parsePackedImpactMetrics = (payload: unknown): PackedImpactRetrievalMetrics => {
    const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    return {
        matchedTermCount: numeric(record.matched_term_count),
        blockCount: numeric(record.block_count),
        candidateCount: numeric(record.candidate_count),
        impactBlocksVisited: numeric(record.impact_blocks_visited),
        impactBlocksPruned: numeric(record.impact_blocks_pruned),
        postingsVisited: numeric(record.postings_visited),
        postingsPruned: numeric(record.postings_pruned),
        competitiveThreshold: numeric(record.competitive_threshold),
    };
};

const parsePackedImpactRetrieval = (payload: unknown): PackedImpactRetrievalResult => {
    const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    return {
        ...parsePackedImpactMetrics(record),
        scoreEntries: parseScoreEntries(record.score_entries),
    };
};

export const createPackedImpactRetriever = (): PackedImpactRetriever => {
    let decoderReady: Promise<unknown> | null = null;
    const ensureDecoder = (): Promise<unknown> => {
        decoderReady ??= initPackedImpactDecoder(packedImpactDecoderUrl);
        return decoderReady;
    };

    return {
        engine: 'rust_wasm_packed_impact',
        async createSession(targetCandidates) {
            await ensureDecoder();
            const wasmSession = new WasmPackedImpactRetrievalSession(targetCandidates);
            return {
                async applyPackedImpactScores(input) {
                    const payload = wasmSession.apply(
                        new Uint8Array(input.bytes),
                        JSON.stringify(input.terms),
                    );
                    return parsePackedImpactMetrics(JSON.parse(payload) as unknown);
                },
                async readScoreEntries() {
                    const payload = JSON.parse(wasmSession.scores_json()) as unknown;
                    const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
                    return parseScoreEntries(record.score_entries);
                },
            };
        },
        async retrievePackedImpactScores(input) {
            await ensureDecoder();
            const payload = retrieve_packed_impact_topk_scores(
                new Uint8Array(input.bytes),
                JSON.stringify(input.terms),
                input.targetCandidates,
            );
            return parsePackedImpactRetrieval(JSON.parse(payload) as unknown);
        },
    };
};
