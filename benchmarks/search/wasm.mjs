import { readFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import initWasm, { SearchEngine } from '../../search/browser/wasm/njupt_search_wasm.js';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bundleIndex = process.argv.indexOf('--bundle');
const bundle = bundleIndex >= 0 ? process.argv[bundleIndex + 1] : undefined;
if (!bundle) throw new Error('missing --bundle');
const root = path.resolve(bundle);
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));

const wasmStarted = performance.now();
await initWasm({
    module_or_path: readFileSync(
        path.join(repository, 'search/browser/wasm/njupt_search_wasm_bg.wasm'),
    ),
});
const wasmInitMs = performance.now() - wasmStarted;
const documents = readFileSync(path.join(root, manifest.documents.path));
const lexicon = readFileSync(path.join(root, manifest.lexicon.path));

function engine() {
    return new SearchEngine(
        documents,
        manifest.documents.decoded_bytes,
        lexicon,
        manifest.lexicon.decoded_bytes,
    );
}

const metadataStarted = performance.now();
engine().free();
const metadataDecodeMs = performance.now() - metadataStarted;
const queries = JSON.parse(readFileSync(
    path.join(repository, 'benchmarks/search/quick-search-queries.json'),
    'utf8',
));
const measurements = [];

for (const query of queries) {
    const current = engine();
    const request = JSON.stringify({ query, limit: 10, sort: 'relevance', filters: {} });
    const postingChunks = JSON.parse(current.begin_search(request));
    const postingStarted = performance.now();
    let postingBytes = 0;
    let postingDecodedBytes = 0;
    for (const chunk of postingChunks) {
        const reference = manifest.postings[chunk];
        const bytes = readFileSync(path.join(root, reference.path));
        postingBytes += bytes.byteLength;
        postingDecodedBytes += reference.decoded_bytes;
        current.load_postings_chunk(chunk, bytes, reference.decoded_bytes);
    }
    const postingMs = performance.now() - postingStarted;
    const rankStarted = performance.now();
    const ranked = JSON.parse(current.prepare_search());
    const exactResultsReadyMs = performance.now() - rankStarted;
    if (!ranked.results.every(result => result.snippet === null)) {
        throw new Error(`${query}: ranked response unexpectedly contains snippets`);
    }
    const contentChunks = JSON.parse(current.required_content_chunks(0, 10));
    const contentStarted = performance.now();
    let contentBytes = 0;
    let contentDecodedBytes = 0;
    for (const chunk of contentChunks) {
        const reference = manifest.content[chunk];
        const bytes = readFileSync(path.join(root, reference.path));
        contentBytes += bytes.byteLength;
        contentDecodedBytes += reference.decoded_bytes;
        current.load_content_chunk(chunk, bytes, reference.decoded_bytes);
    }
    const hydrated = JSON.parse(current.hydrate_search(0, 10));
    const contentMs = performance.now() - contentStarted;
    const rankedIds = ranked.results.map(result => result.id);
    const hydratedIds = hydrated.results.map(result => result.id);
    if (JSON.stringify(rankedIds) !== JSON.stringify(hydratedIds)) {
        throw new Error(`${query}: hydration changed exact result order`);
    }
    if (!hydrated.results.every(result => typeof result.snippet === 'string')) {
        throw new Error(`${query}: hydrated response is missing snippets`);
    }
    current.clear_content();
    const warmStarted = performance.now();
    const warmPostingChunks = JSON.parse(current.begin_search(request));
    const warmRanked = JSON.parse(current.prepare_search());
    if (warmPostingChunks.length !== 0 || warmRanked.results.length !== ranked.results.length) {
        throw new Error(`${query}: prepared query was not reused`);
    }
    const warmRankMs = performance.now() - warmStarted;
    current.free();
    measurements.push({
        query,
        candidates: ranked.totalCandidates,
        posting_requests: postingChunks.length,
        posting_bytes: postingBytes,
        posting_decoded_bytes: postingDecodedBytes,
        posting_load_ms: postingMs,
        exact_results_ready_ms: exactResultsReadyMs,
        content_requests: contentChunks.length,
        content_bytes: contentBytes,
        content_decoded_bytes: contentDecodedBytes,
        decoded_working_set_bytes: manifest.documents.decoded_bytes
            + manifest.lexicon.decoded_bytes
            + postingDecodedBytes
            + contentDecodedBytes,
        snippets_ready_ms: contentMs,
        warm_plan_ms: warmRankMs,
        top_result: ranked.results[0] ?? null,
    });
}

const average = (field) => measurements.reduce((sum, value) => sum + value[field], 0)
    / measurements.length;
process.stdout.write(`${JSON.stringify({
    wasm_init_ms: wasmInitMs,
    metadata_decode_ms: metadataDecodeMs,
    metadata_transfer_bytes: manifest.documents.bytes + manifest.lexicon.bytes,
    averages: {
        posting_requests: average('posting_requests'),
        posting_bytes: average('posting_bytes'),
        posting_decoded_bytes: average('posting_decoded_bytes'),
        exact_results_ready_ms: average('exact_results_ready_ms'),
        content_requests: average('content_requests'),
        content_bytes: average('content_bytes'),
        content_decoded_bytes: average('content_decoded_bytes'),
        decoded_working_set_bytes: average('decoded_working_set_bytes'),
        snippets_ready_ms: average('snippets_ready_ms'),
        warm_plan_ms: average('warm_plan_ms'),
    },
    measurements,
}, null, 2)}\n`);
