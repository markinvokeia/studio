// Empaqueta la demo en un único HTML autocontenido: node demo/build.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = await build({
  entryPoints: [join(here, 'main.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync(join(here, 'template.html'), 'utf8').replace('/*__BUNDLE__*/', () => js);
mkdirSync(join(here, '..', 'dist-demo'), { recursive: true });
writeFileSync(join(here, '..', 'dist-demo', 'index.html'), html);
console.log('demo:', (html.length / 1024).toFixed(0), 'KB');
