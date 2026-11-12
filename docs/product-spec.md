# Frosty Dice — Product Specification

## 1. Purpose

Frosty Dice is a mobile-first browser companion for a physical tabletop game.
The default 3P+ mode gives each player their own phone as a game sheet. Optional
2P lets two opposite players share one device. Players communicate verbally
and may use physical dice or the optional independent Digital Dice Machine.

Classic mechanics are defined in [game-rules.md](./game-rules.md); the optional
variation is defined in [two-player-rules.md](./two-player-rules.md).
The core refactor and compatibility repairs are complete. Gameplay now uses
cell-first entry: the player chooses a cell and number, and the app validates
that attempted move. The board layout and frozen-cell treatment stay familiar;
broad visual polish and release evaluation remain deferred.

## 2. Physical play

The active player rolls four six-sided dice, physically or digitally, chooses two, and may use
one two-digit number formed from that pair. The unused pair is available to ALL
other players, who may each form a number and place it if legal on their board.

The app does not record whose dice supplied a number, who is active, or how many
rolls occurred. Every entered number uses the same guarded placement operation.
Optional pure game helpers can generate the two orientations of a selected pair;
they never roll dice or model a physical turn. The digital dice component is
separate from those helpers and from all board validation.

## 3. Product scope

The app should:

- Represent the player's 4 × 7 board with value and normal/frozen/thawed cell status.
- Validate two-digit numbers whose digits are each from 1 through 6.
- Validate submitted placements using usable orthogonal neighbors and the A1 start rule.
- Let players reason about moves themselves, without target highlighting or number suggestions.
- Apply prime freezing only after legal placement, thawing the previous frozen cell.
- Let players manually apply, remove, or atomically move one temporary Attack Ice.
- Calculate normal cell contributions (repdigits doubled), doubled again for scoring Streets, minus confirmed bids; exclude all ever-frozen values.
- Detect the goal only when D7 is occupied and usable (no Prime Ice or Attack Ice).
- Save and restore the local board and permanent damage status.
- Offer one-step Undo of the last successful placement or Attack Ice action, restoring its complete prior board.
- Offer a secret point-bid Challenge dialog; persist confirmed spending and include it in one-step Undo.
- Keep the main-screen balance private behind a $ button opening the Frosty Fresh Goods receipt, with persistent confirmed-bid records.
- Allow a confirmed new-game reset.
- Remain mobile-first, accessible, static, and GitHub Pages compatible.
- Offer optional home-screen installation and offline play after complete local precaching, while keeping the normal website immediately usable.
- Offer an optional illustrated digital dice machine between the gameplay area and Rules, with an always-visible disclosure toggle independent of the game sheet.

There is no roll counter, number-origin tracking, number-removal action,
synchronization, backend, database, account, cloud save, or replacement special
action for repeated-digit numbers. Classic keeps no opponent state; 2P stores
only its two independent local boards.

## 3.1 Optional 2P mode on one device

Keep the existing experience as the primary **3P+** default. The illustrated
Reset snowman opens a compact bilingual New Game dialog with 3+ Players and
2 Players choices. Choosing either starts a fresh game in that mode, including
when it is already active. The selected mode is indicated subtly. Escape,
outside taps, and Cancel dismiss the dialog without changing gameplay or saves.
The snowman and title retain their existing artwork, size, and position.
Missing/invalid mode preferences fall back to 3P+. Store only `2p` or `3p-plus`
under `frosty-dice.game-mode`.

2P has two independent 5×3 boards in the existing central game region. Player 1
sits at the top, with board, numbers and input rotated 180°; Player 2 sits at the
bottom with an upright board. This orientation was confirmed explicitly. Each
owner starts anywhere in local row 3, their physical outer row. Keep four-direction
OR adjacency and Prime freeze/thaw through shared pure helpers. In both boards,
numbers increase from the physical left to the physical right of the upright
screen: Player 1's logical A–E direction decreases and Player 2's increases.
Vertical equality and all other placement rules remain unchanged. Four small
comparison signs sit across the starting row of each board; Player 1's rotate
with that board so both screen-facing rows agree with the physical rule.
The classic A1=66 restriction remains classic-only, because 2P has no D7 route.
66 is valid in the 2P starting row and later placements under the ordinary rules.

Use normal repdigit doubling and zero scoring for frozen/thawed cells, but no
Streets, Attack Ice, Challenges, receipt, total-score tiebreaker, or classic goal
UI. Sum each owner's three-cell columns. Compare physical columns using the
central mapping `4 - logicalIndex` for rotated Player 1 and identity for Player 2.
The single SVG Frosty Frontline replaces the ten triangles. Its five control
points share the board's actual physical column centers. Each point's vertical
fraction is Player 1's column score divided by both column scores, or 0.5 at
0:0. The curve passes through all five points and stays in the scoring area;
its uniform 8px icy stroke has rounded ends at the first and fifth points.
Two fixed horizontal arrows between each board and its score labels point toward
physical screen right: light blue for Player 1 and pink for Player 2. Blue means Player 1 leads,
pink means Player 2 leads, white marks a positive tie, and a dark point marks
0:0. These are live indicators, not permanent awards. The owners' exact numeric
totals remain fixed at the upper and lower edges, each facing the corresponding
player. The existing equal-weight column victory rules remain unchanged, including
positive ties counting for both and 0:0 for neither. Keep three-digit values
readable and honor reduced motion.

Keep Player 1's label above the upper board, facing Player 1, and Player 2's
label below the lower board, facing Player 2. Feedback stays at these outer edges,
never between the two boards and the scoring strip. Use 6px vertical gaps on both
sides of the strip, preserving every cell dimension, all five physical column
alignments, point positions, orientations, and score formatting.

Both boards accept owner-oriented six-button numeric entry independently; no turn/roll/pass manager,
active-player marker, automatic dice assignment, automatic winner, or board lock
is introduced. The players finish the physical roll after the first board fills
and count won columns themselves. The bilingual explanatory paragraph
sits in normal flow directly
above the How-to-Play disclosure in the Rules area, only while 2P is active. Keep
meadow controls anchored and the instructions clear of their artwork.
Keep Digital Dice, Full Rules, footer, meadow, and illustrations available and
unchanged. The existing How to Play disclosure shows the unchanged twelve-step
classic tutorial in 3P+ and a bilingual six-step 2P tutorial in 2P. Mode changes
reset the tutorial to step one; language changes preserve its step. The 2P
demonstrations use separate, deterministic boards and the same Frontline geometry,
without writing game state. Both sequences share navigation, progress, and the
final scroll to the currently visible game board.

