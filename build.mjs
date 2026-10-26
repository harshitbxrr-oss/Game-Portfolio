#!/usr/bin/env node
/**
 * Build the single-file site.
 *
 * Joins src/template.html, the JavaScript modules in src/ and the images in
 * assets/images/ into one self-contained index.html (scripts inlined, images
 * as data URIs). Produces exactly the same file as build.py. Needs Node 18+
 * and no packages.
 *
 *   node build.mjs                 writes ./index.html
 *   node build.mjs --out public    writes public/index.html (+ public/assets/og-image.jpg)
 *   node build.mjs --check         only checks the JavaScript for syntax errors
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, existsSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const SRC = join(ROOT, 'src');
export const IMG = join(ROOT, 'assets', 'images');

// Order matters: later modules extend earlier ones. Keep this order if you add files.
export const MODULES = ['engine.js', 'content.js', 'world.js', 'game.js', 'vehicles.js', 'physics.js', 'ui.js', 'device.js', 'lights.js'];
export const IMAGES = {
  REF01: 'ref-01-cyber-chowk.jpg',
  REF02: 'ref-02-setu-bridge.jpg',
  REF03: 'ref-03-vajra-s1-studio.jpg',
  REF04: 'ref-04-bazaar-drift.jpg',
  REF05: 'ref-05-city-map.jpg',
  REF06: 'ref-06-old-city-gate.jpg',
  REF07: 'ref-07-holo-interchange.jpg',
};

const SCRIPT_BLOCK = /<script>\s*__SCRIPTS__\s*<\/script>/;

/**
 * @param {{dev?: boolean}} opts
 *   dev: true  -> modules are loaded as separate <script src="src/..."> tags and images by URL,
 *                 so the browser shows real file names and line numbers and VS Code can set breakpoints.
 *        false -> one self-contained file (what you deploy).
 * @returns {{html: string, parts: {file: string, text: string}[]}}
 */
export function buildHtml({ dev = false } = {}) {
  let html = readFileSync(join(SRC, 'template.html'), 'utf8');
  if (!SCRIPT_BLOCK.test(html)) throw new Error('src/template.html is missing the <script>__SCRIPTS__</script> placeholder');
  const parts = MODULES.map((file) => ({ file, text: readFileSync(join(SRC, file), 'utf8') }));
  // function replacers: the code is full of "$" characters that String.replace would otherwise treat specially
  html = html.replace(SCRIPT_BLOCK, () => (dev ? parts.map((p) => `<script src="src/${p.file}"></script>`).join('\n') : `<script>\n${parts.map((p) => p.text).join('\n')}\n</script>`));
  for (const [key, name] of Object.entries(IMAGES)) {
    const ext = extname(name).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : (ext === '.png' ? 'image/png' : 'image/webp');
    const value = dev ? `assets/images/${name}` : `data:${mime};base64,${readFileSync(join(IMG, name)).toString('base64')}`;
    html = html.replaceAll(`__${key}__`, () => value);
  }
  const left = Object.keys(IMAGES).filter((k) => html.includes(`__${k}__`));
  if (left.length) throw new Error(`unreplaced placeholders: ${left.join(', ')}`);
  const coverPath = join(ROOT, 'case-studies', 'wallvista', 'wallvista-cover.png');
  if (!dev && existsSync(coverPath)) {
    const coverB64 = `data:image/png;base64,${readFileSync(coverPath).toString('base64')}`;
    html = html.replaceAll('case-studies/wallvista/wallvista-cover.png', coverB64);
  }
  const holoCover = join(IMG, 'ref-07-holo-interchange.jpg');
  if (!dev && existsSync(holoCover)) {
    const holoB64 = `data:image/jpeg;base64,${readFileSync(holoCover).toString('base64')}`;
    html = html.replaceAll('assets/images/ref-07-holo-interchange.jpg', holoB64);
    html = html.replaceAll('assets/images/ref-07-holo-interchange.webp', holoB64);
  }
  return { html, parts };
}

/** Compile all modules as one script. Returns null when fine, or {file, line, message}. */
export function checkSyntax(parts) {
  const js = parts.map((p) => p.text).join('\n');
  try {
    new vm.Script(js, { filename: 'bundle.js' });
    return null;
  } catch (e) {
    const m = /bundle\.js:(\d+)/.exec(String(e.stack));
    let line = m ? Number(m[1]) : 0;
    let start = 1;
    for (const p of parts) {
      const n = p.text.split('\n').length;
      if (line < start + n) return { file: `src/${p.file}`, line: line - start + 1, message: e.message };
      start += n;
    }
    return { file: 'src/*.js', line, message: e.message };
  }
}

function main() {
  const args = process.argv.slice(2);
  const { html, parts } = buildHtml();
  const problem = checkSyntax(parts);
  if (problem) {
    console.error(`Syntax error in ${problem.file}:${problem.line}\n  ${problem.message}`);
    process.exit(1);
  }
  if (args.includes('--check')) return console.log('JavaScript syntax OK');
  const i = args.indexOf('--out');
  const out = i >= 0 ? resolve(args[i + 1] || '') : ROOT;
  if (i >= 0 && !args[i + 1]) {
    console.error('--out needs a folder name, e.g. --out public');
    process.exit(1);
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'index.html'), html);
  if (out !== ROOT) {
    mkdirSync(join(out, 'assets'), { recursive: true });
    copyFileSync(join(ROOT, 'assets', 'og-image.jpg'), join(out, 'assets', 'og-image.jpg'));
    copyFileSync(join(ROOT, 'assets', 'og-image.jpg'), join(out, 'og-image.jpg'));
    const resume = join(ROOT, 'assets', 'harshit-kumar-sinha-resume.pdf');
    if (existsSync(resume)) copyFileSync(resume, join(out, 'assets', 'harshit-kumar-sinha-resume.pdf'));
    cpSync(join(ROOT, 'case-studies'), join(out, 'case-studies'), { recursive: true, force: true });
  }
  const shown = out === ROOT ? 'index.html' : `${args[i + 1]}/index.html`;
  console.log(`built ${shown}: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
