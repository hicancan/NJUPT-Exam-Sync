/* tslint:disable */
/* eslint-disable */

export class PackedImpactRetrievalSession {
    free(): void;
    [Symbol.dispose](): void;
    apply(bytes: Uint8Array, query_terms_json: string): string;
    apply_terms_utf8(bytes: Uint8Array, query_terms_utf8: Uint8Array, query_term_offsets: Uint32Array): string;
    constructor(target_candidates: number);
    score_entries_f64(): Float64Array;
    scores_json(): string;
    stats_json(): string;
}

export function decode_packed_impact_stats(bytes: Uint8Array): string;

export function decode_packed_impact_to_json(bytes: Uint8Array): string;

export function retrieve_packed_impact_topk_scores_utf8(bytes: Uint8Array, query_terms_utf8: Uint8Array, query_term_offsets: Uint32Array, target_candidates: number): string;

export function retrieve_packed_impact_topk_stats_utf8(bytes: Uint8Array, query_terms_utf8: Uint8Array, query_term_offsets: Uint32Array, target_candidates: number): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_packedimpactretrievalsession_free: (a: number, b: number) => void;
    readonly decode_packed_impact_stats: (a: number, b: number) => [number, number, number, number];
    readonly decode_packed_impact_to_json: (a: number, b: number) => [number, number, number, number];
    readonly packedimpactretrievalsession_apply: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly packedimpactretrievalsession_apply_terms_utf8: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly packedimpactretrievalsession_new: (a: number) => number;
    readonly packedimpactretrievalsession_score_entries_f64: (a: number) => [number, number];
    readonly packedimpactretrievalsession_scores_json: (a: number) => [number, number];
    readonly packedimpactretrievalsession_stats_json: (a: number) => [number, number];
    readonly retrieve_packed_impact_topk_scores_utf8: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly retrieve_packed_impact_topk_stats_utf8: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
