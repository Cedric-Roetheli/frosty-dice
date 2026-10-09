import {
  confirmOwnRoll,
  createEmptyBoard,
  createGameState,
  placeExternalNumber,
  placeOwnRollNumber,
  placeStolenNumber,
  removeOwnNumber,
} from "../js/game.js";
import { calculateScore, getScoreBreakdown, isStreetRow } from "../js/scoring.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

function scoringBoard(...rows) {
  const board = createEmptyBoard();
  rows.forEach((row, index) => { board[index] = [...row]; });
  return board;
}

export function runScoringTests() {
  const results = [];
  function test(name, action) {
    try {
      action();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, message: error.message });
    }
  }

  test("11, 12, 13, 14 is a complete increasing Street", () => {
    assert(isStreetRow([11, 12, 13, 14]));
  });

  test("A non-consecutive full row is not a Street", () => {
    assert(!isStreetRow([11, 13, 14, 15]));
  });

  test("Incomplete and sparse rows are not Streets", () => {
    assert(!isStreetRow([11, 12, 13, null]));
    assert(!isStreetRow([11, 12, 13]));
    assert(!isStreetRow(Array(4)));
    assert(!isStreetRow([null, null, null, null]));
  });

  test("Decreasing, unordered, and repeated values are not Streets", () => {
    assert(!isStreetRow([14, 13, 12, 11]));
    assert(!isStreetRow([11, 13, 12, 14]));
    assert(!isStreetRow([11, 12, 12, 13]));
  });

  test("Street detection rejects rows outside the board's number format", () => {
    assert(!isStreetRow([16, 17, 18, 19]));
    assert(!isStreetRow(["11", 12, 13, 14]));
    assert(!isStreetRow([11, 12, 13, 14, 15]));
    assert(!isStreetRow(null));
  });

  test("An empty board has zero base points, bonus, numerator, and score", () => {
    assertDeepEqual(getScoreBreakdown(createEmptyBoard(), 0), {
      baseSum: 0, streetBonus: 0, streetRows: [], numerator: 0, ownRollCount: 0, score: 0,
    });
  });

  test("A normal board sums every occupied cell without a Street bonus", () => {
    const result = getScoreBreakdown(scoringBoard([16, 24, null, null], [16, 26, null, null]), 2);
    assertEqual(result.baseSum, 82);
    assertEqual(result.streetBonus, 0);
    assertEqual(result.numerator, 82);
    assertEqual(result.score, 41);
    assertDeepEqual(result.streetRows, []);
  });

  test("A Street's entire row sum of 50 contributes 100 to the numerator", () => {
    const result = getScoreBreakdown(scoringBoard([11, 12, 13, 14]), 2);
    assertEqual(result.baseSum, 50);
    assertEqual(result.streetBonus, 50);
    assertEqual(result.numerator, 100);
    assertEqual(result.score, 50);
    assertDeepEqual(result.streetRows, [1]);
  });

  test("Multiple Streets are independently doubled and other cells count once", () => {
    const result = getScoreBreakdown(scoringBoard(
      [11, 12, 13, 14],
      [33, null, null, null],
      [21, 22, 23, 24],
    ), 4);
    assertEqual(result.baseSum, 173);
    assertEqual(result.streetBonus, 140);
    assertEqual(result.numerator, 313);
    assertEqual(result.score, 78.25);
    assertDeepEqual(result.streetRows, [1, 3]);
  });

  test("A vertical consecutive sequence receives no Street bonus", () => {
    const result = getScoreBreakdown(scoringBoard(
      [11, null, null, null], [12, null, null, null],
      [13, null, null, null], [14, null, null, null],
    ), 1);
    assertEqual(result.numerator, 50);
    assertEqual(result.streetBonus, 0);
    assertDeepEqual(result.streetRows, []);
  });

  test("Occupied cells disconnected by removing A1 still count", () => {
    let game = placeOwnRollNumber(confirmOwnRoll(createGameState(), 1, 6), "A1", 16);
    game = placeExternalNumber(game, "B1", 24);
    game = removeOwnNumber(game, "A1");
    const result = getScoreBreakdown(game.board, game.ownRollCount);
    assertEqual(result.baseSum, 24);
    assertEqual(result.numerator, 24);
    assertEqual(result.score, 24);
    assertEqual(game.ownRollCount, 1);
  });

  test("A disconnected complete Street still receives its full doubled value", () => {
    const board = createEmptyBoard();
    board[4] = [31, 32, 33, 34];
    const result = getScoreBreakdown(board, 2);
    assertEqual(result.baseSum, 130);
    assertEqual(result.streetBonus, 130);
    assertEqual(result.numerator, 260);
    assertEqual(result.score, 130);
    assertDeepEqual(result.streetRows, [5]);
  });

  test("Score divides by own rolls and preserves calculation precision", () => {
    const board = scoringBoard([16, null, null, null]);
    assertEqual(calculateScore(board, 2), 8);
    assertEqual(calculateScore(board, 3), 16 / 3);
  });

  test("Zero own rolls returns finite zero even with board points and a Street", () => {
    const board = scoringBoard([11, 12, 13, 14]);
    const result = getScoreBreakdown(board, 0);
    assertEqual(result.numerator, 100);
    assertEqual(result.score, 0);
    assert(Number.isFinite(result.score));
    assertEqual(calculateScore(board, 0), 0);
  });

  test("Received and stolen values score normally without changing the divisor", () => {
    let game = placeOwnRollNumber(confirmOwnRoll(createGameState(), 1, 1), "A1", 11);
    game = placeStolenNumber(game, "B1", 12);
    game = placeExternalNumber(game, "C1", 13);
    game = placeExternalNumber(game, "D1", 14);
    assertEqual(game.ownRollCount, 1);
    assertEqual(calculateScore(game.board, game.ownRollCount), 100);
    const removed = removeOwnNumber(game, "B1");
    const result = getScoreBreakdown(removed.board, removed.ownRollCount);
    assertEqual(result.baseSum, 38);
    assertEqual(result.streetBonus, 0);
    assertEqual(result.score, 38);
    assertEqual(removed.ownRollCount, 1);
    assertDeepEqual(result.streetRows, []);
  });

  test("Scoring does not mutate frozen board data or store derived state", () => {
    const board = scoringBoard([11, 12, 13, 14]);
    const before = JSON.stringify(board);
    board.forEach(Object.freeze);
    Object.freeze(board);
    const result = getScoreBreakdown(board, 2);
    result.streetRows.push(7);
    assertEqual(JSON.stringify(board), before);
    assertDeepEqual(getScoreBreakdown(board, 2).streetRows, [1]);
  });

  test("Invalid own-roll divisors are rejected", () => {
    for (const count of [-1, 1.5, "2", null, NaN, Infinity]) {
      assertThrows(() => calculateScore(createEmptyBoard(), count), "non-negative integer");
    }
  });

  test("Malformed board data cannot silently produce a score", () => {
    const board = createEmptyBoard();
    board[0][0] = 17;
    for (const invalid of [null, [], createEmptyBoard().slice(1), board]) {
      assertThrows(() => calculateScore(invalid, 1), "seven rows");
    }
  });

  return results;
}
