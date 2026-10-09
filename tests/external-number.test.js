import {
  confirmOwnRoll,
  createGameState,
  getCellValue,
  getExternalNumberTargets,
  getLegalTargetCells,
  parseExternalNumber,
  placeExternalNumber,
  placeOwnRollNumber,
  prepareNextOwnRoll,
} from "../js/game.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

function gameWithOwnStart(die1, die2, value) {
  const confirmed = confirmOwnRoll(createGameState(), die1, die2);
  return prepareNextOwnRoll(placeOwnRollNumber(confirmed, "A1", value));
}

export function runExternalNumberTests() {
  const results = [];
  function test(name, action) {
    try {
      action();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, message: error.message });
    }
  }

  test("External inputs 16, 33, and 61 are accepted as single numbers", () => {
    for (const value of [16, 33, 61]) {
      assertEqual(parseExternalNumber(String(value)), value);
      assertDeepEqual(getExternalNumberTargets(createGameState(), value), ["A1"]);
    }
  });

  test("All two-digit numbers with digits 1 through 6 are accepted", () => {
    for (let tens = 1; tens <= 6; tens += 1) {
      for (let units = 1; units <= 6; units += 1) {
        const value = tens * 10 + units;
        assertEqual(parseExternalNumber(String(value)), value);
      }
    }
  });

  test("External inputs 17, 70, 5, 123, 0, and non-numeric text are rejected", () => {
    for (const input of ["17", "70", "5", "123", "0", "abc", "16x", "", "16.0", "1e1", "0x10", "+16", "016", " 16", "16 ", "16\n"]) {
      assertThrows(() => parseExternalNumber(input), "two digits");
    }
  });

  test("External input parsing does not coerce non-string values", () => {
    for (const input of [16, null, undefined, false, [], {}, Symbol("16")]) {
      assertThrows(() => parseExternalNumber(input), "two digits");
    }
  });

  test("Invalid normalized external numbers cannot be queried or placed", () => {
    const game = createGameState();
    for (const value of [17, 70, 5, 123, 0, -16, 16.5, "16", "abc", null, NaN, Infinity]) {
      assertThrows(() => getExternalNumberTargets(game, value), "two-digit number");
      assertThrows(() => placeExternalNumber(game, "A1", value), "two-digit number");
    }
    assertEqual(game.ownRollCount, 0);
    assertEqual(getCellValue(game.board, "A1"), null);
  });

  test("External targets exactly match the core placement helper", () => {
    let game = gameWithOwnStart(1, 6, 16);
    game = placeExternalNumber(game, "B1", 24);
    game = placeExternalNumber(game, "A2", 16);
    for (let tens = 1; tens <= 6; tens += 1) {
      for (let units = 1; units <= 6; units += 1) {
        const value = tens * 10 + units;
        assertDeepEqual(getExternalNumberTargets(game, value), getLegalTargetCells(game.board, value));
      }
    }
    assertDeepEqual(getExternalNumberTargets(game, 26), ["C1", "B2"]);
    assertEqual(game.ownRollCount, 1);
  });

  test("An external first placement must be at A1", () => {
    const original = createGameState();
    assertThrows(() => placeExternalNumber(original, "B1", 16), "first number");
    assertEqual(getCellValue(original.board, "B1"), null);
    assertEqual(original.ownRollCount, 0);
    assertEqual(getCellValue(placeExternalNumber(original, "A1", 16).board, "A1"), 16);
  });

  test("A successful external placement updates only the board", () => {
    const original = createGameState();
    const placed = placeExternalNumber(original, "A1", 16);
    assertEqual(getCellValue(placed.board, "A1"), 16);
    assertEqual(placed.ownRollCount, 0);
    assertEqual(placed.currentRoll, null);
    assertEqual(getCellValue(original.board, "A1"), null);
  });

  test("Successful external placement preserves an existing own-roll count", () => {
    const original = gameWithOwnStart(1, 6, 16);
    const placed = placeExternalNumber(original, "B1", 24);
    assertEqual(getCellValue(placed.board, "B1"), 24);
    assertEqual(placed.ownRollCount, 1);
    assertEqual(original.ownRollCount, 1);
  });

  test("External horizontal and vertical placements obey core rules", () => {
    const original = gameWithOwnStart(1, 6, 16);
    assertThrows(() => placeExternalNumber(original, "B1", 16), "greater than 16");
    assertThrows(() => placeExternalNumber(original, "B1", 12), "greater than 16");
    assertThrows(() => placeExternalNumber(original, "A2", 24), "match 16");
    assertEqual(getCellValue(placeExternalNumber(original, "A2", 16).board, "A2"), 16);
    assertEqual(getCellValue(placeExternalNumber(original, "B1", 61).board, "B1"), 61);
    assertEqual(original.ownRollCount, 1);
  });

  test("Rejected external placements preserve the whole input state", () => {
    const original = gameWithOwnStart(1, 6, 16);
    const before = JSON.stringify(original);
    assertThrows(() => placeExternalNumber(original, "B1", 12));
    assertThrows(() => placeExternalNumber(original, "A3", 16));
    assertThrows(() => placeExternalNumber(original, "B2", 24));
    assertEqual(JSON.stringify(original), before);
    assertEqual(original.ownRollCount, 1);
  });

  test("An occupied cell cannot be overwritten by an external number", () => {
    const game = placeExternalNumber(createGameState(), "A1", 33);
    assertThrows(() => placeExternalNumber(game, "A1", 33), "cannot be overwritten");
    assertThrows(() => placeExternalNumber(game, "A1", 61), "cannot be overwritten");
    assertEqual(getCellValue(game.board, "A1"), 33);
    assertEqual(game.ownRollCount, 0);
  });

  test("Invalid cell names cannot receive an external number", () => {
    const game = createGameState();
    for (const coordinate of ["A0", "A8", "E1", "D8", "a1", null]) {
      assertThrows(() => placeExternalNumber(game, coordinate, 16), "A1 through D7");
    }
    assertEqual(game.ownRollCount, 0);
  });

  test("An external number with no targets leaves board and counter unchanged", () => {
    const game = gameWithOwnStart(6, 6, 66);
    const before = JSON.stringify(game);
    assertDeepEqual(getExternalNumberTargets(game, 33), []);
    assertThrows(() => placeExternalNumber(game, "A2", 33), "match 66");
    assertEqual(JSON.stringify(game), before);
    assertEqual(game.ownRollCount, 1);
  });

  test("Repeated input and target queries never count as own rolls", () => {
    const game = gameWithOwnStart(1, 6, 16);
    const before = JSON.stringify(game);
    for (let i = 0; i < 5; i += 1) {
      getExternalNumberTargets(game, parseExternalNumber("16"));
      getExternalNumberTargets(game, parseExternalNumber("61"));
    }
    assertEqual(JSON.stringify(game), before);
    assertEqual(game.ownRollCount, 1);
  });

  test("External placement uses OR when the left connection alone is valid", () => {
    let game = placeExternalNumber(createGameState(), "A1", 16);
    game = placeExternalNumber(game, "B1", 24);
    game = placeExternalNumber(game, "A2", 16);
    const placed = placeExternalNumber(game, "B2", 26);
    assertEqual(getCellValue(placed.board, "B2"), 26);
    assertEqual(placed.ownRollCount, 0);
  });

  test("External placement uses OR when the upper connection alone is valid", () => {
    let game = placeExternalNumber(createGameState(), "A1", 16);
    for (const [coordinate, value] of [["B1", 24], ["C1", 61], ["A2", 16], ["B2", 66]]) {
      game = placeExternalNumber(game, coordinate, value);
    }
    assertEqual(getCellValue(placeExternalNumber(game, "C2", 61).board, "C2"), 61);
    assertEqual(game.ownRollCount, 0);
  });

  test("The active own-roll placement is preserved instead of being interrupted", () => {
    const confirmed = confirmOwnRoll(createGameState(), 1, 6);
    const before = JSON.stringify(confirmed);
    assertThrows(() => placeExternalNumber(confirmed, "A1", 33), "Finish placing");
    assertEqual(JSON.stringify(confirmed), before);
    assertEqual(confirmed.ownRollCount, 1);
    assertEqual(getCellValue(placeOwnRollNumber(confirmed, "A1", 16).board, "A1"), 16);
  });

  test("Own successful rolls still count once after external placements", () => {
    let game = placeExternalNumber(createGameState(), "A1", 16);
    game = placeOwnRollNumber(confirmOwnRoll(game, 1, 6), "B1", 61);
    assertEqual(game.ownRollCount, 1);
    game = placeExternalNumber(game, "A2", 16);
    assertEqual(game.ownRollCount, 1);
    game = prepareNextOwnRoll(game);
    game = placeOwnRollNumber(confirmOwnRoll(game, 3, 3), "B2", 33);
    assertEqual(game.ownRollCount, 2);
    assertThrows(() => confirmOwnRoll(game, 3, 3), "already confirmed");
    assertEqual(game.ownRollCount, 2);
  });

  test("Own failed rolls still count once after external placements", () => {
    let game = placeExternalNumber(createGameState(), "A1", 66);
    game = confirmOwnRoll(game, 1, 2);
    assertEqual(game.currentRoll.status, "failed");
    assertEqual(game.ownRollCount, 1);
    game = placeExternalNumber(game, "A2", 66);
    assertEqual(game.ownRollCount, 1);
    assertThrows(() => confirmOwnRoll(game, 1, 2), "already confirmed");
    game = confirmOwnRoll(prepareNextOwnRoll(game), 1, 2);
    assertEqual(game.currentRoll.status, "failed");
    assertEqual(game.ownRollCount, 2);
  });

  test("An old failed own roll cannot be reused when an external number opens new targets", () => {
    let game = gameWithOwnStart(1, 1, 11);
    game = placeOwnRollNumber(confirmOwnRoll(game, 6, 6), "B1", 66);
    game = confirmOwnRoll(prepareNextOwnRoll(game), 3, 3);
    assertEqual(game.currentRoll.status, "failed");
    assertEqual(game.ownRollCount, 3);
    game = placeExternalNumber(game, "A2", 11);
    assertDeepEqual(getExternalNumberTargets(game, 33), ["B2"]);
    assertThrows(() => placeOwnRollNumber(game, "B2", 33), "finished roll");
    assertEqual(game.ownRollCount, 3);
    const nextPhysicalRoll = confirmOwnRoll(prepareNextOwnRoll(game), 3, 3);
    assertEqual(nextPhysicalRoll.currentRoll.status, "pending");
    assertEqual(nextPhysicalRoll.ownRollCount, 4);
  });

  test("External placement is immutable even with frozen input state", () => {
    const original = createGameState();
    original.board.forEach(Object.freeze);
    Object.freeze(original.board);
    Object.freeze(original);
    const placed = placeExternalNumber(original, "A1", 16);
    assert(placed !== original);
    assert(placed.board !== original.board);
    assert(placed.board.every((row, index) => row !== original.board[index]));
    assertEqual(getCellValue(original.board, "A1"), null);
    assertEqual(getCellValue(placed.board, "A1"), 16);
    assertEqual(placed.ownRollCount, 0);
  });

  return results;
}
