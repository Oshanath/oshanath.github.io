import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isWebURL } from './content.mjs';

const DAY = 24 * 60 * 60 * 1000;
const MAX_PAGE = 2 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
const hash = text => createHash('sha256').update(text).digest('hex').slice(0, 20);

// Fetches are build-time only. No third-party requests are needed by visitors.
async function get(url, limit) {
  let target = url;
  for (let redirects = 0; redirects < 5; redirects++) {
    if (!isWebURL(target)) throw new Error('Unsupported URL');
    const host = new URL(target).hostname;
    if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[|172\.(1[6-9]|2\d|3[01])\.)/i.test(host)) throw new Error('Not a public URL');
    const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'PortfolioPreview/1.0', Accept: 'text/html,image/*;q=0.9,*/*;q=0.5' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Missing redirect destination');
      target = new URL(location, target).href;
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
    if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new Error('Response too large'); }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > limit) throw new Error('Response too large');
      chunks.push(chunk);
    }
    return { bytes: Buffer.concat(chunks), type: (response.headers.get('content-type') ?? '').split(';')[0], url: target };
  }
  throw new Error('Too many redirects');
}

export function extractMetadata(html, url) {
  const $ = load(html);
  const meta = name => $(`meta[property="${name}"], meta[name="${name}"]`).first().attr('content')?.trim();
  const rawImage = meta('og:image:secure_url') || meta('og:image') || meta('twitter:image');
  let imageURL;
  try { const resolved = new URL(rawImage, url).href; if (rawImage && isWebURL(resolved)) imageURL = resolved; } catch {}
  return {
    title: (meta('og:title') || meta('twitter:title') || $('title').text()).slice(0, 180),
    description: (meta('og:description') || meta('twitter:description') || meta('description') || '').slice(0, 240),
    imageURL
  };
}

export async function fetchPreviews(urls, root, output) {
  const cacheRoot = join(root, '.cache');
  const cacheFile = join(cacheRoot, 'previews.json');
  await mkdir(join(cacheRoot, 'images'), { recursive: true });
  await mkdir(join(output, 'link-images'), { recursive: true });
  let cache = {};
  try { cache = JSON.parse(await readFile(cacheFile, 'utf8')); } catch {}
  const result = {};
  const queue = [...urls];
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const url = queue.shift();
      const previous = cache[url];
      let entry = previous;
      if (process.env.OFFLINE !== '1' && (!entry || Date.now() - entry.fetchedAt > (entry.failed ? DAY : 7 * DAY))) {
        try {
          const page = await get(url, MAX_PAGE);
          if (!page.type.includes('html')) throw new Error('Not an HTML page');
          const metadata = extractMetadata(page.bytes.toString('utf8'), page.url);
          entry = { title: metadata.title, description: metadata.description, fetchedAt: Date.now() };
          if (metadata.imageURL) {
            try {
              const image = await get(metadata.imageURL, MAX_IMAGE);
              const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
              const ext = extensions[image.type];
              if (ext) {
                entry.image = `link-images/${hash(metadata.imageURL)}.${ext}`;
                await writeFile(join(cacheRoot, 'images', entry.image.split('/').at(-1)), image.bytes);
              }
            } catch { /* The text preview still works without an image. */ }
          }
        } catch {
          entry = previous ? { ...previous, fetchedAt: Date.now(), failed: true } : { fetchedAt: Date.now(), failed: true };
          console.log(`Preview unavailable for ${new URL(url).hostname}; using a text card.`);
        }
        cache[url] = entry;
      }
      result[url] = { ...entry };
      if (entry?.image) {
        try { await copyFile(join(cacheRoot, 'images', entry.image.split('/').at(-1)), join(output, entry.image)); }
        catch { delete result[url].image; }
      }
    }
  }));
  await writeFile(cacheFile, JSON.stringify(cache, null, 2));
  return result;
}
