// This module has no DOM or runtime dependencies; the browser runner reports results.
import {
  canPlaceNumber,
  createEmptyBoard,
  getCellValue,
  getLegalTargetCells,
  isCellEmpty,
  isCellOccupied,
  isValidBoard,
  isValidCell,
  isValidNumber,
  placeNumber,
  validatePlacement,
} from "../js/game.js";

import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

function boardWith(...placements) {
  return placements.reduce(
    (board, [coordinate, value]) => placeNumber(board, coordinate, value),
    createEmptyBoard(),
  );
}

export function runGameTests() {
  const results = [];

  function test(name, action) {
    try {
      action();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, message: error.message });
    }
  }

  test("An empty board has seven rows and four null cells per row", () => {
    const board = createEmptyBoard();
    assertEqual(board.length, 7);
    assert(board.every((row) => row.length === 4 && row.every((value) => value === null)));
    assert(isValidBoard(board));
  });

  test("New boards and their rows do not share mutable arrays", () => {
    const first = createEmptyBoard();
    const second = createEmptyBoard();
    first[0][0] = 16;
    assertEqual(first[1][0], null);
    assertEqual(second[0][0], null);
    assertEqual(first[0][1], null);
  });

  test("Cell helpers distinguish empty and occupied cells", () => {
    let board = createEmptyBoard();
    assert(isCellEmpty(board, "A1"));
    assert(!isCellOccupied(board, "A1"));
    board = placeNumber(board, "A1", 16);
    assertEqual(getCellValue(board, "A1"), 16);
    assert(!isCellEmpty(board, "A1"));
    assert(isCellOccupied(board, "A1"));
    assertEqual(getCellValue(board, "D7"), null);
  });

  test("Only cell names A1 through D7 are accepted", () => {
    for (const column of ["A", "B", "C", "D"]) {
      for (let row = 1; row <= 7; row += 1) {
        assert(isValidCell(`${column}${row}`));
      }
    }
    for (const coordinate of ["A0", "A8", "E1", "D8", "a1", "A01", "A1x", "A1\n", " A1", "A1 ", "", null, 1]) {
      assert(!isValidCell(coordinate));
      assertThrows(() => getCellValue(createEmptyBoard(), coordinate));
    }
  });

  test("A valid number has two integer digits, each from 1 through 6", () => {
    for (let tens = 1; tens <= 6; tens += 1) {
      for (let units = 1; units <= 6; units += 1) {
        assert(isValidNumber(tens * 10 + units));
      }
    }
    for (const value of [0, 6, 10, 17, 20, 60, 67, 71, 99, -16, 16.5, "16", null, NaN, Infinity]) {
      assert(!isValidNumber(value));
    }
  });

  test("Malformed board shapes, sparse cells, and invalid values are rejected", () => {
    const shortRow = createEmptyBoard();
    shortRow[0].pop();
    const sparse = createEmptyBoard();
    delete sparse[0][0];
    const invalid = createEmptyBoard();
    invalid[0][0] = 17;
    for (const board of [null, {}, [], createEmptyBoard().slice(1), shortRow, sparse, invalid]) {
      assert(!isValidBoard(board));
      assertThrows(() => getCellValue(board, "A1"));
    }
  });

  test("On an empty board, 16 can be placed at A1 and nowhere else", () => {
    const board = createEmptyBoard();
    assertDeepEqual(getLegalTargetCells(board, 16), ["A1"]);
    for (const column of ["A", "B", "C", "D"]) {
      for (let row = 1; row <= 7; row += 1) {
        const coordinate = `${column}${row}`;
        assertEqual(canPlaceNumber(board, coordinate, 16), coordinate === "A1");
      }
    }
    assertEqual(getCellValue(placeNumber(board, "A1", 16), "A1"), 16);
  });

  test("Every valid number can be the first number at A1", () => {
    for (let tens = 1; tens <= 6; tens += 1) {
      for (let units = 1; units <= 6; units += 1) {
        const value = tens * 10 + units;
        const board = createEmptyBoard();
        assertDeepEqual(getLegalTargetCells(board, value), ["A1"]);
        assertEqual(getCellValue(placeNumber(board, "A1", value), "A1"), value);
      }
    }
  });

  test("A1=16 allows B1=24 horizontally", () => {
    const board = boardWith(["A1", 16]);
    assert(canPlaceNumber(board, "B1", 24));
    assertEqual(getCellValue(placeNumber(board, "B1", 24), "B1"), 24);
  });

  test("A1=16 rejects an equal horizontal value B1=16", () => {
    const board = boardWith(["A1", 16]);
    assert(!canPlaceNumber(board, "B1", 16));
    assertThrows(() => placeNumber(board, "B1", 16), "greater than 16");
  });

  test("A1=16 rejects a lower horizontal value B1=12", () => {
    const board = boardWith(["A1", 16]);
    assert(!canPlaceNumber(board, "B1", 12));
    assertThrows(() => placeNumber(board, "B1", 12), "greater than 16");
  });

  test("Horizontal progression accepts large gaps and does not require +1", () => {
    const board = boardWith(["A1", 16]);
    assert(canPlaceNumber(board, "B1", 61));
    assertEqual(getCellValue(placeNumber(board, "B1", 61), "B1"), 61);
    assert(canPlaceNumber(boardWith(["A1", 11]), "B1", 12));
  });

  test("A1=16 allows A2=16 vertically", () => {
    const board = boardWith(["A1", 16]);
    assert(canPlaceNumber(board, "A2", 16));
    assertEqual(getCellValue(placeNumber(board, "A2", 16), "A2"), 16);
  });

  test("A1=16 rejects a different vertical value A2=24", () => {
    const board = boardWith(["A1", 16]);
    assert(!canPlaceNumber(board, "A2", 24));
    assertThrows(() => placeNumber(board, "A2", 24), "match 16");
  });

  test("B1 and A2 can branch independently from A1 in either placement order", () => {
    const board = boardWith(["A1", 16]);
    assertDeepEqual(getLegalTargetCells(board, 24), ["B1"]);
    assertDeepEqual(getLegalTargetCells(board, 16), ["A2"]);
    const rightFirst = placeNumber(placeNumber(board, "B1", 24), "A2", 16);
    const downFirst = placeNumber(placeNumber(board, "A2", 16), "B1", 24);
    assertDeepEqual(rightFirst, downFirst);
    assertEqual(getCellValue(rightFirst, "B1"), 24);
    assertEqual(getCellValue(rightFirst, "A2"), 16);
  });

  test("Occupied cells cannot be overwritten, even with the same number", () => {
    const board = boardWith(["A1", 16], ["B1", 24]);
    for (const [coordinate, value] of [["A1", 16], ["A1", 24], ["B1", 24], ["B1", 61]]) {
      assert(!canPlaceNumber(board, coordinate, value));
      assertThrows(() => placeNumber(board, coordinate, value), "cannot be overwritten");
    }
  });

  test("Horizontal placement cannot skip an empty immediate predecessor", () => {
    const board = boardWith(["A1", 16]);
    assert(!canPlaceNumber(board, "C1", 24));
    assert(!canPlaceNumber(board, "D1", 61));
    assertThrows(() => placeNumber(board, "C1", 24), "immediately to its left or above");
  });

  test("Vertical placement cannot skip an empty immediate predecessor", () => {
    const board = boardWith(["A1", 16]);
    assert(!canPlaceNumber(board, "A3", 16));
    assert(!canPlaceNumber(board, "A7", 16));
    assertThrows(() => placeNumber(board, "A3", 16), "immediately to its left or above");
  });

  test("A diagonal neighbor cannot support placement", () => {
    const board = boardWith(["A1", 16]);
    assert(!canPlaceNumber(board, "B2", 16));
    assert(!canPlaceNumber(board, "B2", 24));
    assertThrows(() => placeNumber(board, "B2", 24), "immediately to its left or above");
  });

  test("A cell below the target cannot support upward placement", () => {
    const board = boardWith(["A1", 16], ["A2", 16], ["A3", 16], ["B3", 33], ["C3", 44]);
    assert(!canPlaceNumber(board, "C2", 44));
    assertThrows(() => placeNumber(board, "C2", 44), "immediately to its left or above");
  });

  test("Row 1 progresses only through its immediate left cell", () => {
    let board = boardWith(["A1", 16], ["B1", 24]);
    assert(canPlaceNumber(board, "C1", 35));
    assert(!canPlaceNumber(board, "D1", 46));
    board = placeNumber(board, "C1", 35);
    assert(canPlaceNumber(board, "D1", 46));
    assertEqual(getCellValue(placeNumber(board, "D1", 46), "D1"), 46);
  });

  test("Column A has no horizontal predecessor or row-wrapping connection", () => {
    const board = boardWith(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14]);
    assert(canPlaceNumber(board, "A2", 11));
    assert(!canPlaceNumber(board, "A2", 24));
    assertThrows(() => placeNumber(board, "A2", 24), "match 11");
  });

  test("Row 7 and column D use the same immediate placement rules", () => {
    let board = boardWith(["A1", 16]);
    for (let row = 2; row <= 7; row += 1) {
      board = placeNumber(board, `A${row}`, 16);
    }
    board = placeNumber(board, "B7", 24);
    board = placeNumber(board, "C7", 35);
    assert(canPlaceNumber(board, "D7", 66));
    assertEqual(getCellValue(placeNumber(board, "D7", 66), "D7"), 66);
  });

  test("OR: a valid left connection permits B2=26 despite the invalid upper connection", () => {
    const board = boardWith(["A1", 16], ["B1", 24], ["A2", 16]);
    assert(canPlaceNumber(board, "B2", 26));
    assert(getLegalTargetCells(board, 26).includes("B2"));
    assertEqual(getCellValue(placeNumber(board, "B2", 26), "B2"), 26);
  });

  test("OR: a valid upper connection permits C2=61 despite its larger left neighbor 66", () => {
    const board = boardWith(["A1", 16], ["B1", 24], ["C1", 61], ["A2", 16], ["B2", 66]);
    assert(canPlaceNumber(board, "C2", 61));
    assertDeepEqual(getLegalTargetCells(board, 61), ["C2"]);
    assertEqual(getCellValue(placeNumber(board, "C2", 61), "C2"), 61);
  });

  test("OR: a placement is legal when both connections are valid", () => {
    const board = boardWith(["A1", 16], ["B1", 24], ["A2", 16]);
    assert(canPlaceNumber(board, "B2", 24));
    assertEqual(getCellValue(placeNumber(board, "B2", 24), "B2"), 24);
  });

  test("OR: a placement is rejected when neither occupied neighbor supports it", () => {
    const board = boardWith(["A1", 16], ["B1", 24], ["A2", 16]);
    assert(!canPlaceNumber(board, "B2", 16));
    assertThrows(() => placeNumber(board, "B2", 16), "greater than 16 to the left or equal to 24 above");
  });

  test("Enumeration returns all valid targets across branches in row order", () => {
    const board = boardWith(["A1", 16], ["B1", 24], ["A2", 16]);
    assertDeepEqual(getLegalTargetCells(board, 26), ["C1", "B2"]);
    assertDeepEqual(getLegalTargetCells(board, 16), ["A3"]);
  });

  test("Enumeration excludes occupied cells and reflects the latest placement", () => {
    const board = boardWith(["A1", 16], ["B1", 24], ["A2", 16], ["B2", 26]);
    assertDeepEqual(getLegalTargetCells(board, 26), ["C1", "B3"]);
    assert(!getLegalTargetCells(board, 26).includes("B2"));
  });

  test("A fully occupied board has no legal targets", () => {
    let board = createEmptyBoard();
    for (let row = 1; row <= 7; row += 1) {
      for (const [column, value] of [["A", 11], ["B", 22], ["C", 33], ["D", 44]]) {
        board = placeNumber(board, `${column}${row}`, value);
      }
    }
    assertDeepEqual(getLegalTargetCells(board, 11), []);
    assertDeepEqual(getLegalTargetCells(board, 66), []);
  });

  test("Invalid numbers are rejected by validation, enumeration, and guarded placement", () => {
    const board = createEmptyBoard();
    for (const value of [0, 10, 17, 67, -16, 16.5, "16", null, NaN, Infinity]) {
      assert(!canPlaceNumber(board, "A1", value));
      assertDeepEqual(getLegalTargetCells(board, value), []);
      assertThrows(() => placeNumber(board, "A1", value), "two-digit number");
    }
  });

  test("Out-of-range and malformed coordinates cannot be placed", () => {
    const board = createEmptyBoard();
    for (const coordinate of ["A0", "A8", "E1", "a1", "A01", "A10", "A1\n", "A1 ", null, 1]) {
      assert(!canPlaceNumber(board, coordinate, 16));
      assertThrows(() => placeNumber(board, coordinate, 16), "A1 through D7");
    }
  });

  test("Malformed boards fail validation and cannot be enumerated or placed", () => {
    for (const board of [null, [], createEmptyBoard().slice(1)]) {
      assert(!canPlaceNumber(board, "A1", 16));
      assertThrows(() => getLegalTargetCells(board, 16), "seven rows");
      assertThrows(() => placeNumber(board, "A1", 16), "seven rows");
    }
  });

  test("Successful placement copies the board without mutating frozen input", () => {
    const board = boardWith(["A1", 16]);
    board.forEach(Object.freeze);
    Object.freeze(board);
    const nextBoard = placeNumber(board, "B1", 24);
    assertEqual(getCellValue(board, "B1"), null);
    assertEqual(getCellValue(nextBoard, "B1"), 24);
    assert(nextBoard !== board);
    assert(nextBoard.every((row, index) => row !== board[index]));
    assertEqual(nextBoard.flat().filter((value) => value !== null).length, 2);
  });

  test("Rejected placements and legal-target queries leave input unchanged", () => {
    const board = boardWith(["A1", 16]);
    const before = JSON.stringify(board);
    board.forEach(Object.freeze);
    Object.freeze(board);
    assert(!validatePlacement(board, "B1", 16).legal);
    assertThrows(() => placeNumber(board, "B1", 16));
    assertDeepEqual(getLegalTargetCells(board, 24), ["B1"]);
    assertEqual(JSON.stringify(board), before);
  });

  test("Validation explains first-placement, horizontal, vertical, and missing-predecessor failures", () => {
    assert(validatePlacement(createEmptyBoard(), "B1", 16).reason.includes("first number"));
    const board = boardWith(["A1", 16]);
    assert(validatePlacement(board, "B1", 12).reason.includes("greater than 16"));
    assert(validatePlacement(board, "A2", 24).reason.includes("match 16"));
    assert(validatePlacement(board, "B2", 26).reason.includes("immediately to its left or above"));
    assertDeepEqual(validatePlacement(board, "B1", 24), { legal: true, reason: null });
  });

  return results;
}
