# My portfolio

A small Jekyll site. Each section is its own page, listed in a sidebar
explorer. GitHub Pages rebuilds it every time you push.

## Edit your name, tagline and links

Open `_config.yml` and change the values at the top. Uncomment the LinkedIn or
Email lines to show those links.

## Add a section

Create a new file in `_sections/`, for example `_sections/skills.md`:

```markdown
---
order: 3
summary: Languages and tools I use.
---

# Skills

- Python
- Verilog
```

That's it. It gets its own page at `/skills/` and shows up in the sidebar.

- The first `# Heading` is the section's title. It's used for the page
  heading and the name in the sidebar. (No heading? The file name is used.)
- `order` decides where it appears. Lower numbers come first.
  Decimals work too (`order: 2.5`) to slot one in between.
- `summary` (optional) is the one-liner shown on the home page.
- The file name becomes the page address (`skills.md` → `/skills/`),
  so keep it short and lowercase, using dashes instead of spaces.

## Hide or remove a section

Add `published: false` to its front matter to hide it, or delete the file.

## Writing tips

- `## Heading` or `### Heading` make sub-headings.
- `*text*` on the line right under a `###` heading shows as a small grey
  label (good for dates or tech stack).
- Put images in `assets/` and use `![alt text](/assets/photo.jpg)`.

## Publish changes

```
git add .
git commit -m "Update portfolio"
git push
```

The live site updates about a minute later.
