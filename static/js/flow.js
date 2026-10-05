// Draws arrows between cards to show order, in an SVG laid over the container
// and redrawn whenever it resizes, so the arrows stay attached as text reflows.
//
// .qa-grid (2x2 training order): reading order, top-left -> top-right ->
//   bottom-left -> bottom-right. Same row: straight across the gap; next row: a
//   diagonal from the upper card's bottom-left corner to the lower card's
//   top-right corner. In one column (phones) the arrows run straight down.
// .cycle-grid (a loop): .cycle-card elements in document order, each joined to
//   the next by a straight arrow between their edges, and the last back to the
//   first. In one column (phones) the closing arrow is left out.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const PAD = 6; // gap between an arrow's ends and the cards
  let markers = 0;

  // A card's box relative to the container.
  const boxOf = (el, g) => {
    const r = el.getBoundingClientRect();
    const l = r.left - g.left;
    const t = r.top - g.top;
    return { l, t, r: l + r.width, bt: t + r.height, cx: l + r.width / 2, cy: t + r.height / 2,
      hw: r.width / 2, hh: r.height / 2 };
  };

  // Where the ray from a box's centre in direction (dx, dy) leaves the box.
  const exitPoint = (b, dx, dy) => {
    const t = Math.min(dx ? b.hw / Math.abs(dx) : Infinity, dy ? b.hh / Math.abs(dy) : Infinity);
    return [b.cx + dx * t, b.cy + dy * t];
  };

  // A straight arrow from (x1, y1) to (x2, y2), pulled in by PAD at both ends.
  const line = (x1, y1, x2, y2) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    return `M ${x1 + ux * PAD} ${y1 + uy * PAD} L ${x2 - ux * PAD} ${y2 - uy * PAD}`;
  };

  const gridPaths = (cards) => {
    const paths = [];
    for (let i = 0; i + 1 < cards.length; i++) {
      const a = cards[i];
      const b = cards[i + 1];
      if (Math.abs(a.t - b.t) < 1) { // same row
        const y = (Math.max(a.t, b.t) + Math.min(a.bt, b.bt)) / 2;
        paths.push(`M ${a.r + PAD} ${y} H ${b.l - PAD}`);
      } else if (Math.abs(a.cx - b.cx) < 1) { // same column
        paths.push(`M ${a.cx} ${a.bt + PAD} V ${b.t - PAD}`);
      } else { // next row: corner to corner across the middle gap
        paths.push(line(a.l, a.bt, b.r, b.t));
      }
    }
    return paths;
  };

  const cyclePaths = (cards) => {
    const oneColumn = cards.every((c) => Math.abs(c.cx - cards[0].cx) < 1);
    const paths = [];
    for (let i = 0; i < (oneColumn ? cards.length - 1 : cards.length); i++) {
      const a = cards[i];
      const b = cards[(i + 1) % cards.length];
      const dx = b.cx - a.cx;
      const dy = b.cy - a.cy;
      const [x1, y1] = exitPoint(a, dx, dy);
      const [x2, y2] = exitPoint(b, -dx, -dy);
      paths.push(line(x1, y1, x2, y2));
    }
    return paths;
  };

  const draw = (container, svg, cardSelector, toPaths, markerId) => {
    const g = container.getBoundingClientRect();
    svg.querySelectorAll('path.flow-arrow').forEach((p) => p.remove());
    const cards = [...container.querySelectorAll(cardSelector)].map((el) => boxOf(el, g));
    for (const d of toPaths(cards)) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('class', 'flow-arrow');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#4a4a4a');
      path.setAttribute('stroke-width', '1.75');
      path.setAttribute('marker-end', `url(#${markerId})`);
      svg.appendChild(path);
    }
  };

  const attach = (container, cardSelector, toPaths) => {
    const markerId = `flow-arrowhead-${markers++}`;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'flow-arrows');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      `<defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" ` +
      'markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#4a4a4a"/></marker></defs>';
    container.appendChild(svg);
    new ResizeObserver(() => draw(container, svg, cardSelector, toPaths, markerId)).observe(container);
  };

  const mount = () => {
    document.querySelectorAll('.qa-grid').forEach((el) => attach(el, '.qa-card', gridPaths));
    document.querySelectorAll('.cycle-grid').forEach((el) => attach(el, '.cycle-card', cyclePaths));
  };

  // content.md renders asynchronously; it may finish before or after this script runs.
  if ('contentRendered' in document.documentElement.dataset) mount();
  else document.addEventListener('content:rendered', mount, { once: true });
})();
