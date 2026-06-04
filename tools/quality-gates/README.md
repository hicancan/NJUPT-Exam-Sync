# Quality Gates

This directory owns deterministic generated-artifact and contract gates.

Purpose:

- validate the generated public search contract, including obsolete-field rejection;
- enforce public artifact size budgets;
- enforce routed-search startup budgets, so first-screen readiness stays limited to `source_registry`, `global_query_directory`, and `query_aliases`;
- enforce the runtime fast-start contract, so URL hot queries can dispatch `query` before full `init` readiness and cannot silently regress to global-directory-first startup;
- enforce production web bundle budgets after `npm run build`, so worker/main/WASM payload growth is caught before deploy;
- enforce source complexity ratchets, so oversized legacy modules cannot keep growing while ordinary source files stay below maintainable line-count budgets;
- keep deployment blocked when generated artifacts or contracts fail validation.

Quality gates must remain deterministic and must not depend on Codex or other AI review workflows.

```powershell
uv run python tools\quality-gates\scripts\validate_search_index.py
uv run python tools\quality-gates\scripts\check_public_artifact_sizes.py
uv run python tools\quality-gates\scripts\check_source_complexity.py
uv run python tools\quality-gates\scripts\check_runtime_fast_start.py
uv run python tools\quality-gates\scripts\check_web_bundle_sizes.py
```
