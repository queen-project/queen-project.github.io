// Builds the example viewer in each .chess-demo[data-examples]: a chessground
// board, a text panel, prev/next navigation (buttons and ←/→ keys) and a reset
// button. data-examples points at a JSON list of example files, each a Markdown
// file with front matter (fen, optional orientation) followed by the panel text.
//
// Each example's front matter lists its verified move tree as "line:" entries,
// one branch from the starting position per line (space-separated SAN). The tree
// box below the board and panel is drawn from these lines only; clicking a move
// in it jumps to that position, and the current position is underlined.
//
// In the panel text, a link like [**14. Rad1**](move:Qc2,Bd6,Rad1) is a playable
// move: the href is its comma-separated path from the starting position, which
// must be a path in the tree (otherwise the link is crossed out and a warning is
// logged). Hovering draws the last move's arrow; clicking plays it.
//
// The summary lines at the end of each analysis are made interactive
// automatically (no links needed), with moves played from the starting position:
//   BEST_MOVE:       hover draws the arrow, click plays the move.
//   CRITICAL_LINE:   hover draws the first move's arrow, click animates the whole
//                    line, ending on its final position.
//   PROMISING_MOVES: hover draws the three moves' arrows (green, blue, red).
//
// Each element belongs to the position its arrows are drawn from. Hover arrows
// only appear while the board is on that position. Clicking from any other
// position just goes back to it (click again to play); clicking from it plays.
import { Chessground } from 'https://cdn.jsdelivr.net/npm/chessground@9.2.1/+esm';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';

const STEP_MS = 800; // delay between moves when animating CRITICAL_LINE
const PROMISING_BRUSHES = ['green', 'blue', 'red'];
const SCROLL_AT = 0.3; // where a tree click places its link in the panel (0 = top)

// Splits "---\nkey: value\n---\nbody" into { meta, body }. Repeated "line:"
// keys are collected into meta.lines, each an array of SAN moves.
const parseExample = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: { lines: [] }, body: text };
  const meta = { lines: [] };
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (key === 'line') meta.lines.push(value.split(/\s+/).filter(Boolean));
    else meta[key] = value;
  }
  return { meta, body: m[2] };
};

// Identifies a position for comparison: placement, side to move, castling and
// en passant, ignoring the move counters.
const positionKey = (fen) => fen.split(' ').slice(0, 4).join(' ');

// Plays a list of SAN moves from fen; returns one { fen, from, to, san, number,
// color } per move (san in chess.js's canonical form, number/color of the move
// itself), or null if any move is illegal.
const playLine = (fen, sans) => {
  const chess = new Chess(fen);
  try {
    return sans.map((san) => {
      const number = chess.moveNumber();
      const move = chess.move(san);
      return { fen: chess.fen(), from: move.from, to: move.to, san: move.san, number, color: move.color };
    });
  } catch (e) {
    return null;
  }
};

// Builds the tree from the verified lines: one node { step, children } per
// distinct path from the start, with branches in the order first listed.
// paths maps each canonical "san,san,..." path to its node; illegal lists the
// (1-based) numbers of lines that couldn't be played.
const buildTree = (start, lines) => {
  const root = { children: [] };
  const paths = new Map();
  const illegal = [];
  lines.forEach((line, n) => {
    const steps = playLine(start, line);
    if (!steps) { illegal.push(n + 1); return; }
    let parent = root;
    steps.forEach((step, i) => {
      const path = steps.slice(0, i + 1).map((st) => st.san).join(',');
      let node = paths.get(path);
      if (!node) {
        node = { step, path, children: [] };
        paths.set(path, node);
        parent.children.push(node);
      }
      parent = node;
    });
  });
  return { root, paths, illegal };
};

// Lays the tree out as rows: each branch from the start gets its own row, and
// where a line later splits, the side branches go in indented rows followed by
// a new row continuing the first branch. Returns the rows and one { el, step }
// per move.
const renderTree = (tree) => {
  const rows = document.createDocumentFragment();
  const items = [];
  const addLine = (node, depth) => {
    let row;
    let rowStart;
    const newRow = () => {
      row = document.createElement('div');
      row.className = 'chess-tree-line';
      row.style.paddingLeft = `${depth * 1.5}rem`;
      rows.appendChild(row);
      rowStart = true;
    };
    newRow();
    while (node) {
      const { step } = node;
      const el = document.createElement('span');
      el.className = 'chess-tree-move';
      el.textContent = step.color === 'w' ? `${step.number}. ${step.san}`
        : rowStart ? `${step.number}... ${step.san}` : step.san;
      row.appendChild(el);
      items.push({ el, step, path: node.path });
      rowStart = false;
      const [next, ...others] = node.children;
      if (others.length) {
        others.forEach((other) => addLine(other, depth + 1));
        newRow();
      }
      node = next;
    }
  };
  tree.root.children.forEach((child) => addLine(child, 0));
  return { rows, items };
};

