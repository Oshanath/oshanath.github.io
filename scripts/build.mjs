import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { resolve, join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMarkdown, slug, escape as e, makeRenderer, collectPreviews, resourceURL, isWebURL } from './content.mjs';
import { fetchPreviews } from './previews.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arrow = '<span aria-hidden="true">↗</span>';
const label = text => String(text).replace(/^\d+[-_ ]*/, '').replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase());
const sort = (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.file.localeCompare(b.file, 'en', { numeric: true });

async function document(file) {
  const doc = readMarkdown(await readFile(file, 'utf8'), file);
  if (doc.title != null && typeof doc.title !== 'string') throw new Error(`${file}: title must be text.`);
  if (doc.order != null && !Number.isFinite(doc.order)) throw new Error(`${file}: order must be a number.`);
  return doc;
}

export async function loadContent(root) {
  const contentRoot = join(root, 'content');
  const profile = await document(join(contentRoot, 'profile.md'));
  if (!profile.name || !profile.headline) throw new Error('content/profile.md needs name and headline.');
  const sectionsRoot = join(contentRoot, 'sections');
  const sections = [];
  for (const entry of await readdir(sectionsRoot, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    let section, items = [];
    const location = join(sectionsRoot, entry.name);
    if (entry.isDirectory()) {
      const entries = await readdir(location, { withFileTypes: true });
      const index = entries.find(item => item.name === 'index.md');
      section = index ? await document(join(location, index.name)) : { file: join(location, 'index.md'), body: '' };
      for (const item of entries) {
        if (!item.isFile() || !item.name.endsWith('.md') || item.name === 'index.md' || /^[_.]/.test(item.name)) continue;
        const doc = await document(join(location, item.name));
        if (!doc.draft) items.push({ ...doc, title: doc.title || label(basename(item.name, '.md')) });
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      section = await document(location);
    } else continue;
    if (section.draft) continue;
    const id = slug(section.id || basename(entry.name, '.md'));
    if (!id) throw new Error(`${location}: section needs a name.`);
    if (sections.some(s => s.id === id)) throw new Error(`Duplicate section ID "${id}". Rename a section or set a unique id.`);
    const layout = section.layout || 'prose';
    if (!['prose', 'cards', 'timeline'].includes(layout)) throw new Error(`${location}: layout must be prose, cards, or timeline.`);
    const itemIds = new Set();
    items = items.sort(sort).map(item => {
      const itemId = `${id}-${slug(basename(item.file, '.md'))}`;
      if (itemIds.has(itemId)) throw new Error(`Duplicate item ID "${itemId}". Rename a Markdown file.`);
      itemIds.add(itemId);
      return { ...item, id: itemId };
    });
    sections.push({ ...section, id, layout, items, title: section.title || label(basename(entry.name, '.md')) });
  }
  return { contentRoot, profile, sections: sections.sort(sort) };
}

async function copyContentAssets(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    if (entry.isDirectory()) await copyContentAssets(join(from, entry.name), join(to, entry.name));
    else if (entry.isFile() && !entry.name.endsWith('.md')) await cp(join(from, entry.name), join(to, entry.name));
  }
}

export async function buildSite({ root = ROOT, output = join(root, 'dist') } = {}) {
  const { profile, sections, contentRoot } = await loadContent(root);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(join(root, 'public'), output, { recursive: true });
  await copyContentAssets(contentRoot, join(output, 'media'));
  await cp(join(root, 'site', 'style.css'), join(output, 'style.css'));
  await cp(join(root, 'site', 'interactions.js'), join(output, 'interactions.js'));
  const docs = [profile, ...sections.flatMap(s => [s, ...s.items])];
  const previews = await fetchPreviews(collectPreviews(docs, profile.link_previews !== false), root, output);
  const anchors = new Map(sections.flatMap(s => [s, ...s.items]).map(doc => [doc.file, doc.id]));
  const render = makeRenderer({ contentRoot, anchors, previews, linkPreviews: profile.link_previews !== false });
  const href = (url, doc = profile) => resourceURL(url, doc, contentRoot, anchors);
  const navigation = sections.filter(s => s.nav !== false).map((s, i) =>
    `<a href="#${e(s.id)}" class="nav-link"><span class="nav-number">${String(i + 1).padStart(2, '0')}</span><span>${e(s.nav || s.title)}</span><span class="nav-dash" aria-hidden="true"></span></a>`).join('');
  const socialLinks = (profile.links ?? []).map(link =>
    `<a href="${e(href(link.url))}" rel="noopener noreferrer">${e(link.label)} ${arrow}</a>`).join('');

  function itemHTML(item, section) {
    const body = `<div class="prose">${render(item, item.id)}</div>`;
    const tags = Array.isArray(item.tags) ? `<ul class="tags" aria-label="Technologies">${item.tags.map(tag => `<li>${e(tag)}</li>`).join('')}</ul>` : '';
    const link = item.url ? `<a class="item-link" href="${e(href(item.url, item))}" rel="noopener noreferrer">${e(item.link_label || 'Learn more')} ${arrow}</a>` : '';
    const metadata = previews[item.url] ?? {};
    const image = item.image ? href(item.image, item) : metadata.image ? `./${metadata.image}` : null;
    if (section.layout === 'cards') return `<article class="project-card" id="${e(item.id)}">
      ${image ? `<div class="project-image"><img src="${e(image)}" alt="${e(item.image_alt || '')}" width="1000" height="560" loading="lazy"></div>` : ''}
      <div class="project-copy">${item.eyebrow ? `<p class="item-eyebrow">${e(item.eyebrow)}</p>` : ''}
      <h3>${e(item.title)}</h3>${body}${tags}${link}</div></article>`;
    if (section.layout === 'timeline') return `<article class="timeline-item" id="${e(item.id)}">
      <p class="timeline-period">${e(item.period || '')}</p><div><h3>${e(item.title)}</h3>
      ${item.subtitle ? `<p class="timeline-subtitle">${e(item.subtitle)}</p>` : ''}${body}${link}</div></article>`;
    return `<article class="prose-item" id="${e(item.id)}"><h3>${e(item.title)}</h3>${body}${tags}${link}</article>`;
  }

  const sectionHTML = sections.map((s, index) => `<section class="section section-${e(s.layout)}${s.style === 'contact' ? ' section-contact' : ''}" id="${e(s.id)}" aria-labelledby="heading-${e(s.id)}">
    <div class="section-heading"><span class="section-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><h2 id="heading-${e(s.id)}">${e(s.title)}</h2></div>
    ${s.body.trim() ? `<div class="prose section-intro">${render(s, s.id)}</div>` : ''}
    ${s.items.length ? `<div class="items ${e(s.layout)}">${s.items.map(item => itemHTML(item, s)).join('')}</div>` : ''}</section>`).join('\n');

  const canonical = isWebURL(profile.site_url) ? profile.site_url.replace(/\/$/, '') + '/' : '';
  const values = {
    TITLE: e(`${profile.name} — ${profile.role || 'Portfolio'}`),
    DESCRIPTION: e(profile.description || profile.headline),
    CANONICAL: canonical ? `<link rel="canonical" href="${e(canonical)}"><meta property="og:url" content="${e(canonical)}">` : '',
    NAME: e(profile.name), INITIALS: e(profile.initials || profile.name.split(' ').map(s => s[0]).slice(0, 2).join('')),
    ROLE: e(profile.role || ''), LOCATION: e(profile.location || ''),
    AVATAR: profile.image ? `<img class="avatar" src="${e(href(profile.image))}" alt="${e(profile.name)}" width="76" height="76">` : '',
    NAVIGATION: navigation, SOCIAL_LINKS: socialLinks, EYEBROW: e(profile.eyebrow || 'Personal portfolio'),
    HEADLINE: e(profile.headline), INTRO: render(profile, 'intro'), SECTIONS: sectionHTML,
    PRIMARY: profile.primary_link ? `<a class="primary-link" href="${e(href(profile.primary_link.url))}">${e(profile.primary_link.label)} <span aria-hidden="true">↓</span></a>` : '',
    YEAR: String(new Date().getUTCFullYear())
  };
  const template = await readFile(join(root, 'site', 'template.html'), 'utf8');
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Unknown template placeholder: ${key}`);
    return values[key];
  });
  await writeFile(join(output, 'index.html'), html);
  await writeFile(join(output, '.nojekyll'), '');
  await writeFile(join(output, '404.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Page not found — ${e(profile.name)}</title><style>body{background:#141716;color:#ecece6;font:18px/1.7 system-ui;max-width:600px;margin:20vh auto;padding:30px}a{color:#b5d6c2}h1{font:52px Georgia}</style><main><p>404 / A wrong turn</p><h1>Nothing here, just yet.</h1><p>The page may have moved.</p><a href="${e(canonical || './')}">Back to the portfolio →</a></main></html>`);
  console.log(`Built ${sections.length} sections and ${sections.reduce((n, s) => n + s.items.length, 0)} entries → ${output}`);
  return { profile, sections, output };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildSite();
