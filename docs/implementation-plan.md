# Frosty Dice — Implementation Plan

> This plan intentionally builds Frosty Dice in small, testable milestones. Do not implement later milestones speculatively while working on an earlier one.

## Milestone 0 — Repository foundation

Goal: establish a clean project that can grow safely.

**Status: Complete.** The minimal shell and documented folder structure are in
place. Local HTTP and WebKit checks passed at both `/` and `/frosty-dice/`,
including module loading and layouts at 320 px and 1024 px. No later milestone
functionality was included in this foundation work.

Tasks:

- Create the agreed folder structure
- Add `index.html`
- Add `css/style.css`
- Add `js/app.js`
- Add `js/game.js`
- Add `js/scoring.js`
- Add `js/storage.js`
- Add `README.md`
- Keep `AGENTS.md` and the `docs/` specifications in the repository
- Add a suitable `.gitignore`
- Verify the site can be opened locally
- Verify all paths are GitHub Pages compatible

Exit condition:

A minimal page loads without errors and the repository structure matches the documented architecture.

## Milestone 1 — Mobile game board

Goal: create the visual foundation of the game.

**Status: Complete.** The empty board is rendered in `js/app.js` as a semantic
table with labeled rows and columns, disabled cell buttons, and text markers for
Start/A1 and Goal/D7. WebKit checks passed at 320, 360, 375, 390, 768, and 1024 px,
including 200% text at 320 px, with no horizontal overflow or browser errors.
Relative asset and module paths also passed under `/frosty-dice/`. This milestone
added rendering only.

Tasks:

- Build a responsive 4 × 7 board
- Add A–D column labels
- Add 1–7 row labels
- Identify A1 as start
- Identify D7 as goal
- Optimize board sizing for portrait phones
- Establish basic typography, spacing, buttons, and status areas
- Keep the design visually simple and game-like

No game logic beyond rendering is required yet.

Exit condition:

The empty board is pleasant and usable on a narrow mobile viewport.

## Milestone 2 — Board state and core placement rules

Goal: implement the fundamental Frosty Dice board logic independently of the UI.

**Status: Complete.** `js/game.js` implements the 7 × 4 board representation,
cell helpers, placement validation, legal-target enumeration, and immutable
guarded placement. Either valid predecessor suffices, as confirmed in section
4.4 of `docs/game-rules.md`. All 36 dependency-free pure-logic tests pass in
`tests/index.html`, including OR behavior in both directions.

Board state and validation were connected to rendering and rejection messages
while player input remained deferred. WebKit integration checks passed at 320,
375, 390, and 1024 px, including 200% text at 320 px, with no console errors or horizontal
overflow. Relative module and test paths passed at `/` and `/frosty-dice/`.

Tasks:

- Define the board-state representation
- Implement first placement at A1
- Implement horizontal `newValue > leftValue`
- Implement vertical `newValue === valueAbove`
- Support branching
- Determine legal target cells for a candidate number
- Connect rule functions to board rendering
- Give clear feedback for illegal actions

Important:

Game-rule functions should be testable without depending on DOM elements.

Exit condition:

Given a candidate number and board state, the application reliably identifies every legal placement.

## Milestone 3 — Own-roll flow

Goal: make the core turn playable with physical dice.

**Status: Complete.** The UI provides two touch-friendly 1–6 radio groups,
confirmation, unique number choices, legal-target highlighting, and guarded
placement. Pure helpers in `js/game.js` handle number generation, failed-roll
detection, and immutable own-roll state transitions while reusing Milestone 2
placement rules.

Every confirmation increases the own-roll count once. The confirmed roll stays
locked through placement or failure; “Next roll” clears the dice selections and
prepares the next physical roll without changing the board or counter.

