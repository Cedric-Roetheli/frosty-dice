// Pure board helpers. Rows are zero-indexed internally; cell names use A1–D7.
export const BOARD_COLUMNS = Object.freeze(["A", "B", "C", "D"]);
export const BOARD_ROW_COUNT = 7;

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

export function isValidCell(coordinate) {
  return typeof coordinate === "string" && coordinate.length === 2 && /^[A-D][1-7]$/.test(coordinate);
}

// Shape and value validation only; remaining cells stay active after removals.
export function isValidBoard(board) {
  if (!Array.isArray(board) || board.length !== BOARD_ROW_COUNT) {
    return false;
  }

  for (const row of board) {
    if (!Array.isArray(row) || row.length !== BOARD_COLUMNS.length) {
      return false;
    }

    for (const value of row) {
      if (value !== null && !isValidNumber(value)) {
        return false;
      }
    }
  }

  return true;
}

export function getCellValue(board, coordinate) {
  if (!isValidBoard(board)) {
    throw new TypeError("The board must have seven rows of four empty cells or valid numbers.");
  }
  if (!isValidCell(coordinate)) {
    throw new RangeError("Choose a cell from A1 through D7.");
  }

  return board[Number(coordinate[1]) - 1][BOARD_COLUMNS.indexOf(coordinate[0])];
}

export function isCellEmpty(board, coordinate) {
  return getCellValue(board, coordinate) === null;
}

export function isCellOccupied(board, coordinate) {
  return getCellValue(board, coordinate) !== null;
}

export function hasReachedGoal(board) {
  return isCellOccupied(board, "D7");
}

// Placement depends only on current orthogonally adjacent cells. Removal does not
// deactivate other cells or require an A1 connectivity check.
export function validatePlacement(board, coordinate, value) {
  if (!isValidBoard(board)) {
    return { legal: false, reason: "The board must have seven rows of four empty cells or valid numbers." };
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
    return { legal: false, reason: `${coordinate} already contains ${board[row][column]} and cannot be overwritten.` };
  }

  const isEmptyBoard = board.every((entries) => entries.every((entry) => entry === null));
  if (isEmptyBoard) {
    return coordinate === "A1"
      ? { legal: true, reason: null }
      : { legal: false, reason: "The first number must be placed at A1." };
  }

  const leftValue = column > 0 ? board[row][column - 1] : null;
  const rightValue = column < BOARD_COLUMNS.length - 1 ? board[row][column + 1] : null;
  const valueAbove = row > 0 ? board[row - 1][column] : null;
  const valueBelow = row < BOARD_ROW_COUNT - 1 ? board[row + 1][column] : null;
  const validLeftConnection = leftValue !== null && value > leftValue;
  const validRightConnection = rightValue !== null && value < rightValue;
  const validUpperConnection = valueAbove !== null && value === valueAbove;
  const validLowerConnection = valueBelow !== null && value === valueBelow;

  if (validLeftConnection || validRightConnection || validUpperConnection || validLowerConnection) {
    return { legal: true, reason: null };
  }

  const requirements = [];
  if (leftValue !== null) {
    requirements.push(`greater than ${leftValue} to the left`);
  }
  if (rightValue !== null) {
    requirements.push(`smaller than ${rightValue} to the right`);
  }
  if (valueAbove !== null) {
    requirements.push(`equal to ${valueAbove} above`);
  }
  if (valueBelow !== null) {
    requirements.push(`equal to ${valueBelow} below`);
  }
  if (requirements.length === 0) {
    return { legal: false, reason: `${coordinate} needs an occupied orthogonally adjacent cell (left, right, above, or below).` };
  }

  return {
    legal: false,
    reason: `${coordinate} must be ${requirements.join(" or ")}.`,
  };
}

export function canPlaceNumber(board, coordinate, value) {
  return validatePlacement(board, coordinate, value).legal;
}

export function getLegalTargetCells(board, value) {
  if (!isValidBoard(board)) {
    throw new TypeError("The board must have seven rows of four empty cells or valid numbers.");
  }

  const targets = [];
  for (let row = 1; row <= BOARD_ROW_COUNT; row += 1) {
    for (const column of BOARD_COLUMNS) {
      const coordinate = `${column}${row}`;
      if (canPlaceNumber(board, coordinate, value)) {
        targets.push(coordinate);
      }
    }
  }

  return targets;
}

// Successful placement returns a separate board; input state is never mutated.
export function placeNumber(board, coordinate, value) {
  const validation = validatePlacement(board, coordinate, value);
  if (!validation.legal) {
    throw new Error(validation.reason);
  }

  const nextBoard = board.map((row) => [...row]);
  nextBoard[Number(coordinate[1]) - 1][BOARD_COLUMNS.indexOf(coordinate[0])] = value;
  return nextBoard;
}

