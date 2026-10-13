# Frosty Dice — Product Specification

## 1. Purpose

Frosty Dice is a mobile-first browser companion for a physical tabletop game.
Each player uses their own phone as a game sheet. Players communicate verbally
and roll physical dice; the website does not replace either activity.

The redesigned mechanics are defined in [game-rules.md](./game-rules.md).
The core refactor and compatibility repairs are complete. Gameplay now uses
cell-first entry: the player chooses a cell and number, and the app validates
that attempted move. The board layout and frozen-cell treatment stay familiar;
broad visual polish and release evaluation remain deferred.

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
- Validate submitted placements using usable orthogonal neighbors and the A1 start rule.
- Let players reason about moves themselves, without target highlighting or number suggestions.
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

Score, Streets, and goal status are derived from the board. Cell selection and
number drafts stay in the UI and are not persisted. The interface does not
calculate legal-target lists or track turn/source metadata.

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
Every empty cell can be selected, including cells that cannot support the next
move. Selection and typing reveal no information about placement legality.
Only submission calls the shared guarded placement operation. There are no
suggested numbers, precomputed target lists, or legal-cell indicators.

An illegal submission leaves the board and saved data unchanged. Keep the
selected cell and entered value available for correction or cancellation.
Explain a sole usable neighboring relationship briefly; if several neighboring
relationships all fail, use a general explanation rather than implying that
every relationship must be satisfied. The first-placement rule receives its
own short A1 explanation. Invalid input is rejected without truncating a pasted
value into a different valid number.

Frozen cells remain occupied but cannot support a later placement; thawed cells
can support it. An illegal attempt never thaws a cell or changes the board.
The app must not infer rules from the
number's origin or replay turn history to validate a snapshot.

A new freeze sets the placed prime's status to frozen and the previous current
freeze's status to thawed, retaining all values. Previously thawed cells never
regain points. Frozen and thawed cells both prevent Street scoring. A thawed
D7 reaches the local goal even though it scores 0. Global end-of-game timing
remains undecided.

## 6. Cell-first game sheet

The board is the primary input interface. Empty cells are touch-friendly buttons
with no visible text, including when selected. Column and row headings identify
their positions; accessible cell labels retain their coordinates. Occupied
normal, frozen, and thawed cells cannot open entry or be overwritten. Selecting
an empty cell shows a restrained border and a compact form directly below the
board, with the selected coordinate in the input label. Selection is not a
statement that the move is legal.

Use one numeric-keyboard text input for the player's chosen number, with Place
and Cancel controls. Only two digits from 1–6 are accepted. The native form
supports Enter/Done submission where the browser supports it. Do not present a
dropdown, dice controls, orientations, or number suggestions. After success,
save automatically, clear the draft and selection, close the form, and derive
the updated score, Streets, and goal from the board.

Cancel, Escape, or a tap outside the form safely discards a draft. Selecting
another empty cell starts a fresh draft there; tapping the already selected
cell keeps its draft. Moving to entry dismisses a pending reset confirmation.
New Game / Reset remains accessible and requires explicit confirmation.

Keep the score compact, and show Street and goal feedback when applicable.
Currently frozen cells retain `assets/icecube.png` beneath a readable value,
with bounded dimensions and an accessible status label. Thawed cells have no
ice cube and retain their quiet Thawed marker and permanent zero-point label.

Remove the obsolete roll, external-number, Schnapszahl, stealing/removal, and
counter markup, handlers, and exclusive styling. Broader visual redesign is
deferred. Coordinator tests use a document/storage test double; browser
automation, screenshot tests, and viewport tests are excluded from this task.

## 7. Technical constraints

Use HTML, CSS, and vanilla JavaScript with relative asset/module paths. Keep
rule logic independent from DOM code and storage mechanics in storage.js.
Introduce no dependencies, framework, build system, PWA, or networking feature.

Deployment and device/browser evaluation remain future work.
