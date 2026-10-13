import { createEmptyBoard } from "../js/game.js";
import { calculateScore, getScoreBreakdown, isStreetRow } from "../js/scoring.js";
import { boardFixture, freezeBoardSnapshot, placedBoard } from "./fixtures.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

function normalStreetRow(...values) {
  return values.map((value) => value === null ? null : { value, status: "normal" });
}

export function runScoringTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }

  test("Four consecutive increasing normal cells form a Street", () => {
    assert(isStreetRow(normalStreetRow(11, 12, 13, 14)));
  });

  test("Non-consecutive, repeated, or decreasing rows are not Streets", () => {
    for (const values of [[11, 13, 14, 15], [11, 12, 12, 13], [14, 13, 12, 11]]) {
      assert(!isStreetRow(normalStreetRow(...values)));
    }
  });

  test("Incomplete or malformed rows are not Streets", () => {
    for (const row of [normalStreetRow(11, 12, 13, null), normalStreetRow(11, 12, 13),
      Array(4), normalStreetRow(16, 17, 18, 19), [11, 12, 13, 14], null]) {
      assert(!isStreetRow(row));
    }
  });

  test("Frozen and thawed primes disqualify an otherwise consecutive Street", () => {
    for (const status of ["frozen", "thawed"]) {
      const row = normalStreetRow(11, 12, 13, 14);
      row[2].status = status;
      assert(!isStreetRow(row));
    }
  });

  test("An empty board scores zero with no bonus", () => {
    assertDeepEqual(getScoreBreakdown(createEmptyBoard()), { baseSum: 0, streetBonus: 0, streetRows: [], score: 0 });
  });

  test("A normal board scores its full sum without division", () => {
    const board = placedBoard(["A1", 16], ["B1", 24], ["A2", 16], ["B2", 26]);
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 82, streetBonus: 0, streetRows: [], score: 82 });
  });

  test("A Street row contributes its full value twice", () => {
    const board = placedBoard(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14]);
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 50, streetBonus: 50, streetRows: [1], score: 100 });
  });

  test("Multiple Streets each receive their full bonus", () => {
    const board = boardFixture(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14],
      ["A3", 21], ["B3", 22], ["C3", 23], ["D3", 24], ["D7", 33]);
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 173, streetBonus: 140, streetRows: [1, 3], score: 313 });
  });

  test("Frozen occupied values contribute zero points", () => {
    const board = placedBoard(["A1", 11], ["B1", 13]);
    assertEqual(calculateScore(board), 11);
    assertEqual(calculateScore(boardFixture(["D7", 61, "frozen"])), 0);
  });

  test("Actual freezing prevents a complete numeric row receiving a Street bonus", () => {
    const board = placedBoard(["A1", 11], ["B1", 12], ["B2", 12], ["C2", 13],
      ["C1", 13], ["D2", 14], ["D1", 14]);
    assertDeepEqual(board[0].map((cell) => cell.value), [11, 12, 13, 14]);
    assertEqual(board[0][2].status, "frozen");
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 76, streetBonus: 0, streetRows: [], score: 76 });
  });

  test("Thawing never restores a damaged cell's points or its row's Street bonus", () => {
    const board = placedBoard(["A1", 11], ["B1", 12], ["B2", 12], ["C2", 13],
      ["C1", 13], ["D2", 14], ["D1", 14], ["A2", 11]);
    assertEqual(board[0][2].status, "thawed");
    assertEqual(board[1][0].status, "frozen");
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 76, streetBonus: 0, streetRows: [], score: 76 });
  });

  test("Successive freezes keep both current and previously frozen values scoreless", () => {
    const board = placedBoard(["A1", 23], ["B1", 31], ["A2", 23], ["C1", 41]);
    assertEqual(calculateScore(board), 23);
    assertEqual(board[0][1].status, "thawed");
    assertEqual(board[1][0].status, "thawed");
    assertEqual(board[0][2].status, "frozen");
    assertEqual(calculateScore(placedBoard(["A1", 23], ["B1", 31], ["A2", 23], ["C1", 46])), 69);
  });

  test("Score does not depend on any legacy roll-count argument", () => {
    const board = placedBoard(["A1", 16]);
    for (const formerCount of [0, 1, 2, 100, undefined, NaN, "invalid"]) {
      assertEqual(calculateScore(board, formerCount), 16);
      assertEqual(getScoreBreakdown(board, formerCount).score, 16);
    }
  });

  test("All normal snapshot cells count without an A1 connectivity check", () => {
    assertEqual(calculateScore(boardFixture(["D7", 46], ["C3", 31, "frozen"])), 46);
  });

  test("Vertical consecutive values receive no Street bonus", () => {
    const board = boardFixture(["A1", 11], ["A2", 12], ["A3", 13], ["A4", 14]);
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 50, streetBonus: 0, streetRows: [], score: 50 });
  });

  test("Scoring is pure and does not store derived information", () => {
    const board = freezeBoardSnapshot(placedBoard(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14]));
    const before = JSON.stringify(board);
    getScoreBreakdown(board).streetRows.push(7);
    assertDeepEqual(getScoreBreakdown(board).streetRows, [1]);
    assertEqual(JSON.stringify(board), before);
  });

  test("Malformed board snapshots are rejected by scoring", () => {
    for (const board of [null, [], boardFixture(["A1", 17]), boardFixture(["A1", 22, "frozen"])]) {
      assertThrows(() => calculateScore(board), "seven rows");
    }
  });

  return results;
}
