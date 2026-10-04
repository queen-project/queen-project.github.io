// Renders content.md into #content, wrapping each "## Heading" block in a
// Bulma section so it matches the header's layout, and builds the #toc sidebar.
(async function () {
  const root = document.getElementById('content');
  const toc = document.getElementById('toc');
  let md;
  try {
    const res = await fetch('content.md', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    md = await res.text();
  } catch (e) {
    root.innerHTML = '<p class="has-text-centered">Could not load content.md. ' +
      'Serve this folder over HTTP (e.g. <code>python -m http.server</code>) instead of opening the file directly.</p>';
    return;
  }

  // LaTeX-style small caps: \textsc{Queen} -> QUEEN in small caps.
  md = md.replace(/\\textsc\{([^}]*)\}/g, '<span class="textsc">$1</span>');

  const tmp = document.createElement('div');
  tmp.innerHTML = marked.parse(md);

  // Every ## and ### heading, in page order; both get sidebar entries.
  const headings = [];
  const addHeading = (heading, size) => {
    heading.classList.add('title', size);
    heading.id = heading.id || heading.textContent.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    headings.push(heading);
  };
  let body = null;
  const startSection = (heading) => {
    const section = document.createElement('section');
    section.className = 'section';
    section.innerHTML =
      '<div class="container"><div class="columns is-centered has-text-centered">' +
      '<div class="column is-four-fifths-tablet is-three-fifths-widescreen"></div></div></div>';
    const col = section.querySelector('.column');
    if (heading) {
      addHeading(heading, 'is-3');
      col.appendChild(heading);
    }
    body = document.createElement('div');
    body.className = 'content has-text-justified';
    col.appendChild(body);
    root.appendChild(section);
  };

  for (const node of Array.from(tmp.childNodes)) {
    const blank = node.nodeType === Node.COMMENT_NODE ||
      (node.nodeType === Node.TEXT_NODE && !node.textContent.trim());
    if (blank) continue;
    if (node.nodeName === 'H2') startSection(node);
    else {
      if (!body) startSection(null);
      // ### subsections: centred, one size down from section titles.
      if (node.nodeName === 'H3') addHeading(node, 'is-4');
      body.appendChild(node);
    }
  }

  // Let components that live inside content.md (e.g. board.js) know it's in the DOM.
  document.documentElement.dataset.contentRendered = '';
  document.dispatchEvent(new Event('content:rendered'));

  // Sidebar table of contents.
  if (!headings.length) return;
  toc.innerHTML = '<p class="toc-title">Contents</p><ul></ul>';
  const list = toc.querySelector('ul');
  const links = headings.map((h) => {
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    const li = document.createElement('li');
    if (h.nodeName === 'H3') li.className = 'toc-sub';
    li.appendChild(a);
    list.appendChild(li);
    return a;
  });

  // Highlight the last heading scrolled past the top third of the viewport
  // (or the last one when at the bottom of the page).
  const highlight = () => {
    const line = window.innerHeight / 3;
    let current = 0;
    headings.forEach((h, i) => {
      if (h.getBoundingClientRect().top <= line) current = i;
    });
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
      current = headings.length - 1;
    }
    links.forEach((a, i) => a.classList.toggle('is-active', i === current));
  };
  window.addEventListener('scroll', highlight, { passive: true });
  window.addEventListener('resize', highlight);
  highlight();

  // Content loads after the page, so honour a #section link manually.
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView();
  }
})();
