import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { buildSite, loadContent } from './build.mjs';
import { readMarkdown, makeRenderer, linkPreview, resourceURL } from './content.mjs';
import { extractMetadata, fetchPreviews } from './previews.mjs';

process.env.OFFLINE = '1';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('folder and file sections build automatically, keeping numeric order and hiding drafts', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'portfolio-'));
  try {
    await cp(join(root, 'site'), join(fixture, 'site'), { recursive: true });
    await cp(join(root, 'public'), join(fixture, 'public'), { recursive: true });
    await mkdir(join(fixture, 'content/sections/02-projects'), { recursive: true });
    await mkdir(join(fixture, 'content/sections/10-notes'), { recursive: true });
    await writeFile(join(fixture, 'content/profile.md'), '---\nname: A Person\nheadline: Hello & welcome\n---\nIntro.');
    await writeFile(join(fixture, 'content/sections/01-about.md'), '---\ntitle: About\n---\nText.');
    await writeFile(join(fixture, 'content/sections/02-projects/index.md'), '---\nlayout: cards\n---');
    await writeFile(join(fixture, 'content/sections/02-projects/01-one.md'), '---\ntitle: One\n---\n![Local](diagram.svg)\n\n[Other](02-two.md)');
    await writeFile(join(fixture, 'content/sections/02-projects/diagram.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await writeFile(join(fixture, 'content/sections/02-projects/02-two.md'), '---\ntitle: Two\n---\nSecond.');
    await writeFile(join(fixture, 'content/sections/02-projects/03-hidden.md'), '---\ndraft: true\n---\nPrivate draft.');
    await writeFile(join(fixture, 'content/sections/03-draft.md'), '---\ndraft: true\n---\nHidden section.');
    await writeFile(join(fixture, 'content/sections/10-notes/01-note.md'), '---\ntitle: Note\n---\n# A heading\n\n<script>alert(1)</script>');
    const result = await buildSite({ root: fixture });
    assert.deepEqual(result.sections.map(s => s.id), ['about', 'projects', 'notes']);
    const html = await readFile(join(fixture, 'dist/index.html'), 'utf8');
    const $ = load(html);
    assert.equal($('.section-nav a').length, 3);
    assert.equal($('.project-card').length, 2);
    assert.equal($('h1').length, 1);
    assert.equal($('h3#notes-note-a-heading').text(), 'A heading');
    assert.equal($('img[alt="Local"]').attr('src'), './media/sections/02-projects/diagram.svg');
    assert.equal($('a[href="#projects-two"]').length, 1);
    assert.ok(!html.includes('Private draft.') && !html.includes('Hidden section.'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.match(await readFile(join(fixture, 'dist/media/sections/02-projects/diagram.svg'), 'utf8'), /svg/);
    // A rebuild removes deleted sections and their navigation entries.
    await rm(join(fixture, 'content/sections/10-notes'), { recursive: true });
    await buildSite({ root: fixture });
    assert.ok(!(await readFile(join(fixture, 'dist/index.html'), 'utf8')).includes('id="notes"'));
    await writeFile(join(fixture, 'content/sections/11-projects.md'), 'Duplicate.');
    await assert.rejects(loadContent(fixture), /Duplicate section ID/);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test('standalone links get cached previews; inline and list links remain links', () => {
  const url = 'https://example.com/article';
  const renderer = makeRenderer({ contentRoot: '/content', anchors: new Map(), previews: {
    [url]: { title: 'A title', description: 'A useful summary', image: 'link-images/example.png' }
  } });
  const doc = readMarkdown(`[Read it](${url})\n\nA sentence with [a link](${url}).\n\n- [A list link](${url})\n\nhttps://other.example/no-metadata`, '/content/sections/about.md');
  const $ = load(renderer(doc, 'about'));
  assert.equal($('.link-preview').length, 2);
  assert.equal($('.link-preview img').attr('src'), './link-images/example.png');
  assert.equal($('p a').length, 1);
  assert.equal($('li a').length, 1);
  assert.equal($('.link-preview').last().find('.link-title').text(), 'other.example');
  assert.ok(!linkPreview({ url, label: '<script>' }, {}).includes('<script>'));
});

test('Open Graph metadata supports relative thumbnails and normal title fallbacks', () => {
  const meta = extractMetadata('<title>Fallback</title><meta property="og:title" content="Project &amp; research"><meta name="description" content="Description"><meta property="og:image" content="/cover.png">', 'https://example.com/page');
  assert.deepEqual(meta, { title: 'Project & research', description: 'Description', imageURL: 'https://example.com/cover.png' });
  assert.equal(extractMetadata('<title>Fallback</title>', 'https://example.com').title, 'Fallback');
  assert.equal(resourceURL('/images/photo.jpg', { file: '/content/profile.md' }, '/content'), './images/photo.jpg');
  assert.throws(() => resourceURL('../../../secret', { file: '/content/sections/01-about/index.md' }, '/content'), /stay inside content/);
});

test('build-time preview fetching downloads thumbnails, reuses cache, and tolerates failures', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'portfolio-preview-'));
  const originalFetch = globalThis.fetch;
  const originalOffline = process.env.OFFLINE;
  const calls = [];
  process.env.OFFLINE = '0';
  globalThis.fetch = async url => {
    calls.push(url);
    if (url === 'https://example.com/post') return new Response('<meta property="og:title" content="A fetched title"><meta property="og:image" content="/cover.png">', { headers: { 'content-type': 'text/html' } });
    if (url === 'https://example.com/cover.png') return new Response('image-bytes', { headers: { 'content-type': 'image/png' } });
    throw new Error('Network unavailable');
  };
  try {
    const output = join(fixture, 'dist');
    const urls = ['https://example.com/post', 'https://offline.example/post'];
    const previews = await fetchPreviews(urls, fixture, output);
    assert.equal(previews[urls[0]].title, 'A fetched title');
    assert.match(previews[urls[0]].image, /^link-images\/.+\.png$/);
    assert.equal(await readFile(join(output, previews[urls[0]].image), 'utf8'), 'image-bytes');
    assert.equal(previews[urls[1]].failed, true);
    const count = calls.length;
    await fetchPreviews(urls, fixture, output);
    assert.equal(calls.length, count, 'cached successful and failed fetches should not repeat');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OFFLINE = originalOffline;
    await rm(fixture, { recursive: true, force: true });
  }
});
