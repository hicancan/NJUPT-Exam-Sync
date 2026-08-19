import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bundleIndex = process.argv.indexOf('--bundle');
const bundle = bundleIndex >= 0 ? process.argv[bundleIndex + 1] : undefined;
if (!bundle) throw new Error('missing --bundle');
const root = path.resolve(bundle);
const pageLimit = 100;

function nativeQuery(request, offset = 0) {
    const run = spawnSync('cargo', [
        'run', '--quiet', '--release', '--manifest-path', 'search/Cargo.toml',
        '-p', 'njupt-search', '--', 'query', '--bundle', root,
        '--request-json', JSON.stringify(request), '--offset', String(offset),
    ], { cwd: repository, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (run.status !== 0) {
        throw new Error(run.stderr.trim() || `native query failed: ${run.status}`);
    }
    return JSON.parse(run.stdout);
}

function request(query, sort = 'relevance', filters = {}) {
    return { query, limit: pageLimit, sort, filters };
}

function allResults(searchRequest) {
    const first = nativeQuery(searchRequest);
    const results = [...first.results];
    for (let offset = pageLimit; offset < first.totalCandidates; offset += pageLimit) {
        results.push(...nativeQuery(searchRequest, offset).results);
    }
    if (results.length !== first.totalCandidates) {
        throw new Error(
            `${searchRequest.query}: paged ${results.length} of ${first.totalCandidates} candidates`,
        );
    }
    return { totalCandidates: first.totalCandidates, results };
}

function presentationKey(result) {
    const title = result.title
        .replace(/^\s*[\u200b]?【[^】]+】\s*/u, '')
        .normalize('NFKC')
        .toLocaleLowerCase('zh-CN')
        .replace(/\s+/gu, ' ')
        .trim();
    return result.publishedAt && [...title].length >= 6
        ? `presentation\u001f${result.publishedAt}\u001f${title}`
        : `url\u001f${result.url}`;
}

function keySet(response) {
    return new Set(response.results.map(presentationKey));
}

function assertSubset(subset, superset, label) {
    const missing = [...subset].filter(value => !superset.has(value));
    if (missing.length > 0) {
        throw new Error(`${label}: ${missing.length} canonical candidates are absent`);
    }
}

const allRelevance = allResults(request('肖甫'));
const scie = allResults(request('肖甫', 'relevance', { sourceId: 'scie' }));
const allDate = allResults(request('肖甫', 'date_desc'));
const recent = allResults(request('肖甫', 'relevance', {
    publishedFrom: '2025-08-19',
    includeUndated: false,
}));

const allKeys = keySet(allRelevance);
const scieKeys = keySet(scie);
const dateKeys = keySet(allDate);
const recentKeys = keySet(recent);
assertSubset(scieKeys, allKeys, '肖甫 source filter');
assertSubset(recentKeys, allKeys, '肖甫 date filter');
assertSubset(allKeys, dateKeys, '肖甫 relevance to date sort');
assertSubset(dateKeys, allKeys, '肖甫 date sort to relevance');
if (allRelevance.totalCandidates !== allDate.totalCandidates) {
    throw new Error('肖甫: relevance and date_desc candidate totals differ');
}

const knownCases = [
    { query: '校历', sourceId: 'www' },
    { query: '计算机等级', sourceId: 'cs' },
    { query: '普通话考试', sourceId: 'xsc' },
    { query: '竞赛报名', sourceId: 'xsc' },
];
const knownReports = knownCases.map(({ query, sourceId }) => {
    const all = nativeQuery(request(query));
    const source = nativeQuery(request(query, 'relevance', { sourceId }));
    if (source.totalCandidates > all.totalCandidates) {
        throw new Error(
            `${query}: source ${sourceId} has ${source.totalCandidates}, all has ${all.totalCandidates}`,
        );
    }
    return {
        query,
        source_id: sourceId,
        all_candidates: all.totalCandidates,
        source_candidates: source.totalCandidates,
    };
});

process.stdout.write(`${JSON.stringify({
    passed: true,
    xiaofu: {
        all_candidates: allRelevance.totalCandidates,
        scie_candidates: scie.totalCandidates,
        recent_candidates: recent.totalCandidates,
        canonical_source_subset: true,
        sort_candidate_set_equal: true,
    },
    known_queries: knownReports,
}, null, 2)}\n`);
