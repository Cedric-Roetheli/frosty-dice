// Shared board shape and value validation, independent of scoring and actions.
export const BOARD_COLUMNS = Object.freeze(["A", "B", "C", "D"]);
export const BOARD_ROW_COUNT = 7;
const DICE_PRIMES = Object.freeze([11, 13, 23, 31, 41, 43, 53, 61]);
const CELL_STATUSES = Object.freeze(["normal", "frozen", "thawed"]);

export function isValidNumber(value) {
  if (!Number.isInteger(value)) {
    return false;
  }
  const tens = Math.floor(value / 10);
  const units = value % 10;
  return tens >= 1 && tens <= 6 && units >= 1 && units <= 6;
}

export function isPrimeNumber(value) {
  return isValidNumber(value) && DICE_PRIMES.includes(value);
}

export function isValidBoardCell(cell) {
  return cell === null || (typeof cell === "object" && !Array.isArray(cell)
    && isValidNumber(cell.value) && CELL_STATUSES.includes(cell.status)
    && (!Object.prototype.hasOwnProperty.call(cell, "attackIce") || typeof cell.attackIce === "boolean")
    && (cell.status !== "frozen" || (isPrimeNumber(cell.value) && !cell.attackIce)));
}

// Validate the snapshot, without replaying placement history or A1 connectivity.
export function isValidBoard(board) {
  if (!Array.isArray(board) || board.length !== BOARD_ROW_COUNT) {
    return false;
  }
  let frozenCount = 0;
  let attackIceCount = 0;
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== BOARD_COLUMNS.length) {
      return false;
    }
    for (const cell of row) {
      if (!isValidBoardCell(cell)) {
        return false;
      }
      if (cell !== null && cell.status === "frozen") {
        frozenCount += 1;
        if (frozenCount > 1) return false;
      }
      if (cell?.attackIce) {
        attackIceCount += 1;
        if (attackIceCount > 1) return false;
      }
    }
  }
  return true;
}