The classic coordinator owns its existing state/actions. A separate 2P coordinator
owns `{ player1: { board }, player2: { board }, undo }`, with one complete, deep-cloned
pre-placement snapshot of both boards and no nested history. Prime status is
historical and authoritative per player, never reconstructed from current neighbors.
Rejected input/cancellation leaves state and Undo untouched. Reuse the existing
Undo and reset actions, guarded by active mode; New Game clears only the selected
mode's state/save. Classic-only controls and their board/goal/Street/Attack
UI are hidden and unfocusable while 2P is visible.

Persist 2P under `frosty-dice.two-player-game`, schema version 1, validating board
shape, dice values, status restrictions, one freeze per board, and a legal one-move
Undo snapshot. Restore safely from missing/malformed/unavailable data without
rewriting the original. Classic save version 8 and migrations remain unchanged.

Meaningful progress in either the current or selected mode requires confirmation
before starting a new game. Selection/drafts/tutorial/receipt opening do not count
as progress. The other mode's save is retained; the selected mode's save is cleared
only after confirmation. Cancelling changes no board, save, or preference. Save the
new mode preference before clearing the selected game; a failed preference write
keeps both games intact. Startup only reads state/preferences and never erases a game.

All new visible/accessibility copy uses the existing DE/EN preference and language
event. Language changes preserve boards and Undo; an open keypad closes if the
player taps the language control outside it. Keep
new styling scoped to the New Game dialog and 2P view.
Precache new modules/CSS, retain existing assets/pages, and preserve the worker
update strategy. No framework, dependency, server, accounts, or synchronization.

For 2P, selecting an empty cell opens one floating keypad with six buttons,
1–6, and a two-slot draft display. The keypad faces the cell's owner: Player 1's
is rotated 180°, Player 2's is upright. It stays within that owner's board area
without shifting the boards or central scores. A first digit is temporary; the
second immediately calls the existing guarded placement. A valid move saves and
closes the keypad. An invalid move keeps it open, clears both digits, and shows
the existing owner feedback without changing board, score, or Undo. Tapping a
different empty cell or outside, switching modes, and Escape discard the draft.
The 2P cells remain buttons and never focus a native numeric input. Classic 3P+
retains its separate inline input and keyboard behavior.

## 4. Local game state

Classic canonical state is `{ board, undo, pointsSpent?, challengeHistory? }`. Missing `pointsSpent` means
zero; confirmed bids store a nonnegative integer. Each board has seven rows of four cells;
occupied cells retain a value and a normal/frozen/thawed status. At most one
cell in each board is currently frozen. Thawed cells are usable but permanently
scoreless. These statuses are authoritative historical data.
An optional `attackIce: true` flag on an occupied cell is an independent
temporary overlay. Absence means no Attack Ice. At most one cell has that flag;
it cannot coexist with `status: "frozen"` on the same cell. Removing the flag
never changes the underlying value or Prime status.

`challengeHistory`, when present, contains chronological `{ id, amount }`
entries. The sequential positive integer ID also supplies the display number.
Every confirmed bid, including zero, appends one expense entry.
Missing history means an empty list. `pointsSpent` remains the authoritative
aggregate deduction; history records it without spending again. History totals
may be lower because older saves did not itemize bids. No historical entries
are fabricated and no derived balance is stored.

`undo` is either `null` or `{ board, pointsSpent?, challengeHistory? }`, a deep-cloned pre-action
board, spending, and itemized history including Attack Ice and every Prime status. Confirmed bids
include explicit pre-bid spending, even when zero.
The snapshot never contains an older Undo. Score, Streets, legal targets, and
goal are derived and not persisted. Selection, number drafts, unfinished bids,
the revealed bid, the open/confirmed dialog state, and all digital dice values
and selections remain temporary UI data.

Version 8 saves the board, spending, history, and this one nullable snapshot together.
Validate both boards, reject recursive history or a snapshot that does not
precede the current state by one legal placement, Attack Ice action, or affordable
confirmed bid, and retain canonical cell
statuses without legacy boolean flags. Validate transaction IDs, amounts,
aggregate spending, and the exact history transition as part of Undo
validation. A bid's Undo removes exactly its new entry; all other actions keep
the list unchanged. Reject duplicate IDs and itemized spending above the aggregate.
Saved A1=66 values and first-row Attack Ice remain valid, including their exact
historical Undo snapshots. Validation of those snapshots permits the formerly
legal action; all new placements and Freeze actions use the current protective
rules. No automatic removal is required. Existing
first-row Attack Ice can still be unfrozen, moved to rows 2–7, or restored by Undo.

Valid version-7 games retain their board, aggregate spending, balance, and exact
Undo, with no itemized entries. Old bid Undo still restores the former spending.
The receipt labels unitemized deductions as earlier spending. The first new bid
starts at #01 and does not lose or repeat earlier deductions. Older schemas
containing unexpected history are rejected as mixed development saves.
Previous version-8 saves may contain obsolete outcome fields. Ignore those
fields when checking current/Undo history, and discard them during canonical
cloning and the next normal save. Preserve all IDs, amounts, deductions, and
the exact Undo relationship; keep schema version 8 with no extra migration.
Valid version-6 games migrate with their Prime/Attack Ice and Undo intact and no
spending. Valid version-5 games migrate with their existing Undo intact and no Attack Ice.
Valid version-3 and version-4 board-only games migrate with Undo unavailable.
Preserve their values and damage exactly; there is no prior board to recover.
Version 4's legacy permanent damage remains scoreless. Version-2 boolean
records with at most one freeze still migrate safely. Version-1 numeric saves,
ambiguous multiple freezes, mixed encodings, malformed snapshots, and unknown
versions fall back to a fresh state and a visible invalid-save message. Attack
Ice fields in older versions are rejected as mixed development saves. Current
games with multiple Attack overlays or an overlay on a Prime-frozen cell are
also rejected safely; no status is guessed or silently discarded. Spending
fields in versions before 7 are rejected as mixed development saves.

Loading never rewrites or deletes a save. The next successful placement or
Attack Ice action, confirmed bid, or Undo saves version 8. Consuming Undo saves `undo: null`; confirmed reset clears
the saved game entirely. Missing saves and storage-access/quota errors must
not crash the application. Data stays on the local device.

