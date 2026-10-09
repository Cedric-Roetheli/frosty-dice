# Frosty Dice

A mobile-first browser companion for a physical multiplayer dice game. Each
player uses their own phone as a game sheet while playing together at the table
with physical dice.

## Current status

Milestone 8 — Local persistence is implemented. The game saves automatically
on this browser and restores the board, own-roll count, confirmed roll, and
unfinished Schnapszahl action when reopened. “New Game / Reset” requires a
separate confirmation before clearing the game and its save.

A clear notice appears whenever D7 is occupied, including after own-roll,
failed-roll takeover, and stolen-number placement. Removing another cell does
not undo this notice; removing D7 clears current goal detection.

The score, Street markers, and bonuses continue to update from the current
board. Every present number counts, including values disconnected after removal.

A legally placed own-roll Schnapszahl still enables an optional table action and
stolen-number entry. “Number stolen from me” clears one occupied cell after
explicit confirmation; the score and Street bonus are recalculated afterward.

“Take failed roll” continues to accept a verbally announced number and show legal
targets. Failed-roll and stolen-number placements do not add an own roll or
trigger a Schnapszahl action. Removing a cell does not change the own-roll count.

The existing own-roll flow still records physical dice, confirms each roll once,
and lets you choose a number and legal cell. Failed own rolls also count once.

Placement rules follow [the game rules](./docs/game-rules.md), including the
confirmed OR behavior. Removal clears only the selected cell; all remaining
cells stay fully active for scoring and future placements. No A1 connectivity
check is required. Global end-of-game timing remains undecided. Milestone 9 has
not started.

## Run locally

From the repository root, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in a modern browser. The page
should restore any saved game, or display an empty board and zero own rolls on
first use. Stop the server with `Ctrl+C`.

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
│   ├── app.js                  # Board rendering, own rolls, and failed-roll entry
│   ├── game.js                 # Pure board, roll, and external-number helpers
│   ├── scoring.js              # Pure score and Street calculations
│   └── storage.js              # Versioned local saves, validation, and restoration
├── assets/                     # Reserved for static assets
│   └── .gitkeep                 # Keeps the empty directory in Git
├── tests/
│   ├── index.html              # Browser test page
│   ├── game.test.js            # Pure game-logic tests without DOM dependencies
│   ├── own-roll.test.js        # Dice, roll lifecycle, and counter tests
│   ├── external-number.test.js # Failed-roll entry and counter regression tests
│   ├── schnapszahl.test.js     # Own special actions, stolen numbers, and removal
│   ├── scoring.test.js         # Street bonuses, division, and scoring eligibility
│   ├── goal.test.js            # Goal detection and active cells after removal
│   ├── storage.test.js         # Save validation, round trips, and storage failures
│   ├── assert.js               # Shared dependency-free assertions
│   └── test-runner.js          # Displays test results
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

## Game logic tests

