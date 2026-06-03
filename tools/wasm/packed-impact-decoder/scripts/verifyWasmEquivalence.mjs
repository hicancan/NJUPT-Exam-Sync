import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');
const generatedDir = resolve(repoRoot, 'tools/wasm/packed-impact-decoder/pkg');
const committedDir = resolve(repoRoot, 'apps/web/src/features/collection-search/wasm');
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

const collectOutputs = decoder => {
  const fixture = makeFixture();
  const query = JSON.stringify(['考试', '四六级']);
  const session = new decoder.PackedImpactRetrievalSession(4);
  try {
    const firstApply = JSON.parse(session.apply(fixture, JSON.stringify(['考试'])));
    const secondApply = JSON.parse(session.apply(fixture, query));
    return {
      stats: JSON.parse(decoder.decode_packed_impact_stats(fixture)),
      materialized: JSON.parse(decoder.decode_packed_impact_to_json(fixture)),
      topkStats: JSON.parse(decoder.retrieve_packed_impact_topk_stats(fixture, query, 4)),
      topkScores: JSON.parse(decoder.retrieve_packed_impact_topk_scores(fixture, query, 4)),
      session: {
        firstApply,
        secondApply,
        stats: JSON.parse(session.stats_json()),
        scores: JSON.parse(session.scores_json()),
      },
    };
  } finally {
    session.free();
  }
};

const generated = await loadDecoder(generatedDir, 'generated');
const committed = await loadDecoder(committedDir, 'committed');
assert.deepEqual(collectOutputs(generated), collectOutputs(committed));
console.log('[verifyWasmEquivalence] ok');
