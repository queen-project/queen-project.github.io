# Queen Page

Project page for *Language Models that Play Chess and Explain their Moves*, hosted on GitHub Pages.

## Layout

- `index.html` — page shell: title, authors and links live here.
- `content.md` — page body. Each `## Heading` becomes its own section and a sidebar entry. Raw HTML is allowed, and `\textsc{...}` renders as small caps.
- `static/images/` — figures, referenced from `content.md` as `![caption](static/images/fig.png)`.
- `static/css/index.css`, `static/js/render.js` — styles and the Markdown renderer.
- `static/examples/` — the Demonstration examples. `index.json` lists the files in display order; each `.md` file starts with front matter (`fen:`, optional `orientation: black`) followed by the panel text in Markdown.
- `static/js/board.js` — the example viewer: a [chessground](https://github.com/lichess-org/chessground) board, text panel and ←/→ navigation, built into the `.chess-demo` div in `content.md`.

## Local preview

`content.md` is fetched at load time, so the page must be served over HTTP (opening `index.html` directly won't work):

```sh
python -m http.server 8000
```

Then visit http://localhost:8000.

## Deploying

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select your branch and `/ (root)`, then save.
