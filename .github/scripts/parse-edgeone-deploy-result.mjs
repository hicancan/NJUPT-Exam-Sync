import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REQUIRED_STRING_FIELDS = [
  'url',
  'type',
  'projectId',
  'deploymentId',
  'consoleUrl',
];

export function parseEdgeOneDeployResult(output) {
  const lines = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('EdgeOne CLI did not emit a deployment result');
  }

  let result;
  try {
    result = JSON.parse(lines.at(-1));
  } catch (error) {
    throw new Error('EdgeOne CLI final output line is not valid JSON', { cause: error });
  }

  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('EdgeOne CLI deployment result must be a JSON object');
  }

  if (result.status !== 'success') {
    const detail = typeof result.error === 'string' && result.error.trim()
      ? `: ${result.error.trim()}`
      : '';
    throw new Error(`EdgeOne deployment did not report success${detail}`);
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof result[field] !== 'string' || result[field].trim() === '') {
      throw new Error(`EdgeOne deployment result is missing ${field}`);
    }
  }

  for (const field of ['url', 'consoleUrl']) {
    let parsed;
    try {
      parsed = new URL(result[field]);
    } catch (error) {
      throw new Error(`EdgeOne deployment result has an invalid ${field}`, { cause: error });
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`EdgeOne deployment result ${field} must use HTTPS`);
    }
  }

  return result;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('usage: node parse-edgeone-deploy-result.mjs <deploy-output>');
  }
  const result = parseEdgeOneDeployResult(readFileSync(inputPath, 'utf8'));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
