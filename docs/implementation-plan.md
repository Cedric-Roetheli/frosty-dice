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

## Attack Ice — Independent temporary overlay

Add manual Freeze/Unfreeze contextual actions to eligible occupied cells. A
normal or thawed cell may receive the one Attack Ice overlay; a Prime-frozen
cell may not. Freezing another eligible cell atomically moves the overlay.
Keep occupied values readonly, empty-cell input unchanged, and Challenge
resolution entirely at the physical table, as specified in game-rules.md.

Store an independent optional `attackIce: true` cell flag, preserving every
underlying Prime status. Attack Ice keeps base points, blocks placement support,
temporarily disqualifies Streets, and suppresses D7 goal detection. Removal
restores the underlying behavior with no new permanent damage. Use icecube2.png
with the existing contained ice rendering; Prime Ice retains icecube.png.

Each successful Freeze, Unfreeze, or Move captures the same full pre-action
board used by one-step Undo. Version 6 persists both boards with overlays.
Preserve version-5 Undo and earlier supported board migrations; safely reject
mixed or invalid states without rewriting a saved record during load.

Cover the core effects, Prime coexistence, atomic actions, exact Undo, storage
migration, and actual registered UI-handler paths with dependency-free tests.
Run the full suite once, without browser automation, screenshots, viewport
tests, commit, or push. Manual phone/design evaluation remains deferred.

**Status: Complete for this scope.** The full suite ran once in JavaScriptCore:
**253/253 passed** (47 game, 9 number-input, 21 Prime Ice, 17 scoring, 8 goal,
36 storage, 67 coordinator, 15 Undo, and 33 Attack Ice tests). Existing cases
remain, with assertions updated for occupied-cell actions and the new save
version. Static imports, shell IDs, asset paths, and whitespace checks passed.
No browser automation, screenshots, viewport tests, commit, or push was performed.
The supplied icecube2.png is used unchanged.

## Experimental illustrated background and full-cell ice

Use the two supplied portrait PNGs as fixed decorative CSS layers with a
shared aspect-preserving base size, separate scales, and a tunable painted
horizon. Keep the meadow plants and sky transition together without layout
changes. Add only the approved light backing behind header/score text.

Both active ice assets use the same cover/scale rule, clipped to existing cell
bounds with numbers above the artwork. Keep thawed visuals, UI geometry, game
logic, persistence, and artwork files unchanged. Update the stylesheet cache
version so the visual pass is loaded. Broader UI work remains deferred.

Run the existing suite once without browser automation, screenshots, viewport
tests, or visual regression tests. Composition and ice cropping will be
evaluated manually on phones. Do not commit or push.

**Status: Implemented for this experimental pass.** The unchanged automated
suite ran once in JavaScriptCore: **253/253 passed**. CSS asset paths and diff
whitespace checks passed. PNGs, JavaScript, tests, and the previous README URL
cleanup are unchanged. No browser automation, screenshots, viewport tests,
commit, or push was performed. Manual visual evaluation remains pending.

## Targeted visual iteration 2 — Lower horizon, sky header, stretched ice

Move the existing horizon control from 72% to 95% of stable viewport height.
Remove the header backing and use white title/Score/Undo styling, keeping
typography, geometry, and the 48px Undo target. Retain subtle disabled feedback.
Replace the shared oversized cover/transform with 100% width/height and a
central `--ice-image-fit: fill` setting. Keep cell clipping and numbers above
the artwork; do not change other UI, assets, rules, or JavaScript behavior.

**Status: Implemented for manual iPhone evaluation.** Update the stylesheet
cache version. Static scope/path and diff checks only; the suite was not run
because application logic is unchanged. No browser automation, screenshots,
visual tests, commit, or push. The next composition evaluation is manual.

## Targeted visual iteration 3 — Safari canvas and meadow continuation

Add `theme-color: #03020e`, matching the sampled upper sky, and use it for the
root/body canvas fallback without changing the viewport metadata or sky image.
Give the page and decorative layers a `100dvh` minimum with a `100vh` fallback.
Keep composition and its 95% horizon based on stable viewport height.

Keep the sky fixed and let the meadow's decorative layer span the full body
height, extending the PNG naturally down the page. Below the painting, continue
its underlay with matching green `#24691e`. Preserve safe-area padding, board,
header, ice, and all interaction geometry. Make only the exposed New Game /
Reset text and focus outline white; retain confirmation styling and behavior.

**Status: Implemented for manual iPhone Safari evaluation.** Updated the CSS
cache version and performed static scope/path/metadata and whitespace checks.
No full suite was run for these HTML/CSS-only changes. No browser automation,
screenshots, visual tests, commit, or push. Assets and application logic are unchanged.

## Focused board glass polish — Presentation only

Remove the visible board heading and row-number gutter. Render four aligned
P/L/A/Y headers using an app-only display mapping to A/B/C/D. Preserve internal
A1–D7 cell IDs, accessible identifiers, state, and all existing game rules.
Keep Street feedback, moving its ×2 marker into the last cell's corner without
changing cell height or adding a column.

Give the outer sheet restrained translucent white, a thin translucent border,
and slight Safari-compatible backdrop blur. Keep individual cells more opaque,
with readable numbers and existing selection/start/goal distinctions. Expose
opacity and blur values centrally. Preserve cell heights, typography, ice
geometry/stacking, background composition, and interactions outside the board.

Update presentation assertions and add a handler-level display-to-coordinate
regression. Retain every core test and internal-coordinate case. Run the full
suite once without browser automation, screenshots, or visual regression tests.
Do not commit or push. Manual phone evaluation remains deferred.

**Status: Implemented for this focused presentation scope.** The full suite
ran once in JavaScriptCore: **254/254 passed**, including 68 coordinator tests
and the unchanged core cases. Static checks confirmed that gameplay handlers,
game/scoring/storage modules, ice styling, artwork, and all background values
and rules are unchanged. Markup IDs, accessible names, paths, module imports,
and whitespace checks passed. No browser automation, screenshots, visual
regression tests, commit, or push. Manual glass/contrast evaluation is pending.

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
