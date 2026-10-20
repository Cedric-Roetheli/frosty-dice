import { BOARD_COLUMNS, isValidBoard, isValidBoardCell } from "./board-state.js?v=v3-multipliers-1";

// Index in 11–16, 21–26, ... 61–66, after cell validation excludes impossible values.
function streetPosition(value) {
  return (Math.floor(value / 10) - 1) * 6 + value % 10 - 1;
}

export function getCellScoreMultiplier(cell, street = false) {
  if (!isValidBoardCell(cell)) throw new TypeError("Use a valid cell record or an empty cell.");
  if (cell === null || cell.status !== "normal") return 0;
  const repdigitMultiplier = cell.value % 11 === 0 ? 2 : 1;
  return repdigitMultiplier * (street && !cell.attackIce ? 2 : 1);
}

function cellContribution(cell, street = false) {
  return cell === null ? 0 : cell.value * getCellScoreMultiplier(cell, street);
}

export function isStreetRow(row) {
  if (!Array.isArray(row) || row.length !== BOARD_COLUMNS.length) return false;
  for (let column = 0; column < row.length; column += 1) {
    const cell = row[column];
    if (!isValidBoardCell(cell) || cell === null || cell.status !== "normal" || cell.attackIce) return false;
    if (column > 0 && streetPosition(cell.value) !== streetPosition(row[column - 1].value) + 1) return false;
  }
  return true;
}

export function getScoreBreakdown(board, pointsSpent = 0) {
  if (!isValidBoard(board)) {
    throw new TypeError("Score requires seven rows of four valid cell records or empty cells.");
  }
  if (!Number.isSafeInteger(pointsSpent) || pointsSpent < 0) {
    throw new TypeError("Spent points must be a nonnegative integer.");
  }
  let baseSum = 0;
  let streetBonus = 0;
  const streetRows = [];
  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    const row = board[rowIndex];
    const rowSum = row.reduce((sum, cell) => sum + cellContribution(cell), 0);
    baseSum += rowSum;
    if (isStreetRow(row)) {
      streetRows.push(rowIndex + 1);
      const streetTotal = row.reduce((sum, cell) => sum + cellContribution(cell, true), 0);
      streetBonus += streetTotal - rowSum;
    }
  }
  return { baseSum, streetBonus, streetRows, score: Math.max(0, baseSum + streetBonus - pointsSpent) };
}

export function calculateScore(board, pointsSpent = 0) {
  return getScoreBreakdown(board, pointsSpent).score;
}
