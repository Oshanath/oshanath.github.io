import { load } from 'cheerio';
import { readFile, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const html = await readFile(join(output, 'index.html'), 'utf8');
const $ = load(html);
const errors = [];
const ids = new Set();
$('[id]').each((_, element) => {
  const id = $(element).attr('id');
  if (ids.has(id)) errors.push(`Duplicate ID: ${id}`);
  ids.add(id);
});
if ($('h1').length !== 1) errors.push('The page needs exactly one main heading.');
if (!$('title').text().trim()) errors.push('Missing page title.');
if ($('html').attr('lang') !== 'en') errors.push('Missing document language.');
if (!$('meta[name="color-scheme"][content="dark"]').length) errors.push('Dark mode metadata is missing.');
for (const element of $('[href], [src]').toArray()) {
  const value = $(element).attr('href') || $(element).attr('src');
  if (!value || /^(https?:|mailto:|tel:)/.test(value)) continue;
  if (value.startsWith('#')) {
    if (value !== '#' && !ids.has(value.slice(1))) errors.push(`Broken anchor: ${value}`);
  } else {
    const target = resolve(output, decodeURIComponent(value.split('#')[0]));
    if (target !== output && !target.startsWith(output + '/')) { errors.push(`Asset outside output: ${value}`); continue; }
    try { await access(target); } catch { errors.push(`Missing local file: ${value}`); }
  }
}
$('img').each((_, image) => { if ($(image).attr('alt') === undefined) errors.push('Image is missing alt text.'); });
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Verified ${$('main > section').length} sections, ${ids.size} unique IDs, all local assets, and all page anchors.`);
