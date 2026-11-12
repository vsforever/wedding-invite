'use strict';

(() => {
  const section = document.querySelector('#memories');
  if (!section) return;
  const scroller = document.querySelector('#invite');
  const album = section.querySelector('.memories-frame');
  const viewport = section.querySelector('.memory-photos');
  const photos = [...section.querySelectorAll('.memory-photo')];
  const buttons = [...section.querySelectorAll('[data-memory-index]')];
  const current = section.querySelector('[data-memory-current]');
  const caption = document.createElement('div');
  caption.className = 'memories-caption';
  caption.setAttribute('role', 'status');
  caption.setAttribute('aria-live', 'polite');
  caption.setAttribute('aria-atomic', 'true');
  // Overlaid captions reserve only the tallest natural text height at each width.
  const captions = photos.map((photo) => {
    const panel = document.createElement('div');
    panel.className = 'memory-caption-content';
    panel.setAttribute('aria-hidden', 'true');
    panel.append(...[...photo.querySelector('figcaption').children].map((node) => node.cloneNode(true)));
    return panel;
  });
  caption.append(...captions);
  album.insertBefore(caption, section.querySelector('.memories-footer'));
  const status = section.querySelector('.memories-status');
  let active = 0;
  let request = 0;
  let pointer = null;

  function loadPhotos() {
    section.querySelectorAll('img[data-src]').forEach((image) => {
      image.srcset = image.dataset.srcset;
      image.src = image.dataset.src;
      delete image.dataset.srcset;
      delete image.dataset.src;
    });
  }

  function syncBackdrop(photo) {
    const image = photo.querySelector('img');
    if (!image.complete || image.naturalWidth <= 1 || !image.currentSrc || image.currentSrc.startsWith('data:')) return;
    // Reuse the decoded responsive image: no extra file or original-photo download.
    photo.style.setProperty('--memory-backdrop', `url(${JSON.stringify(image.currentSrc)})`);
  }

  function render(index) {
    syncBackdrop(photos[index]);
    active = index;
    photos.forEach((photo, position) => {
      photo.classList.toggle('is-active', position === index);
      photo.setAttribute('aria-hidden', String(position !== index));
    });
    buttons.forEach((button, position) => {
      if (position === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    current.textContent = String(index + 1).padStart(2, '0');
    captions.forEach((panel, position) => {
      panel.classList.toggle('is-active', position === index);
      panel.setAttribute('aria-hidden', String(position !== index));
    });
    status.hidden = true;
  }

  async function showMemory(index) {
    const next = (index + photos.length) % photos.length;
    const id = ++request;
    album.removeAttribute('aria-busy');
    status.hidden = true;
    if (next === active) return;
    loadPhotos();
    album.setAttribute('aria-busy', 'true');
    try {
      // Keep the current photo visible until the selected image is ready.
      await photos[next].querySelector('img').decode();
      if (id !== request) return;
      render(next);
    } catch (_) {
      if (id === request) {
        status.textContent = 'This memory couldn’t load. Please try another photo.';
        status.hidden = false;
      }
    } finally {
      if (id === request) album.removeAttribute('aria-busy');
    }
  }

  // Warm the album near the viewport, never download the large originals.
  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      loadPhotos();
      observer.disconnect();
    }, { root: scroller, rootMargin: '600px 0px' });
    observer.observe(section);
  } else loadPhotos();

  buttons.forEach((button, index) => button.addEventListener('click', () => showMemory(index)));
  section.querySelector('[data-memory-previous]').addEventListener('click', () => showMemory(active - 1));
  section.querySelector('[data-memory-next]').addEventListener('click', () => showMemory(active + 1));
  album.addEventListener('keydown', (event) => {
    const destinations = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: photos.length - 1 };
    if (!(event.key in destinations) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    showMemory(destinations[event.key]);
  });

  viewport.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('button')) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  viewport.addEventListener('pointerup', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      showMemory(active + (dx < 0 ? 1 : -1));
    }
  });
  viewport.addEventListener('pointercancel', () => { pointer = null; });
  viewport.addEventListener('pointerleave', () => { pointer = null; });
  photos.forEach((photo, index) => {
    photo.setAttribute('role', 'group');
    photo.setAttribute('aria-roledescription', 'slide');
    photo.setAttribute('aria-label', `${index + 1} of ${photos.length}`);
    photo.querySelector('img').addEventListener('load', () => syncBackdrop(photo));
    syncBackdrop(photo);
    photo.querySelector('img').addEventListener('error', () => {
      if (index !== active) return;
      status.textContent = 'This memory couldn’t load. Please try another photo.';
      status.hidden = false;
    });
  });
  section.classList.add('is-enhanced');
  render(0);
})();
