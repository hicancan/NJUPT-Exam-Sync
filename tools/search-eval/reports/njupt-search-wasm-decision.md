# NJUPT Search Rust/WASM Retrieval Decision

- Generated at: `2026-06-04T08:56:28.534Z`
- Artifact count: `246`
- Packed body bytes: `16,865,808`
- Runs: `5`

## Results

| Path | Mean ms | Min ms | Max ms |
| --- | ---: | ---: | ---: |
| TypeScript runtime decoder to JS object | 680.869 | 617.165 | 756.561 |
| Rust/WASM decode to JSON string, then JS parse | 741.618 | 729.729 | 756.316 |
| Rust/WASM stats-only decode lower bound | 44.771 | 43.909 | 46.933 |
| TypeScript selective retrieval kernel | 3941.645 | 3892.451 | 4008.336 |
| Rust/WASM stateless retrieval kernel | 377.284 | 373.317 | 384.302 |
| Rust/WASM stateful retrieval session | 511.046 | 497.002 | 522.358 |
| Rust/WASM stateful retrieval with score bridge | 523.395 | 515.450 | 534.024 |

## Decision

- Status: `rust_wasm_retrieval_runtime_selected`
- Winner for current runtime: `wasm_retrieval_session_scores_bridge`
- WASM materialized path ratio vs TypeScript: `1.089x`
- WASM stats-only lower-bound ratio vs TypeScript: `0.066x`
- WASM stateful retrieval ratio vs TypeScript retrieval kernel: `0.130x`
- WASM stateful score bridge ratio vs TypeScript retrieval kernel: `0.133x`
- Reason: The browser runtime can consume Rust/WASM stateful score entries directly. On the full packed body workload, the Rust/WASM session score bridge was 0.133x the TypeScript selective retrieval kernel for the same artifact format, query set, and global top-k pruning state.

## Reproduction

```powershell
node --import tsx tools\search-eval\scripts\benchmarkPackedDecoder.mjs --build-wasm --collection apps\web\public\generated\collections\njupt-public --runs 5 --output docs\reports\njupt-search-wasm-decision.json --markdown docs\reports\njupt-search-wasm-decision.md
```
