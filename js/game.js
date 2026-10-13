// Pure rules and canonical board state. Cell names use A1–D7.
export const BOARD_COLUMNS = Object.freeze(["A", "B", "C", "D"]);
export const BOARD_ROW_COUNT = 7;
const DICE_PRIMES = Object.freeze([11, 13, 23, 31, 41, 43, 53, 61]);
const CELL_STATUSES = Object.freeze(["normal", "frozen", "thawed"]);

export function createEmptyBoard() {
  return Array.from({ length: BOARD_ROW_COUNT }, () => BOARD_COLUMNS.map(() => null));
}

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

export function isValidCell(coordinate) {
  return typeof coordinate === "string" && coordinate.length === 2 && /^[A-D][1-7]$/.test(coordinate);
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

export function getCell(board, coordinate) {
  if (!isValidBoard(board)) {
    throw new TypeError("The board must have seven rows of four empty cells or valid cell records.");
  }
  if (!isValidCell(coordinate)) {
    throw new RangeError("Choose a cell from A1 through D7.");
  }
  const cell = board[Number(coordinate[1]) - 1][BOARD_COLUMNS.indexOf(coordinate[0])];
  return cloneCell(cell);
}

export function getCellValue(board, coordinate) {
  return getCell(board, coordinate)?.value ?? null;
}

export function isCellEmpty(board, coordinate) {
  return getCell(board, coordinate) === null;
}

export function isCellOccupied(board, coordinate) {
  return getCell(board, coordinate) !== null;
}

export function isCellFrozen(board, coordinate) {
  return getCell(board, coordinate)?.status === "frozen";
}

export function isCellThawed(board, coordinate) {
  return getCell(board, coordinate)?.status === "thawed";
}

export function isCellAttackIced(board, coordinate) {
  return getCell(board, coordinate)?.attackIce === true;
}

export function isCellUsable(board, coordinate) {
  const cell = getCell(board, coordinate);
  return usableValue(cell) !== null;
}

export function canApplyAttackIce(board, coordinate) {
  const cell = getCell(board, coordinate);
  return cell !== null && cell.status !== "frozen" && !cell.attackIce;
}

export function hasReachedGoal(board) {
  return isCellUsable(board, "D7");
}

function orthogonalNeighbors(board, row, column) {
  return {
    left: column > 0 ? board[row][column - 1] : null,
    right: column < BOARD_COLUMNS.length - 1 ? board[row][column + 1] : null,
    above: row > 0 ? board[row - 1][column] : null,
    below: row < BOARD_ROW_COUNT - 1 ? board[row + 1][column] : null,
  };
}

function usableValue(cell) {
  return cell === null || cell.status === "frozen" || cell.attackIce ? null : cell.value;
}

export function validatePlacement(board, coordinate, value) {
  if (!isValidBoard(board)) {
    return { legal: false, reason: "The board must have seven rows of four empty cells or valid cell records." };
  }
  if (!isValidCell(coordinate)) {
    return { legal: false, reason: "Choose a cell from A1 through D7." };
  }
  if (!isValidNumber(value)) {
    return { legal: false, reason: "Use a two-digit number with each digit from 1 through 6." };
  }
  const row = Number(coordinate[1]) - 1;
  const column = BOARD_COLUMNS.indexOf(coordinate[0]);
  if (board[row][column] !== null) {
    return { legal: false, reason: `${coordinate} already contains ${board[row][column].value} and cannot be overwritten.` };
  }
  if (board.every((entries) => entries.every((cell) => cell === null))) {
    return coordinate === "A1"
      ? { legal: true, reason: null }
      : { legal: false, reason: "The first number must be placed at A1." };
  }

  const neighbors = orthogonalNeighbors(board, row, column);
  const left = usableValue(neighbors.left);
  const right = usableValue(neighbors.right);
  const above = usableValue(neighbors.above);
  const below = usableValue(neighbors.below);
  if ((left !== null && value > left) || (right !== null && value < right)
      || (above !== null && value === above) || (below !== null && value === below)) {
    return { legal: true, reason: null };
  }

  const requirements = [];
  if (left !== null) requirements.push(`greater than ${left} to the left`);
  if (right !== null) requirements.push(`smaller than ${right} to the right`);
  if (above !== null) requirements.push(`equal to ${above} above`);
  if (below !== null) requirements.push(`equal to ${below} below`);
  return {
    legal: false,
    reason: requirements.length > 0
      ? `${coordinate} must be ${requirements.join(" or ")}.`
      : `${coordinate} needs a usable occupied orthogonally adjacent cell (left, right, above, or below).`,
  };
}

export function canPlaceNumber(board, coordinate, value) {
  return validatePlacement(board, coordinate, value).legal;
}

export function getLegalTargetCells(board, value) {
  if (!isValidBoard(board)) {
    throw new TypeError("The board must have seven rows of four empty cells or valid cell records.");
  }
  const targets = [];
  for (let row = 1; row <= BOARD_ROW_COUNT; row += 1) {
    for (const column of BOARD_COLUMNS) {
      const coordinate = `${column}${row}`;
      if (canPlaceNumber(board, coordinate, value)) targets.push(coordinate);
    }
  }
  return targets;
}

function cloneCell(cell) {
  if (cell === null) return null;
  // An absent overlay means no Attack Ice; retain only true in canonical records.
  const copy = { value: cell.value, status: cell.status };
  if (cell.attackIce) copy.attackIce = true;
  return copy;
}

export function cloneBoard(board) {
  if (!isValidBoard(board)) {
    throw new TypeError("The board must have seven rows of four empty cells or valid cell records.");
  }
  return board.map((row) => row.map(cloneCell));
}

export function applyAttackIce(board, coordinate) {
  const cell = getCell(board, coordinate);
  if (cell === null || cell.status === "frozen") {
    throw new Error("Attack Ice requires a normal or thawed occupied cell.");
  }
  if (cell.attackIce) return board;
  const nextBoard = cloneBoard(board);
  for (const row of nextBoard) {
    for (const entry of row) if (entry !== null) delete entry.attackIce;
  }
  nextBoard[Number(coordinate[1]) - 1][BOARD_COLUMNS.indexOf(coordinate[0])].attackIce = true;
  return nextBoard;
}

export function removeAttackIce(board, coordinate) {
  if (!isCellAttackIced(board, coordinate)) return board;
  const nextBoard = cloneBoard(board);
  delete nextBoard[Number(coordinate[1]) - 1][BOARD_COLUMNS.indexOf(coordinate[0])].attackIce;
  return nextBoard;
}

export function placeNumber(board, coordinate, value) {
  const validation = validatePlacement(board, coordinate, value);
  if (!validation.legal) throw new Error(validation.reason);

  const row = Number(coordinate[1]) - 1;
  const column = BOARD_COLUMNS.indexOf(coordinate[0]);
  // Validate before thawing. Every occupied prime counts as contact, regardless of status.
  const frozen = isPrimeNumber(value) && Object.values(orthogonalNeighbors(board, row, column))
    .some((cell) => cell !== null && isPrimeNumber(cell.value));
  const nextBoard = cloneBoard(board);
  if (frozen) {
    for (const entries of nextBoard) {
      for (const cell of entries) {
        if (cell?.status === "frozen") cell.status = "thawed";
      }
    }
  }
  nextBoard[row][column] = { value, status: frozen ? "frozen" : "normal" };
  return nextBoard;
}

export function createGameState() {
  return { board: createEmptyBoard(), undo: null };
}

function isGameRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// A snapshot contains only gameplay data, never an older Undo or derived displays.
export function isValidUndoSnapshot(snapshot, board) {
  if (!isGameRecord(snapshot) || Object.keys(snapshot).join(",") !== "board"
      || !isValidBoard(snapshot.board) || !isValidBoard(board)) return false;
  let move = null;
  let previousAttack = null;
  let currentAttack = null;
  for (let row = 0; row < BOARD_ROW_COUNT; row += 1) {
    for (let column = 0; column < BOARD_COLUMNS.length; column += 1) {
      const before = snapshot.board[row][column];
      const after = board[row][column];
      const coordinate = BOARD_COLUMNS[column] + (row + 1);
      if (before?.attackIce) previousAttack = coordinate;
      if (after?.attackIce) currentAttack = coordinate;
      if (before === null && after !== null) {
        if (move !== null) return false;
        move = { coordinate, value: after.value };
      } else if (before !== null && (after === null || before.value !== after.value)) {
        return false;
      }
    }
  }
  // Check one forward action for saved-data integrity; restoration never reverses effects.
  try {
    let expected;
    if (move !== null) expected = placeNumber(snapshot.board, move.coordinate, move.value);
    else if (previousAttack === currentAttack) return false;
    else if (currentAttack !== null) expected = applyAttackIce(snapshot.board, currentAttack);
    else expected = removeAttackIce(snapshot.board, previousAttack);
    return JSON.stringify(expected) === JSON.stringify(cloneBoard(board));
  } catch {
    return false;
  }
}

export function isValidGameState(state) {
  return isGameRecord(state) && isValidBoard(state.board)
    && (state.undo == null || isValidUndoSnapshot(state.undo, state.board));
}

export function cloneGameState(state) {
  if (!isValidGameState(state)) throw new TypeError("Use a valid game board and Undo snapshot.");
  return {
    board: cloneBoard(state.board),
    undo: state.undo == null ? null : { board: cloneBoard(state.undo.board) },
  };
}

function applyGameAction(state, operation, ...args) {
  if (!isValidGameState(state)) throw new TypeError("Use a valid game board and Undo snapshot.");
  const snapshot = { board: cloneBoard(state.board) };
  const board = operation(state.board, ...args);
  if (board === state.board) return state;
  // A failed action throws before a new state can replace the existing snapshot.
  return { board, undo: snapshot };
}

export function placeGameNumber(state, coordinate, value) {
  return applyGameAction(state, placeNumber, coordinate, value);
}

export function freezeGameCell(state, coordinate) {
  return applyGameAction(state, applyAttackIce, coordinate);
}

export function unfreezeGameCell(state, coordinate) {
  return applyGameAction(state, removeAttackIce, coordinate);
}

export function canUndo(state) {
  return isValidGameState(state) && state.undo != null;
}

export function undoLastMove(state) {
  if (!isValidGameState(state)) throw new TypeError("Use a valid game board and Undo snapshot.");
  if (state.undo == null) return state;
  return { board: cloneBoard(state.undo.board), undo: null };
}

// Optional input helpers for a chosen physical pair; no turn or origin is stored.
export function isValidDieValue(value) {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

export function generateDiceNumbers(die1, die2) {
  if (!isValidDieValue(die1) || !isValidDieValue(die2)) {
    throw new RangeError("Choose a value from 1 through 6 for each die.");
  }
  const first = die1 * 10 + die2;
  const second = die2 * 10 + die1;
  return first === second ? [first] : [first, second].sort((a, b) => a - b);
}

export function getDiceOptions(board, die1, die2) {
  return generateDiceNumbers(die1, die2).map((value) => ({ value, targets: getLegalTargetCells(board, value) }));
}

export function parseNumberInput(input) {
  if (typeof input !== "string" || input.length !== 2 || !/^[1-6]{2}$/.test(input)) {
    throw new RangeError("Enter two digits, each from 1 through 6, such as 16.");
  }
  return Number(input);
}
