import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bundleIndex = process.argv.indexOf('--bundle');
const bundle = bundleIndex >= 0 ? process.argv[bundleIndex + 1] : undefined;
if (!bundle) throw new Error('missing --bundle');

const cases = JSON.parse(readFileSync(
    path.join(repository, 'benchmarks/search/quick_search_relevance.json'),
    'utf8',
)).cases;
const queryPath = path.join(repository, 'benchmarks/search/quick-search-queries.json');
const run = spawnSync('cargo', [
    'run', '--quiet', '--release', '--manifest-path', 'search/Cargo.toml',
    '-p', 'njupt-search', '--', 'benchmark', '--bundle', path.resolve(bundle),
    '--queries', queryPath,
], { cwd: repository, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (run.status !== 0) throw new Error(run.stderr.trim() || `benchmark failed: ${run.status}`);

const measurements = JSON.parse(run.stdout);
const byQuery = new Map(measurements.map(value => [value.query, value]));

function matches(result, rule) {
    if (rule.source_any && !rule.source_any.includes(result.source)) return false;
    if (rule.published_from && (!result.published_at || result.published_at < rule.published_from)) {
        return false;
    }
    if (rule.title_all && !rule.title_all.every(value => result.title.includes(value))) return false;
    if (rule.title_any && !rule.title_any.some(value => result.title.includes(value))) return false;
    return true;
}

function grade(result, rules) {
    return rules.find(rule => matches(result, rule))?.grade ?? 0;
}

function presentationKey(result) {
    const title = result.title
        .replace(/^\s*[\u200b]?【[^】]+】\s*/u, '')
        .normalize('NFKC')
        .toLocaleLowerCase('zh-CN')
        .replace(/\s+/gu, ' ')
        .trim();
    return result.published_at && [...title].length >= 6
        ? `${result.published_at}\u0000${title}`
        : `url\u0000${result.url}`;
}

function dcg(grades) {
    return grades.reduce((total, value, index) => (
        total + ((2 ** value) - 1) / Math.log2(index + 2)
    ), 0);
}

const reports = cases.map(definition => {
    const measurement = byQuery.get(definition.query);
    if (!measurement) throw new Error(`missing benchmark query: ${definition.query}`);
    const top = measurement.top_results.slice(0, 10);
    const grades = top.map(result => grade(result, definition.rules));
    const ideal = [...grades].sort((left, right) => right - left);
    const precisionAt5 = grades.slice(0, 5).filter(value => value >= 2).length / 5;
    const duplicateCount = top.length - new Set(top.map(presentationKey)).size;
    const forbidden = top.filter(result => (
        definition.forbidden?.some(value => result.title.includes(value))
    ));
    const report = {
        query: definition.query,
        success_at_1: (grades[0] ?? 0) >= 2,
        precision_at_5: precisionAt5,
        ndcg_at_10: dcg(grades) / Math.max(dcg(ideal), 1),
        duplicate_rate_at_10: top.length === 0 ? 0 : duplicateCount / top.length,
        newest_relevant_rank: (() => {
            const relevant = top
                .map((result, index) => ({ result, index, grade: grades[index] ?? 0 }))
                .filter(value => value.grade >= 2 && value.result.published_at)
                .sort((left, right) => right.result.published_at.localeCompare(left.result.published_at));
            return relevant.length ? relevant[0].index + 1 : null;
        })(),
        candidates: measurement.candidates,
        forbidden: forbidden.map(result => result.title),
        top_10: top.map((result, index) => ({
            rank: index + 1,
            grade: grades[index] ?? 0,
            title: result.title,
            source: result.source,
            published_at: result.published_at,
            url: result.url,
        })),
    };
    if (!report.success_at_1) throw new Error(`${definition.query}: Top-1 does not satisfy intent`);
    if (precisionAt5 < definition.minimum_precision_at_5) {
        throw new Error(`${definition.query}: Precision@5 ${precisionAt5} is below ${definition.minimum_precision_at_5}`);
    }
    if (forbidden.length) throw new Error(`${definition.query}: forbidden result ${forbidden[0].title}`);
    return report;
});

process.stdout.write(`${JSON.stringify({ cases: reports }, null, 2)}\n`);
