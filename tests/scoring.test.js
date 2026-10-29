import { createEmptyBoard } from "../js/game.js";
import { calculateScore, getCellScoreMultiplier, getScoreBreakdown, isStreetRow } from "../js/scoring.js";
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

  test("A Street doubles each scoring contribution including the repdigit multiplier", () => {
    const board = placedBoard(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14]);
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 61, streetBonus: 61, streetRows: [1], score: 122 });
  });

  test("Multiple Streets each receive their full bonus", () => {
    const board = boardFixture(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14],
      ["A3", 21], ["B3", 22], ["C3", 23], ["D3", 24], ["D7", 33]);
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 239, streetBonus: 173, streetRows: [1, 3], score: 412 });
  });

  test("Frozen occupied values contribute zero points", () => {
    const board = placedBoard(["A1", 11], ["B1", 13]);
    assertEqual(calculateScore(board), 22);
    assertEqual(calculateScore(boardFixture(["D7", 61, "frozen"])), 0);
  });

  test("Actual freezing prevents a complete numeric row receiving a Street bonus", () => {
    const board = placedBoard(["A1", 11], ["B1", 12], ["B2", 12], ["C2", 13],
      ["C1", 13], ["D2", 14], ["D1", 14]);
    assertDeepEqual(board[0].map((cell) => cell.value), [11, 12, 13, 14]);
    assertEqual(board[0][2].status, "frozen");
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 87, streetBonus: 0, streetRows: [], score: 87 });
  });

  test("Thawing never restores a damaged cell's points or its row's Street bonus", () => {
    const board = placedBoard(["A1", 11], ["B1", 12], ["B2", 12], ["C2", 13],
      ["C1", 13], ["D2", 14], ["D1", 14], ["A2", 11]);
    assertEqual(board[0][2].status, "thawed");
    assertEqual(board[1][0].status, "frozen");
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 87, streetBonus: 0, streetRows: [], score: 87 });
  });

  test("Successive freezes keep both current and previously frozen values scoreless", () => {
    const board = placedBoard(["A1", 23], ["B1", 31], ["A2", 23], ["C1", 41]);
    assertEqual(calculateScore(board), 23);
    assertEqual(board[0][1].status, "thawed");
    assertEqual(board[1][0].status, "thawed");
    assertEqual(board[0][2].status, "frozen");
    assertEqual(calculateScore(placedBoard(["A1", 23], ["B1", 31], ["A2", 23], ["C1", 46])), 69);
  });

  test("Score subtracts confirmed spending without any roll divisor", () => {
    const board = placedBoard(["A1", 16]);
    for (const [spent, expected] of [[0, 16], [1, 15], [2, 14], [16, 0], [100, 0], [undefined, 16]]) {
      assertEqual(calculateScore(board, spent), expected);
      assertEqual(getScoreBreakdown(board, spent).score, expected);
    }
    for (const spent of [-1, 1.5, null, NaN, Infinity, "invalid"]) {
      assertThrows(() => calculateScore(board, spent), "nonnegative integer");
    }
  });

  test("All normal snapshot cells count without an A1 connectivity check", () => {
    assertEqual(calculateScore(boardFixture(["D7", 46], ["C3", 31, "frozen"])), 46);
  });

  test("Vertical consecutive values receive no Street bonus", () => {
    const board = boardFixture(["A1", 11], ["A2", 12], ["A3", 13], ["A4", 14]);
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 61, streetBonus: 0, streetRows: [], score: 61 });
  });

  for (const value of [11, 22, 33, 44, 55, 66]) {
    test("Normal repdigit " + value + " contributes " + value * 2 + " without changing the cell record", () => {
      const board = freezeBoardSnapshot(value === 66 ? boardFixture(["A2", value]) : placedBoard(["A1", value]));
      assertEqual(calculateScore(board), value * 2);
      assertDeepEqual(board[value === 66 ? 1 : 0][0], { value, status: "normal" });
    });
  }

  test("An ordinary normal 35 continues contributing 35", () => {
    assertEqual(calculateScore(placedBoard(["A1", 35])), 35);
  });

  test("Prime-frozen and thawed repdigit 11 score zero even under permitted Attack Ice", () => {
    for (const status of ["frozen", "thawed"]) {
      const board = boardFixture(["A1", 11, status]);
      assertEqual(calculateScore(board), 0);
      if (status === "thawed") {
        board[0][0].attackIce = true;
        assertEqual(calculateScore(board), 0);
      }
    }
  });

  test("Attack Ice preserves the doubled underlying contribution of a normal repdigit", () => {
    for (const value of [11, 22, 33, 44, 55, 66]) {
      const board = boardFixture(["A1", value]);
      board[0][0].attackIce = true;
      assertEqual(calculateScore(board), value * 2);
    }
  });

  for (const values of [[23, 24, 25, 26], [24, 25, 26, 31], [25, 26, 31, 32],
    [55, 56, 61, 62], [56, 61, 62, 63], [63, 64, 65, 66]]) {
    test(values.join(",") + " forms a Street in possible dice-number order", () => {
      assert(isStreetRow(normalStreetRow(...values)));
    });
  }

  for (const values of [[23, 24, 25, 31], [55, 56, 62, 63], [11, 13, 14, 15],
    [32, 31, 26, 25], [65, 66, 11, 12], [15, 16, 17, 21], [56, 57, 61, 62]]) {
    test(values.join(",") + " does not form a Street", () => {
      assert(!isStreetRow(normalStreetRow(...values)));
    });
  }

  test("Every four-number window of the 36 possible numbers qualifies in order", () => {
    const numbers = [11, 12, 13, 14, 15, 16, 21, 22, 23, 24, 25, 26,
      31, 32, 33, 34, 35, 36, 41, 42, 43, 44, 45, 46,
      51, 52, 53, 54, 55, 56, 61, 62, 63, 64, 65, 66];
    for (let start = 0; start <= numbers.length - 4; start += 1) {
      assert(isStreetRow(normalStreetRow(...numbers.slice(start, start + 4))));
    }
  });

  test("Boundary Streets retain Prime Ice, permanent damage, and Attack Ice exclusions", () => {
    for (const status of ["frozen", "thawed"]) {
      const row = normalStreetRow(56, 61, 62, 63);
      row[1].status = status;
      assert(!isStreetRow(row));
    }
    const row = normalStreetRow(56, 61, 62, 63);
    row[2].attackIce = true;
    assert(!isStreetRow(row));
  });

  test("Boundary Street with 55 combines the repdigit and Street multipliers exactly once", () => {
    const board = placedBoard(["A1", 55], ["B1", 56], ["C1", 61], ["D1", 62]);
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 289, streetBonus: 289, streetRows: [1], score: 578 });
  });

  test("Normal 22 and 66 have a 2x multiplier and contribute 44 and 132", () => {
    for (const [value, points] of [[22, 44], [66, 132]]) {
      const board = value === 66 ? boardFixture(["A2", value]) : placedBoard(["A1", value]);
      assertEqual(getCellScoreMultiplier(board[value === 66 ? 1 : 0][0]), 2);
      assertEqual(calculateScore(board), points);
    }
  });

  test("An ordinary Street cell has 2x while its repdigit neighbor has one combined 4x", () => {
    const row = normalStreetRow(33, 34, 35, 36);
    assert(isStreetRow(row));
    assertEqual(getCellScoreMultiplier(row[2], true), 2);
    assertEqual(row[2].value * getCellScoreMultiplier(row[2], true), 70);
    assertEqual(getCellScoreMultiplier(row[0], true), 4);
    assertEqual(getCellScoreMultiplier({ value: 35, status: "normal" }), 1);
    assertEqual(getCellScoreMultiplier(null), 0);
  });

  test("Street 22 contributes exactly 88 without an additional repdigit or Street bonus", () => {
    const board = placedBoard(["A1", 21], ["B1", 22], ["C1", 23], ["D1", 24]);
    assert(isStreetRow(board[0]));
    assertEqual(getCellScoreMultiplier(board[0][1], true), 4);
    assertEqual(board[0][1].value * getCellScoreMultiplier(board[0][1], true), 88);
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 112, streetBonus: 112, streetRows: [1], score: 224 });
    assertEqual(calculateScore(board) - (21 + 23 + 24) * 2, 88);
  });

  test("Prime-frozen and thawed repdigit 11 have no scoring multiplier even in Street context", () => {
    for (const status of ["frozen", "thawed"]) {
      const board = boardFixture(["A1", 11, status]);
      assertEqual(getCellScoreMultiplier(board[0][0]), 0);
      assertEqual(getCellScoreMultiplier(board[0][0], true), 0);
      assertEqual(calculateScore(board), 0);
    }
  });

  test("Attack Ice retains only base multipliers and suppresses the whole Street", () => {
    const board = boardFixture(["A1", 21], ["B1", 22], ["C1", 23], ["D1", 24]);
    board[0][1].attackIce = true;
    assert(!isStreetRow(board[0]));
    assertEqual(getCellScoreMultiplier(board[0][1], true), 2);
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 112, streetBonus: 0, streetRows: [], score: 112 });
    assertEqual(getCellScoreMultiplier({ value: 35, status: "normal", attackIce: true }, true), 1);
    assertEqual(getCellScoreMultiplier({ value: 11, status: "thawed", attackIce: true }, true), 0);
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