Start the local server above and open
[http://127.0.0.1:8000/tests/](http://127.0.0.1:8000/tests/).
The page should report `170/170 tests passed; 0 failed.` No packages, test framework,
or build step are required.

The tests cover board structure, cell lookup, A1-only first placement, horizontal
and vertical rules, branching, occupied cells, missing predecessors, diagonal
and upward rejection, board edges, OR behavior in both directions, legal-target
enumeration, invalid inputs, and input immutability. The own-roll tests cover
unique number generation, doubles, valid and invalid dice, legal roll options,
failed rolls, guarded placement, and counting once through repeated actions.
The external-number tests cover strict parsing, shared legal targets, illegal
placements, unplaceable numbers, zero own-roll increments, and returning to own
rolls afterward. The Schnapszahl tests cover source-specific triggering,
dismissal, guarded stolen placement, unchanged counters, and single-cell removal
without deleting downstream values. Scoring tests cover complete and incomplete
rows, non-Streets, sums, multiple bonuses, disconnected values, received numbers,
division, zero rolls, and immutability. Goal tests cover current D7 occupancy,
all placement sources, removal and re-placement, and active predecessors after
A1 removal. Storage tests cover canonical serialization, schema and state
validation, resumed roll counting, unfinished actions, recalculated derived
values, missing/corrupt saves, storage exceptions, and clearing only the game
key. All seven test modules are independent of the DOM; storage operations use
an in-memory test double.

## Board state and placement helpers

The board is an array of seven row arrays, each containing four entries.
`board[0][0]` is A1 and `board[6][3]` is D7. Empty cells contain `null`; occupied
cells contain a numeric two-digit value whose digits are each from 1 through 6.
Public helpers accept uppercase cell coordinates such as `B2`.

- `createEmptyBoard()` creates independent rows and boards.
- `getCellValue`, `isCellEmpty`, and `isCellOccupied` inspect a cell.
- `validatePlacement(board, coordinate, value)` returns `{ legal, reason }`.
- `canPlaceNumber(board, coordinate, value)` returns a boolean.
- `getLegalTargetCells(board, value)` returns every legal coordinate in row order.
- `placeNumber(board, coordinate, value)` returns a new board or throws the
  validation reason. It never mutates the input board.

All rule helpers live in `js/game.js` and are independent of the DOM. They
support boards created and extended through these helpers. Removal clears only
the selected cell; the existing placement helpers remain local and do not
require A1 connectivity after removal. All remaining cells stay active and
continue to score and support placements, as confirmed in the rules.

## Own-roll state and controls

Game state contains `board`, `ownRollCount`, `currentRoll`, and `schnapszahlAction`.
Before confirmation,
dice selections belong to the UI and do not change game state. A confirmed roll
stores the two physical dice values and a status of `pending`, `placed`, or
`failed`. Legal targets are derived from the board and dice.

- `generateRollNumbers(die1, die2)` validates the dice and returns unique numbers
  in ascending order.
- `getRollOptions(board, die1, die2)` gives each number and its legal targets.
- `isFailedRoll(board, die1, die2)` checks whether all target lists are empty.
- `createGameState`, `confirmOwnRoll`, `placeOwnRollNumber`, and
  `prepareNextOwnRoll` manage immutable state transitions.

Confirmation locks the roll and increments the counter. Placement accepts only
a number from that roll in a legal cell and does not increment the counter.
“Next roll” releases the completed or failed roll, preserving the board and
counter. This prevents repeated taps from confirming or placing the same roll
twice, while allowing later physical rolls with identical dice values.

The UI automatically selects the first usable number. Other generated numbers
remain visible; those without targets are disabled. Selected-number text,
pressed button state, and dashed cell borders identify legal choices. Keyboard
users can use native radio-group arrow keys and tab through enabled controls.

## Taking another player's failed-roll number

“Take failed roll” is a secondary outlined action. Enter the announced number in
one field with a numeric keyboard, select “Show placements”, and tap a legal
cell. The app accepts exactly two digits from 1–6. It does not generate a reverse
orientation, identify the opponent, or verify the opponent's roll.

- `parseExternalNumber(input)` converts a valid two-character input to a number.
- `getExternalNumberTargets(state, value)` delegates to `getLegalTargetCells`.
- `placeExternalNumber(state, coordinate, value)` delegates to guarded placement
  and returns new state with the same own-roll count.

Editing the field clears the previous targets. Invalid or unplaceable entries
leave the board and counter unchanged. Cancel returns to normal controls, and
successful placement does so automatically.

The interface handles one placement at a time: finish a confirmed own-roll
placement before opening this flow. Opening it after a completed or failed own
roll prepares the next own entry and clears the old dice without changing its
count. Unconfirmed own-dice selections are preserved when temporarily switching
to external entry. This keeps the normal own-roll flow intact and prevents reuse
of a finished own roll after an external number changes the available targets.

## Manual checks

1. Start the local server and open the page. Confirm “New Game / Reset” if a
   previous game is saved before starting these fresh-game scenarios.
2. Confirm the empty 4 × 7 board, Start/A1, Goal/D7, and zero own rolls. Confirmation
   stays disabled until both dice are selected. Change either selection and
   verify the counter remains zero.
3. Record 1/6. Confirm that the counter becomes 1, both 16 and 61 appear, and only
   A1 is legal. Switch numbers repeatedly: the highlighted preview should change
   without increasing the count. Place 16 at A1; repeated taps must not add a
   second number or another roll.
4. Select “Next roll” and record 1/6 again. Confirm that 16 highlights A2 and 61
   highlights B1. Place 61 at B1. The counter should be 2.
5. Select “Next roll” and record 3/3. There should be one option, 33, and no legal
   target. The failed-roll message should appear, the board should stay unchanged,
   and the counter should become 3. Repeat taps must leave it at 3.
6. Use “Next roll” to record another physical 3/3. This separate failed roll should
   increase the counter to 4. Next, record 1/6 and place 16 at A2 (count 5), then
   record 2/6 and place 26 at B2 (count 6), exercising the OR rule.
7. Confirm a New Game for a fresh board. Record 6/1 and place 61 at A1. On the next 1/6 roll,
   16 should remain visible but disabled, while 61 can be placed at A2. This roll
   must not be declared failed.
8. Confirm a New Game and record 3/3 on the empty board. Only 33 should appear and it should
   be placeable at A1. Its legal own-roll placement should then show the
   Schnapszahl action. Finish that optional action to return to the own-roll flow.
9. Repeat the interactions in iPhone Safari and Android Chrome, at 320, 375, and
   390 px and with enlarged text. Check legible values, comfortable touch targets,
   no horizontal scrolling, keyboard focus, and screen-reader labels for dice,
   number choices, and legal target cells. Vertical scrolling is expected.
10. Check that the console has no errors and the app assets load successfully.
    Refresh should restore the board and counter, including any confirmed roll
    or unfinished Schnapszahl action.

For the external-number flow:

1. Confirm a New Game, choose “Take failed roll”, and try `17`, `70`, `5`, `123`, `0`, and
   non-numeric text. Each should show a validation message without adding a
   number or changing the zero own-roll count. `123` must not become `12`.
2. Enter `16`, show placements, and confirm only A1 is legal. Edit the field to
   `33`: the old highlight must clear until you show placements again. Cancel
   and verify that the board and count remain unchanged.
3. Take `16` at A1. Normal own-roll controls should return automatically and the
   counter should remain zero. Record an own 1/6 roll and place 61 at B1; the
   counter should now be 1, even with repeated taps or number switching.
4. Take another failed-roll number and enter `33`. With A1=16 and B1=61 it has no
   target: verify the “cannot currently be placed” message, unchanged board,
   and count 1. Change to `16` and place it at A2; the count must remain 1.
5. Take `26` at B2. It is legal through A2's horizontal connection despite the
   mismatch with B1 above. The counter stays 1. Next record an own 3/3 and place
   33 at C2; the counter becomes 2. Finish the Schnapszahl action, then use
   “Next roll” to record 1/2, which now fails
   and makes the count 3.
6. Take `16` at A3 after that own failure. The count stays 3, and the old failed
   roll must not become available again. Record a new own 1/2: 12 is unavailable
   but 21 is legal at B3. Place 21 and confirm the count is 4.
7. Check the single-field numeric keyboard on iPhone Safari and Android Chrome,
   including narrow widths of 320, 375, and 390 px. Verify keyboard focus,
   understandable status messages, no horizontal overflow, and no console
   errors throughout both own and external interactions.

## Schnapszahl and removal controls

`isSchnapszahl` detects the six valid doubles. Only `placeOwnRollNumber` creates
`schnapszahlAction`, and only after guarded legal placement. The action records
the placed own number until `placeStolenNumber` consumes it or
`finishSchnapszahlAction` dismisses it. Neither operation adds an own roll. A
stolen Schnapszahl does not create another action.

Agree verbally which opponent number is removed. The app does not contain an
opponent board or check whether that removed number fits here before allowing
the table action. Enter it if desired; if it has no legal targets, finish the
action without adding a number. The opponent handles deletion on their own device.

`removeOwnNumber` clears one occupied cell in a copied board and leaves the
own-roll count unchanged. The UI requires selection, displays the coordinate
and value, and requires a separate confirmation. Cancel preserves the board.
Remaining cells retain their values, stay active, and continue to count toward
the score. Placement checks use current immediate neighbors. No connectivity
recalculation or path repair is required. Global end-game timing remains open.

For the final manual UI check:

1. Confirm a New Game and record own 1/1. Before placement there should be no special prompt.
   Place 11 at A1 and confirm that the prompt permits removing one opponent
   number verbally, including a number that cannot fit here.
2. Enter a stolen `16`, show placements, and place it at B1. The counter stays 1,
   the special action finishes, and it cannot place a second stolen number.
3. Choose “Number stolen from me”, select A1, and verify the review says 11 from
   A1 while the board is still unchanged. Confirm: A1 clears, B1 remains 16, and
   the own-roll counter stays 1.
4. Try cancelling removal, selecting another occupied cell before confirmation,
   and tapping empty cells. Cancellation must preserve every value and empty
   cells must not be selectable.
5. Confirm a New Game, take a failed-roll `33` at A1, and confirm no special action appears.
   Start another New Game, take `66` at A1, then record own 3/3: it fails, counts once, and
   must not show a special action.
6. Confirm a New Game, record own 6/6, and place 66 at A1. Try stolen `11`: it cannot fit.
   Finish the action without placement; the board remains just A1=66 and count 1.
   Also test dismissing a special action directly and backing out of stolen entry.

Milestone 5 verification was limited to the full test suite and
the three main browser flows once each, without screenshots or viewport sweeps.

## Score and Streets

`isStreetRow(row)` detects four occupied A–D cells containing consecutive
increasing integers. `getScoreBreakdown(board, ownRollCount)` returns the base
sum, Street bonus, one-based Street row numbers, scoring numerator, divisor, and
score. `calculateScore` returns the numeric score alone. These helpers are pure
and do not evaluate connectivity or placement history.

Each Street contributes its full row sum a second time. All other occupied
values count once, including disconnected and received values. A zero own-roll
count produces score 0 even when the numerator is positive. The underlying
calculation retains full precision; the UI formats the score to at most two
decimal places without storing derived score or Street state.

Milestone 6 verification ran the complete pure suite once in JavaScriptCore
outside a browser: 133 passed, 0 failed. No automated browser, screenshot,
viewport, visual-regression, or manual-style UI checks were performed.

## Goal detection

`hasReachedGoal(board)` is a pure read of D7 occupancy. It does not depend on the
placement source, own-roll count, or connection to A1. Goal status is derived
rather than stored as a historical achievement. All existing placement and
removal flows rerender the same local goal notice, alongside the current score.
The notice does not end the table game or enforce stopping turns.

Milestone 7 verification ran the complete pure suite once in JavaScriptCore
outside a browser: 145 passed, 0 failed. No browser or visual testing was
performed.

## Local persistence and reset

`js/storage.js` stores a JSON envelope under `frosty-dice.game` with schema
`version: 1`. Only `board`, `ownRollCount`, `currentRoll` (dice and status), and
`schnapszahlAction` (the placed double) are saved. Confirmed rolls stay counted
and locked after reload; unfinished placements and special actions can resume.
Unconfirmed dice selections, external-number drafts, and removal selections
are temporary UI state. Score, Streets, legal targets, and goal detection are
recalculated from the restored canonical state.

Saving follows every canonical state change, including roll confirmation,
placement from any source, failed own rolls, removal, finishing a special
action, and preparing the next roll. No manual Save button is needed. Missing
saves start normally. Invalid or incompatible data shows a fresh game and a
notice; the old record is retained until a new state is saved or reset is
confirmed. Unavailable storage or quota errors show a notice without stopping
play. Saves are local to this browser and site origin; no game data is sent away.

“New Game / Reset” opens an explicit confirmation. “Keep current game” cancels
without changing state or storage. Confirmation removes only this game's key
and returns the UI to its empty initial state. If the saved record cannot be
cleared, the current game is kept and the interface reports the failure.

Milestone 8 verification ran the complete pure suite once in JavaScriptCore
outside a browser: 170 passed, 0 failed.
Browser persistence and reset checks are left to the user; no browser or visual
testing was performed for this milestone.
