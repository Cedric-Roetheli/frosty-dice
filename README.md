# Frosty Dice :)

A mobile-first companion for a physical tabletop dice game. Each player uses
an independent phone as their game sheet. There is no backend or synchronization.

## Current work

The redesign's first step changes the pure rules, canonical state, scoring,
local-save format, and unit tests. The active player uses four physical dice;
the core accepts a number without tracking its origin, rolls, or turns.

The board is now the main input interface. Select an empty cell, type the desired
two-digit dice number, and press Place or submit with the keyboard. The shared
game operation validates only that attempted move; the interface does not
suggest numbers or highlight legal targets. Illegal attempts preserve the board
and draft for correction. Cancel, Escape, or a tap elsewhere discards the draft.

Successful placements update the score, Streets, and goal and save automatically.
Values/statuses restore through the unchanged versioned loader. New Game / Reset
still requires confirmation. Selection and drafts are temporary UI state.
Currently frozen cells show the supplied ice-cube image beneath their value;
thawed cells show a quiet Thawed marker without an ice cube.
Obsolete roll/source/counter/Schnapszahl/removal controls have been removed.
The board layout and frozen-cell treatment are preserved; broad visual polish
is deferred. No browser automation or visual testing is part of this task.

Read [AGENTS.md](./AGENTS.md) and the [specifications](./docs/) before changes.
The [game rules](./docs/game-rules.md) define mechanics and the
[implementation plan](./docs/implementation-plan.md) defines the redesign steps.

## Core model

State is `{ board }`. The board has seven rows of four entries:

- `null`: empty.
- `{ value: 16, status: "normal" }`: a normal occupied cell.
- `{ value: 13, status: "frozen" }`: the currently frozen occupied prime.
- `{ value: 31, status: "thawed" }`: an occupied, usable, permanently scoreless prime.

A1 is `board[0][0]`; D7 is `board[6][3]`. Values must contain two digits from
1–6. Status must be one of these three values; only dice primes can be damaged.
Board validation rejects more than one currently frozen cell.

Statuses are historical state. When a legal new prime touches any occupied
prime, it freezes and the previous currently frozen cell thaws. Frozen and
thawed primes both count as prime contact; only normal/thawed neighbors can make
a placement legal. Validate before thawing. Previously thawed cells retain
their number, never recover their points, and cannot be overwritten. Current
adjacency must never retroactively freeze existing normal cells.

## Pure APIs

`js/game.js` provides:

- `createEmptyBoard`, `createGameState`, and `cloneBoard`.
- `isValidNumber`, `isPrimeNumber`, `isValidCell`, and board/cell validation.
- `getCell`, `getCellValue`, and empty/occupied/frozen/thawed/usable cell helpers.
- `validatePlacement`, `canPlaceNumber`, and `getLegalTargetCells`.
- `placeNumber` for boards and `placeGameNumber` for source-neutral state.
- `parseNumberInput`, `generateDiceNumbers`, and `getDiceOptions` for optional
  number entry from an already chosen physical pair. These helpers do not roll.
- `hasReachedGoal`: true for a normal or thawed occupied D7, false while frozen.

Placement is immutable and guarded. Empty boards start at A1; other placements
need at least one usable orthogonal relationship. Normal left/right neighbors
require strictly greater/smaller values respectively; normal upper/lower
neighbors require equality. Diagonals and frozen neighbors cannot support it.
Occupied cells cannot be overwritten. There is no number-removal API.

`js/scoring.js` provides `isStreetRow`, `getScoreBreakdown`, and `calculateScore`.
Score is the full normal-cell sum plus Street bonuses, with no roll divisor.
Each complete A–D row of normal consecutive increasing values is doubled.
Frozen and thawed cells contribute 0 permanently and disqualify their Street row.
The breakdown exposes `baseSum`, `streetBonus`, `streetRows`, and `score`.

## Local snapshot format

`js/storage.js` stores `{ version: 3, state: { board } }` under
`frosty-dice.game`. Cell values and statuses are copied; derived values,
entry drafts, and legacy metadata are omitted.

Version-2 `{ value, frozen }` records migrate if they contain at most one current
freeze. Loading does not rewrite the record; the next meaningful save uses
version 3. Multiple old frozen cells cannot reveal which freeze came last, so
the loader returns a fresh state with status `invalid` and preserves the original
record until a later save or confirmed reset. Version-1 numeric saves and
malformed snapshots use the same fallback. Mixed legacy `frozen` flags and current
`status` fields are rejected rather than guessing which field is authoritative.
Missing saves
return `missing`; storage failures return `unavailable`. The storage wrapper
never clears unrelated keys and catches access/quota errors.

## Tests and local serving

There is no installation, dependency, build step, or backend. To serve the
independent test page locally:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [the test page](http://127.0.0.1:8000/tests/) if you want to inspect results
manually. Stop the server with Ctrl+C. Native module loading requires HTTP rather
than opening files directly. This is a development convenience, not a deployment
requirement.

The pure modules cover existing placement behavior, cell-record validation,
prime freezing, usability, number parsing, plain scoring, Streets, normal/frozen
D7, and canonical storage. Obsolete turn/action test modules have been removed.

The core refactor's suite ran once in JavaScriptCore outside a browser:
105/105 passed. Startup regression tests additionally exercise initialization,
save fallbacks, frozen-record rendering, shared placement, and confirmed reset
using a small document/storage test double, without a browser or layout engine.

After the compatibility repair, the full suite ran once in JavaScriptCore:
**113/113 passed**, including eight startup/interaction regressions. Module
imports were checked against their actual exports before running the tests.
No browser automation was performed.

The freeze/thaw revision's full suite ran once in JavaScriptCore:
**131/131 passed**, including status migration, permanent damage, thawed D7,
and minimal text-marker regressions. No browser, screenshot, or viewport testing
was performed; no image assets were added.

The targeted integration follow-up ran the full suite once in JavaScriptCore:
**136/136 passed**, including both entry paths for the three-prime sequence,
save/render/reload checks, ice-cube rendering with bounded fallback dimensions,
and rejection of mixed save formats. These coordinator tests use document and
storage doubles; no browser or visual testing was performed.

After replacing the old entry widgets with cell-first interaction, the full
suite ran once in JavaScriptCore: **159/159 passed** (122 unchanged core tests
and 37 coordinator tests). No browser automation, screenshots, or viewport
tests were performed. The game, scoring, and storage modules are unchanged.

- `tests/game.test.js`: board/state helpers and placement regressions.
- `tests/frozen-prime.test.js`: prime/contact rules, freeze movement, permanent
  damage, thawed usability, and immutable state.
- `tests/number-input.test.js`: source-neutral input and chosen-pair options.
- `tests/scoring.test.js`: sums, frozen exclusions, and Street bonuses.
- `tests/goal.test.js`: goal detection with normal/frozen D7.
- `tests/storage.test.js`: status restoration, legacy migration/fallback, and storage failures.
- `tests/app-initialization.test.js`: cell-first selection/submission, error
  correction, cancellation, occupied-cell guards, score/Street/goal feedback,
  save restoration/reset, and A1=23 → B1=31 → A2=23 → C1=46 integration.
- `tests/fixtures.js` and `tests/assert.js`: dependency-free test helpers.

## GitHub Pages

Assets and native JavaScript modules use relative paths, so the repository
requires no routing fallback or server code. Keep these constraints when
integrating the new core into the UI. Deployment remains deferred.
