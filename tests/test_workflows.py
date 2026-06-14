from pathlib import Path


def test_ci_is_single_authoritative_pages_gate():
    assert not Path(".github/workflows/deploy-web.yml").exists()
    assert not Path(".github/workflows/validate-generated-artifacts.yml").exists()
    workflow = Path(".github/workflows/ci.yml")
    assert workflow.exists()
    text = workflow.read_text(encoding="utf-8")
    assert "concurrency:\n  group: ci-${{ github.ref }}\n  cancel-in-progress: true" in text
    assert "permissions:\n  contents: read\n\nconcurrency:" in text
    assert "Classify CI workload" in text
    assert r"^(\.github/.*|tests/test_workflows\.py)$" in text
    assert r"^(\.github/.*|tests/test_workflows\.py|apps/web/public/edgeone\.json)$" in text
    assert 'mode="static-public-fast"' in text
    assert 'mode="workflow-fast"' in text
    assert 'mode="exam-code-fast"' in text
    assert 'mode="sitegraph-index-fast"' in text
    assert 'mode="wasm-fast"' in text
    assert 'mode="manual-full"' in text
    assert "verification:" in text
    assert "exam_fast_checks" in text
    assert "needs_exam_public_assets" in text
    assert "needs_sitegraph_public_assets" in text
    assert "wasm_fast_checks" in text
    assert "tools/exam-pipeline/.*" in text
    assert "apps/web/src/features/exam-schedule/.*" in text
    assert "needs_generated_assets" in text
    assert "needs_generated_assets: ${{ steps.ci-mode.outputs.needs_generated_assets }}" in text
    assert "Verify CI-only public asset determinism" in text
    assert "if: steps.ci-mode.outputs.needs_generated_assets == 'true'" in text
    assert "Resolve latest generated data baseline" in text
    assert "Restore generated data baseline" in text
    assert "cp -R _baseline-dist/generated apps/web/public/generated" in text
    assert "Materialize exam public assets" in text
    assert "steps.ci-mode.outputs.needs_exam_public_assets == 'true' && steps.ci-mode.outputs.needs_generated_assets != 'true'" in text
    assert "prepare_public_assets.py build-exam-public-data" in text
    assert "prepare_public_assets.py verify-exam-public-data" in text
    assert "Materialize sitegraph public assets" in text
    assert "prepare_public_assets.py build-sitegraph-public-data" in text
    assert "Sitegraph index fast checks" in text
    assert "WASM fast checks" in text
    assert "steps.ci-mode.outputs.needs_generated_assets == 'true' || steps.ci-mode.outputs.wasm_fast_checks == 'true'" in text
    assert "npm run build:wasm:web\n          npm run build:prepared" not in text
    assert "npm run build:prepared\n          npm run check:web-bundle-size" in text
    assert "Fast-mode workflow tests" in text
    assert "Fast frontend checks" in text
    assert "Exam fast checks" in text
    assert "tests/test_exam_history.py tests/test_exam_pipeline_failfast.py tests/test_exam_rooms.py tests/test_prepare_public_assets_download.py" in text
    assert "apps/web/src/features/room-occupancy/.*" in text
    assert "config/classrooms/.*" in text
    assert "apps/web/src/app/routing/useAppRouter\\.ts" in text
    assert "apps/web/src/pages/rooms/.*" in text
    assert "npm run test:prepared -- apps/web/src/features/exam-schedule apps/web/src/features/room-occupancy packages/exam-core packages/contracts/tests/examDataContract.test.ts" in text
    assert "Build deployment bundle" in text
    assert "steps.ci-mode.outputs.needs_public_assets == 'true' && steps.ci-mode.outputs.full_verification != 'true'" in text
    assert "workflow_run:" not in text
    assert "workflows: [ 'Update Collection Index' ]" not in text
    assert "  ci:\n    permissions:\n      contents: read" in text
    assert "  pages-build:" in text
    assert "    permissions:\n      contents: read\n      pages: write" in text
    assert "  pages-deploy:" in text
    assert "    permissions:\n      pages: write\n      id-token: write" in text
    assert "    needs: [ci, pages-build]" in text
    assert "  edgeone-deploy:" not in text
    assert "GITHUB_STEP_SUMMARY" in text
    assert "npm run test:prepared" in text
    assert "npm run typecheck:prepared" in text
    assert "npm run build:prepared" in text
    assert "retention-days: 3" in text
    assert "name: njupt-search-production-dist" in text
    assert "retention-days: 7" in text
    assert "group: production-publish-main" in text


