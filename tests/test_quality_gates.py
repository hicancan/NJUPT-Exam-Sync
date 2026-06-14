from __future__ import annotations

import importlib.util
from pathlib import Path


def load_byproduct_gate():
    script = Path("tools/quality-gates/scripts/check_tracked_byproducts.py")
    spec = importlib.util.spec_from_file_location("check_tracked_byproducts", script)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_vendored_wasm_runtime_is_the_only_allowed_tracked_byproduct():
    gate = load_byproduct_gate()
    assert not gate.is_byproduct("apps/web/src/features/collection-search/wasm/packed_impact_decoder.js")
    assert not gate.is_byproduct("apps/web/src/features/collection-search/wasm/packed_impact_decoder_bg.wasm")
    assert gate.is_byproduct("apps/web/src/features/collection-search/wasm/unexpected_generated_file.js")
    assert gate.is_byproduct("apps/web/dist/assets/index.js")
    assert gate.is_byproduct("apps/web/public/generated/exam/data_summary.json")
