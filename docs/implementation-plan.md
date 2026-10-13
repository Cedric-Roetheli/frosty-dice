# Frosty Dice — Redesign Implementation Plan

The repository foundation, mobile board, and local-storage layer already exist.
Playtesting has replaced the earlier turn and score model. The steps below are
the current plan; [game-rules.md](./game-rules.md) remains the mechanics source
of truth. Do not implement a later step while working on an earlier one.

## Step 1 — Rules, core state, scoring, and tests

**Status: Complete for the core-only scope.** The unit suite ran once outside a
browser in JavaScriptCore: 105/105 passed (46 board/state, 9 number-input,
15 frozen-prime, 15 scoring, 7 goal, and 13 storage tests). No browser automation,
screenshots, or viewport tests were performed. No commit or push was made.

Scope:

- Document the four-physical-dice turn and source-neutral number entry.
- Remove roll counts and source-specific turn/action state from the core.
- Represent occupied cells as value/status records.
- Retain four-direction OR placement through non-frozen occupied neighbors.
- Freeze only the new prime after a legal placement beside an occupied prime.
- Preserve frozen occupancy while excluding it from usable neighbors and points.
- Preserve Streets but require all four cells to be normal and never frozen.
- Calculate score as the plain normal-cell sum plus Street bonuses.
- Detect the goal only at a non-frozen occupied D7.
- Version the new local snapshot format and reject incompatible older records
  without guessing placement order or deleting the original save.
- Retain applicable placement regressions and replace obsolete turn/action tests.
- Run the pure unit suite once after implementation.

At this core-only checkpoint, canonical state was only the board. Cell statuses are authoritative;
score, Streets, targets, and goal status are derived. Core updates must remain
independent of presentation code and use no dependencies or build system.

At the end of Step 1 the interface files were unchanged and still imported old
APIs. The subsequent compatibility repair below resolves that startup failure.
Browser automation, screenshots, and viewport tests were excluded from Step 1.

## Compatibility repair — Existing board initialization

Replace removed imports and legacy state-field assumptions in app.js with the
new generic APIs. Read cell records through getCell, retain preview state only
in the UI, and keep the existing layout/stylesheet. Hide unsupported actions
and counters, and retain versioned-storage fallback and confirmed reset.

Add non-browser startup regressions using a document/storage test double.
The game rules and core test cases remain unchanged by this repair.

**Status: Complete.** All 113 tests passed in one JavaScriptCore run, including
eight startup/interaction regressions. Module imports were checked against the
actual exports. No browser automation, commit, or push was performed.

## Freeze/thaw rule revision

Use explicit normal/frozen/thawed statuses and enforce at most one current
freeze. Check placement before applying effects; a new prime freeze thaws the
old current cell anywhere on the board. Thawed cells regain usability but never
points or Street eligibility. A thawed D7 reaches the local goal.

Version 3 saves retain statuses. Version-2 records with at most one frozen cell
migrate in memory; multiple old freezes and malformed/older incompatible saves
fall back safely without deleting the original record or guessing chronology.

Use existing text-marker styling for FROZEN and Thawed. No image assets, general
UI redesign, browser automation, screenshots, or viewport tests belong to this
revision. Run the full suite once, including document-test-double regressions.

**Status: Complete.** All 131 tests passed in one JavaScriptCore run, including
47 placement/state, 9 number-input, 21 freeze/thaw, 17 scoring, 8 goal,
18 storage, and 11 coordinator tests. Module imports also passed validation.
No browser automation, screenshots, viewport tests, assets, commit, or push.

## Targeted freeze/thaw integration coverage and ice-cube feedback

Trace A1=23 → B1=31 → A2=23 through the actual registered app handlers for both
chosen-pair and manual entry. Check every saved snapshot, rendered status, and
restored board. Continue to C1=46 through thawed B1, with scores 23 before that
continuation and 69 afterwards. The existing shared game transition already
produces normal A1, thawed B1, and frozen A2; no engine rule change is needed.

Currently frozen cells use the supplied ice-cube asset beneath their value,
with explicit 48px fallback dimensions and contained image styling. Thawed
cells have no ice cube. Request the updated stylesheet with a versioned relative
URL. Keep the existing input flow and general layout.

Reject mixed legacy boolean/current status records without guessing permanent
damage or overwriting the original saved data. Valid current-version saves and
unambiguous version-2 migration remain supported.

