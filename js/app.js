// UI coordination only. The shared game operation validates every submitted move.
import {
  BOARD_COLUMNS as columns,
  BOARD_ROW_COUNT as rowCount,
  canApplyAttackIce,
  canUndo,
  confirmGameBid,
  createGameState,
  freezeGameCell,
  getCell,
  hasReachedGoal,
  parseNumberInput,
  parseBidInput,
  placeGameNumber,
  undoLastMove,
  unfreezeGameCell,
} from "./game.js?v=protective-rules-1";
import { getCellScoreMultiplier, getScoreBreakdown } from "./scoring.js?v=v3-multipliers-1";
import { clearSavedGame, loadGame, saveGame } from "./storage.js?v=protective-rules-1";
import { createChallengeNote } from "./challenge-note.js?v=frosty-dollar-1";

// Shorten the core's explanations, without evaluating placement rules in the UI.
function placementFeedback(reason) {
  if (reason === "66 cannot be placed in Start") return reason;
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
  let selectedActionCell = null;
  let resetConfirmOpen = false;
  let challengeConfirmed = false;

  const board = document.getElementById("game-board");
  const boardRows = document.getElementById("board-rows");
  const attackActions = document.getElementById("attack-ice-actions");
  const attackButton = document.getElementById("toggle-attack-ice");
  const undoButton = document.getElementById("undo-move");
  const appStatus = document.getElementById("app-status");
  const storageStatus = document.getElementById("storage-status");
  const newGameButton = document.getElementById("new-game");
  const resetConfirmation = document.getElementById("reset-confirmation");
  const challengeButton = document.getElementById("open-challenge");
  const challengeDialog = document.getElementById("challenge-dialog");
  const challengeForm = document.getElementById("challenge-form");
  const bidInput = document.getElementById("challenge-bid");
  const confirmBidButton = document.getElementById("confirm-bid");
  const closeChallengeButton = document.getElementById("close-challenge");
  const bidFeedback = document.getElementById("bid-feedback");
  const challengeNote = createChallengeNote(document);
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
    selectedActionCell = null;
  }

  function createInlineInput(coordinate) {
    const input = document.createElement("input");
    input.id = "cell-" + coordinate;
    input.type = "text";
    input.dataset.coordinate = coordinate;
    input.dataset.state = "empty";
    input.className = "board-cell board-cell--selected board-cell--entry";
    if (coordinate === "A1") input.classList.add("board-cell--start");
    if (coordinate === "D7") input.classList.add("board-cell--goal");
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("pattern", "[1-6]{2}");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("enterkeyhint", "done");
    input.setAttribute("aria-label", "Number for " + coordinate);
    input.setAttribute("aria-describedby", "number-help app-status");
    // Do not use maxlength: a pasted 123 must be rejected, never truncated to 12.
    const onInput = (event) => {
      if (!event.isComposing && !/^[1-6]?$/.test(input.value)) attemptPlacement(input);
    };
    input.addEventListener("input", onInput);
    input.addEventListener("compositionend", onInput);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        attemptPlacement(input);
      }
    });
    input.addEventListener("blur", () => {
      if (selectedCell === coordinate && document.getElementById(input.id) === input) cancelEntry(false);
    });
    return input;
  }

  function createCell(coordinate, street = false) {
    const record = getCell(game.board, coordinate);
    if (record === null && selectedCell === coordinate) return createInlineInput(coordinate);
    const value = record?.value ?? null;
    const canFreeze = record !== null && canApplyAttackIce(game.board, coordinate);
    const selected = selectedCell === coordinate || selectedActionCell === coordinate;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.id = "cell-" + coordinate;
    cell.dataset.coordinate = coordinate;
    cell.dataset.frozen = String(record?.status === "frozen");
    cell.dataset.state = record?.status ?? "empty";
    cell.dataset.attackIce = String(record?.attackIce === true);
    cell.className = "board-cell";
    cell.disabled = record?.status === "frozen";
    cell.setAttribute("aria-pressed", String(selected));
    if (record !== null && (record.attackIce || canFreeze)) cell.setAttribute("aria-controls", "attack-ice-actions");
    if (record !== null) cell.classList.add("board-cell--occupied");

    const marker = coordinate === "A1" ? "Start" : coordinate === "D7" ? "Goal" : "";
    const labels = [coordinate];
    if (marker) {
      labels.push(marker.toLowerCase());
      cell.classList.add("board-cell--" + marker.toLowerCase());
      if (value === null) {
        if (coordinate === "D7") {
          const flag = document.createElement("img");
          flag.className = "board-cell__flag";
          flag.src = "./assets/d7_flag.png";
          flag.alt = "";
          flag.width = 48;
          flag.height = 48;
          flag.setAttribute("aria-hidden", "true");
          cell.append(flag);
        } else {
          const hint = document.createElement("span");
          hint.className = "board-cell__hint";
          hint.textContent = "Start";
          hint.setAttribute("aria-hidden", "true");
          cell.append(hint);
        }
      }
    }

    labels.push(value === null ? "empty" : String(value));
    if (record?.status === "frozen" || record?.status === "thawed") {
      const frozen = record.status === "frozen";
      labels.push(record.status, "permanently 0 points", frozen || record.attackIce ? "cannot support placement" : "usable placement neighbor");
      if (frozen) {
        cell.classList.add("board-cell--frozen");
      } else {
        const thawedLabel = document.createElement("span");
        thawedLabel.className = "board-cell__marker";
        thawedLabel.textContent = "Thawed";
        cell.append(thawedLabel);
      }
    }

    if (record?.status === "frozen" || record?.attackIce) {
      const attack = record.attackIce === true;
      if (attack) {
        cell.classList.add("board-cell--attack-iced");
        labels.push("Attack Ice", "cannot support placement or a Street", "Unfreeze available");
      }
      const ice = document.createElement("img");
      ice.className = "board-cell__ice";
      ice.src = attack ? "./assets/icecube2.png" : "./assets/icecube.png";
      ice.alt = "";
      ice.width = 48;
      ice.height = 48;
      ice.setAttribute("aria-hidden", "true");
      cell.append(ice);
    } else if (canFreeze) {
      labels.push("Freeze available");
    }

    const multiplier = getCellScoreMultiplier(record, street);
    if (multiplier > 1) {
      if (street) labels.push("Street", "row value doubled");
      labels.push("scores " + multiplier + " times its value");
      const multiplierMarker = document.createElement("span");
      multiplierMarker.className = "street-marker";
      multiplierMarker.textContent = multiplier + "x";
      multiplierMarker.setAttribute("aria-hidden", "true");
      cell.append(multiplierMarker);
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
    for (const column of columns) {
      const heading = document.createElement("th");
      heading.scope = "col";
      heading.textContent = column;
      heading.setAttribute("aria-label", "Column " + column);
      headerRow.append(heading);
    }

    const rows = document.createDocumentFragment();
    for (let rowNumber = 1; rowNumber <= rowCount; rowNumber += 1) {
      const row = document.createElement("tr");
      const street = streetRows.includes(rowNumber);
      if (street) {
        row.className = "board-row--street";
        row.setAttribute("aria-label", "Row " + rowNumber + ", Street, row value doubled");
      }
      for (const column of columns) {
        const entry = document.createElement("td");
        entry.append(createCell(column + rowNumber, street));
        row.append(entry);
      }
      rows.append(row);
    }
    document.getElementById("board-columns").replaceChildren(headerRow);
    boardRows.replaceChildren(rows);
  }

  function render() {
    const scoring = getScoreBreakdown(game.board, game.pointsSpent ?? 0);
    renderBoard(scoring.streetRows);
    document.getElementById("current-score").textContent = scoreFormat.format(scoring.score);
    const streetBonus = document.getElementById("street-bonus");
    streetBonus.hidden = scoring.streetRows.length === 0;
    streetBonus.textContent = "Street bonus +" + scoring.streetBonus + " · " + scoring.streetRows.length + " " + (scoring.streetRows.length === 1 ? "Street" : "Streets");
    const goalStatus = document.getElementById("goal-status");
    const goalMessage = hasReachedGoal(game.board) ? "You have reached the goal at D7!" : "";
    goalStatus.hidden = goalMessage.length === 0;
    if (goalStatus.textContent !== goalMessage) goalStatus.textContent = goalMessage;

    attackActions.hidden = selectedActionCell === null;
    document.getElementById("attack-ice-cell").textContent = selectedActionCell ?? "";
    if (selectedActionCell !== null) {
      attackButton.textContent = getCell(game.board, selectedActionCell).attackIce ? "Unfreeze" : "Freeze";
      attackButton.setAttribute("aria-label", attackButton.textContent + " Attack Ice at " + selectedActionCell);
    }
    undoButton.disabled = !canUndo(game);
    appStatus.hidden = selectedActionCell !== null;
    newGameButton.hidden = resetConfirmOpen;
    resetConfirmation.hidden = !resetConfirmOpen;
  }

  function cancelEntry(focusCell = true) {
    const coordinate = selectedCell ?? selectedActionCell;
    if (coordinate === null) return;
    const inline = selectedCell !== null;
    clearEntry();
    if (inline) {
      // Keep other cells in place: blur precedes their click/keyboard focus.
      document.getElementById("cell-" + coordinate).parentNode.replaceChildren(createCell(coordinate));
    } else {
      showAppStatus("Cell actions closed. Tap an empty cell to enter a number.");
      render();
    }
    if (focusCell) document.getElementById("cell-" + coordinate).focus({ preventScroll: true });
  }

  boardRows.addEventListener("click", (event) => {
    if (challengeDialog.open) return;
    const cell = event.target.closest("button[data-coordinate]");
    if (!cell) return;
    const coordinate = cell.dataset.coordinate;
    const record = getCell(game.board, coordinate);
    if (record !== null) {
      clearEntry();
      resetConfirmOpen = false;
      if (record.attackIce || canApplyAttackIce(game.board, coordinate)) {
        selectedActionCell = coordinate;
        render();
        attackButton.focus({ preventScroll: true });
      } else {
        showAppStatus(record.status === "frozen"
          ? "Prime-frozen cells cannot receive Attack Ice."
          : "This cell is protected from Attack Ice.", "warning");
        render();
      }
      return;
    }
    if (selectedCell === cell.dataset.coordinate) {
      document.getElementById("cell-" + selectedCell).focus({ preventScroll: true });
      return;
    }
    clearEntry();
    selectedCell = cell.dataset.coordinate;
    resetConfirmOpen = false;
    render();
    document.getElementById("cell-" + selectedCell).focus({ preventScroll: true });
  });

  function attemptPlacement(input) {
    if (challengeDialog.open) return;
    if (selectedCell === null || document.getElementById("cell-" + selectedCell) !== input) return;
    const coordinate = selectedCell;
    function reject(message) {
      cancelEntry(false);
      showAppStatus(message);
      board.focus({ preventScroll: true });
    }
    let value;
    try {
      value = parseNumberInput(input.value);
    } catch {
      reject("Use two digits from 1–6.");
      return;
    }
    let nextGame;
    try {
      nextGame = placeGameNumber(game, selectedCell, value);
    } catch (error) {
      reject(placementFeedback(error.message));
      return;
    }
    game = nextGame;
    showStorageStatus(saveGame(game, storage) ? "" : "Local saving is unavailable. Changes may not survive a reload.");
    const placed = getCell(game.board, coordinate);
    clearEntry();
    showAppStatus("Placed " + value + " at " + coordinate + "." + (placed.status === "frozen" ? " Frozen: 0 points; cannot support placement." : ""), "success");
    render();
    board.focus({ preventScroll: true });
  }

  document.getElementById("cancel-attack-ice").addEventListener("click", () => cancelEntry());
  attackButton.addEventListener("click", () => {
    if (challengeDialog.open) return;
    if (selectedActionCell === null) return;
    const coordinate = selectedActionCell;
    const removing = getCell(game.board, coordinate)?.attackIce === true;
    try {
      game = removing ? unfreezeGameCell(game, coordinate) : freezeGameCell(game, coordinate);
    } catch (error) {
      showAppStatus(error.message, "warning");
      clearEntry();
      render();
      return;
    }
    showStorageStatus(saveGame(game, storage) ? "" : "Local saving is unavailable. Changes may not survive a reload.");
    clearEntry();
    showAppStatus("Attack Ice " + (removing ? "removed from " : "applied to ") + coordinate + ".", "success");
    render();
    board.focus({ preventScroll: true });
  });
  document.addEventListener("pointerdown", (event) => {
    if ((selectedCell === null && selectedActionCell === null)
        || event.target.closest?.("input[data-coordinate]")
        || event.target.closest?.("#attack-ice-actions")
        || event.target.closest?.("#undo-move")) return;
    const cell = event.target.closest?.("button[data-coordinate]");
    // Let the subsequent board click switch selection without replacing its target.
    if (cell && getCell(game.board, cell.dataset.coordinate)?.status !== "frozen") return;
    cancelEntry(false);
  });
  document.addEventListener("keydown", (event) => {
    if (challengeDialog.open && event.key === "Escape") {
      event.preventDefault();
      closeChallenge();
      return;
    }
    if (event.key === "Escape" && (selectedCell !== null || selectedActionCell !== null)) {
      event.preventDefault();
      cancelEntry();
    }
  });

  undoButton.addEventListener("click", () => {
    if (challengeDialog.open) return;
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
    if (challengeDialog.open) return;
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
    if (challengeDialog.open) return;
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

  function closeChallenge() {
    if (!challengeDialog.open) return;
    challengeDialog.close();
    challengeNote.reset();
    challengeButton.focus({ preventScroll: true });
  }

  challengeButton.addEventListener("click", () => {
    if (challengeDialog.open) return;
    clearEntry();
    resetConfirmOpen = false;
    render();
    challengeConfirmed = false;
    challengeNote.reset();
    bidInput.value = "";
    bidInput.readOnly = false;
    bidInput.removeAttribute("aria-invalid");
    confirmBidButton.disabled = false;
    confirmBidButton.textContent = "CONFIRM";
    bidFeedback.textContent = "";
    const available = getScoreBreakdown(game.board, game.pointsSpent ?? 0).score;
    bidInput.max = String(available);
    document.getElementById("bid-limit").textContent = "Available Score: " + scoreFormat.format(available);
    challengeDialog.showModal();
    bidInput.focus({ preventScroll: true });
  });

  challengeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!challengeDialog.open || challengeConfirmed) return;
    let bid;
    let nextGame;
    try {
      bid = parseBidInput(bidInput.value);
      nextGame = confirmGameBid(game, bid);
    } catch (error) {
      bidFeedback.textContent = error.message;
      bidInput.setAttribute("aria-invalid", "true");
      bidInput.focus({ preventScroll: true });
      return;
    }
    game = nextGame;
    challengeConfirmed = true;
    bidInput.value = String(bid);
    bidInput.readOnly = true;
    bidInput.removeAttribute("aria-invalid");
    confirmBidButton.disabled = true;
    confirmBidButton.textContent = "CONFIRMED";
    bidFeedback.textContent = "Bid spent. Reveal when ready.";
    document.getElementById("bid-limit").textContent = "";
    showStorageStatus(saveGame(game, storage) ? "" : "Local saving is unavailable. Changes may not survive a reload.");
    render();
    // Move focus off the input to dismiss the keyboard while keeping the reveal open.
    closeChallengeButton.focus({ preventScroll: true });
    challengeNote.conceal(bid);
  });

  bidInput.addEventListener("input", () => {
    if (!challengeConfirmed) {
      bidFeedback.textContent = "";
      bidInput.removeAttribute("aria-invalid");
    }
  });
  closeChallengeButton.addEventListener("click", closeChallenge);
  challengeDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeChallenge();
  });
  challengeDialog.addEventListener("close", () => {
    if (!challengeDialog.open) challengeNote.reset();
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
