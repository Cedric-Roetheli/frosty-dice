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
- Let players manually apply, remove, or atomically move one temporary Attack Ice.
- Calculate normal cell contributions (repdigits doubled), doubled again for scoring Streets, minus confirmed bids; exclude all ever-frozen values.
- Detect the goal only when D7 is occupied and usable (no Prime Ice or Attack Ice).
- Save and restore the local board and permanent damage status.
- Offer one-step Undo of the last successful placement or Attack Ice action, restoring its complete prior board.
- Offer a secret point-bid Challenge dialog; persist confirmed spending and include it in one-step Undo.
- Allow a confirmed new-game reset.
- Remain mobile-first, accessible, static, and GitHub Pages compatible.
- Offer optional home-screen installation and offline play after complete local precaching, while keeping the normal website immediately usable.

There is no roll counter, number-origin tracking, number-removal action, opponent
state, synchronization, backend, database, account, digital dice roller, cloud
save, or replacement special action for repeated-digit numbers.

## 4. Local game state

Canonical state is `{ board, undo, pointsSpent? }`. Missing `pointsSpent` means
zero; confirmed bids store a nonnegative integer. Each board has seven rows of four cells;
occupied cells retain a value and a normal/frozen/thawed status. At most one
cell in each board is currently frozen. Thawed cells are usable but permanently
scoreless. These statuses are authoritative historical data.
An optional `attackIce: true` flag on an occupied cell is an independent
temporary overlay. Absence means no Attack Ice. At most one cell has that flag;
it cannot coexist with `status: "frozen"` on the same cell. Removing the flag
never changes the underlying value or Prime status.

`undo` is either `null` or `{ board, pointsSpent? }`, a deep-cloned pre-action
board and spending including Attack Ice and every Prime status. Confirmed bids
include explicit pre-bid spending, even when zero.
The snapshot never contains an older Undo. Score, Streets, legal targets, and
goal are derived and not persisted. Selection, number drafts, unfinished bids,
the revealed bid, and the open/confirmed dialog state remain temporary UI data.

Version 7 saves the board, spending, and this one nullable snapshot together.
Validate both boards, reject recursive history or a snapshot that does not
precede the current state by one legal placement, Attack Ice action, or affordable
confirmed bid, and retain canonical cell
statuses without legacy boolean flags.

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
Attack Ice action, confirmed bid, or Undo saves version 7. Consuming Undo saves `undo: null`; confirmed reset clears
the saved game entirely. Missing saves and storage-access/quota errors must
not crash the application. Data stays on the local device.

## 5. Placement and feedback

A placement changes the board only after the shared rule validator accepts it.
Every empty cell can be selected, including cells that cannot support the next
move. Selection and typing reveal no information about placement legality.
Only a completed two-digit entry calls the shared guarded placement operation. There are no
suggested numbers, precomputed target lists, or legal-cell indicators.

An illegal entry leaves the board and saved data unchanged. Restore the empty
cell and show the concise reason in a temporary overlay; the player can tap
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
Only empty A1 and D7 show small centered Start/End hints. An active inline input
temporarily replaces the hint; cancellation or rejection restores it. The hints
also return if Undo restores the empty cell; occupied
cells show their number and applicable state markers. Other empty cells have no
visible text. The hints neither intercept taps nor enter game state. The visible
board heading and row-number gutter are removed. Four column headings display P/L/A/Y, mapped
only in the UI to internal A/B/C/D. The grid has exactly four cells in each of
seven rows, centered without a spare gutter. Accessible column/cell labels and
number-entry coordinates retain A1–D7; saved games require no migration. Occupied
normal, frozen, and thawed cells cannot open number input or receive placements.
Normal and thawed cells instead expose a temporary Attack Ice action below the
board: Freeze if eligible, Unfreeze if currently Attack-Iced. Prime-frozen cells
are disabled and offer no Freeze. Selecting an empty cell replaces its button
with a native text input in the same cell, using its existing glass appearance
and centered 22px number typography. Accessible labels retain the internal
coordinate. Selection is not a statement that the move is legal.

