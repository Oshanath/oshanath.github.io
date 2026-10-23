import MarkdownIt from 'markdown-it';
import { parse as parseYAML } from 'yaml';
import { resolve, dirname, relative, posix, sep } from 'node:path';

export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

export const slug = value => String(value).normalize('NFKD').toLowerCase()
  .replace(/^\d+[-_ ]*/, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

export function readMarkdown(source, file = 'Markdown') {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  let data = {};
  if (match) {
    try { data = parseYAML(match[1]) ?? {}; }
    catch (error) { throw new Error(`${file}: ${error.message}`); }
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error(`${file}: front matter must be a mapping.`);
  }
  return { ...data, body: match ? source.slice(match[0].length) : source, file };
}

export const isWebURL = value => {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password; }
  catch { return false; }
};

// A paragraph containing only one external link becomes a preview. Inline links
// and links inside lists remain normal Markdown links.
export function standaloneLink(tokens, i) {
  if (tokens[i]?.type !== 'paragraph_open' || tokens[i].level !== 0 ||
      tokens[i + 1]?.type !== 'inline' || tokens[i + 2]?.type !== 'paragraph_close') return null;
  const children = (tokens[i + 1].children ?? []).filter(t => t.type !== 'text' || t.content.trim());
  if (children[0]?.type !== 'link_open' || children.at(-1)?.type !== 'link_close' ||
      children.filter(t => t.type === 'link_open').length !== 1) return null;
  const url = children[0].attrGet('href');
  return isWebURL(url) ? { url, label: children.slice(1, -1).map(t => t.content).join('').trim() } : null;
}

export function collectPreviews(documents, enabled) {
  if (!enabled) return [];
  const md = new MarkdownIt({ html: false, linkify: true });
  const urls = new Set();
  for (const doc of documents) {
    if (isWebURL(doc.url) && !doc.image) urls.add(doc.url);
    const tokens = md.parse(doc.body, {});
    for (let i = 0; i < tokens.length; i++) {
      const link = standaloneLink(tokens, i);
      if (link) urls.add(link.url);
    }
  }
  return [...urls];
}

export function resourceURL(value, doc, contentRoot, anchors = new Map()) {
  const url = String(value ?? '');
  if (/^(https?:|mailto:|tel:|#)/i.test(url)) return url;
  if (/^\w+:/.test(url) || url.startsWith('//') || url.includes('\\')) return '#';
  if (url.startsWith('/')) return `./${url.slice(1)}`;
  const [path, fragment] = url.split('#');
  const target = resolve(dirname(doc.file), path);
  if (/\.md$/i.test(path) && anchors.has(target)) {
    const anchor = anchors.get(target);
    return `#${anchor}${fragment ? `-${slug(fragment)}` : ''}`;
  }
  const local = relative(contentRoot, target);
  if (local === '..' || local.startsWith(`..${sep}`)) throw new Error(`${doc.file}: asset must stay inside content/ or use /images/.`);
  return `./media/${local.split(sep).map(encodeURIComponent).join('/')}${fragment ? `#${fragment}` : ''}`;
}

export function linkPreview(link, previews, asset = path => `./${path}`) {
  const meta = previews[link.url] ?? {};
  const host = new URL(link.url).hostname.replace(/^www\./, '');
  const title = meta.title || (link.label !== link.url ? link.label : host);
  return `<a class="link-preview${meta.image ? ' has-image' : ''}" href="${escape(link.url)}" rel="noopener noreferrer">
    ${meta.image ? `<img src="${escape(asset(meta.image))}" alt="" width="180" height="120" loading="lazy">` : ''}
    <span class="link-preview-copy"><span class="link-domain">${escape(host)}</span>
    <span class="link-title">${escape(title)}</span>
    ${meta.description ? `<span class="link-description">${escape(meta.description)}</span>` : ''}</span>
    <span class="preview-arrow" aria-hidden="true">↗</span></a>`;
}

export function makeRenderer({ contentRoot, anchors, previews, linkPreviews = true }) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
  md.core.ruler.after('inline', 'portfolio-content', state => {
    const usedHeadings = new Map();
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      if (token.type === 'heading_open') {
        const base = slug(state.tokens[i + 1].content);
        const count = (usedHeadings.get(base) ?? 0) + 1;
        usedHeadings.set(base, count);
        token.attrSet('id', `${state.env.id}-${base}${count > 1 ? `-${count}` : ''}`);
      }
      if (['heading_open', 'heading_close'].includes(token.type)) token.tag = `h${Math.min(6, Number(token.tag.slice(1)) + 2)}`;
      const link = linkPreviews ? standaloneLink(state.tokens, i) : null;
      if (link) {
        const replacement = new state.Token('html_block', '', 0);
        replacement.content = linkPreview(link, previews);
        state.tokens.splice(i, 3, replacement);
      }
    }
  });
  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, i, options, env, self) => {
    tokens[i].attrSet('src', resourceURL(tokens[i].attrGet('src'), env.doc, contentRoot, anchors));
    tokens[i].attrSet('loading', 'lazy');
    tokens[i].attrSet('decoding', 'async');
    return defaultImage(tokens, i, options, env, self);
  };
  md.renderer.rules.link_open = (tokens, i, options, env, self) => {
    const token = tokens[i];
    token.attrSet('href', resourceURL(token.attrGet('href'), env.doc, contentRoot, anchors));
    if (isWebURL(token.attrGet('href'))) token.attrSet('rel', 'noopener noreferrer');
    return self.renderToken(tokens, i, options);
  };
  return (doc, id) => md.render(doc.body, { doc, id });
}
