# njupt-search development rules

- This repository consumes an explicit `NjuptCorpusSnapshot`; it does not crawl.
- Search semantics live only in `search/core` and are shared by native and WASM.
- TypeScript may orchestrate artifacts, workers, bounded caches and UI, but may
  not implement tokenization, retrieval or ranking.
- Python is limited to academics source compilation.
- Only the current corpus and bundle formats are supported. Invalid input fails.
- Generated artifacts are disposable build outputs and are never a source-code
  dependency.
- Keep tests next to their implementation. Put real cross-system quality and
  performance scenarios under `benchmarks`.
- Delete replaced implementations when callers switch; do not add aliases,
  alternate-format readers, hidden scans or speculative abstractions.
