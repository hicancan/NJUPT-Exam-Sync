import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function argument(name, required = true) {
    const index = process.argv.indexOf(name);
    const value = index >= 0 ? process.argv[index + 1] : undefined;
    if (required && !value) throw new Error(`missing ${name}`);
    return value;
}

function benchmark(bundle) {
    const result = spawnSync(
        'cargo',
        [
            'run',
            '--quiet',
            '--manifest-path',
            'search/Cargo.toml',
            '--release',
            '-p',
            'njupt-search',
            '--',
            'benchmark',
            '--bundle',
            path.resolve(bundle),
            '--queries',
            path.join(repository, 'benchmarks/search/queries.json'),
        ],
        {
            cwd: repository,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        },
    );
    if (result.status !== 0) {
        throw new Error(result.stderr.trim() || `native benchmark failed with ${result.status}`);
    }
    return JSON.parse(result.stdout);
}

function assess(measurements, expectations) {
    const byQuery = new Map(measurements.map(measurement => [measurement.query, measurement]));
    return expectations.cases.map(expectation => {
        const measurement = byQuery.get(expectation.query);
        if (!measurement) throw new Error(`benchmark did not execute ${expectation.query}`);
        const results = measurement.top_results.slice(0, expectation.top_k ?? 5);
        const required = results.some(result => (
            (!expectation.source || result.source === expectation.source)
            && (
                !expectation.title_contains_any?.length
                || expectation.title_contains_any.some(term => result.title.includes(term))
            )
        ));
        if (!required) {
            throw new Error(`${expectation.query}: required result absent from top ${results.length}`);
        }
        const forbidden = results.find(result => (
            expectation.forbidden_title_contains_any?.some(term => result.title.includes(term))
        ));
        if (forbidden) {
            throw new Error(`${expectation.query}: forbidden result ${forbidden.title}`);
        }
        return {
            query: expectation.query,
            top_k: expectation.top_k ?? 5,
            elapsed_micros: measurement.elapsed_micros,
            candidates: measurement.candidates,
            top_result: results[0] ?? null,
        };
    });
}

function topFiveOverlap(candidate, baseline) {
    const baselineByQuery = new Map(baseline.map(item => [item.query, item]));
    const uniqueTop = (results) => {
        const seen = new Set();
        const unique = [];
        for (const result of results) {
            const identity = `${result.source}\u001f${result.url}`;
            if (seen.has(identity)) continue;
            seen.add(identity);
            unique.push(result);
            if (unique.length === 5) break;
        }
        return unique;
    };
    const comparisons = candidate.map(item => {
        const oldTop = uniqueTop(baselineByQuery.get(item.query)?.top_results ?? []);
        const currentTop = uniqueTop(item.top_results);
        const oldIds = new Set(oldTop.map(result => `${result.source}\u001f${result.url}`));
        const shared = currentTop.filter(
            result => oldIds.has(`${result.source}\u001f${result.url}`),
        ).length;
        const denominator = Math.min(oldTop.length, currentTop.length);
        const overlap = denominator === 0
            ? Number(oldTop.length === currentTop.length)
            : shared / denominator;
        return {
            query: item.query,
            overlap,
            baseline: oldTop,
            current: currentTop,
        };
    });
    return {
        mean: comparisons.reduce((total, comparison) => total + comparison.overlap, 0)
            / comparisons.length,
        differences: comparisons.filter(comparison => comparison.overlap < 1),
    };
}

const bundle = argument('--bundle');
const baselinePath = argument('--baseline', false);
const expectations = JSON.parse(
    readFileSync(path.join(repository, 'benchmarks/search/expected_results.json'), 'utf8'),
);
const candidate = benchmark(bundle);
const cases = assess(candidate, expectations);
const baseline = baselinePath ? benchmark(baselinePath) : null;
const baselineComparison = baseline ? topFiveOverlap(candidate, baseline) : null;
const elapsed = candidate
    .map(item => item.elapsed_micros)
    .sort((left, right) => left - right);
const percentile = value => (
    elapsed[Math.max(0, Math.ceil(elapsed.length * value) - 1)] ?? 0
);

process.stdout.write(`${JSON.stringify({
    query_count: candidate.length,
    quality_cases_passed: cases.length,
    quality_cases_total: expectations.cases.length,
    mean_elapsed_micros: Math.round(
        candidate.reduce((total, item) => total + item.elapsed_micros, 0) / candidate.length,
    ),
    p50_elapsed_micros: percentile(0.5),
    p95_elapsed_micros: percentile(0.95),
    baseline_top_5_overlap: baselineComparison?.mean ?? null,
    baseline_differences: baselineComparison?.differences ?? [],
    cases,
}, null, 2)}\n`);
