// Elo chart for the Evaluations section: Queen's rating across iterations 1-8
// of search distillation (iteration k = Pawn-k) (one 2px line, markers at each iteration), with the
// frontier models as dashed reference lines labelled at the right edge.
// Hover or focus + arrow keys moves a crosshair with a tooltip; a "Show data"
// table below carries every value without hovering. Drawn into each
// figure.elo-chart (before its caption) and redrawn when the figure resizes.
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  // From the paper (tab:elo and the iteration sequence): Elo anchored to the
  // Lichess scale after 32 games per model. Array index i is iteration i+1,
  // i.e. Pawn-(i+1); Pawn-8 is promoted to Queen.
  const QUEEN = [1782, 2024, 2187, 2346, 2539, 2434, 2559, 2697];
  const FRONTIER = [
    { name: 'Gemini', elo: 2201 },
    { name: 'Sol', elo: 2071 },
    { name: 'Luna', elo: 1822 },
  ];
  const modelName = (i) => (i === QUEEN.length - 1 ? 'Queen (Pawn-8)' : `Pawn-${i + 1}`);

  const Y_MIN = 1700; // axis floor, just below Luna (1822)
  const Y_MAX = 2800;
  const Y_TICKS = [1800, 2000, 2200, 2400, 2600, 2800];
  const HEIGHT = 340;
  const M = { top: 24, right: 104, bottom: 46, left: 50 }; // right margin holds the line labels
  const INSET = 14; // keeps the first/last markers off the plot edges

  const C = {
    series: '#2a78d6', ref: '#898781', grid: '#e1e0d9', axis: '#c3c2b7',
    ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', surface: '#ffffff',
  };

  const el = (tag, attrs = {}, text) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    return node;
  };

  const lineKey = (color, dashed) => {
    const svg = el('svg', { width: 22, height: 10, 'aria-hidden': 'true', class: 'elo-key' });
    svg.appendChild(el('line', {
      x1: 1, y1: 5, x2: 21, y2: 5, stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round',
      ...(dashed ? { 'stroke-dasharray': '5 4', 'stroke-width': 1.5 } : {}),
    }));
    return svg;
  };

  const build = (fig) => {
    const caption = fig.querySelector('figcaption');

    // Legend row (two kinds of line: ours, and the frontier references).
    const legend = document.createElement('div');
    legend.className = 'elo-legend';
    for (const [color, dashed, label] of [[C.series, false, 'Queen (ours)'],
      [C.ref, true, 'Frontier models (high reasoning effort)']]) {
      const item = document.createElement('span');
      item.append(lineKey(color, dashed), document.createTextNode(label));
      legend.appendChild(item);
    }

    const plot = document.createElement('div');
    plot.className = 'elo-plot';
    const tooltip = document.createElement('div');
    tooltip.className = 'elo-tooltip';
    tooltip.setAttribute('aria-live', 'polite');
    tooltip.hidden = true;
    plot.appendChild(tooltip);

    // Table view: every value, no hovering needed.
    const details = document.createElement('details');
    details.className = 'elo-table';
    const summary = document.createElement('summary');
    summary.textContent = 'Show data';
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    for (const h of ['Model', 'Elo']) head.appendChild(Object.assign(document.createElement('th'), { textContent: h }));
    const body = table.createTBody();
    QUEEN.forEach((elo, i) => {
      const row = body.insertRow();
      for (const v of [modelName(i), String(elo)]) row.insertCell().textContent = v;
    });
    FRONTIER.forEach((f) => {
      const row = body.insertRow();
      for (const v of [f.name, String(f.elo)]) row.insertCell().textContent = v;
    });
    details.append(summary, table);

    fig.insertBefore(legend, caption);
    fig.insertBefore(plot, caption);
    fig.insertBefore(details, caption);

    let active = null; // index under the crosshair
    let svg = null;
    let geom = null;

    const showTooltip = () => {
      const crosshair = svg.querySelector('.elo-crosshair');
      const focusDot = svg.querySelector('.elo-focus');
      if (active == null) {
        tooltip.hidden = true;
        crosshair.setAttribute('visibility', 'hidden');
        focusDot.setAttribute('visibility', 'hidden');
        return;
      }
      const x = geom.x(active);
      const y = geom.y(QUEEN[active]);
      crosshair.setAttribute('x1', x);
      crosshair.setAttribute('x2', x);
      crosshair.setAttribute('visibility', 'visible');
      focusDot.setAttribute('cx', x);
      focusDot.setAttribute('cy', y);
      focusDot.setAttribute('visibility', 'visible');

      tooltip.replaceChildren();
      const title = document.createElement('div');
      title.className = 'elo-tooltip-title';
      title.textContent = modelName(active);
      tooltip.appendChild(title);
      const rows = [[C.series, false, QUEEN[active], active === QUEEN.length - 1 ? 'Queen' : modelName(active)],
        ...FRONTIER.map((f) => [C.ref, true, f.elo, f.name])];
      for (const [color, dashed, value, name] of rows) {
        const row = document.createElement('div');
        row.className = 'elo-tooltip-row';
        const v = document.createElement('strong');
        v.textContent = String(value);
        const n = document.createElement('span');
        n.textContent = name;
        row.append(lineKey(color, dashed), v, n);
        tooltip.appendChild(row);
      }
      tooltip.hidden = false;
      const tw = tooltip.offsetWidth;
      const left = x + 14 + tw > geom.width ? x - 14 - tw : x + 14;
      tooltip.style.left = `${Math.max(0, left)}px`;
      tooltip.style.top = `${M.top}px`;
    };

    const render = () => {
      const width = plot.clientWidth;
      if (!width) return;
      const plotL = M.left;
      const plotR = width - M.right;
      const plotT = M.top;
      const plotB = HEIGHT - M.bottom;
      const x = (i) => plotL + INSET + (i / (QUEEN.length - 1)) * (plotR - plotL - 2 * INSET);
      const y = (v) => plotB - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * (plotB - plotT);
      geom = { x, y, width };

      const next = el('svg', {
        width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, tabindex: 0, role: 'img',
        'aria-label': `Line chart: Queen's Elo rises from ${QUEEN[0]} to ${QUEEN[QUEEN.length - 1]} over ` +
          `iterations 1 to 8 (Pawn-1 to Pawn-8, which is Queen); frontier models: ${FRONTIER.map((f) => `${f.name} ${f.elo}`).join(', ')}. ` +
          'Use the left and right arrow keys to step through iterations.',
      });

      // Gridlines and y-axis ticks.
      for (const v of Y_TICKS) {
        next.appendChild(el('line', { x1: plotL, x2: plotR, y1: y(v), y2: y(v), stroke: C.grid, 'stroke-width': 1 }));
        next.appendChild(el('text', { x: plotL - 8, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle',
          fill: C.muted, class: 'elo-tick' }, v.toLocaleString('en-US')));
      }
      next.appendChild(el('text', { x: plotL - 8, y: plotT - 12, 'text-anchor': 'end', fill: C.muted, class: 'elo-tick' }, 'Elo'));
      // Baseline and x-axis ticks.
      next.appendChild(el('line', { x1: plotL, x2: plotR, y1: plotB, y2: plotB, stroke: C.axis, 'stroke-width': 1 }));
      QUEEN.forEach((_, i) => {
        next.appendChild(el('text', { x: x(i), y: plotB + 18, 'text-anchor': 'middle', fill: C.muted, class: 'elo-tick' }, String(i + 1)));
      });
      next.appendChild(el('text', { x: (plotL + plotR) / 2, y: HEIGHT - 6, 'text-anchor': 'middle', fill: C.ink2,
        class: 'elo-axis-title' }, 'Iteration (Pawn-k)'));

      // Frontier reference lines, labelled at the right edge.
      for (const f of FRONTIER) {
        next.appendChild(el('line', { x1: plotL, x2: plotR, y1: y(f.elo), y2: y(f.elo), stroke: C.ref,
          'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
        const label = el('text', { x: plotR + 10, y: y(f.elo), 'dominant-baseline': 'middle', fill: C.ink2, class: 'elo-label' });
        label.appendChild(el('tspan', {}, `${f.name} `));
        label.appendChild(el('tspan', { 'font-weight': 600 }, String(f.elo)));
        next.appendChild(label);
      }

      // Crosshair (under the series).
      next.appendChild(el('line', { class: 'elo-crosshair', x1: 0, x2: 0, y1: plotT, y2: plotB, stroke: C.axis,
        'stroke-width': 1, visibility: 'hidden' }));

      // Queen's line, markers, and start/end labels.
      next.appendChild(el('path', {
        d: QUEEN.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' '),
        fill: 'none', stroke: C.series, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }));
      QUEEN.forEach((v, i) => {
        next.appendChild(el('circle', { cx: x(i), cy: y(v), r: 4, fill: C.series, stroke: C.surface, 'stroke-width': 2 }));
      });
      // Start label sits right of the first point and just below it: above would
      // collide with Luna's line (1822 is only 40 Elo higher).
      next.appendChild(el('text', { x: x(0) + 10, y: y(QUEEN[0]) + 5, 'dominant-baseline': 'middle', fill: C.ink2,
        class: 'elo-label', 'font-weight': 600 }, String(QUEEN[0])));
      const end = el('text', { x: plotR + 10, y: y(QUEEN[QUEEN.length - 1]), 'dominant-baseline': 'middle', fill: C.ink,
        class: 'elo-label' });
      end.appendChild(el('tspan', {}, 'Queen '));
      end.appendChild(el('tspan', { 'font-weight': 700 }, String(QUEEN[QUEEN.length - 1])));
      next.appendChild(end);

      // Hovered point, lifted above the rest.
      next.appendChild(el('circle', { class: 'elo-focus', cx: 0, cy: 0, r: 6, fill: C.series, stroke: C.surface,
        'stroke-width': 2, visibility: 'hidden' }));

      // Hit layer: the whole plot area, snapping to the nearest iteration.
      const hit = el('rect', { x: plotL, y: plotT, width: plotR - plotL, height: plotB - plotT, fill: 'transparent' });
      hit.addEventListener('pointermove', (e) => {
        const px = e.clientX - next.getBoundingClientRect().left;
        let best = 0;
        QUEEN.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
        if (best !== active) { active = best; showTooltip(); }
      });
      hit.addEventListener('pointerleave', () => { active = null; showTooltip(); });
      next.appendChild(hit);

      next.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const step = e.key === 'ArrowRight' ? 1 : -1;
        active = active == null ? (step > 0 ? 0 : QUEEN.length - 1)
          : Math.min(QUEEN.length - 1, Math.max(0, active + step));
        showTooltip();
      });
      next.addEventListener('focus', () => { if (active == null) { active = QUEEN.length - 1; showTooltip(); } });
      next.addEventListener('blur', () => { active = null; showTooltip(); });

      if (svg) svg.replaceWith(next); else plot.insertBefore(next, tooltip);
      svg = next;
      showTooltip();
    };

    let lastWidth = 0;
    new ResizeObserver(() => {
      if (plot.clientWidth !== lastWidth) { lastWidth = plot.clientWidth; render(); }
    }).observe(plot);
  };

  const mount = () => document.querySelectorAll('figure.elo-chart').forEach(build);

  // content.md renders asynchronously; it may finish before or after this script runs.
  if ('contentRendered' in document.documentElement.dataset) mount();
  else document.addEventListener('content:rendered', mount, { once: true });
})();
