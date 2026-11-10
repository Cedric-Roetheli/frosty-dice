# Frosty Dice — Two players on one device

These rules apply only to optional **2P**. The default **3P+** game and its
4×7 A1-to-D7 rules remain defined in [game-rules.md](./game-rules.md).

## Boards and perspective

Each player owns an independent 5-column × 3-row board, logically A–E / 1–3.
Player 1 sits at the top and reads a board rotated 180°. Player 2 sits at the
bottom and reads an upright board. Numbers and the six-button input bar face their
owner's board. This orientation was explicitly confirmed for this implementation.

Each board starts in **any cell of local row 3**, the row nearest its owner:
physically the topmost row for Player 1 and bottommost row for Player 2. Neither
player must enter first, and their starting columns need not match.

The classic A1=66 restriction protects the classic goal route and does **not**
apply here: 66 is allowed in any empty 2P starting-row cell. There is no D7 goal.

## Placement and Prime Ice

Each digit is 1–6. After the first placement, the target must be empty and at
least one usable occupied orthogonal neighbor must satisfy the ordinary rules.
**Both boards increase from the physical left to the physical right of the
upright screen.** A new value physically right of a neighbor must be greater;
a new value physically left of a neighbor must be smaller. In Player 1's rotated
logical A–E coordinates this means values **decrease** from A to E; in Player 2's
upright coordinates they increase from A to E. The value directly above or
below a usable neighbor must equal that neighbor. These are alternatives (OR);
another incompatible neighbor does not invalidate a valid connection.
Diagonals and currently Prime-frozen cells cannot support placement.

Existing 2P saves retain their values and Prime statuses. An older move may have
used the former Player 1 direction; its saved one-step Undo remains available.
All new placements follow the shared physical direction above.

Prime Ice uses the same transition as classic play, separately on each board.
Validate placement before thawing. A newly legally placed prime touching any
occupied orthogonal prime freezes; that player's previous frozen cell thaws.
Frozen and thawed primes still count as contact. There is at most one current
freeze per player. Frozen cells are unusable and score 0; thawed cells are usable
but permanently score 0. One player's transition never affects the other board.

There is no Attack Ice, Challenge, receipt, or Street bonus in 2P.

## Dice and voluntary passing

Use four physical dice or the unchanged optional Digital Dice Machine. The
active player chooses two; the opponent may use the other two. Either order
of a pair is allowed. If the active player voluntarily passes, the opponent
may choose any two of the four dice. Players handle this socially: the app
records neither turns, passing, dice ownership, nor dice-to-entry assignments.

## Column duels and Frosty Frontline

A normal cell contributes its value, doubled for 11/22/33/44/55/66. The entered
value never changes. Empty, frozen, and thawed cells contribute 0. Sum each
three-cell column without Street multipliers.

Compare physically opposing columns. For rotated Player 1, physical index =
4 − logical index; Player 2 uses the same physical/logical index. This mapping
is also its own inverse and determines the local horizontal placement direction.

The central Frosty Frontline has one point for each physical column. Its curved
boundary sits at Player 1's fraction of the two players' column points, from
near the top at 0% to near the bottom at 100%; a 0:0 column sits at the center.
The boundary widens from physical left to right. Each point indicates the current
leader: blue for Player 1, pink for Player 2, white for a positive tie, and a
neutral unlit point for 0:0. The owner's numeric column total stays visible at
the corresponding outer edge, facing that owner. For scores A:B:

| Comparison | Player 1 column victory | Player 2 column victory |
|---|---|---|
| A > B | Lit | Unlit |
| B > A | Unlit | Lit |
| A = B > 0 | Lit | Lit |
| A = B = 0 | Unlit | Unlit |

Column victories are derived and change immediately with the boards. Zero-point
columns are unclaimed. The five physical column positions do not change.

## Finishing, Undo, and Reset

The first completely filled board triggers the final physical roll, but both
players may finish their opportunities from that roll. The players decide when
it is complete. The app never locks boards or announces a winner automatically.
More won columns wins; equal counts are a draw, without a total-points tiebreak.
There is no automatic deadlock detection or special resolution.

Undo restores the authoritative snapshot before the last successful placement
on either board, including both boards' Prime states, and consumes one Undo.
Illegal input and cancellation create no snapshot. Reset requires confirmation
and clears both 2P boards and Undo, recalculating scores and the Frontline.

2P data uses its own versioned local save and never migrates or modifies a
classic save. Mode selection is a separate preference. Switching with meaningful
progress requires confirmation; both separate games are retained to avoid
multi-key deletion/rollback risks. Reset affects only the active mode.
