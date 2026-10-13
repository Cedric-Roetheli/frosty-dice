import { BOARD_COLUMNS, createEmptyBoard, placeNumber } from "../js/game.js";

// Snapshots isolate rules without requiring an irrelevant placement history.
export function boardFixture(...entries) {
  const board = createEmptyBoard();
  for (const [coordinate, value, status = "normal"] of entries) {
    board[Number(coordinate[1]) - 1][BOARD_COLUMNS.indexOf(coordinate[0])] = { value, status };
  }
  return board;
}

export function placedBoard(...entries) {
  return entries.reduce((board, [coordinate, value]) => placeNumber(board, coordinate, value), createEmptyBoard());
}

export function freezeBoardSnapshot(board) {
  board.flat().filter((cell) => cell !== null).forEach(Object.freeze);
  board.forEach(Object.freeze);
  return Object.freeze(board);
}
