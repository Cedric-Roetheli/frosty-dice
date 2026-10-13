import { BOARD_COLUMNS, isValidBoard, isValidBoardCell } from "./game.js?v=attack-ice-1";

export function isStreetRow(row) {
  if (!Array.isArray(row) || row.length !== BOARD_COLUMNS.length) return false;
  for (let column = 0; column < row.length; column += 1) {
    const cell = row[column];
    if (!isValidBoardCell(cell) || cell === null || cell.status !== "normal" || cell.attackIce) return false;
    if (column > 0 && cell.value !== row[column - 1].value + 1) return false;
  }
  return true;
}

export function getScoreBreakdown(board) {
  if (!isValidBoard(board)) {
    throw new TypeError("Score requires seven rows of four valid cell records or empty cells.");
  }
  let baseSum = 0;
  let streetBonus = 0;
  const streetRows = [];
  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    const row = board[rowIndex];
    const rowSum = row.reduce((sum, cell) => sum + (cell === null || cell.status !== "normal" ? 0 : cell.value), 0);
    baseSum += rowSum;
    if (isStreetRow(row)) {
      streetRows.push(rowIndex + 1);
      streetBonus += rowSum;
    }
  }
  return { baseSum, streetBonus, streetRows, score: baseSum + streetBonus };
}

export function calculateScore(board) {
  return getScoreBreakdown(board).score;
}
