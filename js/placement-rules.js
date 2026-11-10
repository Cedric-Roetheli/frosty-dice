// Shared numeric relationships and Prime Ice transitions. Callers validate shape,
// coordinates, emptiness, and their mode's first-placement rule before calling.
import { isPrimeNumber } from "./board-state.js?v=v3-multipliers-1";

export function orthogonalNeighbors(board, row, column) {
  return {
    left: column > 0 ? board[row][column - 1] : null,
    right: column + 1 < board[row].length ? board[row][column + 1] : null,
    above: row > 0 ? board[row - 1][column] : null,
    below: row + 1 < board.length ? board[row + 1][column] : null,
  };
}

export function usableValue(cell) {
  return cell === null || cell.status === "frozen" || cell.attackIce ? null : cell.value;
}

export function hasUsableConnection(neighbors, value, horizontalDirection = 1) {
  const left = usableValue(neighbors.left);
  const right = usableValue(neighbors.right);
  const above = usableValue(neighbors.above);
  const below = usableValue(neighbors.below);
  return (left !== null && (value - left) * horizontalDirection > 0)
    || (right !== null && (right - value) * horizontalDirection > 0)
    || (above !== null && value === above) || (below !== null && value === below);
}

export function cloneCell(cell) {
  if (cell === null) return null;
  const copy = { value: cell.value, status: cell.status };
  if (cell.attackIce) copy.attackIce = true;
  return copy;
}

export function placeWithPrimeIce(board, row, column, value) {
  const frozen = isPrimeNumber(value) && Object.values(orthogonalNeighbors(board, row, column))
    .some((cell) => cell !== null && isPrimeNumber(cell.value));
  const next = board.map((entries) => entries.map(cloneCell));
  if (frozen) for (const entries of next) for (const cell of entries) {
    if (cell?.status === "frozen") cell.status = "thawed";
  }
  next[row][column] = { value, status: frozen ? "frozen" : "normal" };
  return next;
}
