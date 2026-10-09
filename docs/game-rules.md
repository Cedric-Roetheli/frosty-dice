# Frosty Dice — Game Rules

> **Status:** Working rules reference for the first playable version.
>
> This document is the source of truth for Frosty Dice game mechanics. Technical implementation details belong elsewhere. Rules marked as open questions are not yet decided and must not be invented by the implementation.

## 1. Core idea

Each player has their own 4 × 7 board.

The board has:

- Columns `A`, `B`, `C`, `D`
- Rows `1` through `7`
- Start: `A1`
- Goal: `D7`

Players roll two standard six-sided dice and use the two dice values to form a
two-digit number. They grow a branching network of numbers from A1 toward D7.
Cells remain active after other cells are removed, as defined in section 4.5.

The game combines:

- Progress toward D7
- High-value numbers
- Building streets
- Using opponents' failed rolls
- Attacking opponents through Schnapszahlen

## 2. Dice and number formation

On a player's own turn, that player rolls two physical six-sided dice.

If the dice show different values, they can be arranged in either order.

Example:

- Roll: `1` and `6`
- Possible numbers: `16` and `61`

If both dice show the same value, there is only one distinct possible number.

Example:

- Roll: `3` and `3`
- Possible number: `33`

Only numbers whose two digits are between 1 and 6 can therefore occur naturally.

Each confirmed own physical roll counts **exactly once** toward the player's own
counted rolls, including a failed roll. Changing dice selections before
confirmation, considering either number arrangement, and placing the chosen
number do not add another counted roll.

## 3. First placement

On a completely empty board, the first number must be placed in `A1`.
Once the board contains any numbers, use the four-direction adjacency rule in
section 4, including for an empty A1. If all numbers have been removed, the
empty-board A1 start rule applies again.

## 4. Legal placement

An empty cell can receive a number when it forms a valid relationship with at
least one occupied orthogonally adjacent cell: left, right, above, or below.
Branching is allowed. Diagonal cells and cells farther away cannot support a
placement. The completely empty board uses the A1 exception in section 3.

### 4.1 Horizontal placement

An occupied horizontal neighbor may support placement from either side:

- **Left neighbor:** the new number must be **strictly greater** than the
  number immediately to its left: `newValue > leftValue`.
- **Right neighbor:** the new number must be **strictly smaller** than the
  number immediately to its right: `newValue < rightValue`.

Any strictly larger/smaller value satisfies the corresponding relationship;
the difference does not have to be exactly 1. Consecutive +1 values are relevant
only to Streets.

Examples:

- `[16] [empty]`: placing `24` or `61` on the right is legal.
- `[empty] [24]`: placing `16` on the left is legal.
- Equal horizontal values do not satisfy either horizontal relationship.
- A new `25` to the right of `26` does not satisfy the left-neighbor rule.

### 4.2 Vertical placement

An occupied vertical neighbor may support placement from either direction:

- **Upper neighbor:** the new number must be **exactly equal** to the number
  immediately above it: `newValue === valueAbove`.
- **Lower neighbor:** the new number must be **exactly equal** to the number
  immediately below it: `newValue === valueBelow`.

Examples:

- `A1 = 16`, `A2 = 16` is legal.
- With `C3 = 22`, a new `22` can be placed at either `C2` or `C4`.
- A new `26` below `16` does not satisfy the upper-neighbor rule.

### 4.3 Branching

A player's network may branch.

An occupied cell can support development left or right using the corresponding
horizontal relationship, and above or below using equality.

The player is not restricted to one linear path from A1 to D7.

### 4.4 Alternative supporting connections

Once the board contains numbers, **one valid occupied orthogonal neighbor is
sufficient**, including when placing in an empty A1. The four neighboring
relationships are alternatives, not cumulative requirements.

Formally:

`legal = validLeftConnection || validRightConnection || validUpperConnection || validLowerConnection`

If multiple neighbors are occupied, an incompatible relationship does not
invalidate a valid relationship with another neighbor. The target must still
be empty.

Example:

- `A1 = 16`, `B1 = 24`, and `A2 = 16`
- Placing `26` at `B2` is legal because `26 > 16` from A2.
- The invalid vertical connection from B1 (`26 ≠ 24`) does not prevent it.

### 4.5 Removal and connectivity

Once a number has been legally placed, it remains a fully active board cell
unless that specific cell is later removed. Removal of another cell may break
its former connection to A1, but the remaining cell stays on the board, still
counts toward scoring, and can still serve as the immediate predecessor for
future legal horizontal or vertical placements.

