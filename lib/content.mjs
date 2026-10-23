import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";

export const escape = (value = "") => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const slug = value => value.replace(/^\d+[-_]?/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const titleFrom = value => value.replace(/^\d+[-_]?/, "").replace(/[-_]/g, " ").replace(/^./, c => c.toUpperCase());
export function safeUrl(value, { image = false } = {}) {
  if (typeof value !== "string" || /[\s\\\x00-\x1f]/.test(value)) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (!image && value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    if (["https:", "http:"].includes(url.protocol) || (!image && url.protocol === "mailto:")) return value;
  } catch {}
  return "";
}
export function basePath() {
  const value = process.env.PATH_PREFIX || "/";
  return "/" + value.split("/").filter(Boolean).join("/") + (value === "/" ? "" : "/");
}
export function localUrl(value, image = false) {
  const safe = safeUrl(value, { image });
  return safe.startsWith("/") ? basePath() + safe.slice(1) : safe;
}
export function linkCard(label, url, preview = {}) {
  const href = localUrl(url);
  if (!href) return escape(label);
  let host = "Link";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  const image = localUrl(preview.image, true);
  return `<a class="link-card${image ? " has-image" : ""}" href="${escape(href)}">${image ? `<img src="${escape(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="link-icon" aria-hidden="true">↗</span>`}<span class="link-copy"><span class="link-host">${escape(host)}</span><strong>${escape(label || preview.title || host)}</strong>${preview.description ? `<span class="link-description">${escape(preview.description)}</span>` : ""}</span><span class="card-arrow" aria-hidden="true">↗</span></a>`;
}
export function renderMarkdown(content, previews = {}) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
  const originalImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    tokens[idx].attrSet("src", localUrl(tokens[idx].attrGet("src"), true));
    tokens[idx].attrSet("loading", "lazy");
    return originalImage(tokens, idx, options, env, self);
  };
  const originalLink = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrSet("href", localUrl(tokens[idx].attrGet("href")));
    return originalLink(tokens, idx, options, env, self);
  };
  const tokens = md.parse(content, {});
  for (let i = 0; i < tokens.length - 2; i++) {
    const children = tokens[i + 1].children;
    if (tokens[i].type === "paragraph_open" && tokens[i + 2].type === "paragraph_close" && children?.[0]?.type === "link_open" && children.at(-1)?.type === "link_close" && children.filter(t => t.type === "link_open").length === 1 && children.slice(1, -1).every(t => t.type === "text")) {
      const url = children[0].attrGet("href");
      if (!/^https?:\/\//.test(url)) continue;
      tokens[i].type = "html_block";
      tokens[i].content = linkCard(children.slice(1, -1).map(t => t.content).join(""), url, previews[url]);
      tokens[i + 1].hidden = true;
      tokens[i + 1].children = [];
      tokens[i + 2].hidden = true;
    }
  }
  return md.renderer.render(tokens, md.options, {});
}
export async function readMarkdown(file) {
  return matter(await readFile(file, "utf8"));
}
export async function loadContent(root = process.cwd()) {
  const site = JSON.parse(await readFile(path.join(root, "site.json"), "utf8"));
  const previews = JSON.parse(await readFile(path.join(root, "previews.json"), "utf8"));
  const intro = await readMarkdown(path.join(root, "content/intro.md"));
  const entries = await readdir(path.join(root, "content"), { withFileTypes: true });
  const sections = [];
  const ids = new Set();
  for (const dir of entries.filter(e => e.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
    const folder = path.join(root, "content", dir.name);
    const files = (await readdir(folder)).sort();
    const index = files.includes("_index.md") ? await readMarkdown(path.join(folder, "_index.md")) : { data: {}, content: "" };
    if (index.data.draft) continue;
    const id = slug(dir.name);
    if (!id || ids.has(id)) throw new Error(`Section folder needs a unique name: ${dir.name}`);
    ids.add(id);
    const items = [];
    for (const file of files.filter(f => f.endsWith(".md") && !f.startsWith("_"))) {
      const item = await readMarkdown(path.join(folder, file));
      if (item.data.draft) continue;
      items.push({ ...item.data, title: item.data.title || titleFrom(file.slice(0, -3)), body: renderMarkdown(item.content, previews) });
    }
    sections.push({ ...index.data, id, title: index.data.title || titleFrom(dir.name), body: renderMarkdown(index.content, previews), items });
  }
  return { site, intro: renderMarkdown(intro.content, previews), sections };
}
