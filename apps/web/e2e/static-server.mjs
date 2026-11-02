// Minimal static file server for the `out/` export, used by `npm run preview` and
// Playwright. Mirrors Cloudflare Pages behaviour closely enough for tests:
// directory → index.html, `/` → 302 to /pl/ (public/_redirects), unknown → 404.html.
// Dependency-free on purpose (no extra package needed for one test helper).
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../out', import.meta.url)));
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const candidate = normalize(join(root, decoded));
  if (candidate !== root && !candidate.startsWith(root + sep)) return null; // path traversal
  for (const path of [candidate, join(candidate, 'index.html'), `${candidate}.html`]) {
    try {
      if ((await stat(path)).isFile()) return path;
    } catch {
      // try next candidate
    }
  }
  return null;
}

/**
 * Local-preview workaround for a Next.js 16.4 static-export bug on Windows only:
 * segment prefetch files are written nested (`__next.$d$locale/menu/__PAGE__.txt`)
 * because `path.relative()` yields backslashes, while the client requests the flat
 * name (`__next.$d$locale.menu.__PAGE__.txt`). Linux builds (CI, Cloudflare Pages)
 * produce flat files, so this fallback is never hit there.
 */
async function resolveWindowsSegmentFile(urlPath) {
  const match = /^(.*\/)__next\.(.+)\.txt$/.exec(urlPath);
  if (!match) return null;
  const [, dir, inner] = match;
  const [first, ...rest] = inner.split('.');
  if (rest.length === 0) return null;
  return resolveFile(`${dir}__next.${first}/${rest.join('/')}.txt`);
}

function send(res, status, file) {
  res.writeHead(status, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(res);
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (pathname === '/') {
    res.writeHead(302, { Location: '/pl/' });
    res.end();
    return;
  }
  const file = (await resolveFile(pathname)) ?? (await resolveWindowsSegmentFile(pathname));
  if (file) return send(res, 200, file);
  const notFound = await resolveFile('/404.html');
  if (notFound) return send(res, 404, notFound);
  res.writeHead(404).end('Not found');
}).listen(port, () => {
  console.warn(`Serving ${root} at http://localhost:${port}`);
});
