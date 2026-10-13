import {
  canPlaceNumber, getCell, getCellValue, getLegalTargetCells, isCellEmpty,
  isCellFrozen, isCellOccupied, isCellThawed, isCellUsable, isPrimeNumber, placeNumber,
} from "../js/game.js";
import { boardFixture, freezeBoardSnapshot, placedBoard } from "./fixtures.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

export function runFrozenPrimeTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }

  test("Prime detection covers every possible dice number", () => {
    const primes = [11, 13, 23, 31, 41, 43, 53, 61];
    for (let tens = 1; tens <= 6; tens += 1) {
      for (let units = 1; units <= 6; units += 1) {
        const value = tens * 10 + units;
        assertEqual(isPrimeNumber(value), primes.includes(value));
      }
    }
  });

  test("Prime detection rejects non-dice numbers and non-numeric values", () => {
    for (const value of [2, 7, 17, 67, 71, -13, 13.5, "13", null, undefined, NaN, Infinity]) {
      assert(!isPrimeNumber(value));
    }
  });

  test("A legally placed prime freezes beside a prime in any orthogonal direction", () => {
    for (const [coordinate, neighbor, value] of [["A2", 11, 13], ["C2", 13, 11],
      ["B1", 11, 11], ["B3", 11, 11]]) {
      const board = boardFixture([coordinate, neighbor]);
      assert(canPlaceNumber(board, "B2", value));
      assertDeepEqual(getCell(placeNumber(board, "B2", value), "B2"), { value, status: "frozen" });
    }
  });

  test("A prime beside only a non-prime remains normal", () => {
    const board = placedBoard(["A1", 12], ["B1", 13]);
    assert(!isCellFrozen(board, "B1"));
    assert(isCellUsable(board, "B1"));
  });

  test("A non-prime beside a prime remains normal", () => {
    const board = placedBoard(["A1", 11], ["B1", 12]);
    assert(!isCellFrozen(board, "B1"));
  });

  test("Existing primes never freeze retroactively", () => {
    const original = placedBoard(["A1", 11]);
    const placed = placeNumber(original, "B1", 13);
    assert(!isCellFrozen(original, "A1"));
    assert(!isCellFrozen(placed, "A1"));
    assert(isCellFrozen(placed, "B1"));
  });

  test("Several adjacent primes freeze only the new cell once", () => {
    const board = boardFixture(["A2", 13], ["C2", 31], ["B1", 23], ["B3", 41]);
    const placed = placeNumber(board, "B2", 23);
    assertDeepEqual(getCell(placed, "B2"), { value: 23, status: "frozen" });
    for (const coordinate of ["A2", "C2", "B1", "B3"]) assert(!isCellFrozen(placed, coordinate));
  });

  test("An illegal prime attempt neither places nor freezes anything", () => {
    const board = placedBoard(["A1", 23]);
    const before = JSON.stringify(board);
    assertThrows(() => placeNumber(board, "B1", 13), "greater than 23");
    assertEqual(JSON.stringify(board), before);
    assert(isCellEmpty(board, "B1"));
    assert(!isCellFrozen(board, "A1"));
  });

  test("A frozen prime is occupied and cannot be overwritten", () => {
    const board = placedBoard(["A1", 11], ["B1", 13]);
    assert(isCellOccupied(board, "B1"));
    assert(!isCellEmpty(board, "B1"));
    assert(!isCellUsable(board, "B1"));
    assertEqual(getCellValue(board, "B1"), 13);
    for (const value of [13, 24]) assertThrows(() => placeNumber(board, "B1", value), "cannot be overwritten");
  });

  test("Frozen neighbors cannot support placement in any direction", () => {
    const board = boardFixture(["B2", 31, "frozen"]);
    for (const [coordinate, value] of [["A2", 23], ["C2", 41], ["B1", 31], ["B3", 31]]) {
      assert(!canPlaceNumber(board, coordinate, value));
      assert(!getLegalTargetCells(board, value).includes(coordinate));
      assertThrows(() => placeNumber(board, coordinate, value), "non-frozen occupied");
    }
  });

  test("Another normal neighbor can support placement despite a frozen neighbor", () => {
    const board = boardFixture(["A2", 23, "frozen"], ["B1", 24]);
    assert(canPlaceNumber(board, "B2", 24));
    assert(!isCellFrozen(placeNumber(board, "B2", 24), "B2"));
  });

  test("Frozen prime contact causes freezing only when another usable neighbor makes placement legal", () => {
    const board = boardFixture(["A2", 16], ["B1", 13, "frozen"]);
    assert(!canPlaceNumber(board, "B2", 13));
    assertThrows(() => placeNumber(board, "B2", 13));
    assert(canPlaceNumber(board, "B2", 23));
    const moved = placeNumber(board, "B2", 23);
    assert(isCellFrozen(moved, "B2"));
    assertDeepEqual(getCell(moved, "B1"), { value: 13, status: "thawed" });
  });

  test("Diagonal prime contact does not freeze the new prime", () => {
    const board = placedBoard(["A1", 12], ["B1", 13], ["A2", 12], ["B2", 22]);
    assert(!isCellFrozen(placeNumber(board, "C2", 23), "C2"));
  });

  test("A board containing only frozen cells is not treated as empty", () => {
    const board = boardFixture(["B2", 31, "frozen"]);
    assert(!canPlaceNumber(board, "A1", 16));
    assertDeepEqual(getLegalTargetCells(board, 16), []);
  });

  test("A new freeze thaws the old cell without mutating the original snapshot", () => {
    const board = freezeBoardSnapshot(placedBoard(["A1", 11], ["B1", 13]));
    const before = JSON.stringify(board);
    getLegalTargetCells(board, 11);
    const placed = placeNumber(board, "A2", 11);
    assert(isCellFrozen(placed, "A2"));
    assert(isCellThawed(placed, "B1"));
    assert(isCellFrozen(board, "B1"));
    assert(!isCellFrozen(placed, "A1"));
    assertEqual(JSON.stringify(board), before);
    assert(placed[0][1] !== board[0][1]);
  });

  test("The clarified 23/31 example preserves thawed values and restores usability", () => {
    const before = placedBoard(["A1", 23], ["B1", 31]);
    assert(!canPlaceNumber(before, "C1", 46));
    const moved = placeNumber(before, "A2", 23);
    assertDeepEqual(getCell(moved, "A1"), { value: 23, status: "normal" });
    assertDeepEqual(getCell(moved, "B1"), { value: 31, status: "thawed" });
    assertDeepEqual(getCell(moved, "A2"), { value: 23, status: "frozen" });
    assert(isCellOccupied(moved, "B1"));
    assert(isCellUsable(moved, "B1"));
    assert(getLegalTargetCells(moved, 46).includes("C1"));
    assertEqual(getCellValue(placeNumber(moved, "C1", 46), "C1"), 46);
    for (const value of [31, 46]) assertThrows(() => placeNumber(moved, "B1", value), "cannot be overwritten");
  });

  test("Repeated freeze moves leave at most one current freeze and preserve previous damage", () => {
    let board = placedBoard(["A1", 23], ["B1", 31]);
    for (let row = 2; row <= 7; row += 1) {
      for (const [column, value] of [["A", 23], ["B", 31]]) {
        board = placeNumber(board, `${column}${row}`, value);
        assertEqual(board.flat().filter((cell) => cell?.status === "frozen").length, 1);
        assertEqual(getCellValue(board, `${column}${row}`), value);
      }
    }
    assertEqual(board.flat().filter((cell) => cell?.status === "thawed").length, 12);
    assertDeepEqual(getCell(board, "B7"), { value: 31, status: "frozen" });
    assertDeepEqual(getCell(board, "A1"), { value: 23, status: "normal" });
  });

  test("A thawed prime still triggers freezing and retains its damaged status", () => {
    const board = placedBoard(["A1", 23], ["B1", 31], ["A2", 23]);
    const moved = placeNumber(board, "C1", 41);
    assertDeepEqual(getCell(moved, "C1"), { value: 41, status: "frozen" });
    assertDeepEqual(getCell(moved, "B1"), { value: 31, status: "thawed" });
    assertDeepEqual(getCell(moved, "A2"), { value: 23, status: "thawed" });
  });

  test("Only a new freeze moves the current freeze", () => {
    const board = placedBoard(["A1", 23], ["B1", 31]);
    const moved = placeNumber(board, "A2", 23);
    const withComposite = placeNumber(moved, "C1", 46);
    assertDeepEqual(getCell(withComposite, "A2"), { value: 23, status: "frozen" });
    assertDeepEqual(getCell(withComposite, "C1"), { value: 46, status: "normal" });
    const isolatedPrime = placeNumber(withComposite, "D1", 53);
    assertDeepEqual(getCell(isolatedPrime, "D1"), { value: 53, status: "normal" });
    assertDeepEqual(getCell(isolatedPrime, "A2"), { value: 23, status: "frozen" });
  });

  test("An otherwise illegal placement cannot thaw its only supporting frozen neighbor", () => {
    const board = freezeBoardSnapshot(placedBoard(["A1", 23], ["B1", 31]));
    const before = JSON.stringify(board);
    assertThrows(() => placeNumber(board, "C1", 41), "non-frozen occupied");
    assertEqual(JSON.stringify(board), before);
    assert(isCellFrozen(board, "B1"));
    assert(isCellEmpty(board, "C1"));
  });

  test("A thawed cell supports all four ordinary placement relationships", () => {
    const board = boardFixture(["B2", 31, "thawed"]);
    for (const [coordinate, value] of [["A2", 24], ["C2", 46], ["B1", 31], ["B3", 31]]) {
      assert(canPlaceNumber(board, coordinate, value));
      assertEqual(getCellValue(placeNumber(board, coordinate, value), coordinate), value);
    }
    assert(!canPlaceNumber(board, "A1", 16)); // Still not an empty board.
  });

  return results;
}