## 5. Placement and feedback

A placement changes the board only after the shared rule validator accepts it.
Every empty cell can be selected, including cells that cannot support the next
move. Selection and typing reveal no information about placement legality.
Only a completed two-digit entry calls the shared guarded placement operation. There are no
suggested numbers, precomputed target lists, or legal-cell indicators.
Reject 66 in A1 with “66 cannot be placed in Start” in the shared above-board
status area, preserving the empty cell, board, score, saved data, and Undo.
The initial-placement requirement remains A1; other starting numbers stay valid.

An illegal entry leaves the board and saved data unchanged. Restore the empty
cell and show the concise reason in the status area above the board; the player can tap
the cell again to retry.
Explain a sole usable neighboring relationship briefly; if several neighboring
relationships all fail, use a general explanation rather than implying that
every relationship must be satisfied. The first-placement rule receives its
own short A1 explanation. Invalid input is rejected without truncating a pasted
value into a different valid number.

Prime-frozen and Attack-Iced cells remain occupied but cannot support a later
placement; thawed cells without Attack Ice can support it. An illegal attempt
never thaws a cell or changes the board.
The app must not infer rules from the
number's origin or replay turn history to validate a snapshot.

A new freeze sets the placed prime's status to frozen and the previous current
freeze's status to thawed, retaining all values. Previously thawed cells never
regain points. Frozen and thawed cells both prevent Street scoring. A thawed
D7 reaches the local goal even though it scores 0. Global end-of-game timing
remains undecided.

## 6. Cell-first game sheet

The board is the primary input interface. Empty cells are touch-friendly buttons.
Empty A1 shows its small centered Start hint. Empty D7 shows the unchanged
`assets/d7_flag.png` instead of End text, centered in an 88% width/height image
box with `object-fit: contain` and no pointer interception. Its absolute
positioning leaves cell dimensions unchanged. The flag is derived only from an
empty, unedited D7; it adds no game state. An active inline input
temporarily replaces the hint; cancellation or rejection restores it. The hints
also return if Undo restores the empty cell; occupied
cells show their number and applicable state markers. Other empty cells have no
visible text. The hints neither intercept taps nor enter game state. The visible
board heading and row-number gutter are removed. Column headings A/B/C/D are
visually hidden and retained for assistive technology; P/L/A/Y is no longer
displayed. The grid has exactly four cells in each of
seven rows, centered without a spare gutter. Accessible column/cell labels and
number-entry coordinates retain A1–D7; saved games require no migration. Occupied
normal, frozen, and thawed cells cannot open number input or receive placements.
Normal and thawed cells instead expose a temporary Attack Ice action below the
board: Freeze if eligible, Unfreeze if currently Attack-Iced. First-row cells
A1–D1 never offer a new Freeze; an older overlay there still offers Unfreeze.
Core validation enforces the same row protection. Prime-frozen cells
are disabled and offer no Freeze. Selecting an empty cell replaces its button
with a native text input in the same cell, using its existing glass appearance
and centered 22px number typography. Accessible labels retain the internal
coordinate. Selection is not a statement that the move is legal.

There is no separate entry bar, form, Place/Cancel control, or reserved space.
Keep the board below the header and reserved message area, without changing its dimensions or
the meadow/horizon. Automatically focus the inline input with `preventScroll`
and `inputmode="numeric"`. Native keyboard accommodation remains the browser's
responsibility; add no viewport detection or scripted scrolling.

The first valid digit is only a draft. The second automatically attempts the
placement through the shared parser and guarded game operation. Reject invalid
digits, non-numeric text, and overlong input without truncating pasted values.
Do not add `maxlength` that could turn a malformed paste into a legal number.
Enter/Done may also attempt the current input. A successful placement saves,
removes the input, dismisses keyboard focus, and recalculates score, Streets,
and goal. Only success creates an Undo snapshot.

Rejection restores the empty cell and replaces the previous status text with
the concise reason in the same above-board live region used for successful
actions. Success and error feedback have identical white text, typography,
opacity, alignment, and positioning. Feedback remains until the next status
message; there is no placement-error overlay, box, icon, or timeout. Keep
accessible input instructions associated with that shared status area.

Blur, Escape, or an outside tap discards a draft without saving or changing Undo.
Restore only the edited cell on blur so another cell's pending click or keyboard
focus target stays intact. Selecting another empty cell starts a fresh draft;
tapping the active input keeps its draft. Starting number entry dismisses a pending reset confirmation.
New Game / Reset remains accessible and requires explicit confirmation.

Keep the balance hidden behind the compact $ receipt button, and show Street and goal feedback when applicable.
The existing contextual status appears directly above the board as centered,
small white text without a panel or background. Its wrapper reserves 2.5rem
for two lines even while the text is hidden during cell actions, so message
changes do not shift the board. Longer messages wrap; if more than two lines
are needed, the text scrolls within the reserved height rather than covering
the board. Invalid attempts leave the board, save, and Undo unchanged.
Currently frozen cells retain `assets/icecube.png` beneath a readable value,
with bounded dimensions and an accessible status label. Thawed cells have no
Prime ice cube and retain their quiet Thawed marker and permanent zero-point
label. Attack-Iced cells use `assets/icecube2.png` with the same contained sizing
and a readable value; attacked thawed cells retain their Thawed marker. Accessible
labels distinguish Attack Ice and its blocked placement/Street support.

Remove the obsolete roll, external-number, Schnapszahl, stealing/removal, and
counter markup, handlers, and exclusive styling. Broader visual redesign is
deferred. Coordinator tests use a document/storage test double; browser
automation, screenshot tests, and viewport tests are excluded from this task.

## 7. Undo correction

Show one subtle circular ↶ button immediately left of the $ receipt button. Keep it in the
same position when disabled, with a subdued appearance and a mobile touch
target of at least 48px. Use an accessible label/title, “Undo last move,” and
no permanent descriptive text or external icon library.

Only successful placement, state-changing Freeze/Unfreeze/Move, or confirmed bid publishes a
new pre-action snapshot. Failed
attempts and canceled entry preserve the existing snapshot. Undo immediately
restores the complete board, pre-action spending, and transaction history, saves it, recalculates score/Street/goal displays,
and consumes the snapshot. Clear selection, input, and validation feedback before
rendering the restored state. Close any cell actions as well. Prime and Attack
Ice visuals follow the restored complete board.

