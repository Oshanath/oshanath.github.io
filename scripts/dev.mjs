import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './build.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const port = Number(process.env.PORT || 4173);
await buildSite();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.pdf': 'application/pdf', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let target = resolve(output, `.${pathname}`);
    if (target !== output && !target.startsWith(output + '/')) { res.writeHead(403); res.end(); return; }
    if ((await stat(target)).isDirectory()) target = join(target, 'index.html');
    const bytes = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await readFile(join(output, '404.html')));
  }
});
server.listen(port, '0.0.0.0', () => console.log(`Local: http://localhost:${port}/`));

let building = false;
let pending = false;
let timer;
async function rebuild() {
  if (building) { pending = true; return; }
  building = true;
  try { await buildSite(); console.log('Updated. Refresh the browser to see your edits.'); }
  catch (error) { console.error(error.message); }
  finally { building = false; if (pending) { pending = false; await rebuild(); } }
}
const watchers = ['content', 'public', 'site'].map(directory => watch(join(root, directory), { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 150);
}));
function close() { watchers.forEach(w => w.close()); server.close(); }
process.on('SIGTERM', close);
process.on('SIGINT', close);
