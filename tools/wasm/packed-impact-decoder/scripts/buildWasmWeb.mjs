import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const crateDir = resolve(scriptDir, '..');
const repoRoot = resolve(crateDir, '..', '..', '..');
const packageDir = resolve(crateDir, 'pkg');
const runtimeDir = resolve(repoRoot, 'apps/web/src/features/collection-search/wasm');
const lockFile = resolve(crateDir, '.build-wasm-web.lock');

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireLock() {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      return openSync(lockFile, 'wx');
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }
      try {
        const ageMs = Date.now() - statSync(lockFile).mtimeMs;
        if (ageMs > 300_000) {
          unlinkSync(lockFile);
          continue;
        }
      } catch {
        continue;
      }
      sleep(500);
    }
  }
  throw new Error(`Timed out waiting for ${lockFile}`);
}

const lock = acquireLock();
try {
  run('wasm-pack', ['build', '--target', 'web', '--release', '--out-dir', 'pkg'], { cwd: crateDir });

  rmSync(runtimeDir, { recursive: true, force: true });
  mkdirSync(runtimeDir, { recursive: true });

  for (const fileName of [
    'packed_impact_decoder.js',
    'packed_impact_decoder.d.ts',
    'packed_impact_decoder_bg.wasm',
    'packed_impact_decoder_bg.wasm.d.ts',
    'package.json',
  ]) {
    const source = resolve(packageDir, fileName);
    if (!existsSync(source)) {
      throw new Error(`Missing generated WASM artifact: ${source}`);
    }
    copyFileSync(source, resolve(runtimeDir, fileName));
  }
} finally {
  closeSync(lock);
  rmSync(lockFile, { force: true });
}

console.log(`[buildWasmWeb] wrote ${runtimeDir}`);