def test_edgeone_deploy_uses_verified_ci_artifact_only():
    workflow = Path(".github/workflows/deploy-edgeone.yml")
    assert workflow.exists()
    text = workflow.read_text(encoding="utf-8")
    assert "workflows: [ 'CI' ]" in text
    assert "workflow_dispatch:" in text
    assert "run_id:" in text
    assert "vars.EDGEONE_PAGES_ENABLED == 'true'" in text
    assert "group: production-publish-main" in text
    assert "Checkout workflow helpers" in text
    assert "has_dist_artifact()" in text
    assert "actions/runs/$candidate_run_id/artifacts" in text
    assert "has no njupt-search-dist artifact; skipping EdgeOne deploy" in text
    assert "download-artifact-with-retry.sh \"$RUN_ID\"" in text
    assert "njupt-search-dist dist" in text
    assert "EDGEONE_API_TOKEN: ${{ secrets.EDGEONE_API_TOKEN }}" in text
    assert "EDGEONE_PROJECT_NAME: ${{ vars.EDGEONE_PROJECT_NAME || 'njupt-search' }}" in text
    assert "EDGEONE_PAGES_AREA: ${{ vars.EDGEONE_PAGES_AREA || 'global' }}" in text
    assert "set -o pipefail" in text
    assert 'npx --yes edgeone@latest pages deploy ./dist -n "$project" -t "$EDGEONE_API_TOKEN" -e production -a "$area"' in text
    assert "EDGEONE_API_TOKEN secret is required" in text
    assert "vars.CF_PURGE_ENABLED == '1'" in text
    assert "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" in text
    assert "Cloudflare cache purge failed; static site deployments already completed" in text
    assert "npm run build" not in text
    assert "npm run prepare:public-assets" not in text


def test_edgeone_headers_keep_mutable_exam_data_fresh():
    config = Path("apps/web/public/edgeone.json")
    assert config.exists()
    text = config.read_text(encoding="utf-8")
    assert '"source": "/*"' in text
    assert '"X-Content-Type-Options"' in text
    assert '"nosniff"' in text
    assert '"X-Frame-Options"' in text
    assert '"SAMEORIGIN"' in text
    assert '"Referrer-Policy"' in text
    assert '"strict-origin-when-cross-origin"' in text
    assert '"/generated/exam/data_summary.json"' in text
    assert '"/generated/exam/source_metadata.json"' in text
    assert '"/generated/exam/class_index.json"' in text
    assert '"/generated/exam/classes/*.json"' in text
    assert '"/generated/exam/history/classes/*.json"' in text
    assert '"/generated/exam/rooms/*"' in text
    assert '"no-store, max-age=0, must-revalidate"' in text
    assert '"/generated/collections/*/manifest.json"' in text
    assert '"/generated/collections/*/manifest.json*"' in text
    assert '"/generated/collections/*/*.json"' in text
    assert '"/generated/collections/*/*.json*"' in text
    assert '"/assets/*"' in text
    assert '"public, max-age=31536000, immutable"' in text
    assert '"/manifest.webmanifest"' in text
    assert '"/sw.js"' in text
    assert '"/workbox-*.js"' not in text
    assert '"public, max-age=0, must-revalidate"' in text


