# Oshanath's portfolio

A small, permanently dark portfolio. Content is plain Markdown; numbered folders
and files control the order. Navigation and link previews are built automatically.
No application framework, database, external font, or visitor account is needed.

## Edit the content

| What you want to change | Where to edit |
| --- | --- |
| Name, headline, intro, social links | `content/profile.md` |
| About text | `content/sections/01-about/index.md` |
| A project | A Markdown file in `content/sections/02-projects/` |
| Experience | A Markdown file in `content/sections/03-experience/` |
| Any new section | Add a numbered folder in `content/sections/` |
| Colors and typography | Variables at the top of `site/style.css` |

### Add a section

Create `content/sections/06-publications/index.md`:

```markdown
---
title: Publications
---

## A heading

Write a paragraph, add **emphasis**, or include an [inline link](https://example.com).

![A descriptive caption](figure.png)
```

Put `figure.png` next to that Markdown file. The section and its navigation entry
appear automatically. A new folder without `index.md` also works: its name becomes
the title. For a small section, a single `06-publications.md` works too.

Rename `06-publications` to `02-publications` to move it earlier. No section list
or navigation configuration needs updating. `01-`, `02-`, etc. are just ordering
prefixes; they do not appear in titles or anchors. Avoid duplicate section names.

Front matter is the small optional block between `---` lines. Supported options:

```yaml
title: Publications
nav: Papers       # shorter navigation label; false hides this navigation entry
layout: prose    # prose (default), cards, or timeline
draft: false     # true omits this entire section
```

### Add a project card

Create `content/sections/02-projects/03-my-project.md`:

```markdown
---
title: My new project
eyebrow: Research
url: https://github.com/Oshanath/my-project
image: screenshot.png
image_alt: A screenshot of the project's main view
tags: [C++, CUDA]
link_label: View project
---

A short description. Ordinary Markdown works here too.
```

Put `screenshot.png` beside the Markdown file. Omit `image` to try the linked
page's Open Graph or Twitter thumbnail automatically. If none is available,
the card has a text layout. All additional `.md` files in a section folder
become entries. Prefix entry filenames with numbers to set their order.

### Images and other files

Two equally valid ways to organize images:

- Alongside the Markdown: `![Description](screenshot.png)`.
- In `public/images/`: `![Description](/images/screenshot.png)`.

Relative paths, including subdirectories, work. Files in `public/` are copied to
the site root. Files beside Markdown are copied under `media/` with their folder
structure preserved. Links to PDFs and other files work the same way.
Relative links to other content `.md` files become links to their section or entry.

### Link previews

Put a URL or a Markdown link **in its own paragraph**, separated by blank lines:

```markdown
Here is something worth reading.

https://example.com/interesting-article

[Another interesting project](https://example.com/project)
```

The build tries Open Graph metadata, Twitter metadata, and finally the HTML title.
It downloads supported thumbnails so visitors load them directly from your site.
If metadata is blocked, missing, or unavailable, it renders the label and domain
as a text card. Links inside sentences and lists stay ordinary links.

Previews are cached for seven days; failed fetches retry after one day. Set
`link_previews: false` in `content/profile.md` for ordinary links throughout, or
delete `.cache/` to refresh local previews. Use `OFFLINE=1 npm run build` on
macOS/Linux to build without fetching new metadata. On PowerShell, use
`$env:OFFLINE='1'; npm run build`.

The live site is static. Metadata is fetched **when you build**, not in the
visitor's browser; sites may choose to block preview requests. You can always
supply your own card image.

### Experience and education

Use `layout: timeline` in a section's `index.md`, then add entry files:

```markdown
---
title: A role or degree
subtitle: An organization
period: 2024 — Present
---

A brief description.
```

### Drafts

Set `draft: true` to omit a section or entry. Start filenames or folder names
with `_` to ignore them entirely. Keep unpublished assets in ignored folders;
other non-Markdown assets under `content/` and `public/` are copied to the site.

## Preview locally

Install Node.js 22 or newer (the workflow uses Node 24), then:

```sh
npm ci
npm run dev
```

Open the printed local URL. Editing content, images, or styles rebuilds the site;
refresh the browser to see the result. Content needs no JavaScript to display.

```sh
npm test       # section discovery, content rendering, assets, preview behavior
npm run build # create the static site in dist/
npm run check # verify headings, local assets, unique IDs, and internal anchors
```

## Publish to GitHub Pages

This replaces the repository's original, uncustomized Jekyll starter with a small
Node-based Markdown builder. You do not need Ruby or Jekyll.

1. Merge the portfolio pull request into the default branch.
2. In **Settings → Pages → Build and deployment → Source**, choose
   **GitHub Actions**.
3. Open **Actions → Build and deploy portfolio → Run workflow** if the workflow
   ran before you changed the Pages setting.
4. After deployment, open `https://oshanath.github.io/`.

Later, just edit Markdown or upload images and commit to the default branch.
GitHub Actions rebuilds and publishes the site. Pull requests build and check
the site without deploying it. The deployment job only runs on the default branch.
The workflow does not change repository visibility or Pages settings.

The repository is currently private. GitHub Pages from a private repository
requires a plan that supports it. The finished Pages website is normally public.
See [GitHub's Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
for plan availability and publishing configuration.

For another repository, change `site_url` in `content/profile.md`. Asset paths
are relative, so the site also works under a project path such as `/portfolio/`.

## Before publishing your content

Review the starter biography and project descriptions, and replace or remove
anything you do not want on your portfolio. Add any email, CV, or social links
you want in the `links` list in `content/profile.md`. No analytics or contact
form is included.
