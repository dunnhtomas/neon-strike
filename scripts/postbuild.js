import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');

if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

// Copy the classic JS runtime files into dist so the production bundle works.
const files = ['game.js', 'manifest.json', 'sw.js'];
files.forEach((f) => copyFileSync(join(root, f), join(dist, f)));
cpSync(join(root, 'src'), join(dist, 'src'), { recursive: true, force: true });

console.log('postbuild: copied game.js, manifest.json, sw.js, and src/ to dist/');
