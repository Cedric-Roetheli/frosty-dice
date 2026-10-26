# Frosty Dice

Frosty Dice brings physical dice and a digital game board to the same table.
Each player opens their own board in the browser. Roll with friends, choose
your numbers, and let the app handle placement validation and points.

**[Play Frosty Dice → https://frostydice.com](https://frostydice.com)**

## How to Play

1. On your turn, roll **four physical six-sided dice** and choose two. All other
   players may use the remaining pair on their own boards.
2. Form a two-digit number from your pair, in either order: 1 and 6 make 16 or
   61. Tap an empty cell and type both digits; placement is attempted immediately
   after the second digit.
3. Begin at **Start (A1)** on your personal **4×7 board**. Later placements need
   one usable adjacent neighbor: greater than the number to the left, smaller
   than the number to the right, or equal to the number above or below. One
   matching relationship is enough; diagonals do not count.
4. Build points with **repdigits** (11, 22, …, 66), which score double, and
   **Streets**: full rows of four normal cells without Attack Ice, consecutive
   in possible dice-number order, such as 24, 25, 26, 31. Streets double each
   cell's contribution, giving a Street repdigit **4x** its value.
5. Watch for **Prime Ice**: placing a prime beside another prime freezes the new
   cell. A previous freeze thaws but remains permanently scoreless. Use
   **Secret Bid Challenges** to contest temporary **Attack Ice** with other
   players; compare bids and resolve the outcome together at the table.
6. Aim for the highest score while reaching the **End flag (D7)** with a usable
   cell. The app shows your local goal; table-wide end-of-game timing is not
   enforced.

See the [complete game rules](./docs/game-rules.md) for ice effects, Challenge
outcomes, scoring details, and the open question about end-of-game timing.

## Features

- Mobile-friendly board with direct inline number entry and placement validation.
- Automatic points, Street detection, and single **2x / 4x** cell indicators.
- Prime freeze/thaw states and manual Attack Ice controls.
- Secret Bid Challenge with confirmed point spending and a bid reveal screen.
- One-step **Undo**, automatic local saves, and a confirmed New Game reset.
- English/German illustrated Rules with a light-blue language selection and a
  readable **Additional Rules** popup.
- Hand-drawn title, illustrated D7 flag, and surfing-cowboy footer.
- Installable **Progressive Web App (PWA)** with offline play after initial caching.

Play directly in the browser or use its **Add to Home Screen / Install** option.
Open each browser or installed app online first and let the complete offline
cache finish installing. On iOS, an installed app has separate website data;
your existing Safari game is not automatically transferred. Saves stay in that
browser/app on that device, with no account or cloud sync. Browser storage can
be cleared or evicted.

## Development

Built with **HTML, CSS, and vanilla JavaScript ES modules**. No framework,
third-party dependencies, backend, or build step is required.

From the repository root:

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). Serve over HTTP rather than
opening `index.html` directly so native ES modules load correctly. Stop the
server with Ctrl+C.

To run the existing automated tests, open
[http://localhost:8000/tests/](http://localhost:8000/tests/) while the server is
running. The [test runner](./tests/test-runner.js) reports results on that page
and covers rules, scoring, persistence, UI coordination with test doubles,
Rules controls, and service-worker behavior.

Before contributing, read [AGENTS.md](./AGENTS.md), the
[game rules](./docs/game-rules.md), [product specification](./docs/product-spec.md),
and [implementation plan](./docs/implementation-plan.md). Pure rules live in
`js/game.js` and `js/board-state.js`, scoring in `js/scoring.js`, UI coordination
in `js/app.js` and `js/rules.js`, and persistence in `js/storage.js`.

Maintenance notes:

- The version-7 game save uses `frosty-dice.game`: board values, historical Prime
  statuses, Attack Ice, confirmed spending, and one complete pre-action Undo.
  Preserve those statuses; never infer them again from current neighbors.
  Score, Streets, goal, and input drafts are not stored. The product spec
  documents supported migrations and safe invalid-save handling.
- The independent `frosty-dice.rules-language` preference survives game resets.
- If `assets/language_select.png` changes, regenerate its two interior fill
  overlays. The masks flood-fill enclosed transparent letter bodies, extending
  one pixel under the original antialiased outlines while preserving holes and
  cutouts. The current fill is `#66D9FF`; no runtime image processing is used.

## Deployment

GitHub Pages serves the repository root from **`main`** at
[https://frostydice.com](https://frostydice.com), configured by [CNAME](./CNAME).
The [PWA manifest](./manifest.webmanifest) and service worker target this root
domain. PWA testing requires HTTPS, with `localhost` supported for development;
plain HTTP on a LAN address does not provide service-worker support.

For **every deployment that changes cached application files or assets**, bump
`CACHE_NAME`'s version in [service-worker.js](./service-worker.js). Keep
`PRECACHE_URLS` aligned with new/removed files and exact query-string versions
used by HTML and module imports. Installation fetches the complete fresh
application cache atomically; a failed install leaves the previous release usable.

Online launches check for worker updates. A new release waits until all existing
Frosty Dice windows/tabs close, then activates and removes obsolete Frosty Dice
caches. Reopen to use the update. This avoids a forced reload during play and
leaves local game saves intact.

## Credits

Frosty Dice is a personal creative project. Thanks to everyone who rolled dice,
playtested around the table, and shared ideas that helped shape the game.
