import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import initWasm, { SearchEngine } from '../../search/browser/wasm/njupt_search_wasm.js';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bundleIndex = process.argv.indexOf('--bundle');
const bundle = bundleIndex >= 0 ? process.argv[bundleIndex + 1] : undefined;
if (!bundle) throw new Error('missing --bundle');
const root = path.resolve(bundle);
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const queries = JSON.parse(readFileSync(
    path.join(repository, 'benchmarks/search/consistency-queries.json'),
    'utf8',
));

await initWasm({
    module_or_path: readFileSync(
        path.join(repository, 'search/browser/wasm/njupt_search_wasm_bg.wasm'),
    ),
});
const documents = readFileSync(path.join(root, manifest.documents.path));
const lexicon = readFileSync(path.join(root, manifest.lexicon.path));

const reports = [];
for (const query of queries) {
    const native = spawnSync('cargo', [
        'run', '--quiet', '--release', '--manifest-path', 'search/Cargo.toml',
        '-p', 'njupt-search', '--', 'query', '--bundle', root,
        '--request-json', JSON.stringify(query),
    ], { cwd: repository, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (native.status !== 0) {
        throw new Error(native.stderr.trim() || `native query failed: ${native.status}`);
    }
    const nativeResponse = JSON.parse(native.stdout);

    const wasm = new SearchEngine(
        documents,
        manifest.documents.decoded_bytes,
        lexicon,
        manifest.lexicon.decoded_bytes,
    );
    const postings = JSON.parse(wasm.begin_search(JSON.stringify(query)));
    for (const chunk of postings) {
        const reference = manifest.postings[chunk];
        wasm.load_postings_chunk(
            chunk,
            readFileSync(path.join(root, reference.path)),
            reference.decoded_bytes,
        );
    }
    wasm.prepare_search();
    const contents = JSON.parse(wasm.required_content_chunks(0, query.limit));
    for (const chunk of contents) {
        const reference = manifest.content[chunk];
        wasm.load_content_chunk(
            chunk,
            readFileSync(path.join(root, reference.path)),
            reference.decoded_bytes,
        );
    }
    const wasmResponse = JSON.parse(wasm.hydrate_search(0, query.limit));
    wasm.free();

    if (nativeResponse.totalCandidates !== wasmResponse.totalCandidates) {
        throw new Error(`${query.query}: Native and WASM candidate totals differ`);
    }
    const nativeIds = nativeResponse.results.map(result => result.id);
    const wasmIds = wasmResponse.results.map(result => result.id);
    if (JSON.stringify(nativeIds) !== JSON.stringify(wasmIds)) {
        throw new Error(`${query.query}: Native and WASM result order differ`);
    }
    reports.push({
        query,
        total_candidates: nativeResponse.totalCandidates,
        result_count: nativeIds.length,
        ids: nativeIds,
    });
}

process.stdout.write(`${JSON.stringify({ passed: reports.length, reports }, null, 2)}\n`);