**Status: Complete.** The full suite ran once in JavaScriptCore: **136/136
passed**, including 14 coordinator tests and 20 storage tests. No browser
automation, screenshots, viewport tests, commit, or push was performed. The
image was supplied by the user; no asset generation or image editing was used.

## Step 2 — Cell-first interaction and integration

The approved interaction is a cell-first digital game sheet. Select any empty
cell, enter a two-digit dice number, and submit it to the existing shared rule
operation. Do not calculate or display legal targets, suggest numbers, or
validate a placement during selection or typing. Occupied cells cannot receive
ordinary placements; Undo below provides one-step input correction.

On success, apply the existing state transition, save, update the derived
displays, and close/clear entry. On rejection, preserve the board and draft and
explain the failure briefly without implying cumulative neighbor requirements.
Cancel/outside taps/Escape discard only the draft. Keep confirmed reset.

Remove old roll/source/counter/Schnapszahl/removal UI and its exclusive CSS/JS.
Keep the compact score, Street/goal feedback, touch sizes, board layout, and
working ice-cube treatment. Broad visual polish is outside this task. The game,
scoring, and storage modules and all engine tests remain unchanged.

Replace obsolete coordinator tests with cell selection, submission, correction,
cancellation, occupied-cell safety, shared freeze/thaw, score, goal, persistence,
and reset regressions. Run the suite once without browser automation,
screenshots, viewport tests, commit, or push.

**Status: Complete for this interaction scope.** The full suite ran once in
JavaScriptCore: **159/159 passed**, comprising 122 unchanged core tests and
37 coordinator tests. The game, scoring, and storage modules are unchanged.
HTML references, relative paths, and module imports were checked without a
browser. Broad visual polish remains deferred. No browser automation,
screenshots, viewport tests, commit, or push was performed.

## One-step Undo — Whole-board correction

Remove direct occupied-cell correction, its action interface, API, state,
exclusive styling, and tests. Occupied normal/frozen/thawed cells are readonly.

Extend canonical state to `{ board, undo }`. Capture a deep-cloned
`{ board }` immediately before placement, publishing it only when the move
succeeds. The next successful move replaces it; failed attempts and canceled
drafts preserve it. Restore the snapshot exactly and consume it with no Redo
or older history. Do not reverse effects or reconstruct a previous board.

Keep existing placement, dice, freeze/thaw, scoring, Street, and goal logic.
Recalculate derived displays after restore. Clear any unsubmitted entry and
stale selection on Undo. Confirmed reset clears current state and Undo.

Add a compact, accessible ↶ button immediately left of Score. Keep its place
when unavailable and disable/subdue it. Use a 48px touch target and immediate
action with no confirmation. No other occupied-cell or opponent action is added.

Version 5 persists both boards and consumes Undo by storing null. Preserve valid
version-3/4 boards without inventing snapshots, retain safe version-2 migration,
and reject malformed/recursive/mismatched snapshots safely. Keep relative paths
and static deployment compatibility.

Add pure snapshot/Undo, full coordinator, and persistence regressions, including
the 23/31/23 freeze example, Street/goal rollback, reload, repeat taps, invalid
attempts, cancellation, and reset. Preserve existing game-engine coverage.
Run the suite once; no browser automation, screenshots, viewport tests, commit,
or push.

**Status: Complete.** The full suite ran once in JavaScriptCore: **195/195
passed**, including 15 pure Undo, 50 coordinator, and 28 storage tests. Existing
game-engine coverage remains; obsolete direct-correction tests were removed.
The 23/31/23 integration exercises input, save, render, reload, and Undo, restoring
B1 frozen and A2 empty. Source checks also passed for imports, labels, static
paths, and the Undo button's position. No browser automation, screenshots,
viewport tests, commit, or push was performed.

## Step 3 — Manual evaluation and release

**Not started.** After UI integration, evaluate the physical game and interface
on representative phones, verify saving/restoration/reset and GitHub Pages
paths, and resolve only the rules that require a design decision. Publish only
when explicitly requested.

Global end-of-game timing remains undecided and is not enforced by Step 1.

## Workflow

Read the specifications, implement the current scope, keep rules deterministic,
and align documentation with approved changes. Do not invent an unresolved
mechanic. Follow the user's testing and commit/push restrictions for each task.