A disabled Undo does nothing, including leaving any open draft alone. An
available Undo safely closes an open draft and any pending reset confirmation.
There is no confirmation dialog, Redo, history screen, or multi-step stack.
Occupied values are readonly, and there is no direct value correction interface.

## 8. Physical Challenges and manual Attack Ice

Before a normal dice turn, a player may challenge another player and may still
take their normal dice turn after the Challenge concludes.
Both secretly bid an integer from 0 through their current available Score and
spend their confirmed bid regardless of outcome. They compare screens physically:
the higher bid wins. Equal bids have no winner; both players bid again until
their bids differ. Accounting for already confirmed bids in tied rounds remains
unspecified. Every winner chooses **exactly ONE** action: Freeze an eligible
opponent cell **OR** Unfreeze an eligible cell of their own. The same options
apply regardless of who initiated the Challenge. A new Freeze replaces/moves any existing
Attack Ice on that board. Full mechanics are in game-rules.md section 6.

The app records local bid spending and manual Freeze/Unfreeze actions, trusting
the table for roles, comparison, winners, and consequences. It adds no permission
system, player selection, turn tracking, dice controls, or networking.
The contextual panel contains only its cell label,
one Freeze/Unfreeze button, and Cancel; it is hidden outside selection. Outside
taps, Escape, switching to number entry, Undo, or reset close it. Selection and
cancellation never save or change Undo. After an action, automatically save,
close selection, and recalculate score, Streets, and goal.

Normal values retain base points under Attack Ice; thawed values stay at 0.
Attack Ice temporarily prevents placement support, Street eligibility, and D7
goal detection. Unfreeze restores underlying behavior without permanent damage.
Freeze on another eligible cell atomically moves the single overlay and creates
one Undo snapshot. There is still no Edit or number-removal feature.

A compact Challenge button sits beside Undo in the existing header. It opens a
native modal dialog over a dimmed, visible game without changing page layout.
Show MAKE YOUR BID, the unchanged transparent `assets/bid.png`, a large dark
numeric input centred in the illustrated circle, CONFIRM, and secondary CLOSE.
Keep the banknote dominant with no surrounding card. Its two-sided flip preserves
the original number placement and dialog layout.

Validate whole, nonnegative, affordable bids on confirmation, including 0; blank,
fractional, negative, or unaffordable entries show a concise reserved-space live
message without changing state or Undo. Confirmation spends once, saves, updates
the receipt balance, records one expense, locks the visible input, disables repeated confirmation, and
keeps the dialog open with the bid concealed. Move focus off the input to dismiss the keyboard.
Close/Escape before confirmation cancel; afterwards they close without refund.
Backdrop clicks do nothing. Restore focus to Challenge on close. Reopening starts
a new blank bid using the then-current Score. Native dialog semantics isolate
keyboard focus and prevent using underlying Undo until the dialog closes.

Unfinished/revealed bids and open dialogs do not survive reload; spending,
confirmed-bid history, and the exact pre-action Undo do. There is no second resource, debt, automated
winner, automatic Freeze, or bid cooldown/limit.

V3 scoring doubles the base contribution of normal 11/22/33/44/55/66, without
adding cell state. Prime-frozen/thawed cells remain at 0;
Attack Ice retains the doubled underlying contribution. A Street is four
successive possible dice numbers in a horizontal A–D row, ordered using digits
1–6 (for example 56 → 61), with unchanged normal/no-ice eligibility. It doubles
each scoring contribution: ordinary cells receive 2x and repdigits receive
2x2 = 4x, without another additive bonus. The same pure multiplier helper drives
scoring and the cell indicator. Reuse the existing Street marker's typography,
size, corner position, and styling: show one 2x or 4x per applicable cell, never
two markers. Ordinary non-Street cells and zero-scoring cells have none. An
Attack-Iced normal repdigit retains 2x while its row loses all Street multipliers.
Score stays derived and supplies the existing Challenge maximum. Existing
scoring deductions and one-step Undo semantics remain unchanged; version 8 also records bid history.

The bid input keeps its exact centre and transparent dark appearance, with a
larger font scaled to the banknote and enough width for four digits. The header
Challenge button has a white outline and a restrained rounded rectangle shape,
retaining its position, 48px touch height, and transparent fill.

The Frosty Dollar uses unchanged 2048 × 2048 illustrations: `assets/bid.png`
for entry and revealed bids, and `assets/bid_front.png` for the covered face.
Align their painted artwork within the existing square frame without cropping
or distorting either source. CSS perspective, preserved 3D transforms, and
backface visibility rotate the note 0° → 180° on confirmation (500ms). It stays
covered indefinitely. The cover is a native reveal button supporting touch,
mouse, Enter, and Space, with “Tap to reveal” / “Zum Aufdecken tippen” according
to the current Rules language. A tap starts 400ms of very subtle anticipation,
followed by 800ms of increasingly noticeable, irregular horizontal trembling
(maximum 4px), with the amount fully covered. Trembling then stops and the note
continues in the same direction to 360° over 700ms, revealing the locked bid.
The reveal sequence totals approximately 1900ms; confirmation remains 500ms.

Hide the bid face completely while covered, disable and exclude its input from
focus/assistive access, and show no amount on the cover or in status/limit text.
Only the bid face contains the number. Disable repeated reveal activation;
revealing and animation callbacks never spend, save, or create Undo. The existing
confirmation guard and pure game operation remain the only point-spending path.
Closing at any phase cancels pending animation work without refunds; reopening
resets to an empty editable 0° face. Visual phases are temporary and never saved.
Reduced motion skips shake/rotation, switches faces immediately, and still
requires an explicit reveal. Both illustrations and the independent visual
controller are precached; service-worker activation and existing bid mechanics stay unchanged.

## 8.1 Frosty Fresh Goods receipt

The visible currency name is Frosty Dollars, using whole-dollar formatting such
as $25 and $1,420. Keep board numbers unchanged. Replace only the header's
permanent Points value with a white 48px $ button labelled “Open Frosty Fresh
Goods receipt,” beside the unchanged title, Challenge, and Undo controls.

Open a native modal with a dark backdrop, a small close control, Escape/native
cancellation, and backdrop dismissal. Restore focus to the $ button. Native
modal semantics isolate focus and board interaction; coordinator guards also
reject background game actions while the receipt is open. Opening and closing
never save, spend, or create Undo. The receipt starts closed after every launch,
including at the local goal, and reaching D7 does not open it automatically.

