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
Values/statuses restore through the versioned loader. New Game / Reset
still requires confirmation. Selection and drafts are temporary UI state.
Occupied values are readonly; tapping a normal or thawed cell offers Freeze or
Unfreeze for temporary Attack Ice. Physical Challenges are resolved at the table.
The ↶ button immediately left of Score restores
the entire board before the last successful placement or Attack Ice action, including all Prime
statuses and Attack Ice, and consumes that one snapshot. It works after reload and closes any
unsubmitted entry. Illegal attempts and cancellation preserve Undo; confirmed
reset clears it. There is no direct value correction, Redo, or history stack.
Prime-frozen cells show `icecube.png` beneath their value; Attack-Iced cells
show `icecube2.png`. Thawed cells retain a quiet Thawed marker and have no Prime
ice cube, even when temporarily covered by Attack Ice.
Obsolete roll/source/counter/Schnapszahl/removal controls have been removed.
The board layout and frozen-cell treatment are preserved; broad visual polish
is deferred. No browser automation or visual testing is part of this task.

Read [AGENTS.md](./AGENTS.md) and the [specifications](./docs/) before changes.
The [game rules](./docs/game-rules.md) define mechanics and the
[implementation plan](./docs/implementation-plan.md) defines the redesign steps.

## Core model

State is `{ board, undo }`. `undo` is null or a deep-cloned `{ board }` from before
the last successful state-changing action, never an older Undo. Each board has seven rows
of four entries:

- `null`: empty.
- `{ value: 16, status: "normal" }`: a normal occupied cell.
- `{ value: 13, status: "frozen" }`: the currently frozen occupied prime.
- `{ value: 31, status: "thawed" }`: an occupied, usable, permanently scoreless prime.

A1 is `board[0][0]`; D7 is `board[6][3]`. Values must contain two digits from
1–6. Status must be one of these three values. A current freeze must hold a
prime. Legacy thawed values retain permanent zero points.
An independent optional `attackIce: true` flag represents temporary Attack Ice;
removing it leaves the value and Prime status intact. Board validation rejects
more than one Prime freeze, more than one Attack Ice, or both on the same cell.

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
- `canApplyAttackIce`, `isCellAttackIced`, `applyAttackIce`, and `removeAttackIce`
  for the independent overlay; `freezeGameCell`/`unfreezeGameCell` capture Undo.
- `canUndo` and `undoLastMove` for consuming one complete prior-board snapshot.
- `isValidGameState`, `isValidUndoSnapshot`, and `cloneGameState` for bounded,
  independently cloned canonical state.
- `parseNumberInput`, `generateDiceNumbers`, and `getDiceOptions` for optional
  number entry from an already chosen physical pair. These helpers do not roll.
- `hasReachedGoal`: true for a normal or thawed occupied D7, false under Prime Ice or Attack Ice.

Placement is immutable and guarded. Empty boards start at A1; other placements
need at least one usable orthogonal relationship. Normal left/right neighbors
require strictly greater/smaller values respectively; normal upper/lower
neighbors require equality. Diagonals, Prime-frozen neighbors, and Attack-Iced neighbors cannot support it.
Occupied cells cannot be overwritten. Undo restores a complete snapshot rather
than changing a historical value or reversing effects individually. There is
no standalone number-removal API.

`js/scoring.js` provides `isStreetRow`, `getScoreBreakdown`, and `calculateScore`.
Score is the full normal-cell sum plus Street bonuses, with no roll divisor.
Each complete A–D row of normal consecutive increasing values is doubled.
Frozen and thawed cells contribute 0 permanently and disqualify their Street row.
Attack Ice retains normal base points, temporarily suppresses Streets, and leaves
no damage when removed. The breakdown exposes `baseSum`, `streetBonus`, `streetRows`, and `score`.

## Local snapshot format

`js/storage.js` stores `{ version: 6, state: { board, undo } }` under
`frosty-dice.game`. Undo is null or one `{ board }` snapshot. Values, Prime statuses, and
Attack overlays are deep-copied; derived displays, input drafts, source metadata, and
older history are omitted. Saved snapshot/current-board pairs must match one
legal placement or Attack Ice action under the shared engine; restoration copies the snapshot itself.

Valid version-5 saves preserve their existing Undo without Attack Ice.
Attack Ice fields in legacy versions are rejected rather than guessed.
Valid version-3/4 board-only saves restore unchanged with Undo unavailable.
Legacy permanent damage is preserved. Unambiguous version-2 boolean records
still migrate; version-1 numeric, malformed, ambiguous, mixed, and unknown
formats fall back safely with a visible status and preserve the original save.

Loading never rewrites data. Successful placement, Attack Ice actions, and Undo save version 6;
consumption writes `undo: null`, and confirmed reset removes the game key.
Missing saves return `missing`; storage errors return `unavailable`. No
unrelated keys are touched.

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

The current follow-up adds one-step complete-state Undo and removes direct
occupied-cell correction. Its coordinator and persistence tests use document
and storage doubles; no browser or layout engine is used.

The full suite ran once in JavaScriptCore: **195/195 passed**, including 15 pure
Undo, 50 coordinator, and 28 storage tests. Existing game-engine regressions
remain in the suite. No browser automation, screenshots, or viewport tests were
performed; no commit or push was made.

- `tests/game.test.js`: board/state helpers and placement regressions.
- `tests/frozen-prime.test.js`: prime/contact rules, freeze movement, permanent
  damage, thawed usability, and immutable state.
- `tests/number-input.test.js`: source-neutral input and chosen-pair options.
- `tests/scoring.test.js`: sums, frozen exclusions, and Street bonuses.
- `tests/goal.test.js`: goal detection with normal/frozen D7.
- `tests/storage.test.js`: status restoration, legacy migration/fallback, and storage failures.
- `tests/undo.test.js`: exact snapshots, freeze/thaw restoration, score/Street/goal
  rollback, deep-copy isolation, consumption, and bounded-history validation.
- `tests/attack-ice.test.js`: independent overlay effects, atomic movement, Prime
  coexistence, placement support, base points, Streets, D7, and exact Undo.
- `tests/app-initialization.test.js`: cell-first selection/submission, error
  correction, cancellation, occupied-cell guards, score/Street/goal feedback,
  save restoration/reset, one-step Undo, and A1=23 → B1=31 → A2=23 integration.
- `tests/fixtures.js` and `tests/assert.js`: dependency-free test helpers.

Attack Ice adds 33 focused pure tests, 17 coordinator tests through the actual
registered UI handlers, and eight persistence/migration tests. The full suite
ran once in JavaScriptCore: **253/253 passed**, retaining all existing cases.
No browser automation, screenshots, or viewport tests were performed.

## GitHub Pages

Assets and native JavaScript modules use relative paths, so the repository
requires no routing fallback or server code. Keep these constraints when
integrating the new core into the UI. Deployment remains deferred.
