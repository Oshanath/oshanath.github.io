// Content and navigation work without JavaScript. This only highlights the
// current section and hides a manually supplied remote image if it breaks.
const navigation = [...document.querySelectorAll('.section-nav a')];
const sections = [...document.querySelectorAll('main > section[id]')];
function updateCurrent() {
  const threshold = window.innerHeight * 0.3;
  let current = sections[0];
  for (const section of sections) if (section.getBoundingClientRect().top <= threshold) current = section;
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 12) current = sections.at(-1);
  for (const link of navigation) {
    if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
let scheduled = false;
window.addEventListener('scroll', () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { updateCurrent(); scheduled = false; });
}, { passive: true });
window.addEventListener('resize', updateCurrent);
document.querySelectorAll('.link-preview img, .project-image img').forEach(image => {
  const hide = () => { if (image.closest('.project-image')) image.parentElement.hidden = true; else image.hidden = true; };
  image.addEventListener('error', hide);
  if (image.complete && image.naturalWidth === 0) hide();
});
updateCurrent();