The game does not require recalculating connectivity back to A1 after removals.
Placement validation uses the current immediate left, right, upper, and lower
neighbors according to sections 4.1, 4.2, and 4.4.

## 5. Failed rolls

If neither possible number from the active player's own roll can be legally placed anywhere on that player's board, the roll is a **failed roll**.

The opponents may then use one of the rolled numbers if they can legally place it on their own board.

A number placed from another player's failed roll:

- must obey the normal placement rules;
- does **not** count as one of the receiving player's own rolls for the score divisor.

The receiving player's device does not need to know whose failed roll it came from.

## 6. Streets

A **street** is a completely occupied horizontal row from column A through D whose four numbers are consecutive integers increasing by exactly 1.

Example:

`11 — 12 — 13 — 14`

The total point value of that row is doubled in the final score calculation.

Example:

Base row value:

`11 + 12 + 13 + 14 = 50`

Street value:

`50 × 2 = 100`

A row that is not four consecutive increasing values receives no street bonus.

Only complete horizontal A–D rows qualify. Incomplete rows, vertical sequences,
and non-consecutive rows such as `11, 13, 14, 15` are not Streets.

## 7. Schnapszahlen

The Schnapszahlen are:

`11, 22, 33, 44, 55, 66`

A Schnapszahl triggers its special effect only after the player actually legally
places it on their own board from their **own physical roll**. Merely rolling it,
or having a potential legal target, does not trigger the effect.

A Schnapszahl received from another player's failed roll or as a stolen number
does not trigger this special action.

After legally placing it, the player may remove one already-entered number from an opponent's board.

### 7.1 Stealing the removed number

After removing the opponent's number:

- If the active player can legally place that removed number on their own board, they may place it there.
- If the active player cannot legally place it, the opponent's number is still removed and the number is destroyed.

Therefore the Schnapszahl effect may be used either:

- to gain a useful number; or
- purely to slow or disrupt an opponent.

The removed opponent handles the deletion on their own device. The active player handles any legal stolen-number placement on their own device.

### 7.2 A number is removed from my board

The affected player selects the occupied cell on their own device and explicitly
confirms its removal. Empty cells cannot be removed. Removal does not change
that player's own counted rolls.

Removal clears only the selected cell. All other entered values remain untouched
and fully active, including cells whose former connection to A1 has been broken.
They continue to score and support placements as defined in sections 4.5 and 10.

## 8. Numbers received without an own roll

Numbers can enter a player's board without being generated by that player's own roll, for example:

- taking a number from an opponent's failed roll;
- placing a number stolen through a Schnapszahl.

These placements must obey the normal placement rules.

They do not add an additional own roll to the score divisor.

## 9. Goal

The target cell is `D7`.

The goal is reached when the player legally places a number in D7. No additional
connectivity check back to A1 is required. A number already present in D7 means
that player has reached the goal, regardless of whether it came from an own roll,
an opponent's failed roll, or a stolen number.

Removal elsewhere does not undo this detection while D7 remains occupied.
Removing D7 makes it empty and the goal is no longer currently detected.

This identifies only that player's current goal status. Global end-of-game
timing remains undecided; reaching D7 does not define when the table game ends
or whether other players finish a round.

Because branching is allowed, the player may occupy more cells than are required for a single shortest path.

## 10. Score

The core scoring rule is:

`Score = scoring numerator / number of the player's own counted rolls`

**Every number currently present on the player's board counts toward the score,
even if that cell has become disconnected from A1 after a removal.**

The scoring numerator is the sum of all currently occupied cells, with each
Street's entire row value counted twice. Multiple Streets are each doubled.
Connectivity does not affect either base points or Street bonuses.

Numbers received from opponents' failed rolls or stolen from opponents count
normally in the numerator. They do not create an additional own roll or
retroactively change the own-roll divisor.

When the number of own counted rolls is zero, display a score of `0` without
dividing by zero, including when the board already contains received numbers.

The player with the highest final score wins.

## 11. Open rule questions

The following mechanics have not yet been fully decided. They must be resolved through design discussion or playtesting before the implementation assumes a specific answer.

### 11.2 End-of-game timing

When one player reaches D7:

- Does that player immediately stop taking turns?
- Does the entire game end immediately?
- Does the current round finish?
- Do other players continue until they also reach D7?

### 11.3 Multiple opponents wanting the same failed roll

If several opponents can use a failed roll, priority/order has not yet been defined.

## 12. Rules that must not be assumed

Until explicitly added to this document:

- There is no digital dice roller requirement.
- There is no multiplayer synchronization rule.
- There is no account system.
- There is no requirement that a player follow only one path.
- Horizontal numbers do not need to increase by exactly 1 except when forming a street.
