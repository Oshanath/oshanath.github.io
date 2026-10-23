import { loadContent, escape as e, localUrl, basePath } from "../lib/content.mjs";

const arrow = '<span aria-hidden="true">↗</span>';
export default class {
  data() { return { permalink: "index.html" }; }
  async render() {
    const { site, intro, sections } = await loadContent();
    const itemHtml = item => `<article class="entry">${localUrl(item.image, true) ? `<img class="entry-image" src="${e(localUrl(item.image, true))}" alt="${e(item.imageAlt || "")}" loading="lazy">` : ""}<div class="entry-content">${item.eyebrow ? `<p class="eyebrow">${e(item.eyebrow)}</p>` : ""}<h3>${e(item.title)}</h3><div class="prose">${item.body}</div>${Array.isArray(item.tags) && item.tags.length ? `<ul class="tags" aria-label="Topics">${item.tags.map(t => `<li>${e(t)}</li>`).join("")}</ul>` : ""}${localUrl(item.url) ? `<a class="entry-link" href="${e(localUrl(item.url))}">${e(item.linkLabel || "View project")} ${arrow}</a>` : ""}</div></article>`;
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#141615"><title>${e(site.name)} — Portfolio</title><meta name="description" content="${e(site.description)}"><meta property="og:title" content="${e(site.name)} — Portfolio"><meta property="og:description" content="${e(site.description)}"><link rel="icon" href="${basePath()}assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${basePath()}assets/style.css"></head>
<body><a class="skip" href="#main">Skip to content</a><div class="shell">
<header class="topbar"><a class="monogram" href="#" aria-label="${e(site.name)} home">${e(site.initials)}</a><nav aria-label="Main navigation">${sections.map(s => `<a href="#${s.id}">${e(s.nav || s.title)}</a>`).join("")}</nav></header>
<main id="main"><section class="hero" aria-labelledby="name"><p class="eyebrow hero-role"><span class="dot" aria-hidden="true"></span>${e(site.role)}</p><h1 id="name">${e(site.name)}</h1><div class="hero-bottom"><div class="prose intro">${intro}</div><div class="socials">${(site.links || []).filter(l => localUrl(l.url)).map(l => `<a href="${e(localUrl(l.url))}">${e(l.label)} ${arrow}</a>`).join("")}</div></div></section>
${sections.map((s, i) => `<section class="section" id="${s.id}" aria-labelledby="title-${s.id}"><div class="section-label"><span class="section-number">${String(i + 1).padStart(2, "0")}</span><h2 id="title-${s.id}">${e(s.title)}</h2></div><div class="section-content"><div class="prose section-intro">${s.body}</div>${s.items.length ? `<div class="entries ${s.layout === "cards" ? "cards" : "list"}">${s.items.map(itemHtml).join("")}</div>` : ""}</div></section>`).join("")}
</main><footer><span>© ${new Date().getFullYear()} ${e(site.name)}</span><span>${e(site.footer)}</span><a href="#">Back to top ↑</a></footer></div></body></html>`;
  }
}
