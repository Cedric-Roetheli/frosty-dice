// UI coordination only. The shared game operation validates every submitted move.
import {
  BOARD_COLUMNS as columns,
  BOARD_ROW_COUNT as rowCount,
  canUndo,
  createGameState,
  getCell,
  hasReachedGoal,
  parseNumberInput,
  placeGameNumber,
  undoLastMove,
} from "./game.js?v=undo-1";
import { getScoreBreakdown } from "./scoring.js?v=undo-1";
import { clearSavedGame, loadGame, saveGame } from "./storage.js?v=undo-1";

// Shorten the core's explanations, without evaluating placement rules in the UI.
function placementFeedback(reason) {
  if (reason === "The first number must be placed at A1.") return "Place your first number at A1.";
  if (reason.includes("cannot be overwritten")) return "This cell is already occupied.";
  const requirement = /^[A-D][1-7] must be (.+)\.$/.exec(reason)?.[1];
  if (requirement && !requirement.includes(" or ")) {
    const relation = requirement.startsWith("equal to") ? requirement.replace("equal to", "match") : "be " + requirement;
    return "Must " + relation + ".";
  }
  return "This number doesn't fit next to any usable neighboring number.";
}

// Document/storage injection keeps coordinator tests independent of a browser.
export function initializeApp(document, storage) {
  const restoredGame = loadGame(storage);
  let game = restoredGame.state;
  let selectedCell = null;
  let resetConfirmOpen = false;

  const board = document.getElementById("game-board");
  const boardRows = document.getElementById("board-rows");
  const entryForm = document.getElementById("number-entry-form");
  const numberInput = document.getElementById("number-input");
  const entryFeedback = document.getElementById("entry-feedback");
  const undoButton = document.getElementById("undo-move");
  const appStatus = document.getElementById("app-status");
  const storageStatus = document.getElementById("storage-status");
  const newGameButton = document.getElementById("new-game");
  const resetConfirmation = document.getElementById("reset-confirmation");
  const scoreFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

  function showStorageStatus(message) {
    storageStatus.textContent = message;
    storageStatus.hidden = message.length === 0;
  }

  function showAppStatus(message, tone = "info") {
    appStatus.textContent = message;
    appStatus.dataset.tone = tone;
  }

  function clearEntry() {
    selectedCell = null;
    numberInput.value = "";
    numberInput.removeAttribute("aria-invalid");
    entryFeedback.textContent = "";
    entryFeedback.hidden = true;
  }

  function showEntryError(message) {
    entryFeedback.textContent = message;
    entryFeedback.hidden = false;
    numberInput.setAttribute("aria-invalid", "true");
    numberInput.focus({ preventScroll: true });
  }

  function createCell(coordinate) {
    const record = getCell(game.board, coordinate);
    const value = record?.value ?? null;
    const selected = selectedCell === coordinate;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.id = "cell-" + coordinate;
    cell.dataset.coordinate = coordinate;
    cell.dataset.frozen = String(record?.status === "frozen");
    cell.dataset.state = record?.status ?? "empty";
    cell.className = "board-cell";
    cell.disabled = record !== null;
    cell.setAttribute("aria-pressed", String(selected));
    if (record === null) cell.setAttribute("aria-controls", "number-entry-form");
    if (record !== null) cell.classList.add("board-cell--occupied");

    const marker = coordinate === "A1" ? "Start" : coordinate === "D7" ? "Goal" : "";
    const labels = [coordinate];
    if (marker) {
      labels.push(marker.toLowerCase());
      cell.classList.add("board-cell--" + marker.toLowerCase());
      if (value !== null) {
        const markerLabel = document.createElement("span");
        markerLabel.className = "board-cell__marker";
        markerLabel.textContent = marker;
        cell.append(markerLabel);
      }
    }

    labels.push(value === null ? "empty" : String(value));
    if (record?.status === "frozen" || record?.status === "thawed") {
      const frozen = record.status === "frozen";
      labels.push(record.status, "permanently 0 points", frozen ? "cannot support placement" : "usable placement neighbor");
      if (frozen) {
        cell.classList.add("board-cell--frozen");
        const ice = document.createElement("img");
        ice.className = "board-cell__ice";
        ice.src = "./assets/icecube.png";
        ice.alt = "";
        ice.width = 48;
        ice.height = 48;
        ice.setAttribute("aria-hidden", "true");
        cell.append(ice);
      } else {
        const thawedLabel = document.createElement("span");
        thawedLabel.className = "board-cell__marker";
        thawedLabel.textContent = "Thawed";
        cell.append(thawedLabel);
      }
    }

    if (value !== null) {
      const valueLabel = document.createElement("span");
      valueLabel.className = "board-cell__value";
      valueLabel.textContent = value;
      cell.append(valueLabel);
    }

    if (selected) {
      labels.push("selected");
      cell.classList.add("board-cell--selected");
    }
    cell.setAttribute("aria-label", labels.join(", "));
    return cell;
  }

  function renderBoard(streetRows) {
    const headerRow = document.createElement("tr");
    const corner = document.createElement("td");
    corner.className = "board-corner";
    headerRow.append(corner);
    for (const column of columns) {
      const heading = document.createElement("th");
      heading.scope = "col";
      heading.textContent = column;
      headerRow.append(heading);
    }

    const rows = document.createDocumentFragment();
    for (let rowNumber = 1; rowNumber <= rowCount; rowNumber += 1) {
      const row = document.createElement("tr");
      const heading = document.createElement("th");
      heading.scope = "row";
      heading.textContent = rowNumber;
      if (streetRows.includes(rowNumber)) {
        row.className = "board-row--street";
        heading.setAttribute("aria-label", "Row " + rowNumber + ", Street, row value doubled");
        const marker = document.createElement("span");
        marker.className = "street-marker";
        marker.textContent = "×2";
        marker.setAttribute("aria-hidden", "true");
        heading.append(marker);
      }
      row.append(heading);
      for (const column of columns) {
        const entry = document.createElement("td");
        entry.append(createCell(column + rowNumber));
        row.append(entry);
      }
      rows.append(row);
    }
    document.getElementById("board-columns").replaceChildren(headerRow);
    boardRows.replaceChildren(rows);
  }

  function render() {
    const scoring = getScoreBreakdown(game.board);
    renderBoard(scoring.streetRows);
    document.getElementById("current-score").textContent = scoreFormat.format(scoring.score);
    const streetBonus = document.getElementById("street-bonus");
    streetBonus.hidden = scoring.streetRows.length === 0;
    streetBonus.textContent = "Street bonus +" + scoring.streetBonus + " · " + scoring.streetRows.length + " " + (scoring.streetRows.length === 1 ? "Street" : "Streets");
    const goalStatus = document.getElementById("goal-status");
    const goalMessage = hasReachedGoal(game.board) ? "You have reached the goal at D7!" : "";
    goalStatus.hidden = goalMessage.length === 0;
    if (goalStatus.textContent !== goalMessage) goalStatus.textContent = goalMessage;

    entryForm.hidden = selectedCell === null;
    undoButton.disabled = !canUndo(game);
    document.getElementById("selected-cell").textContent = selectedCell ?? "";
    appStatus.hidden = selectedCell !== null;
    newGameButton.hidden = resetConfirmOpen;
    resetConfirmation.hidden = !resetConfirmOpen;
  }

  function cancelEntry(focusCell = true) {
    if (selectedCell === null) return;
    const coordinate = selectedCell;
    clearEntry();
    showAppStatus("Entry cancelled. Tap an empty cell to enter a number.");
    render();
    if (focusCell) document.getElementById("cell-" + coordinate).focus({ preventScroll: true });
  }

  boardRows.addEventListener("click", (event) => {
    const cell = event.target.closest("button[data-coordinate]");
    if (!cell) return;
    if (getCell(game.board, cell.dataset.coordinate) !== null) {
      cancelEntry(false);
      showAppStatus("This cell is already occupied.", "warning");
      return;
    }
    if (selectedCell === cell.dataset.coordinate) {
      numberInput.focus();
      return;
    }
    clearEntry();
    selectedCell = cell.dataset.coordinate;
    resetConfirmOpen = false;
    render();
    numberInput.focus();
  });

  numberInput.addEventListener("input", () => {
    numberInput.removeAttribute("aria-invalid");
    entryFeedback.textContent = "";
    entryFeedback.hidden = true;
  });

  entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (selectedCell === null) return;
    let value;
    try {
      value = parseNumberInput(numberInput.value);
    } catch {
      showEntryError("Use two digits from 1–6.");
      return;
    }
    let nextGame;
    try {
      nextGame = placeGameNumber(game, selectedCell, value);
    } catch (error) {
      showEntryError(placementFeedback(error.message));
      return;
    }
    const coordinate = selectedCell;
    game = nextGame;
    showStorageStatus(saveGame(game, storage) ? "" : "Local saving is unavailable. Changes may not survive a reload.");
    const placed = getCell(game.board, coordinate);
    clearEntry();
    showAppStatus("Placed " + value + " at " + coordinate + "." + (placed.status === "frozen" ? " Frozen: 0 points; cannot support placement." : ""), "success");
    render();
    board.focus({ preventScroll: true });
  });

  document.getElementById("cancel-entry").addEventListener("click", () => cancelEntry());
  document.addEventListener("pointerdown", (event) => {
    if (selectedCell === null || event.target.closest?.("#number-entry-form")
        || event.target.closest?.("#undo-move")) return;
    const cell = event.target.closest?.("button[data-coordinate]");
    if (cell && getCell(game.board, cell.dataset.coordinate) === null) return;
    cancelEntry(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selectedCell !== null) {
      event.preventDefault();
      cancelEntry();
    }
  });

  undoButton.addEventListener("click", () => {
    if (!canUndo(game)) return;
    game = undoLastMove(game);
    clearEntry();
    resetConfirmOpen = false;
    showStorageStatus(saveGame(game, storage) ? "" : "Local saving is unavailable. Changes may not survive a reload.");
    showAppStatus("Last move undone.", "success");
    render();
    board.focus({ preventScroll: true });
  });

  newGameButton.addEventListener("click", () => {
    clearEntry();
    resetConfirmOpen = true;
    showAppStatus("Tap an empty cell to enter a number.");
    render();
    document.getElementById("cancel-new-game").focus();
  });
  document.getElementById("cancel-new-game").addEventListener("click", () => {
    resetConfirmOpen = false;
    render();
    newGameButton.focus();
  });
  document.getElementById("confirm-new-game").addEventListener("click", () => {
    if (!resetConfirmOpen) return;
    if (!clearSavedGame(storage)) {
      showStorageStatus("The saved game could not be cleared. Your current game was kept; try again or cancel.");
      return;
    }
    game = createGameState();
    clearEntry();
    resetConfirmOpen = false;
    showStorageStatus("");
    showAppStatus("New game started. Tap an empty cell to enter a number.", "success");
    render();
    board.focus({ preventScroll: true });
  });

  clearEntry();
  showAppStatus("Tap an empty cell to enter a number.");
  if (restoredGame.status === "invalid") {
    showStorageStatus("Saved data could not be restored. A new game is shown; the old save is kept until you play or reset.");
  } else if (restoredGame.status === "unavailable") {
    showStorageStatus("Local storage is unavailable. Changes may not survive a reload.");
  } else if (restoredGame.status === "restored") {
    showStorageStatus("Saved game restored.");
  }
  render();
}

if (typeof document !== "undefined" && document.getElementById("board-rows")) {
  initializeApp(document);
}