def test_collection_update_tracks_sitegraph_automatically():
    workflow = Path(".github/workflows/update-collection-index.yml")
    assert workflow.exists()
    text = workflow.read_text(encoding="utf-8")
    assert "concurrency:\n  group: production-publish-main\n  cancel-in-progress: false" in text
    assert "actions: read" in text
    assert "pages: write" in text
    assert "id-token: write" in text
    assert "schedule:" in text
    assert "cron: '30 1,7,13,19 * * *'" in text
    assert "repository_dispatch:" in text
    assert "types: [sitegraph-data-updated]" in text
    assert "force_deploy:" in text
    assert "FORCE_DEPLOY: ${{ github.event.inputs.force_deploy || (github.event.client_payload.dispatch_reason == 'manual_force' && 'true') || (github.event.client_payload.dispatch_reason == 'manual_dispatch_only' && 'true') || 'false' }}" in text
    assert "cron: '30 */6 * * *'" not in text
    assert "github.event.client_payload.sitegraph_ref" in text
    assert "resolved_sha" in text
    assert "Plan collection update" in text
    assert "needs_data_build" in text
    assert "should_deploy" in text
    assert "ref: ${{ steps.sitegraph-ref.outputs.resolved_sha }}" in text
    assert "DISPATCH_SITEGRAPH_REF" in text
    assert "DISPATCH_SOURCE_REPO" in text
    assert "DISPATCH_SOURCE_RUN_ID" in text
    assert "repository_dispatch missing client_payload.sitegraph_ref" in text
    assert "repository_dispatch source_repo must be hicancan/njupt-site-graph" in text
    assert "repository_dispatch missing client_payload.source_run_id" in text
    assert "Validate sitegraph ref exists" in text
    assert "repos/hicancan/njupt-site-graph/commits/$SITEGRAPH_REF" in text
    assert "sitegraph_ref $SITEGRAPH_REF is not a commit visible in hicancan/njupt-site-graph" in text
    assert "python tools/ci/commit_generated_changes.py" in text
    assert "prepare_public_assets.py update-sitegraph-lock" in text
    assert "prepare_public_assets.py build-sitegraph-public-data" in text
    assert "prepare_public_assets.py build-public-data" not in text
    assert "run-smoke-queries" not in text
    assert "run-task-queries" not in text
    assert "actions/runs/$candidate_run_id/artifacts" in text
    assert 'select(.expired == false and .name == "njupt-search-dist")' in text
    assert 'select(.expired == false and .name == "njupt-search-production-dist")' in text
    assert "ARTIFACT_NAME: ${{ steps.verified-dist.outputs.artifact_name }}" in text
    assert "download-artifact-with-retry.sh \"$RUN_ID\"" in text
    assert '"$ARTIFACT_NAME" dist' in text
    assert "rm -rf dist/generated/collections/njupt-public" in text
    assert "cp -R apps/web/public/generated/collections/njupt-public dist/generated/collections/njupt-public" in text
    assert "if marker_path.exists():" in text
    assert "actions/upload-pages-artifact@v5" in text
    assert "actions/deploy-pages@v5" in text
    assert "name: njupt-search-production-dist" in text
    assert "EDGEONE_PROJECT_NAME: ${{ vars.EDGEONE_PROJECT_NAME || 'njupt-search' }}" in text
    assert "EDGEONE_PAGES_AREA: ${{ vars.EDGEONE_PAGES_AREA || 'global' }}" in text
    assert "set -o pipefail" in text
    assert "npx --yes edgeone@latest pages deploy ./dist" in text
    assert "vars.CF_PURGE_ENABLED == '1'" in text
    assert "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" in text
    assert "Cloudflare cache purge failed; static site deployments already completed" in text
    assert "--add config/data-locks/sitegraph.lock.json" in text
    assert "--add apps/web/public/generated/collections/njupt-public/" not in text
    assert "npm test" not in text
    assert "npm run typecheck" not in text
    assert "npm run build" not in text
    assert "git push" not in text


def test_collection_update_uses_configured_source_packages():
    workflow = Path(".github/workflows/update-collection-index.yml")
    text = workflow.read_text(encoding="utf-8")
    assert "NJUPT_SITEGRAPH_REPO: _sitegraph/njupt-site-graph" in text
    assert "--source-package \"$SITEGRAPH_JWC_INDEX\"" not in text
    assert "prepare_public_assets.py build-sitegraph-public-data" in text