On each new opening, choose independently and uniformly among `assets/receipt.png`,
`assets/receipt2.png`, `assets/receipt3.png`, `assets/receipt4.png`,
`assets/receipt6.png` (Frosty Gardens), and `assets/receipt7.png` (Frosty Charity Run),
with a 1/6 probability for each design.
Consecutive repeats are allowed. Keep the design stable while the receipt is
open; rendering or repeated open calls do not draw again. The choice is temporary
presentation state, independent of the board, balance, spending/history, meadow,
language, and saved game. Preload all six images and assign the new source while
the modal is still closed, before the existing entrance animation.

All six unchanged PNGs are 1440 × 3200 with matching paper bounds, RECEIPT heading,
separator positions, blank content region, barcode, and bottom edge. Their logos
and footer wording differ, without requiring layout changes. Reuse one image and
the existing shared overlays at the natural aspect ratio. The actual blank centre
spans approximately x=302–1181 and y=1216–2032. Place BOARD VALUE, the transaction list, and BALANCE (SALDO) in that
bounded region. Do not repeat text baked into the illustration. Use local
American Typewriter with Courier New/Courier/monospace fallbacks, without downloads.

BOARD VALUE uses `getScoreBreakdown`'s base sum plus Street bonus, including all
repdigit, combined 4x, and ice effects. BALANCE (SALDO) is the same breakdown's clamped
score after `pointsSpent`, exactly matching the Challenge maximum. Derive both
on every render/open. Existing aggregate spending may exceed itemized history;
show that remainder as earlier spending, never as invented Challenge records.

Use the same Challenge transaction names on all six designs; do not theme them
after the illustration. Show chronological expenses as “1x Challenge #01” and “-$50” with flexible CSS
dotted leaders. Transactions follow BOARD VALUE directly, with no separate
CHALLENGE HISTORY heading, outcome symbols, outcome fields, or winner inference.
The independent devices cannot reliably associate results with these expenses.
Add no manual outcome selector, opponent tracking, or synchronization.

Only the history list scrolls inside the fixed blank region, keeping BOARD
VALUE and the balance outside that list and away from printed footer/barcode artwork.
Keep transaction rows regular-weight American Typewriter, approximately 14–15px
on typical phones and smaller on narrow screens. BOARD VALUE uses approximately
15–16px. Keep BALANCE (SALDO) on the left and its larger black amount on the
right of one horizontal row. Use regular-weight type, with a responsive
13–18px label and 20–28px amount so narrow phones remain readable. The final
row alone can use the blank paper farther right; retain the existing image,
other rows, and scrollable transactions. Add no panels or background fills. The $
button retains its 48px target and transparent background, with a 1px white
circular outline. Existing title, Undo, Challenge, and header positions stay intact.

Behind the amount, use the unchanged hand-drawn `sale_orange.png` for balances
$0–99, `sale_yellow.png` for $100–499, `sale_green.png` for $500–999, and
`sale_pink.png` for $1000 and above. Select from the same authoritative balance
on every receipt render; never use BOARD VALUE or persist a sticker choice.
All four 1024px-square PNGs are precached and retain their natural aspect ratios.
Rotate only the oversized illustration by -8deg in its own clipped layer.
Keep the horizontal amount outside that clip, above the sticker, and readable.
Allow right-side spikes beyond the paper while bounding the decoration away
from the label, transactions, thank-you message, and barcode.

Use a restrained 450ms downward entrance on the receipt alone; reduced motion
shows it immediately. Keep existing Challenge flips unchanged. Reset clears
history and spending, restarts numbering at #01, and preserves Rules language.
Precache all six receipt artworks and the receipt controller in the existing versioned shell.

## 9. Technical constraints

The focused board polish uses a very translucent white outer sheet (12%) with
a thin translucent border and a restrained 3px backdrop blur, including Safari's
prefixed filter. Individual cells use 80% opacity for readable values and
distinct empty/normal/start/goal states; selected cells use 94% with their existing
border treatment. Opacity and blur controls are grouped in style.css.

Column labels remain visually hidden, with internal A–D coordinates unchanged.
A1 and D7 share the same 2px black (`#000000`) border in empty, occupied, selected,
and ice states. Reuse their existing border width so cell geometry, individual
glass backgrounds, the D7 flag, and all other rendering remain unchanged.
Street highlighting
and feedback remain; the existing corner marker style shows each cell's 2x/4x
without adding a column or changing cell height. Ice assets, their fit/clipping,
and number stacking are unchanged. This is presentation only: placement, Prime
Ice, Attack Ice, Undo, score, goal, storage, reset, and background composition
retain their existing behavior. Manual iPhone evaluation remains pending.

The experimental background pass uses the supplied background_sky.png and
background_meadow.png unchanged as non-interactive decorative CSS layers.
On each fresh page load, a small synchronous head script chooses equally among
`background_meadow.png`, `background_meadow_desert.png`,
`background_meadow_snow.png`, and `background_meadow_sea.png` before the stylesheet
loads, with a 25% chance for each. All four are
1440 × 3200 and use the same width/automatic-height sizing without distortion.
Only the meadow image custom property changes; horizon, positioning, scaling,
standalone adjustments, sky, controls, and the solid green continuation stay
unchanged. The choice lasts for that document, never changes during game/UI
actions, and is not persisted. All four illustrations are precached offline.
The sky stays fixed; the meadow spans the full document height and scrolls with
the page so its ground continues below the fold. The meadow's painted horizon is anchored independently of sky position
and both scales; controls are grouped at the top of style.css. The composition
stays behind the game sheet even when entry or reset makes the page longer.
The second targeted iteration moves the horizon from 72% to 95% of the stable
viewport height. The header has no opaque backing: title, the $ receipt control,
and Undo are white over the sky. Undo retains its 48px target, transparent fill,
and a subdued disabled appearance. UI outside the focused board polish remains.

The third targeted iteration keeps the 95% stable-viewport horizon unchanged.
Theme metadata and root/body canvas fallbacks use the sampled upper sky color,
`#03020e`. The page and decorative layers have a `100dvh` minimum with a `100vh`
fallback, while composition still uses `svh`. Existing safe-area padding stays.
If the meadow PNG runs out, its full-page underlay continues with matching green
`#24691e`, avoiding a light canvas beneath the scene. The reset confirmation
retains its existing appearance and behavior.