There is no separate entry bar, form, Place/Cancel control, or reserved space.
Keep the board directly below the header, without changing its dimensions or
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

Rejection restores the empty cell and shows the existing concise reason as a
small, non-interactive overlay inside the board area, opposite the attempted
cell's half. The overlay occupies no layout space, disappears after 4.5 seconds,
and clears on the next selection or action. Keep an accessible live status and
input instructions. No error modal or additional controls are needed.

Blur, Escape, or an outside tap discards a draft without saving or changing Undo.
Restore only the edited cell on blur so another cell's pending click or keyboard
focus target stays intact. Selecting another empty cell starts a fresh draft;
tapping the active input keeps its draft. Starting number entry dismisses a pending reset confirmation.
New Game / Reset remains accessible and requires explicit confirmation.

Keep the score compact, and show Street and goal feedback when applicable.
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

Show one subtle circular ↶ button immediately left of Score. Keep it in the
same position when disabled, with a subdued appearance and a mobile touch
target of at least 48px. Use an accessible label/title, “Undo last move,” and
no permanent descriptive text or external icon library.

Only successful placement, state-changing Freeze/Unfreeze/Move, or confirmed bid publishes a
new pre-action snapshot. Failed
attempts and canceled entry preserve the existing snapshot. Undo immediately
restores the complete board and pre-action spending, saves it, recalculates score/Street/goal displays,
and consumes the snapshot. Clear selection, input, and validation feedback before
rendering the restored state. Close any cell actions as well. Prime and Attack
Ice visuals follow the restored complete board.

A disabled Undo does nothing, including leaving any open draft alone. An
available Undo safely closes an open draft and any pending reset confirmation.
There is no confirmation dialog, Redo, history screen, or multi-step stack.
Occupied values are readonly, and there is no direct value correction interface.

## 8. Physical Challenges and manual Attack Ice

Instead of a normal turn, the active player may challenge any other player.
Both secretly bid an integer from 0 through their current available Score and
spend their confirmed bid regardless of outcome. They compare screens physically:
the challenger must bid strictly higher, so ties favor the defender. A winning challenger
may remove their own Attack Ice **AND** apply Attack Ice on the loser's board.
A winning challenged player chooses **ONE**: remove their own Attack Ice **OR**
apply it on the challenger's board. A new Freeze replaces/moves any existing
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
Keep the banknote dominant with no surrounding card. The component can accept a
future animation near the heading without adding a placeholder now.

Validate whole, nonnegative, affordable bids on confirmation, including 0; blank,
fractional, negative, or unaffordable entries show a concise reserved-space live
message without changing state or Undo. Confirmation spends once, saves, updates
the normal Score, locks the visible input, disables repeated confirmation, and
keeps the dialog open for reveal. Move focus off the input to dismiss the keyboard.
Close/Escape before confirmation cancel; afterwards they close without refund.
Backdrop clicks do nothing. Restore focus to Challenge on close. Reopening starts
a new blank bid using the then-current Score. Native dialog semantics isolate
keyboard focus and prevent using underlying Undo until the dialog closes.

Unfinished/revealed bids and open dialogs do not survive reload; only spending
and the exact pre-action Undo do. There is no second resource, debt, automated
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
spending, Undo, and version-7 persistence behavior remain unchanged.

The bid input keeps its exact centre and transparent dark appearance, with a
larger font scaled to the banknote and enough width for four digits. The header
Challenge button has a white outline and a restrained rounded rectangle shape,
retaining its position, 48px touch height, and transparent fill.

## 9. Technical constraints

The focused board polish uses a very translucent white outer sheet (12%) with
a thin translucent border and a restrained 3px backdrop blur, including Safari's
prefixed filter. Individual cells use 80% opacity for readable values and
distinct empty/normal/start/goal states; selected cells use 94% with their existing
border treatment. Opacity and blur controls are grouped in style.css.

