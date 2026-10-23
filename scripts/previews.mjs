import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseHTML } from "linkedom";
import MarkdownIt from "markdown-it";
import matter from "gray-matter";
import { safeUrl } from "../lib/content.mjs";

// Metadata is fetched at build time. The published site needs no API or server.
export function extractPreview(html, pageUrl) {
  const { document } = parseHTML(html);
  const meta = name => Array.from(document.querySelectorAll("meta")).find(el => (el.getAttribute("property") || el.getAttribute("name") || "").toLowerCase() === name)?.getAttribute("content") || "";
  const rawImage = meta("og:image") || meta("twitter:image");
  let image = "";
  try { if (rawImage) image = safeUrl(new URL(rawImage, pageUrl).href, { image: true }); } catch {}
  return {
    title: (meta("og:title") || document.querySelector("title")?.textContent || "").trim().slice(0, 300),
    description: (meta("og:description") || meta("description")).trim().slice(0, 350),
    image
  };
}
async function markdownFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(full));
    else if (entry.name.endsWith(".md")) files.push(full);
  }
  return files;
}
export async function updatePreviews() {
  const md = new MarkdownIt();
  const urls = new Set();
  for (const file of await markdownFiles("content")) {
    const { content, data } = matter(await readFile(file, "utf8"));
    if (data.draft) continue;
    const tokens = md.parse(content, {});
    for (let i = 0; i < tokens.length - 2; i++) {
      const children = tokens[i + 1]?.children;
      if (tokens[i].type !== "paragraph_open" || tokens[i + 2]?.type !== "paragraph_close" || children?.[0]?.type !== "link_open" || children.at(-1)?.type !== "link_close" || children.filter(t => t.type === "link_open").length !== 1 || !children.slice(1,-1).every(t => t.type === "text")) continue;
      const url = children[0].attrGet("href");
      if (/^https?:\/\//.test(url)) urls.add(url);
    }
  }
  const cache = JSON.parse(await readFile("previews.json", "utf8"));
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "MarkdownPortfolio/1.0 (link preview builder)", "Accept": "text/html" } });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("No readable HTML");
      // Bound the download, including pages without a Content-Length header.
      let bytes = 0;
      const chunks = [];
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) throw new Error("Page too large");
        chunks.push(chunk);
      }
      const preview = extractPreview(Buffer.concat(chunks).toString("utf8"), response.url);
      cache[url] = { ...cache[url], ...Object.fromEntries(Object.entries(preview).filter(([,v]) => v)) };
      console.log(`Preview updated: ${new URL(url).hostname}`);
    } catch {
      console.log(`Preview unavailable: ${new URL(url).hostname}; keeping cached metadata or a text card.`);
    }
  }
  await writeFile("previews.json", JSON.stringify(cache, null, 2) + "\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await updatePreviews();
