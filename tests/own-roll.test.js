import {
  confirmOwnRoll,
  createEmptyBoard,
  createGameState,
  finishSchnapszahlAction,
  generateRollNumbers,
  getCellValue,
  getRollOptions,
  isFailedRoll,
  isValidDieValue,
  placeExternalNumber,
  placeNumber,
  placeOwnRollNumber,
  prepareNextOwnRoll,
  removeOwnNumber,
} from "../js/game.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

function gameWithStart(die1, die2, value) {
  const confirmed = confirmOwnRoll(createGameState(), die1, die2);
  return prepareNextOwnRoll(finishSchnapszahlAction(placeOwnRollNumber(confirmed, "A1", value)));
}

export function runOwnRollTests() {
  const results = [];
  function test(name, action) {
    try {
      action();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, message: error.message });
    }
  }

  test("Dice 1 and 6 generate 16 and 61", () => {
    assertDeepEqual(generateRollNumbers(1, 6), [16, 61]);
  });

  test("Dice 6 and 1 generate the same options without duplicates", () => {
    assertDeepEqual(generateRollNumbers(6, 1), [16, 61]);
  });

  test("Dice 2 and 4 generate 24 and 42", () => {
    assertDeepEqual(generateRollNumbers(2, 4), [24, 42]);
  });

  test("Doubles 3 and 3 generate only 33", () => {
    assertDeepEqual(generateRollNumbers(3, 3), [33]);
  });

  test("Every double generates exactly one number", () => {
    for (let value = 1; value <= 6; value += 1) {
      assertDeepEqual(generateRollNumbers(value, value), [value * 11]);
    }
  });

  test("Only integer die values 1 through 6 are accepted", () => {
    for (let value = 1; value <= 6; value += 1) {
      assert(isValidDieValue(value));
    }
    for (const value of [0, 7, -1, 1.5, "1", null, undefined, NaN, Infinity]) {
      assert(!isValidDieValue(value));
      assertThrows(() => generateRollNumbers(value, 6), "1 through 6");
      assertThrows(() => generateRollNumbers(1, value), "1 through 6");
    }
  });

  test("An empty board and roll 1/6 expose only 16 and 61 at A1", () => {
    const board = createEmptyBoard();
    assertDeepEqual(getRollOptions(board, 1, 6), [
      { value: 16, targets: ["A1"] },
      { value: 61, targets: ["A1"] },
    ]);
    assert(!isFailedRoll(board, 1, 6));
  });

  test("After A1=16, roll 1/6 exposes A2 for 16 and B1 for 61", () => {
    const board = placeNumber(createEmptyBoard(), "A1", 16);
    assertDeepEqual(getRollOptions(board, 1, 6), [
      { value: 16, targets: ["A2"] },
      { value: 61, targets: ["B1"] },
    ]);
  });

  test("Roll options reuse branching and the confirmed OR placement rule", () => {
    let board = placeNumber(createEmptyBoard(), "A1", 16);
    board = placeNumber(board, "B1", 24);
    board = placeNumber(board, "A2", 16);
    assertDeepEqual(getRollOptions(board, 2, 6), [
      { value: 26, targets: ["C1", "B2"] },
      { value: 62, targets: ["C1", "B2"] },
    ]);
  });

  test("An own roll with only a leftward target is usable and counts once", () => {
    let game = gameWithStart(1, 6, 16);
    game = placeExternalNumber(game, "B1", 24);
    game = removeOwnNumber(game, "A1");
    assertDeepEqual(getRollOptions(game.board, 1, 1), [{ value: 11, targets: ["A1"] }]);
    assert(!isFailedRoll(game.board, 1, 1));
    const confirmed = confirmOwnRoll(game, 1, 1);
    assertEqual(confirmed.currentRoll.status, "pending");
    assertEqual(confirmed.ownRollCount, 2);
    assertThrows(() => placeOwnRollNumber(confirmed, "C1", 11), "greater than 24");
    const placed = placeOwnRollNumber(confirmed, "A1", 11);
    assertEqual(getCellValue(placed.board, "A1"), 11);
    assertEqual(placed.ownRollCount, 2);
    assertDeepEqual(placed.schnapszahlAction, { value: 11 });
    assertThrows(() => confirmOwnRoll(placed, 1, 1), "already confirmed");
  });

  test("Own-roll options and guarded placement use an equal lower neighbor", () => {
    let game = gameWithStart(1, 6, 16);
    game = placeExternalNumber(game, "A2", 16);
    game = removeOwnNumber(game, "A1");
    const confirmed = confirmOwnRoll(game, 1, 6);
    assertDeepEqual(getRollOptions(confirmed.board, 1, 6), [
      { value: 16, targets: ["A1", "A3"] },
      { value: 61, targets: ["B2"] },
    ]);
    assertThrows(() => placeOwnRollNumber(confirmed, "B1", 16), "orthogonally adjacent");
    const placed = placeOwnRollNumber(confirmed, "A1", 16);
    assertEqual(getCellValue(placed.board, "A1"), 16);
    assertEqual(getCellValue(placed.board, "A2"), 16);
    assertEqual(placed.ownRollCount, 2);
  });

  test("One unusable orientation does not make an otherwise usable roll fail", () => {
    const board = placeNumber(createEmptyBoard(), "A1", 61);
    assertDeepEqual(getRollOptions(board, 1, 6), [
      { value: 16, targets: [] },
      { value: 61, targets: ["A2"] },
    ]);
    assert(!isFailedRoll(board, 1, 6));
  });

  test("Roll 1/2 fails after A1=66 when both orientations have no target", () => {
    const board = placeNumber(createEmptyBoard(), "A1", 66);
    assertDeepEqual(getRollOptions(board, 1, 2), [
      { value: 12, targets: [] },
      { value: 21, targets: [] },
    ]);
    assert(isFailedRoll(board, 1, 2));
  });

  test("A double with no legal target is also a failed roll", () => {
    const board = placeNumber(createEmptyBoard(), "A1", 66);
    assert(isFailedRoll(board, 3, 3));
  });

  test("A new game has an empty board, zero own rolls, and no confirmed roll", () => {
    assertDeepEqual(createGameState(), { board: createEmptyBoard(), ownRollCount: 0, currentRoll: null, schnapszahlAction: null });
  });

  test("Confirming a usable roll counts once before placement without changing the board", () => {
    const original = createGameState();
    const confirmed = confirmOwnRoll(original, 1, 6);
    assertEqual(original.ownRollCount, 0);
    assertEqual(original.currentRoll, null);
    assertEqual(confirmed.ownRollCount, 1);
    assertDeepEqual(confirmed.currentRoll, { dice: [1, 6], status: "pending" });
    assertDeepEqual(confirmed.board, createEmptyBoard());
  });

  test("A successful own roll counts exactly once and places only one number", () => {
    const confirmed = confirmOwnRoll(createGameState(), 1, 6);
    const placed = placeOwnRollNumber(confirmed, "A1", 16);
    assertEqual(placed.ownRollCount, 1);
    assertEqual(placed.currentRoll.status, "placed");
    assertEqual(getCellValue(placed.board, "A1"), 16);
    assertEqual(placed.board.flat().filter((value) => value !== null).length, 1);
    assertThrows(() => placeOwnRollNumber(placed, "B1", 61), "finished roll");
    assertEqual(placed.ownRollCount, 1);
  });

  test("Repeated confirmation during placement cannot count again or replace the dice", () => {
    const confirmed = confirmOwnRoll(createGameState(), 1, 6);
    assertThrows(() => confirmOwnRoll(confirmed, 1, 6), "already confirmed");
    assertThrows(() => confirmOwnRoll(confirmed, 3, 3), "already confirmed");
    assertEqual(confirmed.ownRollCount, 1);
    assertDeepEqual(confirmed.currentRoll.dice, [1, 6]);
  });

  test("Repeated confirmation after successful placement cannot count again", () => {
    const placed = placeOwnRollNumber(confirmOwnRoll(createGameState(), 1, 6), "A1", 16);
    assertThrows(() => confirmOwnRoll(placed, 1, 6), "already confirmed");
    assertEqual(placed.ownRollCount, 1);
  });

  test("A failed own roll counts exactly once and leaves the board unchanged", () => {
    const original = gameWithStart(6, 6, 66);
    const failed = confirmOwnRoll(original, 1, 2);
    assertEqual(original.ownRollCount, 1);
    assertEqual(failed.ownRollCount, 2);
    assertEqual(failed.currentRoll.status, "failed");
    assertDeepEqual(failed.board, original.board);
    assertThrows(() => confirmOwnRoll(failed, 1, 2), "already confirmed");
    assertThrows(() => confirmOwnRoll(failed, 3, 3), "already confirmed");
    assertEqual(failed.ownRollCount, 2);
  });

  test("A failed roll cannot be used for a placement", () => {
    const failed = confirmOwnRoll(gameWithStart(6, 6, 66), 1, 2);
    assertThrows(() => placeOwnRollNumber(failed, "A2", 12), "finished roll");
    assertEqual(failed.ownRollCount, 2);
    assertEqual(getCellValue(failed.board, "A2"), null);
  });

  test("An unconfirmed roll cannot place a number", () => {
    const original = createGameState();
    assertThrows(() => placeOwnRollNumber(original, "A1", 16), "Confirm an own roll");
    assertEqual(original.ownRollCount, 0);
    assertEqual(getCellValue(original.board, "A1"), null);
  });

  test("Illegal cells cannot consume a confirmed roll or change its count", () => {
    const confirmed = confirmOwnRoll(createGameState(), 1, 6);
    assertThrows(() => placeOwnRollNumber(confirmed, "B1", 16), "first number");
    assertEqual(confirmed.ownRollCount, 1);
    assertEqual(confirmed.currentRoll.status, "pending");
    assertEqual(getCellValue(confirmed.board, "B1"), null);
    const placed = placeOwnRollNumber(confirmed, "A1", 16);
    assertEqual(placed.ownRollCount, 1);
  });

  test("An occupied cell cannot be overwritten by a new own roll", () => {
    const confirmed = confirmOwnRoll(gameWithStart(1, 6, 16), 1, 6);
    assertThrows(() => placeOwnRollNumber(confirmed, "A1", 61), "cannot be overwritten");
    assertEqual(getCellValue(confirmed.board, "A1"), 16);
    assertEqual(confirmed.ownRollCount, 2);
    assertEqual(confirmed.currentRoll.status, "pending");
  });

  test("Even a normally legal number cannot be placed if it was not rolled", () => {
    const confirmed = confirmOwnRoll(createGameState(), 1, 6);
    assertThrows(() => placeOwnRollNumber(confirmed, "A1", 24), "confirmed roll");
    assertEqual(getCellValue(confirmed.board, "A1"), null);
    assertEqual(confirmed.ownRollCount, 1);
  });

  test("Invalid die values are rejected before increasing the own-roll count", () => {
    const original = createGameState();
    for (const value of [0, 7, 1.5, "1", null, undefined, NaN]) {
      assertThrows(() => confirmOwnRoll(original, value, 6), "1 through 6");
      assertThrows(() => confirmOwnRoll(original, 1, value), "1 through 6");
    }
    assertEqual(original.ownRollCount, 0);
    assertEqual(original.currentRoll, null);
  });

  test("A pending roll must be placed before preparing the next one", () => {
    const confirmed = confirmOwnRoll(createGameState(), 1, 6);
    assertThrows(() => prepareNextOwnRoll(confirmed), "Place this confirmed roll");
    assertEqual(confirmed.ownRollCount, 1);
    assertEqual(confirmed.currentRoll.status, "pending");
  });

  test("Preparing the next roll clears only the roll lock and preserves count and board", () => {
    const placed = placeOwnRollNumber(confirmOwnRoll(createGameState(), 1, 6), "A1", 16);
    const ready = prepareNextOwnRoll(placed);
    assertEqual(ready.currentRoll, null);
    assertEqual(ready.ownRollCount, 1);
    assertEqual(getCellValue(ready.board, "A1"), 16);
    assertEqual(prepareNextOwnRoll(ready).ownRollCount, 1);
  });

  test("Separate physical rolls with identical dice each count once", () => {
    const ready = gameWithStart(1, 6, 16);
    const second = placeOwnRollNumber(confirmOwnRoll(ready, 1, 6), "A2", 16);
    assertEqual(second.ownRollCount, 2);
    assertEqual(getCellValue(second.board, "A2"), 16);
  });

  test("Separate failed rolls with identical dice also each count once", () => {
    const firstFailure = confirmOwnRoll(gameWithStart(6, 6, 66), 1, 2);
    const secondFailure = confirmOwnRoll(prepareNextOwnRoll(firstFailure), 1, 2);
    assertEqual(firstFailure.ownRollCount, 2);
    assertEqual(secondFailure.ownRollCount, 3);
    assertEqual(secondFailure.currentRoll.status, "failed");
  });

  test("Repeatedly considering either number and its targets does not increase the count", () => {
    const confirmed = confirmOwnRoll(createGameState(), 1, 6);
    const before = JSON.stringify(confirmed);
    for (let i = 0; i < 5; i += 1) {
      getRollOptions(confirmed.board, ...confirmed.currentRoll.dice);
      generateRollNumbers(6, 1);
    }
    assertEqual(JSON.stringify(confirmed), before);
    assertEqual(confirmed.ownRollCount, 1);
  });

  test("Roll confirmation and placement work with frozen input without mutation", () => {
    const original = createGameState();
    original.board.forEach(Object.freeze);
    Object.freeze(original.board);
    Object.freeze(original);
    const confirmed = confirmOwnRoll(original, 1, 6);
    Object.freeze(confirmed.currentRoll.dice);
    Object.freeze(confirmed.currentRoll);
    Object.freeze(confirmed);
    const placed = placeOwnRollNumber(confirmed, "A1", 16);
    assertEqual(original.ownRollCount, 0);
    assertEqual(confirmed.currentRoll.status, "pending");
    assertEqual(getCellValue(confirmed.board, "A1"), null);
    assertEqual(placed.ownRollCount, 1);
    assertEqual(placed.currentRoll.status, "placed");
    assertEqual(getCellValue(placed.board, "A1"), 16);
  });

  return results;
}