Column labels stay readable and aligned with their columns. Street highlighting
and feedback remain; the existing corner marker style shows each cell's 2x/4x
without adding a column or changing cell height. Ice assets, their fit/clipping,
and number stacking are unchanged. This is presentation only: placement, Prime
Ice, Attack Ice, Undo, score, goal, storage, reset, and background composition
retain their existing behavior. Manual iPhone evaluation remains pending.

The experimental background pass uses the supplied background_sky.png and
background_meadow.png unchanged as non-interactive decorative CSS layers.
The sky stays fixed; the meadow spans the full document height and scrolls with
the page so its ground continues below the fold. The meadow's painted horizon is anchored independently of sky position
and both scales; controls are grouped at the top of style.css. The composition
stays behind the game sheet even when entry or reset makes the page longer.
The second targeted iteration moves the horizon from 72% to 95% of the stable
viewport height. The header has no opaque backing: title, Score label/value,
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
markers. Cells, grid dimensions, interactions, and Prime-thawed treatment do not
change. General visual redesign and PNG optimization remain deferred.

A bilingual rules illustration appears in a plain section after the game
interface, with a large centered white Rules heading that stays English and
no card surface.
Keep the game region at least as tall as the existing horizon height, without
moving its controls. Add responsive spacing matching the scaled PNG's lower
painted ground (941/1440 of its displayed width), plus 1.5rem, so the section
begins near the transition to solid-green continuation. Leave 0.5rem between
the heading and selector, selector and image, and 2rem of bottom breathing room.
Use 96% of available width, capped at 36rem, centered. Display `assets/Rules.png`
for English and `assets/rules_german.png` for German, without cropping either.
Use each image's actual width/height to reserve space, with responsive width
and automatic height. Do not assume matching aspect ratios or internal margins.
Keep both artworks unchanged and provide descriptive alt text and language.

Place the unchanged `assets/language_select.png` directly below the heading at
40% container width, bounded by 7rem and 12rem. Transparent semantic Deutsch
and English buttons cover its two halves, with at least 48px touch targets,
native keyboard activation, `aria-pressed`, and a visible keyboard focus ring.
Keep the selector unframed and the existing signpost anchor/navigation intact.

Only the active language's letter bodies receive saturated yellow `#FFD600`.
Use precise transparent overlays `language_de_fill.png` and
`language_en_fill.png` below the original colorful outlines. Preserve D's hole,
E's cutouts, and N's shape; do not tint the original or use rectangular fills.
Generate these assets during development, with no runtime image processing.

English is the default. The independent `frosty-dice.rules-language` preference
stores only `en` or `de`; invalid or inaccessible preferences fall back to
English, and blocked writes do not prevent switching during the visit. Reset,
Undo, Challenge, game saves, and save version 7 remain independent. Switch
in place without navigation, scrolling scripts, or fixed-height clipping.
The existing full-page meadow layer and green fallback cover the image and
spacing without repeating plants, moving the horizon, or altering game UI or
JavaScript. No image-specific tests or browser automation are required.

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

A plain, centered footer follows the Rules section and displays only the supplied
`assets/contact_information.png`, with alt text “Frosty Dice contact information.”
Use 96% width, capped at 32rem, preserving the original aspect ratio and
transparency. Leave a 2rem gap above its image canvas (collapsing with the Rules
section's existing bottom margin) and 1rem below, plus the existing body safe-area
padding. The artwork's transparent margins provide additional breathing room.
Add no card, background, border, duplicated contact text, links, or controls.
The existing full-document meadow/green continuation extends behind the footer
and bottom spacing; do not repeat or reposition the landscape or meadow controls.

Use HTML, CSS, and vanilla JavaScript with relative asset/module paths. Keep
rule logic independent from DOM code and storage mechanics in storage.js.
Introduce no dependencies, framework, build system, backend, or multiplayer networking.

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
game code, UI, localStorage version 7, Undo, and reset remain unchanged.

Cache the complete static application, including all lazy Rules/contact/bid/ice
artwork. Each installed/browser context needs an online visit long enough for
the required batch to finish. Offline root/index navigation uses cached index.
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
