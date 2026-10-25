# My portfolio

A one-page portfolio built with Jekyll. GitHub Pages builds it automatically
every time you push.

## Edit your name, tagline and links

Open `_config.yml` and change the values at the top. Uncomment the LinkedIn or Email lines to show those links.

## Add a section

Create a new file in `_sections/`, for example `_sections/skills.md`:

```markdown
---
title: Skills
order: 3
---

- Python
- JavaScript
- Design
```

- `title` is the section heading (and the link in the menu).
- `order` decides where it appears. Lower numbers come first.
  Decimals work too (`order: 2.5`) if you want to slot one in between.

## Hide or remove a section

Add `hidden: true` to its front matter to hide it, or delete the file.

## Writing tips

- `### Heading` makes a sub-heading (good for each project or job).
- `*text*` right under a sub-heading shows as a small grey label (dates, tech stack).
- Put images in `assets/` and use `![alt text](/assets/photo.jpg)`.

## Publish changes

```
git add .
git commit -m "Update portfolio"
git push
```

The live site updates about a minute later.
