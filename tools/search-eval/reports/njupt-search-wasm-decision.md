# NJUPT Search Rust/WASM Retrieval Decision

- Generated at: `2026-06-05T01:03:41.314Z`
- Artifact count: `246`
- Packed body bytes: `16,866,162`
- Runs: `5`

## Results

| Path | Mean ms | Min ms | Max ms |
| --- | ---: | ---: | ---: |
| TypeScript runtime decoder to JS object | 680.576 | 547.788 | 1107.643 |
| Rust/WASM decode to JSON string, then JS parse | 1159.932 | 1080.677 | 1231.032 |
| Rust/WASM stats-only decode lower bound | 67.945 | 59.294 | 72.909 |
| TypeScript selective retrieval kernel | 6421.168 | 6202.794 | 6669.738 |
| Rust/WASM stateless retrieval kernel | 593.197 | 548.018 | 662.901 |
| Rust/WASM stateful retrieval session | 822.471 | 750.465 | 872.958 |
| Rust/WASM stateful retrieval with JSON score bridge | 841.366 | 781.311 | 910.940 |
| Rust/WASM stateful retrieval with typed score buffer | 832.437 | 755.511 | 894.513 |

## Decision

- Status: `rust_wasm_retrieval_runtime_selected`
- Winner for current runtime: `wasm_retrieval_session_typed_scores`
- WASM materialized path ratio vs TypeScript: `1.704x`
- WASM stats-only lower-bound ratio vs TypeScript: `0.100x`
- WASM stateful retrieval ratio vs TypeScript retrieval kernel: `0.128x`
- WASM stateful JSON score bridge ratio vs TypeScript retrieval kernel: `0.131x`
- WASM stateful typed score buffer ratio vs TypeScript retrieval kernel: `0.130x`
- Reason: The browser runtime consumes Rust/WASM stateful score entries through a typed buffer, without the JSON score bridge. On the full packed body workload, the typed score buffer path was 0.130x the TypeScript selective retrieval kernel for the same artifact format, query set, and global top-k pruning state.

## Reproduction

```powershell
node --import tsx tools\search-eval\scripts\benchmarkPackedDecoder.mjs --build-wasm --collection apps\web\public\generated\collections\njupt-public --runs 5 --output docs\reports\njupt-search-wasm-decision.json --markdown docs\reports\njupt-search-wasm-decision.md
```