Active Prime Ice and Attack Ice share 100% width/height and `object-fit: fill`,
intentionally stretching the artwork to the cell proportions instead of scaling
and cropping it. `--ice-image-fit` controls this experimental fit centrally.
Both images remain clipped inside existing cell bounds, behind numbers and
markers. A non-replaced `.board-cell__ice-layer` spans each cell with absolute
`inset: 0` and z-index 0, establishing a box for its 100%-sized block image
without relying on a replaced image's positioning inside a flex button. Numbers,
status labels, and multipliers use z-index 1 above it. Both original PNGs and
their cell-filling appearance remain unchanged. Cells, grid dimensions, interactions, and Prime-thawed treatment do not
change. General visual redesign and PNG optimization remain deferred.

The main page's Rules / Regeln area is the primary onboarding experience and
contains only the existing interactive How-to-Play tutorial and language selector,
with no card surface. Preserve its spacing, signpost anchor, disclosure, twelve
steps, animations, and camera system. Keep the game region and meadow controls
unchanged; removing Full Rules leaves no empty disclosure or illustration wrapper.

Complete illustrated rules are available separately at `/rules.html`, reached
through a small underlined FULL RULES / ALLE REGELN footer link below the original
cowboy/contact illustrations. Keep those illustrations in their existing grid row
at their existing sizes. The link spans a separate row and has a 48px touch target.
Use ordinary `./rules.html` navigation, with no routing or game-state changes.

The dedicated page uses the existing dark-blue canvas, fonts, white text, and
illustration/selector/modal styling. It has a Full Rules / Alle Regeln h1, the
existing selector, the illustration and Additional Rules hit area, and an underlined
BACK TO GAME / ZURÜCK ZUM SPIEL link to `./index.html`. Keep normal body/safe-area
insets, 96% content width capped at 36rem, responsive images, and no meadow,
game, dice, receipt, or tutorial components. Only the shared Rules controller and
PWA registration initialize here. Display `assets/Rules.png`
for English and `assets/rules_german.png` for German, without cropping either.
Use each image's actual width/height to reserve space, with responsive width
and automatic height. Do not assume matching aspect ratios or internal margins.
Keep both artworks unchanged and provide descriptive alt text and language.

Place the unchanged `assets/language_select.png` directly below the heading at
40% container width, bounded by 7rem and 12rem. Transparent semantic Deutsch
and English buttons cover its two halves, with at least 48px touch targets,
native keyboard activation, `aria-pressed`, and a visible keyboard focus ring.
Keep the selector unframed and the existing signpost anchor/navigation intact.

Only the active language's letter bodies receive icy light blue `#66D9FF`.
Use precise transparent overlays `language_de_fill.png` and
`language_en_fill.png` below the original colorful outlines. Preserve D's hole,
E's cutouts, and N's shape; do not tint the original or use rectangular fills.
Generate these assets during development, with no runtime image processing.

English is the default. The independent `frosty-dice.rules-language` preference
stores only `en` or `de`; invalid or inaccessible preferences fall back to
English, and blocked writes do not prevent switching during the visit. Reset,
Undo, Challenge, game saves, and save version 8 remain independent. Switch
in place without navigation, scrolling scripts, or fixed-height clipping.
The existing full-page meadow layer and green fallback cover the image and
spacing without repeating plants, moving the horizon, or altering game UI or
JavaScript. No image-specific tests or browser automation are required.

The yellow Additional Rules box at the bottom of either illustration has its
own transparent semantic button. Keep the rest of the image non-interactive.
Measure each image independently: both current 2480 × 3508 sources have a
box at x=73, y=2754, width=2312, height=696 pixels. Convert those coordinates
to percentages of that image's own dimensions so responsive scaling stays
aligned. Keep the original artwork unchanged. A small magnifying-glass hint
sits below the lower-right edge without covering text or enlarging the hit area.

Open a native modal with the selected Rules language and readable English
or German paragraphs reflecting the current confirmed rules. Use Additional Rules / Zusätzliche Regeln,
white 18px text, comfortable paragraph spacing, a restrained dark frosted panel,
and a dark translucent backdrop. Respect safe areas and permit the text to
scroll while the close button remains available. Close with ×, backdrop tap,
Escape, or native cancellation. Keep focus inside via native dialog behavior,
return focus to the box, and restore the previous page styles and scroll
position after temporarily locking background scrolling. Do not alter the
normal scrolling behavior outside the modal.

The popup retains the readable illustrated rules and reflects the clarified
Challenge timing, tie rule, and identical one-action winner privileges. Original
illustrations stay unchanged. Opening/closing the modal never writes the game or language
preference. Embed all text in the existing rules controller for offline use.

### Interactive How to Play and Full Rules

Keep the existing Rules signpost anchor and language selector on the main page.
HOW TO PLAY / SPIELANLEITUNG is the only Rules disclosure, initially collapsed.
Full Rules is a footer link to the separate page, where the original illustration
is immediately visible and its Additional Rules interaction remains intact.
Opening How to Play immediately displays Step 1; reopening preserves the current
step for the page session. There is no tutorial preference or game-save change.

Both pages reuse `frosty-dice.rules-language` and one Rules controller. The
controller updates whichever page's elements exist and emits a small language-change
event for the tutorial and Digital Dice. Initial language comes from the selected
semantic language control, never a hidden or absent Rules image. Page-show/storage
restoration refreshes changed preferences, including Safari Back-cache navigation,
without writing a game save or resetting tutorial/dice state. Localized headings,
footer/back links, illustration, and Additional Rules use the same preference.

The tutorial has exactly 12 bilingual steps, Back/Next navigation, twelve progress
dots, and a final LET’S PLAY! / JETZT SPIELEN! action that scrolls to the real board
without resetting it. Language changes use the existing Rules preference and do
not reset progress or restart animations. All meaningful text follows that language.

One canonical 4×7 example board is shown through dynamic camera viewports: full
board at the beginning/end, enlarged upper rows for placement, and paired cropped
boards for Challenges. Related placement steps preserve cell size. The viewport
physically clips approximately 45% of peripheral row 3, while relevant cells remain
fully visible. Camera transitions last 400ms; reduced motion shows settled scenes.

