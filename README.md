# A quiet, Markdown-first portfolio

A permanent dark theme, responsive layout, automatic navigation, and link preview cards. Built with Eleventy. No browser framework, database, or API key needed.

**Live site:** https://oshanath.github.io/

The repository includes a hidden example project and Notes section (`draft: true`). Edit their Markdown and remove that flag when ready.

## First run

Install Node.js 22 or newer, then run these commands in this folder:

```sh
npm ci
npm run dev
```

Open the local address printed by Eleventy (usually http://localhost:8080). Markdown and CSS edits refresh the page. If you edit generator code under `lib/` or `src/`, restart the dev command so Node reloads imported modules.

**Before publishing:** edit `site.json`, `content/intro.md`, and the Contact section. The GitHub and LinkedIn URLs are placeholders. Replace the example project and review all sample biography text. Edit `assets/favicon.svg` if you change your initials.

## Content structure

| Path | What it controls |
| --- | --- |
| `site.json` | Name, role, metadata, footer, profile links |
| `content/intro.md` | The introduction under your name |
| `content/10-about/_index.md` | About section title and body |
| `content/20-work/_index.md` | Work section title, body, and layout |
| `content/20-work/10-encrypted-databases.md` | One entry inside Work |
| `content/30-notes/_index.md` | Notes and link cards |
| `content/40-contact/_index.md` | Contact section |
| `assets/` | Images, PDFs, stylesheet, favicon |
| `previews.json` | Cached or manually supplied metadata for link cards |

Two-digit prefixes determine order and are removed from section anchors. Use names such as `10-about`, `20-work`, `30-writing`. Keep section names unique after removing the numbers. Only direct child folders of `content/` become sections; section entries live directly in those folders. Arbitrarily nested sub-sections are not supported.

## Add a section

Create `content/50-writing/_index.md`:

```md
---
title: Writing
nav: Writing
---
I write stories about people caught in extraordinary circumstances.

### A heading

A paragraph with **bold text**, *italics*, and an [inline link](https://example.com/).

![An image with descriptive alt text](/assets/writing.jpg)
```

Add `writing.jpg` to `assets/`. Your new section and navigation link appear automatically. No template or config changes. An `_index.md` is optional: without it, the heading is derived from the folder name.

To reorder a section, rename the numeric prefix. To remove one, delete its folder. To hide a section or entry temporarily, add `draft: true` to its front matter. Draft content is omitted from the built site, but **source files are still visible in a public GitHub repository**.

## Add entries or project cards

Choose `layout: cards` in the section's `_index.md` for a two-column card grid (one column on mobile). Omit it for a simple vertical list.

Create `content/20-work/30-my-project.md`:

```md
---
title: My project
eyebrow: Open source
image: /assets/my-project.jpg
imageAlt: Screenshot of my project
url: https://github.com/yourname/your-project
linkLabel: View source
tags: [C++, CUDA]
---
What I built, why it matters, and what I learned.

Add more paragraphs, lists, code, or images as needed.
```

Only the Markdown body is required; the title falls back to the filename. All other fields are optional. Filenames determine entry order. Entries are displayed inside their section; this starter does not generate individual article pages.

## Links and thumbnails

Inline links stay inline. Put a link in a paragraph by itself to make a card:

```md
[A paper I found useful](https://example.com/paper)
```

`npm run previews` tries to retrieve the page's Open Graph image, title, and description. The GitHub workflow runs it automatically before building. The actual label you write stays the card title. If metadata is missing, blocked, or unavailable, the card shows your label and the domain with a simple arrow icon. Builds do not require metadata fetching to succeed.

The site has no runtime preview service. Metadata is fetched only when the preview command runs. Thumbnails use the source site's image URL; availability depends on that site, and images may later disappear. You can download an image you have permission to use into `assets/` for a dependable local thumbnail.

To override or supply a preview yourself, edit `previews.json` using the exact linked URL as its key:

```json
{
  "https://example.com/paper": {
    "image": "/assets/paper-cover.jpg",
    "description": "A short summary of why this is worth reading."
  }
}
```

To preserve manual overrides, remove the "Refresh link previews" step from the workflow. Automatic refresh otherwise replaces fields when fresh metadata is available. Run `npm run previews` locally and commit `previews.json` if you want cached previews to survive an unsuccessful fetch in a future deployment.

Use paths starting with `/assets/` for local files. The builder handles both a root GitHub Pages site and a project site under `/repository-name/`. URL-encode spaces in filenames, or use simple hyphenated names.

Markdown supports headings, paragraphs, images, links, lists, blockquotes, fenced code, and tables. Raw HTML is intentionally disabled. A standalone image wrapped in a link remains a linked image rather than a preview card.

## Publish on GitHub Pages

1. Create a repository. Name it `YOUR_USERNAME.github.io` for `https://YOUR_USERNAME.github.io/`, or choose any name for `https://YOUR_USERNAME.github.io/REPOSITORY/`.
2. Put the **contents of this folder** at the repository root, including `.github/workflows/pages.yml`, `package.json`, and `package-lock.json`. Do not upload `node_modules/` or `_site/`. Using Git preserves the hidden workflow directory.
3. Use `master` as the default branch (or edit the branch in the workflow).
4. Open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Push your files to `master`. If the push happened before you enabled Pages, open **Actions → Publish portfolio → Run workflow**.

The workflow installs dependencies, attempts previews, checks content behavior, builds HTML, and deploys to Pages. Subsequent pushes rebuild the site. You can edit Markdown and upload images directly in GitHub without running anything locally. The existing Jekyll files are retained for history; Eleventy only builds the `src/` entry point and the Markdown under `content/`.

## Local production build

```sh
npm run check
npm run build
```

Output is `_site/`. For a project-path build on macOS/Linux, use `PATH_PREFIX=/portfolio/ npm run build`. In PowerShell, set `$env:PATH_PREFIX='/portfolio/'` before running the build. GitHub Actions sets this automatically.

Change visual styling in `assets/style.css`. Colors are CSS variables at the top. The page uses system fonts and Georgia so it needs no external font downloads. There is no light theme or theme switch.
