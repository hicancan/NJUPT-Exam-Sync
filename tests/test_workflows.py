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
    assert 'mode="workflow-fast"' in text
    assert "Verify CI-only public asset determinism" in text
    assert "if: steps.ci-mode.outputs.full_verification == 'true'" in text
    assert "Fast-mode workflow tests" in text
    assert "Build deployment bundle" in text
    assert "workflow_run:" not in text
    assert "workflows: [ 'Update Collection Index' ]" not in text
    assert "  ci:\n    permissions:\n      contents: read" in text
    assert "  pages-build:" in text
    assert "    permissions:\n      contents: read\n      pages: write" in text
    assert "  pages-deploy:" in text
    assert "    permissions:\n      pages: write\n      id-token: write" in text
    assert "  edgeone-deploy:" not in text
    assert "GITHUB_STEP_SUMMARY" in text
    assert "npm run test:prepared" in text
    assert "npm run typecheck:prepared" in text
    assert "npm run build:prepared" in text
    assert "retention-days: 3" in text


def test_edgeone_deploy_uses_verified_ci_artifact_only():
    workflow = Path(".github/workflows/deploy-edgeone.yml")
    assert workflow.exists()
    text = workflow.read_text(encoding="utf-8")
    assert "workflows: [ 'CI' ]" in text
    assert "workflow_dispatch:" in text
    assert "run_id:" in text
    assert "vars.EDGEONE_PAGES_ENABLED == 'true'" in text
    assert "group: edgeone-pages-production" in text
    assert "gh run download \"$RUN_ID\"" in text
    assert "--name njupt-search-dist" in text
    assert "EDGEONE_API_TOKEN: ${{ secrets.EDGEONE_API_TOKEN }}" in text
    assert "EDGEONE_PAGES_PROJECT: ${{ vars.EDGEONE_PAGES_PROJECT || 'njupt-search' }}" in text
    assert "EDGEONE_PAGES_AREA: ${{ vars.EDGEONE_PAGES_AREA || 'overseas' }}" in text
    assert 'npx --yes edgeone@latest pages deploy ./dist -n "$project" -t "$EDGEONE_API_TOKEN" -e production -a "$area"' in text
    assert "EDGEONE_API_TOKEN secret is required" in text
    assert "npm run build" not in text
    assert "npm run prepare:public-assets" not in text


def test_collection_update_is_triggered_by_sitegraph_dispatch():
    workflow = Path(".github/workflows/update-collection-index.yml")
    assert workflow.exists()
    text = workflow.read_text(encoding="utf-8")
    assert "actions: read" in text
    assert "pages: write" in text
    assert "id-token: write" in text
    assert "repository_dispatch:" in text
    assert "sitegraph-data-updated" in text
    assert "cron: '30 */6 * * *'" not in text
    assert "github.event.client_payload.sitegraph_ref" in text
    assert "ref: ${{ env.SITEGRAPH_REF }}" in text
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
    assert "prepare_public_assets.py build-public-data" in text
    assert "gh run download \"$RUN_ID\"" in text
    assert "--name njupt-search-dist" in text
    assert "rm -rf dist/generated" in text
    assert "cp -R apps/web/public/generated dist/generated" in text
    assert "actions/upload-pages-artifact@v5" in text
    assert "actions/deploy-pages@v5" in text
    assert "npx --yes edgeone@latest pages deploy ./dist" in text
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
    assert "prepare_public_assets.py build-public-data" in text


def test_exam_update_uses_retrying_generated_commit_helper():
    workflow = Path(".github/workflows/update-exam-data.yml")
    assert workflow.exists()
    text = workflow.read_text(encoding="utf-8")
    assert "actions: read" in text
    assert "pages: write" in text
    assert "id-token: write" in text
    assert "python tools/ci/commit_generated_changes.py" in text
    assert "prepare_public_assets.py update-exam-lock" in text
    assert "prepare_public_assets.py build-exam-public-data" in text
    assert "prepare_public_assets.py verify-exam-public-data" in text
    assert "gh run download \"$RUN_ID\"" in text
    assert "--name njupt-search-dist" in text
    assert "rm -rf dist/generated/exam" in text
    assert "cp -R apps/web/public/generated/exam dist/generated/exam" in text
    assert "actions/upload-pages-artifact@v5" in text
    assert "actions/deploy-pages@v5" in text
    assert "npx --yes edgeone@latest pages deploy ./dist" in text
    assert "Update Exam Data" not in Path(".github/workflows/ci.yml").read_text(encoding="utf-8")
    assert "prepare_public_assets.py build-public-data" not in text
    assert "Checkout sitegraph source packages" not in text
    assert "--add config/data-locks/exam.lock.json" in text
    assert "--add apps/web/public/generated/exam/" not in text
    assert "validate_search_index.py" not in text
    assert "run-smoke-queries" not in text
    assert "run-task-queries" not in text
    assert "uv run python -m pytest" not in text
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