Example snapshots are reconstructed using the existing pure placement and scoring
helpers, starting A1=12, B1=24, C1=46, C2=46, B2=35. The last connection is legal
through C2 despite the mismatch above. A validated later continuation reaches D7.
Player A bids $30, Player B bids $50, and B chooses exactly one demonstrated action:
Freeze A's B2 or Unfreeze B's pre-existing Attack Ice at B2. Both branches preserve
the same later $1,114 board value, $30 spending, and $1,084 balance. The example uses
unequal bids; tied-round accounting remains unspecified. A fixed existing receipt
illustration shows this calculation after the goal, with Board/Receipt view controls.

The tutorial intentionally does not mention or demonstrate Prime Ice. Full Rules
and Additional Rules retain their complete explanations. Tutorial scenes, dice,
bids, receipt, timers, and animation state are independent of the real board, score,
Challenges, Undo, receipt, Digital Dice, and local game persistence. Navigation
cancels obsolete work with generation guards and reconstructs deterministic scenes.
Animations settle without automatically advancing steps. Reuse existing artwork;
precache the new native modules and scoped stylesheet with the existing PWA strategy.

Illustrated landscape controls replace the former New Game / Reset and Rules
text row, with no remaining row spacing. The supplied transparent PNGs remain
unchanged: `reset_button.png` sits inside the existing `#new-game` button, and
`rules_button.png` sits inside the existing `href="#rules"` anchor. Accessible
names are “Reset game” and “View game rules”; images have empty alt text. Keep
all existing reset handlers, confirmation, persistence, and Undo semantics.
The confirmation panel remains below the board, hidden until requested.

An absolute, non-intercepting meadow control layer starts at the end of main's
existing horizon-height reservation, or after exceptionally tall game UI.
Its depth equals the scaled PNG's painted
ground (941/1440 of its displayed width). The signpost keeps its existing 3%
top anchor and 80% horizontal center, with its width reduced to 80% of the
previous size. The snowman is centered at the layer's top (0% Y) and 42% across,
placing it higher than the signpost and closer to the horizontal center, at its
unchanged size. This adds no layout height and leaves the sky, horizon,
continuation, board, and actual Rules section styling/markup unchanged.
Use no viewport JavaScript.

Central CSS tuning properties are `--rules-signpost-x`, `--rules-signpost-y`,
`--rules-signpost-size`, `--reset-snowman-x`, `--reset-snowman-y`, and
`--reset-snowman-size`. X values refer to horizontal centers; signpost Y refers
to its top and snowman Y to its center. Sizes preserve aspect ratios and are
capped at 24%/45% of the game column to keep tap areas separate. The signpost's
large transparent margins are excluded from its hit area with CSS; all drawn
pixels, including the bird above the signpost, are retained. Compensate the
expanded upper bounds so the original signpost keeps its approved visual size
and position. Keep the entire snowman image visible. Add no card, fill,
border, shadow, or visible label; show a white outline only for keyboard focus.

The signpost links directly to `#rules`, retaining its 1.5rem scroll margin.
Smooth scrolling remains enabled only for `prefers-reduced-motion: no-preference`;
otherwise navigation is instant. Add no return link, sticky navigation, or
gameplay state for this link.

