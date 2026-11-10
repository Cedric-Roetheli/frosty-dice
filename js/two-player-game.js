// Pure rules for two independent 5×3 boards. All coordinates are owner-local.
import { isPrimeNumber, isValidBoardCell, isValidNumber } from "./board-state.js?v=v3-multipliers-1";
import { cloneCell, hasUsableConnection, orthogonalNeighbors, placeWithPrimeIce } from "./placement-rules.js?v=frontline-1";
import { getCellScoreMultiplier } from "./scoring.js?v=v3-multipliers-1";

export const TWO_PLAYER_COLUMNS = Object.freeze(["A", "B", "C", "D", "E"]);
export const TWO_PLAYER_ROWS = 3;
export const TWO_PLAYER_START_ROW = 3;
const players = [1, 2];
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const keysAre = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function createTwoPlayerBoard() {
  return Array.from({ length: TWO_PLAYER_ROWS }, () => TWO_PLAYER_COLUMNS.map(() => null));
}

export function isValidTwoPlayerBoard(board) {
  if (!Array.isArray(board) || board.length !== TWO_PLAYER_ROWS) return false;
  let frozen = 0;
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== TWO_PLAYER_COLUMNS.length) return false;
    for (const cell of row) {
      if (!isValidBoardCell(cell)) return false;
      if (cell === null) continue;
      if (!keysAre(cell, ["value", "status"]) || cell.status !== "normal" && !isPrimeNumber(cell.value)) return false;
      if (cell.status === "frozen" && ++frozen > 1) return false;
    }
  }
  return true;
}

export function isValidTwoPlayerCell(coordinate) {
  return typeof coordinate === "string" && coordinate.length === 2 && /^[A-E][1-3]$/.test(coordinate);
}

// Positive means logical A→E follows physical left→right; negative reverses it.
export function getTwoPlayerHorizontalDirection(player) {
  return mapTwoPlayerColumn(player, 1) > mapTwoPlayerColumn(player, 0) ? 1 : -1;
}

export function validateTwoPlayerPlacement(board, player, coordinate, value) {
  if (!players.includes(player)) return { legal: false, reason: "player" };
  if (!isValidTwoPlayerBoard(board)) return { legal: false, reason: "board" };
  if (!isValidTwoPlayerCell(coordinate)) return { legal: false, reason: "cell" };
  if (!isValidNumber(value)) return { legal: false, reason: "number" };
  const row = Number(coordinate[1]) - 1;
  const column = TWO_PLAYER_COLUMNS.indexOf(coordinate[0]);
  if (board[row][column] !== null) return { legal: false, reason: "occupied" };
  if (board.every((entries) => entries.every((cell) => cell === null))) {
    return { legal: row === TWO_PLAYER_START_ROW - 1, reason: row === TWO_PLAYER_START_ROW - 1 ? null : "start" };
  }
  const legal = hasUsableConnection(orthogonalNeighbors(board, row, column), value, getTwoPlayerHorizontalDirection(player));
  return { legal, reason: legal ? null : "neighbor" };
}

function placeOnBoard(board, player, coordinate, value) {
  const result = validateTwoPlayerPlacement(board, player, coordinate, value);
  if (!result.legal) throw new Error(result.reason);
  return placeWithPrimeIce(board, Number(coordinate[1]) - 1, TWO_PLAYER_COLUMNS.indexOf(coordinate[0]), value);
}

function validBoards(state) {
  return keysAre(state, ["player1", "player2"]) && players.every((player) =>
    keysAre(state["player" + player], ["board"]) && isValidTwoPlayerBoard(state["player" + player].board));
}

function boardsOnly(state) { return { player1: state.player1, player2: state.player2 }; }
function cloneBoards(state) {
  return Object.fromEntries(players.map((player) => ["player" + player,
    { board: state["player" + player].board.map((row) => row.map(cloneCell)) }]));
}

export function createTwoPlayerState() {
  return { player1: { board: createTwoPlayerBoard() }, player2: { board: createTwoPlayerBoard() }, undo: null };
}

export function isValidTwoPlayerState(state) {
  if (!keysAre(state, ["player1", "player2", "undo"]) || !validBoards(boardsOnly(state))) return false;
  if (state.undo === null) return true;
  if (!validBoards(state.undo)) return false;
  // An authoritative one-placement snapshot, never nested history or inferred ice.
  for (const player of players) {
    const other = 3 - player;
    if (!equal(state["player" + other], state.undo["player" + other])) continue;
    const before = state.undo["player" + player].board;
    const after = state["player" + player].board;
    const added = [];
    for (let row = 0; row < TWO_PLAYER_ROWS; row += 1) for (let col = 0; col < TWO_PLAYER_COLUMNS.length; col += 1) {
      if (before[row][col] === null && after[row][col] !== null) added.push([TWO_PLAYER_COLUMNS[col] + (row + 1), after[row][col].value]);
    }
    if (added.length !== 1) continue;
    for (const directionOwner of player === 1 ? [1, 2] : [2]) {
      // Old 2P saves used A→E for both players. Preserve their single Undo.
      try { if (equal(placeOnBoard(before, directionOwner, ...added[0]), after)) return true; } catch { /* Invalid history. */ }
    }
  }
  return false;
}

export function cloneTwoPlayerState(state) {
  if (!isValidTwoPlayerState(state)) throw new TypeError("Invalid two-player state.");
  return { ...cloneBoards(state), undo: state.undo === null ? null : cloneBoards(state.undo) };
}

export function placeTwoPlayerNumber(state, player, coordinate, value) {
  if (!players.includes(player)) throw new RangeError("Choose player 1 or 2.");
  if (!isValidTwoPlayerState(state)) throw new TypeError("Invalid two-player state.");
  const board = placeOnBoard(state["player" + player].board, player, coordinate, value);
  const next = cloneBoards(state);
  next["player" + player].board = board;
  return { ...next, undo: cloneBoards(state) };
}

export function undoTwoPlayerMove(state) {
  if (!isValidTwoPlayerState(state)) throw new TypeError("Invalid two-player state.");
  return state.undo === null ? state : { ...cloneBoards(state.undo), undo: null };
}

export function getTwoPlayerColumnScores(board) {
  if (!isValidTwoPlayerBoard(board)) throw new TypeError("Invalid two-player board.");
  return TWO_PLAYER_COLUMNS.map((_, col) => board.reduce((sum, row) => sum + (row[col] === null ? 0 : row[col].value * getCellScoreMultiplier(row[col])), 0));
}

// The TOP player is rotated; reversing an index is its own inverse.
export function mapTwoPlayerColumn(player, index) {
  if (!players.includes(player) || !Number.isInteger(index) || index < 0 || index >= 5) throw new RangeError("Choose a player and column 0–4.");
  return player === 1 ? 4 - index : index;
}

export function getTwoPlayerDuels(state) {
  if (!isValidTwoPlayerState(state)) throw new TypeError("Invalid two-player state.");
  const scores = [getTwoPlayerColumnScores(state.player1.board), getTwoPlayerColumnScores(state.player2.board)];
  return TWO_PLAYER_COLUMNS.map((_, physical) => {
    const a = scores[0][mapTwoPlayerColumn(1, physical)];
    const b = scores[1][mapTwoPlayerColumn(2, physical)];
    return { physical, player1: { score: a, lit: a > 0 && a >= b }, player2: { score: b, lit: b > 0 && b >= a } };
  });
}