All 66 automated tests pass: 36 placement tests and 30 own-roll tests. Complete
browser interactions passed in WebKit at 320, 375, 390, and 1024 px, including
200% text at 320 px. Checks covered rapid/repeated actions, both orientations,
doubles, failures, one usable orientation, and OR placement. No console errors
or horizontal overflow occurred. App and test module paths passed at `/` and
`/frosty-dice/`.

Tasks:

- Add fast input for two values from 1–6
- Generate both number orders when dice differ
- Handle doubles correctly
- Display candidate number(s)
- Highlight legal placements for each candidate
- Let the player choose a legal placement
- Count one own roll per physical roll
- Detect a failed roll when neither candidate can be placed
- Ensure failed own rolls still increase the own-roll count
- Prevent double-counting when the player considers both candidate numbers

Exit condition:

A player can play normal turns using physical dice and the website records their board and roll count correctly.

## Milestone 4 — External number entry

Goal: support numbers acquired from another player's failed roll through verbal
table interaction without networking.

**Status: Complete for the approved failed-roll scope.** “Take failed roll” opens
a single numeric-keyboard field. Pure helpers parse and validate the entered
number, delegate target calculation and placement to the existing core rules,
and preserve the own-roll count on every attempt. The UI clears stale highlights
when the input changes, reports unplaceable numbers, and returns to normal
controls after a placement or cancellation.

All 88 automated tests pass: 36 placement, 30 own-roll, and 22 external-number
tests. Mixed own/external interactions passed in WebKit at 320, 375, 390, and
1024 px, including 200% text at 320 px, with no console errors or horizontal
overflow. App and test module paths passed at `/` and `/frosty-dice/`.

Milestone 4 was limited to failed-roll numbers. Stolen-number entry was deferred
to Milestone 5 alongside the special-action flow.

### Failed-roll takeover

Tasks:

- Add “Take failed roll”
- Accept a valid two-digit Frosty Dice number
- Show legal placements
- Place the chosen number
- Do not increment the own-roll count

Exit condition:

Numbers acquired from opponents' failed rolls can be legally added without
increasing the receiving player's own-roll count.

## Milestone 5 — Schnapszahlen and removal

Goal: support the special attack mechanic locally.

**Status: Complete for the approved local-device scope.** A legal own-roll
Schnapszahl placement creates one optional special action. Failed-roll takeover
and stolen-number placement do not trigger it. The player can enter a stolen
number using the shared input and core placement helpers, or finish the action
without placement. Stolen placement preserves the own-roll count.

“Number stolen from me” enables occupied-cell selection and shows the selected
coordinate and value before explicit confirmation. Removal clears exactly that
cell, leaves every other value untouched, and preserves the own-roll count.
No connectivity consequences were decided or coded in Milestone 5.

All 115 automated tests pass: the prior 88 tests plus 27 focused Schnapszahl,
stolen-number, and removal tests. Only the three requested main browser flows
were checked, once each, in WebKit, with no console errors. No screenshot,
viewport sweep, or visual-regression checks were performed.

Tasks:

- Detect `11, 22, 33, 44, 55, 66`
- Trigger the special-action message only after a Schnapszahl is legally placed from the player's own roll
- Explain that the player may remove one opponent number
- Support the stolen-number flow if the player can use that number
- Allow an occupied own cell to be removed when an opponent steals/destroys it
- Require confirmation before destructive removal
- Recalculate derived board state after removal

### Stolen-number placement — deferred from Milestone 4

Tasks:

- Add a way to enter a stolen number
- Validate normal placement rules
- Do not increment the own-roll count
- Keep this action distinct enough that the player understands its origin

Deferred rule decision:

Resolve the “broken network after stealing” rule in `docs/game-rules.md` before
implementing connectivity consequences or repair behavior. Scoring eligibility
is now independently confirmed in section 10 of `docs/game-rules.md`.
The approved Milestone 5 scope is selected-cell removal only and is not blocked
by that outstanding decision.

Exit condition:

The website correctly supports the local-device parts of Schnapszahl attacks without needing opponent data.

## Milestone 6 — Scoring and streets

