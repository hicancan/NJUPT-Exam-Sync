import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

function argument(name) {
    const index = process.argv.indexOf(name);
    const value = index >= 0 ? process.argv[index + 1] : undefined;
    if (!value) throw new Error(`missing ${name}`);
    return value;
}

function optionalArgument(name, defaultValue) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : defaultValue;
}

const root = path.resolve(argument('--root'));
const logPath = path.resolve(argument('--log'));
const port = Number(argument('--port'));
const scenario = optionalArgument('--scenario', 'normal');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid --port');
if (!['normal', 'missing-manifest', 'corrupt-identity'].includes(scenario)) {
    throw new Error('invalid --scenario');
}
writeFileSync(logPath, '');

const contentType = extension => ({
    '.bin': 'application/octet-stream',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.wasm': 'application/wasm',
}[extension] ?? 'application/octet-stream');

createServer((request, response) => {
    const started = performance.now();
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    const requestedPath = decodeURIComponent(url.pathname);
    let relativePath = requestedPath.replace(/^\/+/, '');
    if (!relativePath) relativePath = 'index.html';
    let filePath = path.resolve(root, relativePath);
    if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== root) {
        response.writeHead(400).end();
        return;
    }
    if (
        scenario === 'missing-manifest'
        && requestedPath === '/generated/search/manifest.json'
    ) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('missing SearchBundle manifest');
        response.on('finish', () => appendFileSync(logPath, `${JSON.stringify({
            at: new Date().toISOString(),
            method: request.method,
            path: requestedPath,
            status: 404,
            duration_ms: Number((performance.now() - started).toFixed(3)),
        })}\n`));
        return;
    }
    try {
        if (!statSync(filePath).isFile()) throw new Error('not a file');
    } catch {
        if (path.extname(relativePath)) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('not found');
            return;
        }
        filePath = path.join(root, 'index.html');
    }
    try {
        let body = readFileSync(filePath);
        if (
            scenario === 'corrupt-identity'
            && requestedPath === '/generated/search/manifest.json'
        ) {
            const manifest = JSON.parse(body.toString('utf8'));
            manifest.bundle_id = '0'.repeat(64);
            body = Buffer.from(JSON.stringify(manifest));
        }
        const isManifest = filePath.endsWith(`${path.sep}manifest.json`);
        response.writeHead(200, {
            'Content-Type': contentType(path.extname(filePath)),
            'Content-Length': body.length,
            'Cache-Control': isManifest ? 'no-cache' : 'public, max-age=31536000, immutable',
        });
        response.end(request.method === 'HEAD' ? undefined : body);
        response.on('finish', () => appendFileSync(logPath, `${JSON.stringify({
            at: new Date().toISOString(),
            method: request.method,
            path: requestedPath,
            query: url.search,
            bytes: body.length,
            duration_ms: Number((performance.now() - started).toFixed(3)),
        })}\n`));
    } catch (error) {
        response.writeHead(500).end();
        appendFileSync(logPath, `${JSON.stringify({
            at: new Date().toISOString(),
            method: request.method,
            path: requestedPath,
            error: error instanceof Error ? error.message : String(error),
        })}\n`);
    }
}).listen(port, '127.0.0.1', () => {
    process.stdout.write(`benchmark server listening on http://127.0.0.1:${port}\n`);
});