export function isValidDieValue(value) {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

export function generateRollNumbers(die1, die2) {
  if (!isValidDieValue(die1) || !isValidDieValue(die2)) {
    throw new RangeError("Choose a value from 1 through 6 for each die.");
  }

  const first = die1 * 10 + die2;
  const second = die2 * 10 + die1;
  return first === second ? [first] : [first, second].sort((a, b) => a - b);
}

export function getRollOptions(board, die1, die2) {
  return generateRollNumbers(die1, die2).map((value) => ({
    value,
    targets: getLegalTargetCells(board, value),
  }));
}

export function isFailedRoll(board, die1, die2) {
  return getRollOptions(board, die1, die2).every((option) => option.targets.length === 0);
}

export function createGameState() {
  return { board: createEmptyBoard(), ownRollCount: 0, currentRoll: null, schnapszahlAction: null };
}

function assertGameState(state) {
  if (!state || !isValidBoard(state.board) || !Number.isSafeInteger(state.ownRollCount) || state.ownRollCount < 0) {
    throw new TypeError("Use a valid board and a non-negative own-roll count.");
  }
}

// A recorded roll stays locked until resolved and explicitly prepared for the next roll.
// This also locks failed rolls, preventing a repeated confirmation from counting twice.
export function confirmOwnRoll(state, die1, die2) {
  assertGameState(state);
  if (state.currentRoll !== null) {
    throw new Error("This roll is already confirmed. Finish it and start the next roll.");
  }
  if (state.schnapszahlAction) {
    throw new Error("Finish the Schnapszahl action before recording another own roll.");
  }
  if (state.ownRollCount === Number.MAX_SAFE_INTEGER) {
    throw new RangeError("The own-roll count cannot be increased further.");
  }

  const failed = isFailedRoll(state.board, die1, die2);
  return {
    ...state,
    ownRollCount: state.ownRollCount + 1,
    currentRoll: { dice: [die1, die2], status: failed ? "failed" : "pending" },
  };
}

export function placeOwnRollNumber(state, coordinate, value) {
  assertGameState(state);
  if (!state.currentRoll || state.currentRoll.status !== "pending") {
    throw new Error("Confirm an own roll before placing its number. A finished roll cannot be placed again.");
  }
  if (!generateRollNumbers(...state.currentRoll.dice).includes(value)) {
    throw new Error("Choose one of the numbers from the confirmed roll.");
  }

  return {
    ...state,
    board: placeNumber(state.board, coordinate, value),
    currentRoll: { ...state.currentRoll, status: "placed" },
    schnapszahlAction: isSchnapszahl(value) ? { value } : null,
  };
}

export function prepareNextOwnRoll(state) {
  assertGameState(state);
  if (state.currentRoll?.status === "pending") {
    throw new Error("Place this confirmed roll before starting another roll.");
  }
  if (state.schnapszahlAction) {
    throw new Error("Finish the Schnapszahl action before starting the next roll.");
  }

  return { ...state, currentRoll: null };
}

export function parseExternalNumber(input) {
  if (typeof input !== "string" || input.length !== 2 || !/^[0-9]{2}$/.test(input) || !isValidNumber(Number(input))) {
    throw new RangeError("Enter two digits, each from 1 through 6, such as 16.");
  }
  return Number(input);
}

export function getExternalNumberTargets(state, value) {
  assertGameState(state);
  if (!isValidNumber(value)) {
    throw new RangeError("Use a two-digit number with each digit from 1 through 6.");
  }
  return getLegalTargetCells(state.board, value);
}

// Taking a verbally announced number changes only the board, never the own-roll count.
export function placeExternalNumber(state, coordinate, value) {
  assertGameState(state);
  if (state.currentRoll?.status === "pending") {
    throw new Error("Finish placing your confirmed own roll before taking another number.");
  }
  if (state.schnapszahlAction) {
    throw new Error("Finish the Schnapszahl action before taking a failed-roll number.");
  }
  return { ...state, board: placeNumber(state.board, coordinate, value) };
}

export function isSchnapszahl(value) {
  return [11, 22, 33, 44, 55, 66].includes(value);
}

export function finishSchnapszahlAction(state) {
  assertGameState(state);
  return { ...state, schnapszahlAction: null };
}

export function placeStolenNumber(state, coordinate, value) {
  assertGameState(state);
  if (!state.schnapszahlAction) {
    throw new Error("A legally placed own-roll Schnapszahl is required to receive a stolen number.");
  }
  return {
    ...state,
    board: placeNumber(state.board, coordinate, value),
    schnapszahlAction: null,
  };
}

// Clear exactly the chosen occupied cell. Do not traverse or change other cells.
export function removeOwnNumber(state, coordinate) {
  assertGameState(state);
  if (state.currentRoll?.status === "pending" || state.schnapszahlAction) {
    throw new Error("Finish the current own-roll action before removing a number.");
  }
  if (getCellValue(state.board, coordinate) === null) {
    throw new Error(`${coordinate} is empty and cannot be removed.`);
  }
  const nextBoard = state.board.map((row) => [...row]);
  nextBoard[Number(coordinate[1]) - 1][BOARD_COLUMNS.indexOf(coordinate[0])] = null;
  return { ...state, board: nextBoard };
}