Goal: automate scoring.

**Status: Complete.** Pure functions in `js/scoring.js` detect complete horizontal
Streets, sum every occupied cell including disconnected values, add each Street
row's full value as a bonus, and divide by own counted rolls. A zero divisor
returns a score of 0 without division. The UI derives the score and bonus on each
render and marks Street rows with a gold inset border and a ×2 label.

The automated suite ran once outside a browser in JavaScriptCore: 133/133 tests
passed (the prior 115 plus 18 focused scoring tests). No automated browser,
screenshot, viewport, or visual-regression checks were performed. Milestone 7
has not started.

Tasks:

- Calculate base board-value sum
- Detect complete horizontal streets
- Apply the ×2 street value
- Track the own-roll divisor
- Calculate and display current score
- Recalculate immediately after placements/removals
- Make street status visually clear
- Handle zero-roll state safely

Confirmed scoring eligibility:

Every number currently present counts toward the numerator, irrespective of
connectivity. This resolves the earlier scoring blocker without deciding
placement activity, repairs, or goal connectivity.

Exit condition:

For all resolved rule cases, the displayed score matches manual calculation.

## Milestone 7 — Goal detection

Goal: reliably identify reaching D7.

Tasks:

- Determine whether D7 is validly reached from A1
- Show a clear completion state
- Preserve final score information
- Avoid declaring completion from an invalid/disconnected target

Blocker:

Finalize the broken-network rule and overall end-of-game timing in `docs/game-rules.md`.

Exit condition:

Goal detection matches the final confirmed rules.

## Milestone 8 — Local persistence

Goal: make the website safe to use during a real game.

Tasks:

- Save authoritative game state to `localStorage`
- Restore the current game on reload
- Add a state/schema version
- Handle missing/corrupt stored state gracefully
- Add “New game” / reset
- Confirm before deleting an existing game
- Ensure derived score/legal moves are recalculated correctly after restore

Exit condition:

A player can close/reload the page and continue their game without data loss under normal conditions.

## Milestone 9 — Mobile UX polish

Goal: make Frosty Dice pleasant at the table.

Tasks:

- Test common narrow phone widths
- Reduce unnecessary taps
- Improve dice-entry speed
- Improve legal-move highlighting
- Improve success/error feedback
- Make destructive actions unmistakable
- Check accessibility and focus behavior
- Ensure values remain readable in every board state
- Add a compact rules/help view if useful
- Add subtle animation only where it improves comprehension

Exit condition:

A new player can operate the digital sheet with minimal explanation.

## Milestone 10 — Testing and GitHub Pages release

Goal: publish a reliable first test version.

Tasks:

- Manually test all confirmed rules
- Test representative branching boards
- Test doubles and Schnapszahlen
- Test failed rolls
- Test external-number entry
- Test streets and scoring
- Test deletion/removal
- Test persistence and reset
- Test on iPhone Safari
- Test on Android Chrome
- Check desktop as a secondary target
- Fix GitHub Pages path issues
- Publish through GitHub Pages
- Add the live URL to `README.md`

Exit condition:

Several people at the same table can independently open the GitHub Pages URL and complete a test game.

## Development approach

Work milestone by milestone.

Within a milestone:

1. Implement the smallest useful piece.
2. Test it.
3. Commit it.
4. Continue.

Prefer frequent working commits over large batches.

Do not proceed around unresolved game-rule blockers by inventing behavior. Record the blocker and ask for a decision.

## Suggested early commit sequence

Examples:

1. `chore: initialize Frosty Dice web project`
2. `feat: add responsive 4x7 game board`
3. `feat: implement board placement rules`
4. `feat: add physical dice input flow`
5. `feat: detect failed rolls`
6. `feat: support external number placement`
7. `feat: add Schnapszahl actions`
8. `feat: calculate streets and score`
9. `feat: persist games locally`
10. `chore: prepare GitHub Pages release`