def test_exam_update_uses_retrying_generated_commit_helper():
    workflow = Path(".github/workflows/update-exam-data.yml")
    assert workflow.exists()
    text = workflow.read_text(encoding="utf-8")
    assert "concurrency:\n  group: production-publish-main\n  cancel-in-progress: false" in text
    assert "actions: read" in text
    assert "pages: write" in text
    assert "id-token: write" in text
    assert "python tools/ci/commit_generated_changes.py" in text
    assert "prepare_public_assets.py update-exam-lock" in text
    assert "NJUPT_SEARCH_REQUIRE_PREVIOUS_EXAM_BASELINE" not in text
    assert "force_deploy:" in text
    assert "FORCE_DEPLOY: ${{ github.event.inputs.force_deploy || 'false' }}" in text
    assert "prepare_public_assets.py build-exam-public-data" in text
    assert "prepare_public_assets.py verify-exam-public-data" in text
    assert "Exam-only regression tests" in text
    assert "tests/test_exam_history.py tests/test_exam_pipeline_failfast.py tests/test_exam_rooms.py tests/test_prepare_public_assets_download.py" in text
    assert "npm ci" in text
    assert "npm run test:prepared -- apps/web/src/features/exam-schedule apps/web/src/features/room-occupancy packages/exam-core packages/contracts/tests/examDataContract.test.ts" in text
    assert "actions/runs/$candidate_run_id/artifacts" in text
    assert 'select(.expired == false and .name == "njupt-search-dist")' in text
    assert 'select(.expired == false and .name == "njupt-search-production-dist")' in text
    assert "ARTIFACT_NAME: ${{ steps.verified-dist.outputs.artifact_name }}" in text
    assert "download-artifact-with-retry.sh \"$RUN_ID\"" in text
    assert '"$ARTIFACT_NAME" dist' in text
    assert "rm -rf dist/generated/exam" in text
    assert "cp -R apps/web/public/generated/exam dist/generated/exam" in text
    assert "actions/upload-pages-artifact@v5" in text
    assert "actions/deploy-pages@v5" in text
    assert "name: njupt-search-production-dist" in text
    assert "EDGEONE_PROJECT_NAME: ${{ vars.EDGEONE_PROJECT_NAME || 'njupt-search' }}" in text
    assert "EDGEONE_PAGES_AREA: ${{ vars.EDGEONE_PAGES_AREA || 'global' }}" in text
    assert "set -o pipefail" in text
    assert "npx --yes edgeone@latest pages deploy ./dist" in text
    assert "vars.CF_PURGE_ENABLED == '1'" in text
    assert "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" in text
    assert "Cloudflare cache purge failed; static site deployments already completed" in text
    assert "Update Exam Data" not in Path(".github/workflows/ci.yml").read_text(encoding="utf-8")
    assert "prepare_public_assets.py build-public-data" not in text
    assert "Checkout sitegraph source packages" not in text
    assert "--add config/data-locks/exam.lock.json" in text
    assert "--add apps/web/public/generated/exam/" not in text
    assert "validate_search_index.py" not in text
    assert "run-smoke-queries" not in text
    assert "run-task-queries" not in text
    assert "uv run python -m pytest tests\n" not in text
    assert "npm test" not in text
    assert "npm run typecheck" not in text
    assert "npm run build" not in text
    assert "git push" not in text


def test_android_release_is_hardened():
    workflow = Path(".github/workflows/release-android.yml")
    assert workflow.exists()
    text = workflow.read_text(encoding="utf-8")
    assert "concurrency:\n  group: release-android-${{ github.ref }}\n  cancel-in-progress: true" in text
    assert "permissions:\n  contents: read" in text
    assert "  build-apk:\n    permissions:\n      contents: read" in text
    assert "  publish-release:" in text
    assert "    permissions:\n      contents: write" in text
    assert "Validate release inputs" in text
    assert "KEYSTORE_BASE64 secret is required" in text
    assert "tag $RELEASE_TAG does not match package.json version v$VERSION" in text
    assert "if-no-files-found: error" in text
    assert "actions/download-artifact@v7" in text


def test_generated_commit_helper_retries_push_after_rebase():
    helper = Path("tools/ci/commit_generated_changes.py")
    assert helper.exists()
    text = helper.read_text(encoding="utf-8")
    assert 'git", "push", "origin", f"HEAD:{branch}"' in text
    assert 'git", "fetch", "origin", branch' in text
    assert 'git", "rebase", f"origin/{branch}"' in text
    assert "GITHUB_OUTPUT" in text


def test_github_artifact_downloads_retry_transient_failures():
    helper = Path(".github/scripts/download-artifact-with-retry.sh")
    assert helper.exists()
    text = helper.read_text(encoding="utf-8")
    assert "for attempt in 1 2 3 4 5" in text
    assert "gh run download" in text
    assert 'rm -rf "$output_dir"' in text
    assert "artifact download failed after 5 attempts" in text
