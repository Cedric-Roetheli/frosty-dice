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

Players roll two standard six-sided dice and use the two dice values to form a two-digit number. They build a connected, branching network of numbers from A1 toward D7.

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

A player's first legally placed number is entered in `A1`.

## 4. Legal placement

The board grows from already occupied cells. Branching is allowed.

### 4.1 Horizontal placement

Moving one column to the right means:

- `A → B`
- `B → C`
- `C → D`

The new number must be **strictly greater** than the number immediately to its left.

It does not need to be exactly one greater.

Examples:

- `16 → 24` is legal.
- `16 → 61` is legal.
- `16 → 16` is not legal horizontally.
- `26 → 25` is not legal horizontally.

Formally:

`newValue > leftValue`

### 4.2 Vertical placement

Moving one row downward means:

- `1 → 2`
- `2 → 3`
- …
- `6 → 7`

The new number must be **exactly equal** to the number immediately above it.

Examples:

- `A1 = 16`, `A2 = 16` is legal.
- `A1 = 16`, `A2 = 26` is not legal.

Formally:

`newValue === valueAbove`

### 4.3 Branching

A player's network may branch.

An occupied cell can therefore support development both:

- to the right, using the horizontal rule; and
- downward, using the vertical rule.

The player is not restricted to one linear path from A1 to D7.

### 4.4 Alternative supporting connections

For a cell other than A1, an occupied neighbor immediately to the left or
immediately above can support the new placement. **Either valid predecessor is
sufficient.** Horizontal and vertical conditions are alternatives, not cumulative
requirements.

Formally:

`legal = validHorizontalConnection || validVerticalConnection`

If both neighbors are occupied, a neighbor that does not satisfy its rule does
not invalidate a valid connection from the other direction. The target must
still be empty.

Example:

- `A1 = 16`, `B1 = 24`, and `A2 = 16`
- Placing `26` at `B2` is legal because `26 > 16` from A2.
- The invalid vertical connection from B1 (`26 ≠ 24`) does not prevent it.

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

For Milestone 5, removal clears only the selected cell. Other entered values
remain untouched. This temporary scope does not decide their connectivity,
activity, scoring eligibility, or repair behavior; those questions remain open
in section 11.1.

## 8. Numbers received without an own roll

Numbers can enter a player's board without being generated by that player's own roll, for example:

- taking a number from an opponent's failed roll;
- placing a number stolen through a Schnapszahl.

These placements must obey the normal placement rules.

They do not add an additional own roll to the score divisor.

## 9. Goal

The target cell is `D7`.

A player is considered to have reached the goal when D7 is reached through the player's valid network originating from A1.

Because branching is allowed, the player may occupy more cells than are required for a single shortest path.

## 10. Score

The core scoring rule is:

`Score = scoring numerator / number of the player's own counted rolls`

The scoring numerator consists of the player's scoring board values, with street bonuses applied.

Numbers obtained from opponents can contribute to the board value but do not create an additional own roll in the divisor.

The player with the highest final score wins.

## 11. Open rule questions

The following mechanics have not yet been fully decided. They must be resolved through design discussion or playtesting before the implementation assumes a specific answer.

### 11.1 Broken network after stealing

If an opponent removes a number that disconnects cells farther along a branch from A1:

- Do the disconnected numbers remain on the board?
- Are they temporarily inactive?
- Do they count toward the score?
- Can the connection later be repaired?

### 11.2 End-of-game timing

When one player reaches D7:

- Does that player immediately stop taking turns?
- Does the entire game end immediately?
- Does the current round finish?
- Do other players continue until they also reach D7?

### 11.3 Multiple opponents wanting the same failed roll

If several opponents can use a failed roll, priority/order has not yet been defined.

### 11.4 Exact scoring eligibility

The treatment of disconnected or otherwise inactive cells in the final scoring numerator depends on the unresolved network rule above.

## 12. Rules that must not be assumed

Until explicitly added to this document:

- There is no digital dice roller requirement.
- There is no multiplayer synchronization rule.
- There is no account system.
- There is no requirement that a player follow only one path.
- Horizontal numbers do not need to increase by exactly 1 except when forming a street.
