import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');
const generatedDir = resolve(repoRoot, 'tools/wasm/packed-impact-decoder/pkg');
const textEncoder = new TextEncoder();

const encodeVarint = value => {
  let remaining = BigInt(value);
  const bytes = [];
  while (remaining >= 0x80n) {
    bytes.push(Number((remaining & 0x7fn) | 0x80n));
    remaining >>= 7n;
  }
  bytes.push(Number(remaining));
  return bytes;
};

const encodeU32Le = value => [
  value & 0xff,
  (value >> 8) & 0xff,
  (value >> 16) & 0xff,
  (value >> 24) & 0xff,
];

const encodeFields = fields => {
  const bytes = [...encodeVarint(fields.length)];
  for (const [field, docs] of fields) {
    bytes.push(field.charCodeAt(0));
    bytes.push(...encodeVarint(docs.length));
    let previous = 0;
    docs.forEach((docId, index) => {
      bytes.push(...encodeVarint(index === 0 ? docId : docId - previous));
      previous = docId;
    });
  }
  return bytes;
};

const makeFixture = () => {
  const metadata = textEncoder.encode(JSON.stringify({
    field_impacts: { t: 10, b: 4 },
    block_size: 2,
  }));
  const terms = [
    ['考试', [['t', [1, 3, 10]], ['b', [2, 4]]]],
    ['四六级', [['t', [3, 5]], ['b', [8, 13, 21]]]],
  ].map(([term, fields]) => {
    const termBytes = textEncoder.encode(term);
    const payload = encodeFields(fields);
    return { termBytes, payload };
  });

  const directory = [...encodeVarint(terms.length)];
  for (const { termBytes, payload } of terms) {
    directory.push(...encodeVarint(termBytes.length), ...termBytes, ...encodeVarint(payload.length));
  }

  return Uint8Array.from([
    ...textEncoder.encode('SGIXB002'),
    ...encodeU32Le(metadata.length),
    ...metadata,
    ...directory,
    ...terms.flatMap(term => term.payload),
  ]);
};

const loadDecoder = async (baseDir, cacheKey) => {
  const moduleUrl = `${pathToFileURL(resolve(baseDir, 'packed_impact_decoder.js')).href}?${cacheKey}`;
  const decoder = await import(moduleUrl);
  decoder.initSync({ module: readFileSync(resolve(baseDir, 'packed_impact_decoder_bg.wasm')) });
  return decoder;
};

const typedScoreEntries = typedScores => {
  assert.equal(typedScores.length % 2, 0);
  const entries = [];
  for (let index = 0; index < typedScores.length; index += 2) {
    entries.push([typedScores[index], typedScores[index + 1]]);
  }
  return entries;
};

const encodeQueryTerms = terms => {
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

const collectOutputs = decoder => {
  const fixture = makeFixture();
  const terms = ['考试', '四六级'];
  const encodedQuery = encodeQueryTerms(terms);
  const encodedExam = encodeQueryTerms(['考试']);
  const typedSession = new decoder.PackedImpactRetrievalSession(4);
  try {
    const firstApplyTyped = JSON.parse(typedSession.apply_terms_utf8(fixture, encodedExam.bytes, encodedExam.offsets));
    const secondApplyTyped = JSON.parse(typedSession.apply_terms_utf8(fixture, encodedQuery.bytes, encodedQuery.offsets));
    const typedSessionScores = Array.from(typedSession.score_entries_f64());
    assert.deepEqual(typedScoreEntries(typedSessionScores), [
      [3, 37],
      [1, 24],
      [10, 24],
      [5, 13],
      [2, 12],
      [4, 12],
      [8, 7],
      [13, 7],
      [21, 7],
    ]);
    return {
      stats: JSON.parse(decoder.decode_packed_impact_stats(fixture)),
      materialized: JSON.parse(decoder.decode_packed_impact_to_json(fixture)),
      topkStatsTyped: JSON.parse(decoder.retrieve_packed_impact_topk_stats_utf8(fixture, encodedQuery.bytes, encodedQuery.offsets, 4)),
      topkScoresTyped: JSON.parse(decoder.retrieve_packed_impact_topk_scores_utf8(fixture, encodedQuery.bytes, encodedQuery.offsets, 4)),
      session: {
        firstApplyTyped,
        secondApplyTyped,
        stats: JSON.parse(typedSession.stats_json()),
        typedSessionScores,
      },
    };
  } finally {
    typedSession.free();
  }
};

const generated = await loadDecoder(generatedDir, 'generated');
const output = collectOutputs(generated);
assert.deepEqual(output.stats, { term_count: 2, field_count: 4, posting_count: 10, max_doc_id: 21 });
assert.equal(output.topkStatsTyped.candidate_count, 7);
assert.equal(output.topkStatsTyped.impact_blocks_pruned, 1);
assert.equal(output.topkStatsTyped.postings_pruned, 2);
assert.deepEqual(output.topkStatsTyped.top_doc_ids, [3, 5, 1, 10, 8, 13, 21]);
assert.deepEqual(output.topkScoresTyped.score_entries.slice(0, 4), [
  [3, 25],
  [5, 13],
  [1, 12],
  [10, 12],
]);
console.log('[verifyWasmEquivalence] ok');
