import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseEdgeOneDeployResult } from './parse-edgeone-deploy-result.mjs';

const success = {
  status: 'success',
  url: 'https://njupt-search.example.edgeone.cool?eo_token=token&eo_time=123',
  type: 'direct-upload',
  projectId: 'pages-example',
  deploymentId: 'deployment-example',
  consoleUrl: 'https://console.cloud.tencent.com/edgeone/pages/project/pages-example/deployment/deployment-example',
};

test('parses the final JSON line and preserves the complete deployment URL', () => {
  const output = `[cli] uploading\r\n${JSON.stringify(success)}\r\n`;
  const result = parseEdgeOneDeployResult(output);

  assert.deepEqual(result, success);
  assert.equal(result.url, success.url);
});

test('rejects an EdgeOne error result', () => {
  assert.throws(
    () => parseEdgeOneDeployResult('{"status":"error","error":"permission denied"}\n'),
    /permission denied/u,
  );
});

test('rejects a success result with missing identity fields', () => {
  const incomplete = { ...success };
  delete incomplete.deploymentId;

  assert.throws(
    () => parseEdgeOneDeployResult(JSON.stringify(incomplete)),
    /missing deploymentId/u,
  );
});

test('rejects text output instead of structured output', () => {
  assert.throws(
    () => parseEdgeOneDeployResult('EDGEONE_DEPLOY_URL=https://example.com\n'),
    /not valid JSON/u,
  );
});

test('production deploy uses the Makers namespace and structured output only', () => {
  const deployScript = readFileSync(
    new URL('./deploy-edgeone-with-retry.sh', import.meta.url),
    'utf8',
  );

  assert.match(deployScript, /edgeone@latest makers deploy/u);
  assert.match(deployScript, /--json/u);
  assert.match(deployScript, /PAGES_SOURCE=skills/u);
  assert.doesNotMatch(deployScript, /edgeone@latest pages deploy/u);
});
