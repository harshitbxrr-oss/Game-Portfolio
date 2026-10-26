#!/usr/bin/env node
/**
 * Dev server for Shatranj City. No packages needed (Node 18+).
 *
 *   node dev.mjs                      http://localhost:5173
 *   node dev.mjs --port 3000          another port        (npm start -- --port 3000)
 *   node dev.mjs --host 127.0.0.1     this computer only  (default: also reachable on your Wi-Fi for phone testing)
 *   node dev.mjs --bundle             serve the same single-file bundle that you deploy
 *
 * The PORT, HOST and DEV_BUNDLE=1 environment variables work too.
 *
 * - Edit anything in src/ (or swap an image in assets/images/) and the browser reloads by itself.
 * - Scripts are served as separate files, so DevTools and VS Code show real file names and line
 *   numbers, and breakpoints in src/*.js work. Press F5 in VS Code ("Play in Chrome").
 * - A JavaScript syntax error shows up on the page with the file and line instead of a blank screen.
 */
import http from 'node:http';
import os from 'node:os';
import { watch, readFileSync, statSync, createReadStream } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';
import { ROOT, SRC, IMG, MODULES, buildHtml, checkSyntax } from './build.mjs';

function flag(name) {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
}
const PORT = Number(flag('port') || process.env.PORT) || 5173;
const HOST = (typeof flag('host') === 'string' && flag('host')) || process.env.HOST || '0.0.0.0';
const BUNDLE = flag('bundle') !== undefined || process.env.DEV_BUNDLE === '1';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.woff2': 'font/woff2',
};
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Reload when the page's event stream reconnects after a server restart, and on every "reload" message.
const RELOAD = `<script>(()=>{let lost=false;const es=new EventSource('/__reload');es.onmessage=()=>location.reload();es.onerror=()=>{lost=true};es.onopen=()=>{if(lost)location.reload()}})()</script>`;
const clients = new Set();

function errorPage(title, detail) {
  return `<!doctype html><meta charset="utf-8"><title>Build error</title>
<body style="margin:0;background:#1b1020;color:#ffd7d7;font:16px/1.5 system-ui,sans-serif;padding:40px">
<h1 style="margin:0 0 8px;font-size:28px">${esc(title)}</h1>
<p style="color:#ffb3b3;margin:0 0 20px">Fix the file and save it. This page reloads by itself.</p>
<pre style="background:#2a1830;padding:18px;border-radius:10px;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap">${esc(detail)}</pre>${RELOAD}`;
}

function indexPage() {
  try {
    const { html, parts } = buildHtml({ dev: !BUNDLE });
    const problem = checkSyntax(parts);
    if (problem) return errorPage('JavaScript syntax error', `${problem.file}:${problem.line}\n${problem.message}`);
    return html.replace('</body>', () => `${RELOAD}</body>`);
  } catch (e) {
    return errorPage('Could not build the page', e.message);
  }
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function handle(req, res) {
  // take the path straight from the request line; a malformed %-escape throws and is answered with 400 below
  const urlParts = req.url.split('?');
  const path = decodeURIComponent(urlParts[0].split('#')[0]);
  const qs = urlParts[1] ? `?${urlParts[1]}` : '';
  if (path.includes('\0')) return send(res, 400, 'text/plain; charset=utf-8', 'Bad request');

  if (path === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('retry: 500\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (path === '/__log') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      console.log('*** CLIENT ERROR LOGGED ***:\n' + body);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    return;
  }
  if (path === '/' || path === '/index.html') return send(res, 200, TYPES['.html'], indexPage());

  // source modules: served with a strict-mode directive in front (no line shift), because the production bundle runs in strict mode
  const mod = /^\/src\/([\w.-]+\.js)$/.exec(path);
  if (mod && MODULES.includes(mod[1])) {
    return send(res, 200, TYPES['.js'], `'use strict';` + readFileSync(join(SRC, mod[1]), 'utf8'));
  }

  // everything else: only assets/, media/, and case-studies/
  let file = normalize(join(ROOT, path));
  const allowed = [join(ROOT, 'assets') + sep, join(ROOT, 'media') + sep, join(ROOT, 'case-studies') + sep];
  if (!allowed.some((a) => file.startsWith(a))) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  try {
    const st = statSync(file);
    if (st.isDirectory()) {
      if (!req.url.split('?')[0].endsWith('/')) {
        res.writeHead(302, { Location: req.url.split('?')[0] + '/' + qs, 'Cache-Control': 'no-store' });
        res.end();
        return;
      }
      const idx = join(file, 'index.html');
      if (statSync(idx).isFile()) file = idx;
      else throw new Error('not a file');
    } else if (!st.isFile()) {
      throw new Error('not a file');
    }
  } catch {
    return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

// one bad request must never take the dev server down
const server = http.createServer((req, res) => {
  try {
    handle(req, res);
  } catch (e) {
    if (!res.headersSent) send(res, 400, 'text/plain; charset=utf-8', 'Bad request');
    else res.destroy();
  }
});

// watch the (flat) source folders; no recursion needed
let timer = null;
for (const dir of [SRC, IMG]) {
  watch(dir, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const c of clients) c.write('data: reload\n\n');
      console.log(`${new Date().toLocaleTimeString()}  changed, reloading ${clients.size} tab${clients.size === 1 ? '' : 's'}`);
    }, 80);
  });
}
setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 20000).unref();

console.log('Starting dev server...');
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Try:  node dev.mjs --port ${PORT + 1}` : e.message);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  console.log(`Dev server ready at http://localhost:${PORT}${BUNDLE ? '  (single-file bundle)' : ''}`);
  if (HOST === '0.0.0.0') {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`On your phone (same Wi-Fi): http://${a.address}:${PORT}`);
    }
  }
  console.log('Edit files in src/ and the page reloads. Press Ctrl+C to stop.');
});
