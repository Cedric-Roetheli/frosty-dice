# Frosty Dice — Product Specification

## 1. Purpose

Frosty Dice is a mobile-first browser companion for a physical tabletop game.
Each player uses their own phone as a game sheet. Players communicate verbally
and roll physical dice; the website does not replace either activity.

The redesigned mechanics are defined in [game-rules.md](./game-rules.md).
The core refactor is complete, followed by a minimal compatibility repair to
the existing interface. Its layout remains unchanged, with a small frozen-cell
image treatment; the full UI redesign is deferred.

## 2. Physical play

The active player rolls four physical six-sided dice, chooses two, and may use
one two-digit number formed from that pair. The unused pair is available to ALL
other players, who may each form a number and place it if legal on their board.

The app does not record whose dice supplied a number, who is active, or how many
rolls occurred. Every entered number uses the same guarded placement operation.
Optional pure helpers can generate the two orientations of a selected pair;
they never roll dice or model a physical turn.

## 3. Product scope

The app should:

- Represent the player's 4 × 7 board with value and normal/frozen/thawed cell status.
- Validate two-digit numbers whose digits are each from 1 through 6.
- Identify legal targets using usable orthogonal neighbors and the A1 start rule.
- Apply prime freezing only after legal placement, thawing the previous frozen cell.
- Calculate a plain sum with Street bonuses, excluding all ever-frozen values.
- Detect the goal only when D7 is occupied and not frozen.
- Save and restore the local board and permanent damage status.
- Allow a confirmed new-game reset.
- Remain mobile-first, accessible, static, and GitHub Pages compatible.

There is no roll counter, number-origin tracking, number-removal action, opponent
state, synchronization, backend, database, account, digital dice roller, cloud
save, or replacement special action for repeated-digit numbers.

## 4. Local game state

Canonical state is a board only. Empty cells are empty; occupied cells retain
both a value and a status: normal, currently frozen, or previously frozen/thawed.
At most one cell is currently frozen. Thawed cells are usable but permanently
scoreless. This status depends on placement order and must be stored rather than
recalculated from current neighboring values.

Score, Streets, legal targets, and goal status are derived from the board.
Neither dice-entry drafts nor turn/source metadata belong in persistent state.

Version 3 stores explicit cell statuses. Version-2 boolean cell records with at
most one frozen cell migrate to normal/frozen statuses in memory; the next
meaningful save writes version 3. Saves with several old frozen cells cannot
identify the latest freeze, so no current frozen cell is guessed. They safely
fall back to a fresh state and invalid-save status, preserving the original
record until play saves a new state or reset is confirmed. Version-1 numeric
records remain incompatible. Malformed version-3 states, including more than
one current freeze, use the same safe fallback. Mixed cell encodings that contain
both the legacy boolean `frozen` field and a current `status` field are rejected;
restoration must not guess which field describes permanent damage.

Missing or malformed saves and storage-access/quota errors must not crash the
storage layer. Game data stays on the local device.

## 5. Placement and feedback

A placement changes the board only after the shared rule validator accepts it.
Frozen cells remain occupied but cannot support a later placement; thawed cells
can support it. An illegal attempt never thaws a cell or changes the board.
The app must not infer rules from the
number's origin or replay turn history to validate a snapshot.

A new freeze sets the placed prime's status to frozen and the previous current
freeze's status to thawed, retaining all values. Previously thawed cells never
regain points. Frozen and thawed cells both prevent Street scoring. A thawed
D7 reaches the local goal even though it scores 0. Global end-of-game timing
remains undecided.

## 6. Existing UI compatibility and later redesign

Retain a simple game-sheet layout with compact score, readable board labels,
clear legal targets, and touch-friendly number entry. Compatibility wiring uses
the shared generic APIs, keeps input previews outside canonical state, and
derives score/goal/Street displays from the board. Currently frozen cells show
the supplied `assets/icecube.png` beneath a readable value and retain an
accessible label explaining their status. Thawed values show no ice cube, using
a quiet Thawed marker and a label explaining their usability and permanent zero
points. Removed actions and counters remain hidden. This targeted frozen-cell
treatment does not include a general layout or input redesign.

The next UI task can redesign the interface and remove the obsolete hidden
markup. Frozen values should remain readable without implying that they score
or support placement.

Do not redesign the interface or add new flows during the compatibility repair.
New-game confirmation remains required. Startup regression tests use a document
test double; browser automation and visual testing are excluded from this task.

## 7. Technical constraints

Use HTML, CSS, and vanilla JavaScript with relative asset/module paths. Keep
rule logic independent from DOM code and storage mechanics in storage.js.
Introduce no dependencies, framework, build system, PWA, or networking feature.

Deployment and device/browser evaluation remain future work.
