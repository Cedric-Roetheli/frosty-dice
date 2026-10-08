# Frosty Dice

A mobile-first browser companion for a physical multiplayer dice game. Each
player uses their own phone as a game sheet while playing together at the table
with physical dice.

## Current status

Milestone 1 — Mobile game board is implemented. The page displays an empty 4 × 7
board with columns A–D, rows 1–7, and clearly labeled A1 start and D7 goal cells.
The cells are disabled buttons sized for touch use in later milestones.
Gameplay is not yet implemented; Milestone 2 has not started.

## Run locally

From the repository root, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in a modern browser. The page
should display the empty board and “Board preview only. Play controls will be
added later.” Stop the server with `Ctrl+C`.

Use an HTTP server rather than opening `index.html` directly, because browsers
restrict JavaScript module loading from `file://` URLs. Python is only a local
development convenience; the deployed site does not require it.

There is no build step, package installation, or backend.

## Repository structure

```text
frosty-dice/
├── index.html                  # Semantic application shell
├── AGENTS.md                   # Engineering instructions
├── README.md
├── .gitignore
├── css/
│   └── style.css               # Mobile-first presentation
├── js/
│   ├── app.js                  # Board rendering and UI coordination
│   ├── game.js                 # Future board model and placement rules
│   ├── scoring.js              # Future score and street calculations
│   └── storage.js              # Future local persistence
├── assets/                     # Reserved for static assets
│   └── .gitkeep                 # Keeps the empty directory in Git
└── docs/
    ├── game-rules.md            # Source of truth for game mechanics
    ├── product-spec.md          # V1 behavior and scope
    └── implementation-plan.md   # Milestones and implementation status
```

Read [AGENTS.md](./AGENTS.md) and all [specifications](./docs/) before making
changes. Work one milestone at a time, keeping game rules independent of the UI.

## GitHub Pages compatibility

The site consists entirely of static HTML, CSS, and native JavaScript modules.
All stylesheet, script, and module paths are relative, so it can be served from
either a domain root or a repository path such as `/frosty-dice/`. No routing
fallback, environment variables, or server code are required.

For a future GitHub Pages release, use the repository root as the publishing
directory. For branch-based publishing, select the branch containing these files
and `/ (root)` in the repository's Pages settings. Deployment is deferred to the
release milestone.

## Manual checks

1. Start the local server and open the page.
2. Confirm there are four labeled columns (A–D), seven labeled rows (1–7), and
   28 empty cells, with “Start / A1” at the top left and “Goal / D7” at the bottom
   right.
3. Confirm the browser console has no errors and the stylesheet plus all four
   JavaScript files load successfully in the Network panel.
4. Reload the page and confirm the same result.
5. Check portrait phone widths of 320, 375, and 390 px: all columns and endpoint
   labels should remain readable without horizontal page scrolling. Vertical
   scrolling is expected on shorter screens.
6. Confirm tapping a cell does not change the board. The disabled cells are a
   visual preview; there is no placement or selection behavior yet.
7. Check the board on iPhone Safari and Android Chrome, including with larger
   text settings. A screen reader should identify the table, row and column
   headers, and the coordinates of the unavailable empty cells.