A plain, centered footer follows the Rules section with the unchanged
`assets/surfing_cowboy.png` on the left and `assets/contact_information.png`
on the right. Use a two-column grid in a 1:2 ratio, centered vertically, with
a responsive 0.25rem–1rem gap. Use 96% width, capped at 36rem. Both images
retain their complete canvases, natural aspect ratios, and transparency,
without cropping or overlapping. Leave a 2rem gap above the footer (collapsing with the Rules
section's existing bottom margin) and 1rem below, plus the existing body safe-area
padding. The artwork's transparent margins provide additional breathing room.
Add no card, background, border, or duplicated contact text. The small Full Rules
link occupies its own grid row without moving/resizing the illustration row.
The existing full-document meadow/green continuation extends behind the footer
and bottom spacing; do not repeat or reposition the landscape or meadow controls.

The header's numerical score is visibly labeled Points, with unchanged scoring,
white text, Challenge/Undo controls, and layout. Its h1 uses a transparent crop
of the supplied `frosty_dice_title.png`, preserving the original source. Keep
the complete lettering and colors, omitting surrounding padding and the isolated
lower export speck. The derivative is 1674 × 1187 with 4px breathing room;
display it at `clamp(4.5rem, 24vw, 6rem)` wide and automatic height, with alt text
Frosty Dice. Add no new header surface or controls.

Use HTML, CSS, and vanilla JavaScript with relative asset/module paths. Keep
rule logic independent from DOM code and storage mechanics in storage.js.
Introduce no dependencies, framework, build system, backend, or multiplayer networking.

## 9.1 Optional Digital Dice Machine

Display the supplied cabinet, separate rotating lever, stationary mounting
bracket, and six illustrated faces without modifying any PNG. The component
sits in normal flow below `main` and above Rules, with green breathing room
before and after it. Existing horizon, meadow variants, snowman/signpost anchors,
board, and standalone PWA adjustments remain unchanged. Its responsive
1800 × 1900 coordinate system includes the lever's full swing and the redesigned
2048 × 2048 illustration's sign, raccoon, money bag, and right-hand decoration,
with a maximum width of 32rem. Offset the unchanged PNG -260 source pixels to
omit only transparent margins, without distorting it. Four dice always occupy
one vertical column. Central CSS variables
locate the cabinet, display, dice region, lever, and bracket. Align the lever
and stationary bracket to the new frame, with an independent 44px-wide invisible
touch area so narrow screens do not enlarge the lever artwork out of alignment.

At widths up to 36rem, cancel the existing page insets for the dice section so
its clipping panel reaches the viewport edge, without using `100vw` or creating
scrollbar overflow. Keep the illustrated machine at its previous content width
and height. Translate the complete composition horizontally using the source
width and measured shorter pole tip, x=2019. The upper pole ends at x=2032,
with 16 transparent pixels remaining in the PNG. Only its extra 13px tip extends
offscreen; both poles meet the viewport edge. Cabinet, sign, raccoon, bag, and
aligned lever remain visible. Wider screens retain the existing centered
composition and full painted bounds. Vertical placement and landscape anchors
remain unchanged.

Keep a small semantic disclosure button directly above the machine, labeled
“DIGITAL DICE” / “DIGITALE WÜRFEL” with a state chevron, `aria-expanded`, and
`aria-controls`. Default to collapsed, restoring only an explicitly saved
expanded preference from the separate `frosty-dice.digital-dice-expanded` key.
Store visibility changes as `true`/`false` strings; missing or malformed values
default to collapsed. Catch unavailable storage and allow session toggling.
This preference is independent of the game save and Rules language.

Animate wrapper height and opacity over 300ms without scaling or changing the
illustrated machine. The collapsed panel reserves no height; Rules follows
upward naturally. Keep its DOM mounted and remove hidden controls from focus
and accessibility navigation using `inert` and `aria-hidden`. Return focus to
the toggle if needed. Collapse never changes dice, selections, roll timers, or
outcomes: an ongoing roll completes normally while hidden. Language changes
translate the toggle without changing visibility. Reduced motion skips the
disclosure transition as well as the existing dice animations.

The `js/digital-dice.js` module owns only temporary dice state and UI.
Show neutral, unselectable 1/2/3/4 placeholders immediately without an initial
random draw. Leave the upper selection area empty until a die is selected;
the English-only CHOOSE TWO sign is already part of the illustration and is
not recreated or translated in HTML/CSS. The lever is the only roll control: a semantic button supporting
tap/click, native Enter/Space, and a short downward Pointer Event pull. Capture
outside release, handle cancellation, and suppress the synthetic click following
a handled pointer gesture. Only the lever restricts touch scrolling.

Generate four independent final values at roll start. Prefer
`crypto.getRandomValues` with rejection of Uint32 values at or above 4294967292
before mapping modulo six. If Web Crypto is unavailable, use
`Math.floor(Math.random() * 6) + 1`. Animation never determines or redraws the
outcome. Stable die IDs 0–3 distinguish equal values throughout selection.

Rotate the lever at its lower-right pivot through approximately -32 degrees,
with a restrained +2-degree spring-back over 480ms; the mounting bracket stays
still. Preload all six faces, reuse the four image elements, and cycle faces
every 80ms. Stop top-to-bottom at 700/1000/1300/1600ms. Lock the lever and
selection during rolling. Cancel scheduled work with generation guards on
completion, a replacement roll, or teardown; leaving the page settles the
current display. Reduced motion shows the final result immediately, without
rapid cycling, lever animation, or selection transitions.

After rolling, choose up to two individual dice. Fade/shrink a chosen die for
180ms, then hide it; keep its ID in selection order. Show each chosen value as
its own accessible deselection button in the upper display. Selecting duplicate
values and deselecting either one restores the correct die. A third selection
is silently ignored. No additional confirmation or Show button is required.
With no selections, use the full measured 600 × 1380 interior, starting at
source y=330, for four evenly spaced dice. Each die is 300 source units square
instead of approximately 217; initial placeholders, rolling, and stopped dice
all use that same layout. No selection-text area is reserved in this state.
When values are selected, measure their actual text/button height plus a 0.25rem
gap and subtract only that space from the available region. The three or two
remaining dice redistribute and resize within those bounds using the existing
250ms transitions. Measure again on resize or language changes; last deselection
and a new roll reclaim the full height. Individual stopping events never change
the four-dice geometry. Reduced motion disables the region transitions too.
The outer wrapper never changes size. The two remaining dice stay visible for
other players until selection changes, another roll, or reload.

Use the existing Rules language preference and controls. Read their restored
language after document initialization, then update the machine labels on that
same toggle: “CHOSEN:” / “GEWÄHLT:” only while values are selected. Hide and clear
the selected-value label when the last die is deselected or a new roll begins;
show no replacement instruction, placeholder, or visible empty text box.
Values and their order are unchanged by language switching. Keep accessible
localized labels, native controls, visible focus, and usable touch targets.

The machine imports no game, scoring, storage, Challenge, or receipt module. It
does not form or place board numbers, validate manual entry against dice,
change Score/Frosty Dollars, modify Undo/history/ice, or track turns/opponents.
Players continue entering numbers manually. Do not save dice or selections;
reload returns the machine to its placeholders without changing the saved game
or storage schema. Precache the module and all nine original illustrations
within the existing PWA snapshot and update strategy.

## 10. Optional PWA

Production is the custom root domain https://frostydice.com. Add a standalone
manifest with ID/start URL/scope `/` and the existing dark sky color `#03020e`.
Provide 192/512px PNG icons and an Apple 180px touch icon resized without
cropping or changing the existing opaque source artwork. No maskable icon is
declared because the artwork extends to the edges. Apple standalone metadata
uses a black status bar with content below it; preserve the viewport and
normal-browser styling.

Installation through the browser is optional. Add no install gate, prompt,
button, accounts, backend, push, analytics, cloud saves, or new gameplay.
Registration is independent of game initialization and fails silently. Existing
game code, UI, localStorage, Undo, and reset remain independent of PWA installation.

Cache the complete static application, including `/rules.html`, its scoped page
stylesheet, and all lazy Rules/contact/bid/ice artwork. Each installed/browser context needs an online visit long enough for
the required batch to finish. Offline root/index navigation uses cached index;
Rules navigation uses cached rules.html, including either page's query variants.
Cache-first resources stay in one versioned snapshot. Online launches check
the worker for updates without the HTTP cache. New versions precache fresh
files, wait for existing windows/tabs to close, then activate, clean only older
Frosty Dice PWA caches, and claim clients. No forced reload interrupts a game.
Maintainers must bump the worker cache version for every changed cached file
and keep the precache URLs aligned with actual module/asset query strings.
Missing cache entries fall back to network; unrelated requests pass through.
For these fixed static URLs, cache lookup ignores `Vary` request-header
differences so conditional image requests reuse the precached artwork offline.
Exact paths and query-string versions still apply.
Precache both rules illustrations, the language selector, both fill overlays,
and the independent rules controller so language switching works offline.

Standalone display mode uses an 85%-of-stable-viewport meadow horizon to
compensate for the missing browser bars. Normal browser mode retains 95%.
Keep the existing meadow-relative control anchors, artwork sizing, sky, and
board geometry unchanged; do not introduce viewport JavaScript.

Game data remains in localStorage, never the Cache API. Safari and an installed
iOS Home Screen app use separate website storage, so a Safari game is not
automatically copied at installation; neither store is cleared by the PWA code.
Test initial caching and persistence within each context. No state migration
between contexts is implemented. Standard browser storage eviction still applies.

The normal static Python server works on localhost; real-device PWA tests use
HTTPS. CNAME and GitHub Pages deployment configuration are unchanged. Initial
manual iPhone testing confirmed installation, standalone launch, local state,
and offline gameplay. Recheck conditional artwork and the standalone meadow
correction on the device; Android validation remains pending.
