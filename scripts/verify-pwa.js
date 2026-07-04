import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log('✓', msg);
}

const manifest = JSON.parse(readFileSync(join(root, 'dist', 'manifest.json'), 'utf8'));
assert(manifest.name && manifest.short_name, 'manifest has name and short_name');
assert(manifest.start_url, 'manifest has start_url');
assert(manifest.display === 'fullscreen', 'manifest display is fullscreen');
assert(manifest.background_color && manifest.theme_color, 'manifest has theme colors');
assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest has icons');

const sw = readFileSync(join(root, 'dist', 'sw.js'), 'utf8');
assert(sw.includes('install') && sw.includes('fetch') && sw.includes('activate'), 'service worker has install/fetch/activate handlers');
assert(sw.includes('neon-strike-v'), 'service worker uses versioned cache');

const index = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
assert(index.includes('<link rel="manifest"'), 'index.html links manifest');
assert(index.includes('viewport-fit=cover'), 'index.html includes safe-area viewport');
assert(index.includes('touch-action: none'), 'index.html disables touch actions');

console.log('PWA verification passed.');
