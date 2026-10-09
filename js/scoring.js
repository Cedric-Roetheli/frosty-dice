import { BOARD_COLUMNS, isValidBoard, isValidNumber } from "./game.js";

export function isStreetRow(row) {
  if (!Array.isArray(row) || row.length !== BOARD_COLUMNS.length) {
    return false;
  }
  for (let column = 0; column < row.length; column += 1) {
    if (!isValidNumber(row[column])) {
      return false;
    }
    if (column > 0 && row[column] !== row[column - 1] + 1) {
      return false;
    }
  }
  return true;
}

// Count every present value. Connectivity and number origin do not affect scoring.
export function getScoreBreakdown(board, ownRollCount) {
  if (!isValidBoard(board)) {
    throw new TypeError("Score requires a board with seven rows of four valid numbers or empty cells.");
  }
  if (!Number.isSafeInteger(ownRollCount) || ownRollCount < 0) {
    throw new RangeError("Own counted rolls must be a non-negative integer.");
  }

  let baseSum = 0;
  let streetBonus = 0;
  const streetRows = [];
  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    const row = board[rowIndex];
    const rowSum = row.reduce((total, value) => total + (value === null ? 0 : value), 0);
    baseSum += rowSum;
    if (isStreetRow(row)) {
      streetRows.push(rowIndex + 1);
      streetBonus += rowSum;
    }
  }

  const numerator = baseSum + streetBonus;
  return {
    baseSum,
    streetBonus,
    streetRows,
    numerator,
    ownRollCount,
    score: ownRollCount === 0 ? 0 : numerator / ownRollCount,
  };
}

export function calculateScore(board, ownRollCount) {
  return getScoreBreakdown(board, ownRollCount).score;
}
