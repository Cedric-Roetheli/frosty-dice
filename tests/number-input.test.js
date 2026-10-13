import {
  createEmptyBoard, createGameState, generateDiceNumbers, getCell, getDiceOptions,
  getLegalTargetCells, isValidDieValue, parseNumberInput, placeGameNumber,
} from "../js/game.js";
import { placedBoard } from "./fixtures.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

export function runNumberInputTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }

  test("Either ordering of a chosen physical pair produces the same unique options", () => {
    assertDeepEqual(generateDiceNumbers(1, 6), [16, 61]);
    assertDeepEqual(generateDiceNumbers(6, 1), [16, 61]);
    assertDeepEqual(generateDiceNumbers(2, 4), [24, 42]);
  });

  test("Repeated-digit values have one option and no separate action", () => {
    for (let die = 1; die <= 6; die += 1) {
      const value = die * 11;
      assertDeepEqual(generateDiceNumbers(die, die), [value]);
      const state = placeGameNumber(createGameState(), "A1", value);
      assertDeepEqual(Object.keys(state), ["board"]);
      assertDeepEqual(getCell(state.board, "A1"), { value, status: "normal" });
    }
  });

  test("Chosen die values must be integers from 1 through 6", () => {
    for (let die = 1; die <= 6; die += 1) assert(isValidDieValue(die));
    for (const die of [0, 7, -1, 1.5, "1", null, undefined, NaN, Infinity]) {
      assert(!isValidDieValue(die));
      assertThrows(() => generateDiceNumbers(die, 6), "1 through 6");
      assertThrows(() => generateDiceNumbers(1, die), "1 through 6");
    }
  });

  test("Generic number entry accepts all 36 two-digit dice numbers", () => {
    for (let tens = 1; tens <= 6; tens += 1) {
      for (let units = 1; units <= 6; units += 1) assertEqual(parseNumberInput(`${tens}${units}`), tens * 10 + units);
    }
  });

  test("Generic number entry rejects invalid strings and non-string input", () => {
    for (const input of ["17", "70", "5", "123", "0", "abc", "16x", "", "16.0", "+16", "016",
      " 16", "16 ", "16\n", 16, null, undefined, false, [], {}, Symbol("16")]) {
      assertThrows(() => parseNumberInput(input), "two digits");
    }
  });

  test("A selected 1/6 pair on an empty board exposes only A1", () => {
    assertDeepEqual(getDiceOptions(createEmptyBoard(), 1, 6), [
      { value: 16, targets: ["A1"] }, { value: 61, targets: ["A1"] },
    ]);
  });

  test("Selected pair options reuse the shared placement validator", () => {
    const board = placedBoard(["A1", 16]);
    assertDeepEqual(getDiceOptions(board, 1, 6), [
      { value: 16, targets: ["A2"] }, { value: 61, targets: ["B1"] },
    ]);
    for (const option of getDiceOptions(board, 2, 4)) {
      assertDeepEqual(option.targets, getLegalTargetCells(board, option.value));
    }
  });

  test("An unusable selected pair simply exposes no targets", () => {
    const board = placedBoard(["A1", 66]);
    assertDeepEqual(getDiceOptions(board, 1, 2), [{ value: 12, targets: [] }, { value: 21, targets: [] }]);
  });

  test("Input and target queries never add turn metadata to game state", () => {
    const state = createGameState();
    const before = JSON.stringify(state);
    getDiceOptions(state.board, 1, 6);
    parseNumberInput("16");
    assertEqual(JSON.stringify(state), before);
    assertDeepEqual(Object.keys(state), ["board"]);
  });

  return results;
}
