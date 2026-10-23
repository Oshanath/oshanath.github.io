import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderMarkdown, loadContent, localUrl } from "../lib/content.mjs";
import { extractPreview } from "../scripts/previews.mjs";

test("standalone links become preview cards; inline and adjacent links stay normal", () => {
  const html = renderMarkdown('[Research](https://example.com/)\n\nRead [this](https://example.com/) first.\n\n[A](https://a.com/) [B](https://b.com/)', { "https://example.com/": { image: "https://example.com/cover.png", description: "An overview" } });
  assert.equal((html.match(/class="link-card/g) || []).length, 1);
  assert.match(html, /cover\.png/);
  assert.match(html, /An overview/);
  assert.match(html, /<p>Read <a href="https:\/\/example.com\/">this<\/a> first\.<\/p>/);
  assert.match(html, /<p><a href="https:\/\/a.com\/">A<\/a> <a href="https:\/\/b.com\/">B<\/a><\/p>/);
});
test("missing metadata still produces a usable link; unsafe HTML and URL metadata stay inert", () => {
  const html = renderMarkdown('[Fallback](https://example.com/)\n\n<script>alert(1)</script>', { "https://example.com/": { image: "javascript:alert(1)", description: '<script>bad</script>' } });
  assert.match(html, /href="https:\/\/example.com\/"/);
  assert.doesNotMatch(html, /<script>|src="javascript:/);
  assert.match(html, /&lt;script&gt;/);
});
test("project repository paths work for Markdown images and links", () => {
  const previous = process.env.PATH_PREFIX;
  process.env.PATH_PREFIX = "/portfolio";
  try {
    const html = renderMarkdown('![Photo](/assets/photo.jpg)\n\n[Resume](/assets/resume.pdf)');
    assert.match(html, /src="\/portfolio\/assets\/photo.jpg"/);
    assert.match(html, /href="\/portfolio\/assets\/resume.pdf"/);
    assert.equal(localUrl("https://example.com/"), "https://example.com/");
  } finally { if (previous === undefined) delete process.env.PATH_PREFIX; else process.env.PATH_PREFIX = previous; }
});
test("new folders appear automatically, sort by prefix, and drafts are omitted", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "portfolio-"));
  try {
    await mkdir(path.join(root, "content"));
    await writeFile(path.join(root, "site.json"), '{"name":"Example"}');
    await writeFile(path.join(root, "previews.json"), '{}');
    await writeFile(path.join(root, "content/intro.md"), "Hello");
    for (const dir of ["20-new-section", "10-about", "30-hidden"]) await mkdir(path.join(root, "content", dir));
    await writeFile(path.join(root, "content/30-hidden/_index.md"), "---\ndraft: true\n---\nHidden");
    await writeFile(path.join(root, "content/20-new-section/10-first.md"), "---\ntitle: First\n---\nBody");
    await writeFile(path.join(root, "content/20-new-section/20-draft.md"), "---\ndraft: true\n---\nHidden");
    const { sections } = await loadContent(root);
    assert.deepEqual(sections.map(s => s.id), ["about", "new-section"]);
    assert.deepEqual(sections[1].items.map(i => i.title), ["First"]);
  } finally { await rm(root, { recursive: true }); }
});
test("Open Graph metadata supports relative images and encoded text", () => {
  const preview = extractPreview('<html><head><meta content="A &amp; B" property="og:title"><meta name="description" content="Useful summary"><meta property="og:image" content="/cover.png"></head></html>', "https://example.com/page");
  assert.deepEqual(preview, { title: "A & B", description: "Useful summary", image: "https://example.com/cover.png" });
});
