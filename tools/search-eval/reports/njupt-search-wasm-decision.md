# NJUPT Search Rust/WASM Retrieval Decision

- Generated at: `2026-06-05T04:52:36.165Z`
- Artifact count: `246`
- Packed body bytes: `16,865,808`
- Runs: `5`

## Results

| Path | Mean ms | Min ms | Max ms |
| --- | ---: | ---: | ---: |
| TypeScript runtime decoder to JS object | 546.895 | 510.228 | 584.421 |
| Rust/WASM decode to JSON string, then JS parse | 583.620 | 571.537 | 596.506 |
| Rust/WASM stats-only decode lower bound | 37.122 | 36.459 | 37.780 |
| TypeScript selective retrieval kernel | 3314.754 | 3286.400 | 3378.676 |
| Rust/WASM stateless retrieval kernel | 284.323 | 279.024 | 289.816 |
| Rust/WASM stateful retrieval session | 295.354 | 293.382 | 297.488 |
| Rust/WASM stateful retrieval with JSON score bridge | 302.712 | 300.953 | 304.874 |
| Rust/WASM stateful retrieval with typed score buffer | 296.430 | 295.444 | 297.728 |

## Decision

- Status: `rust_wasm_retrieval_runtime_selected`
- Winner for current runtime: `wasm_retrieval_session_typed_scores`
- WASM materialized path ratio vs TypeScript: `1.067x`
- WASM stats-only lower-bound ratio vs TypeScript: `0.068x`
- WASM stateful retrieval ratio vs TypeScript retrieval kernel: `0.089x`
- WASM stateful JSON score bridge ratio vs TypeScript retrieval kernel: `0.091x`
- WASM stateful typed score buffer ratio vs TypeScript retrieval kernel: `0.089x`
- Reason: The browser runtime consumes Rust/WASM stateful score entries through a typed buffer, without the JSON score bridge. On the full packed body workload, the typed score buffer path was 0.089x the TypeScript selective retrieval kernel for the same artifact format, query set, and global top-k pruning state.

## Reproduction

```powershell
node --import tsx tools\search-eval\scripts\benchmarkPackedDecoder.mjs --build-wasm --collection apps\web\public\generated\collections\njupt-public --runs 5 --output docs\reports\njupt-search-wasm-decision.json --markdown docs\reports\njupt-search-wasm-decision.md
```
