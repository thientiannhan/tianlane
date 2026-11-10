import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiAndHealthRequest } from './apiRouter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');
const PORT = Number(process.env.PORT || 8080);

// Validate Neon.tech pooled connection string rule on startup
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('-pooler')) {
  console.warn(
    '[Tianlane Cloud Guard] WARNING: DATABASE_URL does not include "-pooler". Always use the Neon Pooled connection string in production.'
  );
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const handled = await handleApiAndHealthRequest(req, res);
  if (handled) return;

  // Serve static SPA from dist/ when running in production container
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const safePath = path
    .normalize(decodeURIComponent(urlObj.pathname))
    .replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = path.join(DIST_DIR, safePath === '/' ? 'index.html' : safePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader(
      'Content-Type',
      MIME_TYPES[ext] || 'application/octet-stream'
    );
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[Tianlane Server] Listening on http://0.0.0.0:${PORT} (Health: /health, MCP: /api/mcp)`
  );
});
