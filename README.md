# Frosty Dice

A mobile-first browser companion for a physical multiplayer dice game. Each
player uses their own phone as a game sheet while playing together at the table
with physical dice.

## Current status

Milestone 3 — Own-roll flow is implemented. Enter the values of two physical dice,
confirm the roll, choose a number, and tap a highlighted legal cell. Confirmed
own rolls count once, including failures. “Next roll” prepares a fresh entry
after a placement or failed roll.

Placement rules follow [the game rules](./docs/game-rules.md), including the
confirmed OR behavior. Milestone 4 has not started.

## Run locally

From the repository root, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in a modern browser. The page
should display an empty board, an own-roll count of zero, and two rows of dice
values. Stop the server with `Ctrl+C`.

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
│   ├── app.js                  # Board rendering and own-roll interaction
│   ├── game.js                 # Pure board, placement, and own-roll helpers
│   ├── scoring.js              # Future score and street calculations
│   └── storage.js              # Future local persistence
├── assets/                     # Reserved for static assets
│   └── .gitkeep                 # Keeps the empty directory in Git
├── tests/
│   ├── index.html              # Browser test page
│   ├── game.test.js            # Pure game-logic tests without DOM dependencies
│   ├── own-roll.test.js        # Dice, roll lifecycle, and counter tests
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
The page should report `66/66 tests passed; 0 failed.` No packages, test framework,
or build step are required.

The tests cover board structure, cell lookup, A1-only first placement, horizontal
and vertical rules, branching, occupied cells, missing predecessors, diagonal
and upward rejection, board edges, OR behavior in both directions, legal-target
enumeration, invalid inputs, and input immutability. The own-roll tests cover
unique number generation, doubles, valid and invalid dice, legal roll options,
failed rolls, guarded placement, and counting once through repeated actions.
Both test modules are independent of the DOM.

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
support boards created and extended through these helpers. Removal and
disconnected-network behavior remain unresolved and are not implemented.

## Own-roll state and controls

Game state contains `board`, `ownRollCount`, and `currentRoll`. Before confirmation,
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

## Manual checks

1. Start the local server and open the page.
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
7. Reload for a fresh board. Record 6/1 and place 61 at A1. On the next 1/6 roll,
   16 should remain visible but disabled, while 61 can be placed at A2. This roll
   must not be declared failed.
8. Reload and record 3/3 on the empty board. Only 33 should appear and it should
   be placeable at A1 normally, without a special stealing action.
9. Repeat the interactions in iPhone Safari and Android Chrome, at 320, 375, and
   390 px and with enlarged text. Check legible values, comfortable touch targets,
   no horizontal scrolling, keyboard focus, and screen-reader labels for dice,
   number choices, and legal target cells. Vertical scrolling is expected.
10. Check that the console has no errors and the app assets load successfully.
    Refresh should clear the board and counter; persistence belongs to a later
    milestone.