// Wraps each summary line in a span carrying its moves, keeping the line's
// Markdown (bold) and any trailing hard break. Move numbers ("9...Nd7",
// "10.Nd3") are dropped, leaving plain SAN.
const SUMMARY_LINE = /^(BEST_MOVE|CRITICAL_LINE|PROMISING_MOVES):(.*?)(\\?)$/gm;
const markSummary = (md) => md.replace(SUMMARY_LINE, (line, kind, rest, brk) => {
  const moves = rest.replace(/\*/g, '').split(/[\s,]+/)
    .map((m) => m.replace(/^\d+\.+/, '')).filter(Boolean);
  return `<span class="chess-summary" data-kind="${kind}" data-moves="${moves.join(' ')}">` +
    `${kind}:${rest}</span>${brk}`;
});

const renderText = (md) => marked.parse(markSummary(md)
  .replace(/\\textsc\{([^}]*)\}/g, '<span class="textsc">$1</span>'));

const setup = async (root) => {
  // Build the layout before fetching so the board's space is reserved immediately.
  root.innerHTML =
    '<div class="chess-board"></div>' +
    '<div class="chess-panel"><div class="chess-panel-body"></div></div>' +
    '<div class="chess-tree"></div>' +
    '<div class="chess-nav">' +
    '<button class="button is-small is-rounded chess-prev" aria-label="Previous example">' +
    '<span class="icon"><i class="fas fa-chevron-left"></i></span></button>' +
    '<span class="chess-count"></span>' +
    '<button class="button is-small is-rounded chess-next" aria-label="Next example">' +
    '<span class="icon"><i class="fas fa-chevron-right"></i></span></button>' +
    '</div>' +
    '<div class="chess-actions">' +
    '<button class="button is-small is-rounded chess-reset">' +
    '<span class="icon"><i class="fas fa-rotate-left"></i></span><span>Reset</span></button>' +
    '</div>';
  const boardEl = root.querySelector('.chess-board');
  const panel = root.querySelector('.chess-panel-body');
  const treeEl = root.querySelector('.chess-tree');
  const count = root.querySelector('.chess-count');

  const cg = Chessground(boardEl, { viewOnly: true, coordinates: true });
  // Chessground positions pieces in pixels, so redraw when the board resizes.
  new ResizeObserver(() => cg.redrawAll()).observe(boardEl);

  const listUrl = new URL(root.dataset.examples, location.href);
  let examples;
  try {
    const names = await (await fetch(listUrl, { cache: 'no-cache' })).json();
    examples = await Promise.all(names.map(async (name) => {
      const res = await fetch(new URL(name, listUrl), { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${name}: ${res.status}`);
      const example = parseExample(await res.text());
      // Normalise through chess.js so it compares equal to positions it generates.
      example.start = new Chess(example.meta.fen).fen();
      return example;
    }));
  } catch (e) {
    panel.textContent = `Could not load examples (${e.message}).`;
    return;
  }

  let current; // positionKey of what the board shows
  let treeItems = []; // { el, step } per move in the current example's tree
  const underlineCurrent = () => {
    for (const { el, step } of treeItems) {
      el.classList.toggle('is-current', positionKey(step.fen) === current);
    }
  };
  const draw = (fen, lastMove) => {
    current = positionKey(fen);
    cg.setAutoShapes([]);
    cg.set({ fen, lastMove });
    underlineCurrent();
  };

  // Any new board change cancels a CRITICAL_LINE animation in progress.
  let playId = 0;
  const setPosition = (fen, lastMove) => {
    playId++;
    draw(fen, lastMove);
  };
  const animateLine = async (startFen, steps) => {
    setPosition(startFen, undefined);
    const id = playId;
    for (const [i, step] of steps.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, STEP_MS));
      if (id !== playId) return;
      draw(step.fen, [step.from, step.to]);
    }
  };

  // Ties el to fromFen: hovering draws shapes while the board shows fromFen;
  // clicking elsewhere returns to fromFen (with the arrows, as the pointer is
  // still over el), and clicking on fromFen runs action, if any.
  const bind = (el, fromFen, shapes, action) => {
    const from = positionKey(fromFen);
    el.addEventListener('mouseenter', () => {
      if (current === from) cg.setAutoShapes(shapes);
    });
    el.addEventListener('mouseleave', () => cg.setAutoShapes([]));
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (current !== from) {
        setPosition(fromFen, undefined);
        cg.setAutoShapes(shapes);
      } else if (action) {
        action();
      }
    });
  };
  const arrow = (step, brush) => ({ orig: step.from, dest: step.to, brush });

  // Scrolls only the panel (never the page) so link sits SCROLL_AT of the way
  // down it, then flashes the link.
  const scrollToLink = (link) => {
    const top = link.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
    panel.scrollTo({ top: top - panel.clientHeight * SCROLL_AT, behavior: 'smooth' });
    link.classList.remove('is-flashing');
    void link.offsetWidth; // restart the animation if it's already running
    link.classList.add('is-flashing');
  };

  let index = 0;
  const show = (i) => {
    index = (i + examples.length) % examples.length;
    const { meta, body, start } = examples[index];
    cg.set({ orientation: meta.orientation || 'white' });
    setPosition(start, undefined);
    panel.innerHTML = renderText(body);
    panel.scrollTop = 0;
    count.textContent = `${index + 1} / ${examples.length}`;

    const tree = buildTree(start, meta.lines);
    for (const n of tree.illegal) console.warn(`Example ${index + 1}: illegal move in line ${n}`);
    const { rows, items } = renderTree(tree);
    treeEl.replaceChildren(rows);
    treeEl.hidden = !items.length;
    treeItems = items;
    underlineCurrent();

    const invalid = (el, what) => {
      console.warn(`Example ${index + 1}: ${what}`);
      el.classList.add('is-invalid');
    };

    const linkByPath = new Map(); // first link in the text for each tree path
    for (const link of panel.querySelectorAll('a[href^="move:"]')) {
      link.classList.add('chess-move');
      link.addEventListener('click', (e) => e.preventDefault());
      const href = link.getAttribute('href');
      const steps = playLine(start, href.slice('move:'.length).split(',').map((m) => m.trim()));
      if (!steps) { invalid(link, `illegal move in link "${href}"`); continue; }
      const path = steps.map((st) => st.san).join(',');
      if (!tree.paths.has(path)) {
        invalid(link, `link "${href}" is not a path in the tree`);
        continue;
      }
      if (!linkByPath.has(path)) linkByPath.set(path, link);
      const last = steps[steps.length - 1];
      const before = steps.length > 1 ? steps[steps.length - 2].fen : start;
      bind(link, before, [arrow(last, 'green')], () => setPosition(last.fen, [last.from, last.to]));
    }

    // Clicking a tree move jumps to it and scrolls the text to its link.
    for (const { el, step, path } of items) {
      const link = linkByPath.get(path);
      if (!link) console.warn(`Example ${index + 1}: tree move ${path} has no link in the text`);
      el.addEventListener('click', () => {
        setPosition(step.fen, [step.from, step.to]);
        if (link) scrollToLink(link);
      });
    }

    for (const el of panel.querySelectorAll('.chess-summary')) {
      const { kind } = el.dataset;
      el.classList.add('chess-move');
      if (kind === 'PROMISING_MOVES') {
        const steps = el.dataset.moves.split(' ').map((m) => playLine(start, [m])?.[0]);
        if (steps.some((s) => !s)) { invalid(el, `illegal move in ${kind}`); continue; }
        bind(el, start, steps.map((s, i) => arrow(s, PROMISING_BRUSHES[i])));
        continue;
      }
      const steps = playLine(start, el.dataset.moves.split(' '));
      if (!steps) { invalid(el, `illegal move in ${kind}`); continue; }
      el.classList.add('is-clickable');
      bind(el, start, [arrow(steps[0], 'green')], kind === 'BEST_MOVE'
        ? () => setPosition(steps[0].fen, [steps[0].from, steps[0].to])
        : () => animateLine(start, steps));
    }
  };

  root.querySelector('.chess-prev').addEventListener('click', () => show(index - 1));
  root.querySelector('.chess-next').addEventListener('click', () => show(index + 1));
  root.querySelector('.chess-reset').addEventListener('click', () =>
    setPosition(examples[index].start, undefined));

  // ←/→ switch examples while the viewer is on screen, unless the user is typing
  // or using a browser shortcut (e.g. Alt+← for back).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const r = root.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    e.preventDefault();
    show(index + (e.key === 'ArrowRight' ? 1 : -1));
  });

  show(0);
};

const mount = () => {
  for (const root of document.querySelectorAll('.chess-demo[data-examples]')) setup(root);
};

// content.md renders asynchronously; it may finish before or after this module loads.
if ('contentRendered' in document.documentElement.dataset) mount();
else document.addEventListener('content:rendered', mount, { once: true });
