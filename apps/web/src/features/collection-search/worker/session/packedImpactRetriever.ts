import type {
    PackedImpactRetrievalMetrics,
    PackedImpactRetrievalResult,
    PackedImpactRetriever,
} from '@njupt-search/search-core';
import initPackedImpactDecoder, {
    PackedImpactRetrievalSession as WasmPackedImpactRetrievalSession,
    retrieve_packed_impact_topk_scores_utf8,
} from '../../wasm/packed_impact_decoder.js';
import packedImpactDecoderUrl from '../../wasm/packed_impact_decoder_bg.wasm?url';

const numeric = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const textEncoder = new TextEncoder();

const encodeQueryTerms = (terms: string[]): { bytes: Uint8Array; offsets: Uint32Array } => {
    const parts = terms.map(term => textEncoder.encode(term));
    const totalBytes = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const bytes = new Uint8Array(totalBytes);
    const offsets = new Uint32Array(parts.length * 2);
    let cursor = 0;
    parts.forEach((part, index) => {
        bytes.set(part, cursor);
        offsets[index * 2] = cursor;
        cursor += part.byteLength;
        offsets[index * 2 + 1] = cursor;
    });
    return { bytes, offsets };
};

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

const parseTypedScoreEntries = (value: ArrayLike<number>): Array<readonly [number, number]> => {
    if (value.length % 2 !== 0) {
        throw new Error(`Invalid typed score entry buffer length: ${value.length}`);
    }
    const entries: Array<readonly [number, number]> = [];
    for (let index = 0; index < value.length; index += 2) {
        const docIndex = value[index];
        const score = value[index + 1];
        if (typeof docIndex !== 'number' || typeof score !== 'number') {
            throw new Error(`Invalid typed score entry at offset ${index}`);
        }
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
                    const terms = encodeQueryTerms(input.terms);
                    const payload = wasmSession.apply_terms_utf8(
                        new Uint8Array(input.bytes),
                        terms.bytes,
                        terms.offsets,
                    );
                    return parsePackedImpactMetrics(JSON.parse(payload) as unknown);
                },
                async readScoreEntries() {
                    return parseTypedScoreEntries(wasmSession.score_entries_f64());
                },
            };
        },
        async retrievePackedImpactScores(input) {
            await ensureDecoder();
            const terms = encodeQueryTerms(input.terms);
            const payload = retrieve_packed_impact_topk_scores_utf8(
                new Uint8Array(input.bytes),
                terms.bytes,
                terms.offsets,
                input.targetCandidates,
            );
            return parsePackedImpactRetrieval(JSON.parse(payload) as unknown);
        },
    };
};
