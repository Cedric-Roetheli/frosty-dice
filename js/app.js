// UI coordination only. Dice, roll counting, and placement rules live in game.js.
import {
  BOARD_COLUMNS as columns,
  BOARD_ROW_COUNT as rowCount,
  confirmOwnRoll,
  createGameState,
  finishSchnapszahlAction,
  getCellValue,
  getExternalNumberTargets,
  getRollOptions,
  hasReachedGoal,
  isValidDieValue,
  parseExternalNumber,
  placeExternalNumber,
  placeOwnRollNumber,
  placeStolenNumber,
  prepareNextOwnRoll,
  removeOwnNumber,
} from "./game.js";
import { getScoreBreakdown } from "./scoring.js";
import { clearSavedGame, loadGame, saveGame } from "./storage.js";

const restoredGame = loadGame();
let game = restoredGame.state;
let selectedDice = game.currentRoll ? [...game.currentRoll.dice] : [null, null];
let selectedNumber = null;
let takingFailedRoll = false;
let externalNumber = null;
let receivingStolenNumber = false;
let removingOwnNumber = false;
let removalSelection = null;
let resetConfirmOpen = false;

const rollForm = document.getElementById("own-roll-form");
const confirmButton = document.getElementById("confirm-roll");
const nextButton = document.getElementById("next-roll");
const rollPanel = document.getElementById("roll-panel");
const placementControls = document.getElementById("placement-controls");
const numberOptions = document.getElementById("number-options");
const appStatus = document.getElementById("app-status");
const takeButton = document.getElementById("take-failed-roll");
const externalForm = document.getElementById("external-number-form");
const externalInput = document.getElementById("external-number");
const cancelExternalButton = document.getElementById("cancel-external-number");
const schnapszahlPanel = document.getElementById("schnapszahl-panel");
const enterStolenButton = document.getElementById("enter-stolen-number");
const finishSchnapszahlButton = document.getElementById("finish-schnapszahl");
const startRemovalButton = document.getElementById("start-removal");
const confirmRemovalButton = document.getElementById("confirm-removal");
const cancelRemovalButton = document.getElementById("cancel-removal");
const scoreFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const storageStatus = document.getElementById("storage-status");
const newGameButton = document.getElementById("new-game");
const resetConfirmation = document.getElementById("reset-confirmation");
const cancelNewGameButton = document.getElementById("cancel-new-game");

function showStorageStatus(message) {
  storageStatus.textContent = message;
  storageStatus.hidden = message.length === 0;
}

function updateGame(nextGame) {
  game = nextGame;
  showStorageStatus(saveGame(game)
    ? ""
    : "Local saving is unavailable. Changes may not survive a reload.");
}

function enteringNumber() {
  return takingFailedRoll || receivingStolenNumber;
}

function blockedOwnControls() {
  return enteringNumber() || removingOwnNumber || Boolean(game.schnapszahlAction);
}

function currentOptions() {
  if (enteringNumber()) {
    return externalNumber === null
      ? []
      : [{ value: externalNumber, targets: getExternalNumberTargets(game, externalNumber) }];
  }
  if (!game.currentRoll || game.currentRoll.status === "placed") {
    return [];
  }
  return getRollOptions(game.board, ...game.currentRoll.dice);
}

function createCell(coordinate, targets) {
  const value = getCellValue(game.board, coordinate);
  const isTarget = !removingOwnNumber && (enteringNumber() || game.currentRoll?.status === "pending") && targets.includes(coordinate);
  const cell = document.createElement("button");
  cell.type = "button";
  cell.id = `cell-${coordinate}`;
  cell.dataset.coordinate = coordinate;
  cell.className = "board-cell";
  cell.disabled = removingOwnNumber ? value === null : !isTarget;

  const marker = coordinate === "A1" ? "Start" : coordinate === "D7" ? "Goal" : "";
  const labels = [coordinate];
  if (marker) {
    labels.push(marker.toLowerCase());
    cell.classList.add(`board-cell--${marker.toLowerCase()}`);
    const markerLabel = document.createElement("span");
    markerLabel.className = "board-cell__marker";
    markerLabel.textContent = marker;

    cell.append(markerLabel);
  }

  labels.push(value === null ? "empty" : String(value));
  if (removingOwnNumber && value !== null) {
    cell.classList.add("board-cell--removable");
    labels.push("select for removal");
    if (removalSelection?.coordinate === coordinate) {
      cell.classList.add("board-cell--removal-selected");
      labels.push("selected for removal");
    }
  }

  if (isTarget) {
    cell.classList.add("board-cell--legal");
    labels.push(`legal target for ${selectedNumber}`);
    const targetLabel = document.createElement("span");
    targetLabel.className = "board-cell__target";
    targetLabel.textContent = String(selectedNumber);
    cell.append(targetLabel);
  } else if (value !== null || marker) {
    const valueLabel = document.createElement("span");
    valueLabel.className = value === null ? "board-cell__coordinate" : "board-cell__value";
    valueLabel.textContent = value === null ? coordinate : value;
    cell.append(valueLabel);
  }

  cell.setAttribute("aria-label", labels.join(", "));
  return cell;
}

function renderBoard(options, streetRows) {
  const targets = options.find((option) => option.value === selectedNumber)?.targets ?? [];
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
      heading.setAttribute("aria-label", `Row ${rowNumber}, Street, row value doubled`);
      const marker = document.createElement("span");
      marker.className = "street-marker";
      marker.textContent = "×2";
      marker.setAttribute("aria-hidden", "true");
      heading.append(marker);
    }
    row.append(heading);

    for (const column of columns) {
      const entry = document.createElement("td");
      entry.append(createCell(`${column}${rowNumber}`, targets));
      row.append(entry);
    }

    rows.append(row);
  }

  document.getElementById("board-columns").replaceChildren(headerRow);
  document.getElementById("board-rows").replaceChildren(rows);
}

function renderNumberOptions(options) {
  document.getElementById("number-heading").textContent = receivingStolenNumber
    ? "Stolen number"
    : takingFailedRoll ? "From an opponent’s failed roll" : "Choose a number";
  if (enteringNumber()) {
    const summary = document.createElement("p");
    summary.className = "external-number-summary";
    summary.textContent = options.length > 0
      ? `${externalNumber} · ${options[0].targets.length} legal ${options[0].targets.length === 1 ? "target" : "targets"}`
      : "";
    numberOptions.replaceChildren(summary);
    document.getElementById("placement-help").textContent = options[0]?.targets.length > 0
      ? `Tap a highlighted cell to ${receivingStolenNumber ? "place" : "take"} ${externalNumber}. Own rolls stay unchanged.`
      : "This number cannot currently be placed.";
    return;
  }
  const buttons = options.map((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "number-option";
    button.dataset.number = String(option.value);
    button.disabled = option.targets.length === 0;
    button.setAttribute("aria-pressed", String(option.value === selectedNumber));

    const value = document.createElement("span");
    value.className = "number-option__value";
    value.textContent = option.value;
    const help = document.createElement("span");
    help.textContent = option.targets.length === 0
      ? "No legal targets"
      : `${option.targets.length} legal ${option.targets.length === 1 ? "target" : "targets"}`;
    button.append(value, help);
    return button;
  });
  numberOptions.replaceChildren(...buttons);
  document.getElementById("placement-help").textContent = game.currentRoll?.status === "pending"
    ? `Tap a highlighted cell to place ${selectedNumber}.`
    : "No legal targets for this roll.";
}

function render() {
  const options = currentOptions();
  const scoring = getScoreBreakdown(game.board, game.ownRollCount);
  const goalReached = hasReachedGoal(game.board);
  const goalStatus = document.getElementById("goal-status");
  const goalMessage = goalReached ? "You have reached the goal at D7!" : "";
  goalStatus.hidden = !goalReached;
  if (goalStatus.textContent !== goalMessage) {
    goalStatus.textContent = goalMessage;
  }
  const pending = game.currentRoll?.status === "pending";
  const complete = game.currentRoll !== null && !pending;
  const specialAction = Boolean(game.schnapszahlAction);
  renderBoard(options, scoring.streetRows);
  renderNumberOptions(options);
  document.getElementById("own-roll-count").textContent = game.ownRollCount;
  document.getElementById("current-score").textContent = scoreFormat.format(scoring.score);
  const streetBonus = document.getElementById("street-bonus");
  streetBonus.hidden = scoring.streetRows.length === 0;
  streetBonus.textContent = `Street bonus +${scoring.streetBonus} · ${scoring.streetRows.length} ${scoring.streetRows.length === 1 ? "Street" : "Streets"}`;
  let boardMode = "Ready";
  if (removingOwnNumber) {
    boardMode = "Select removal";
  } else if (enteringNumber()) {
    boardMode = receivingStolenNumber ? "Stolen number" : "Take failed roll";
    if (externalNumber !== null) {
      boardMode = `${receivingStolenNumber ? "Place" : "Take"} ${externalNumber}`;
    }
  } else if (specialAction) {
    boardMode = "Schnapszahl";
  } else if (pending) {
    boardMode = `Place ${selectedNumber}`;
  } else if (game.currentRoll?.status === "failed") {
    boardMode = "Failed roll";
  }
  document.getElementById("board-mode").textContent = boardMode;
  placementControls.hidden = options.length === 0;
  rollPanel.hidden = pending || blockedOwnControls();
  rollForm.hidden = complete;
  nextButton.hidden = !complete;
  document.getElementById("roll-heading").textContent = complete ? "Next own roll" : "Record own roll";
  confirmButton.disabled = blockedOwnControls() || game.currentRoll !== null || !selectedDice.every(isValidDieValue);
  for (const fieldset of rollForm.querySelectorAll("fieldset")) {
    fieldset.disabled = blockedOwnControls() || game.currentRoll !== null;
  }
  document.getElementById("external-panel").hidden = removingOwnNumber || (specialAction && !receivingStolenNumber);
  takeButton.hidden = enteringNumber();
  takeButton.disabled = pending;
  document.getElementById("take-help").hidden = !pending;
  externalForm.hidden = !enteringNumber();
  document.getElementById("external-heading").textContent = receivingStolenNumber ? "Stolen number" : "From the table";
  document.getElementById("external-number-label").textContent = receivingStolenNumber
    ? "Number removed from the opponent’s board"
    : "Number announced by the other player";
  cancelExternalButton.textContent = receivingStolenNumber ? "Back to action" : "Cancel";
  schnapszahlPanel.hidden = !specialAction;
  document.getElementById("schnapszahl-message").textContent = specialAction
    ? `You legally placed ${game.schnapszahlAction.value} from your own roll. You may remove one already-entered number from an opponent’s board and use it if it fits here.`
    : "";
  enterStolenButton.hidden = receivingStolenNumber;
  document.getElementById("removal-panel").hidden = pending || enteringNumber() || specialAction;
  startRemovalButton.hidden = removingOwnNumber;
  document.getElementById("removal-controls").hidden = !removingOwnNumber;
  document.getElementById("removal-selection").textContent = removalSelection
    ? `Remove ${removalSelection.value} from ${removalSelection.coordinate}? Only this cell will be cleared.`
    : "No cell selected.";
  confirmRemovalButton.disabled = !removalSelection;
  newGameButton.hidden = resetConfirmOpen;
  resetConfirmation.hidden = !resetConfirmOpen;
}

function createDiceControls() {
  for (let die = 1; die <= 2; die += 1) {
    const choices = document.createDocumentFragment();
    for (let value = 1; value <= 6; value += 1) {
      const label = document.createElement("label");
      label.className = "dice-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `die-${die}`;
      input.value = String(value);
      input.id = `die-${die}-${value}`;
      input.className = "visually-hidden";
      input.required = true;
      const text = document.createElement("span");
      text.className = "dice-value";
      text.textContent = value;
      label.append(input, text);
      choices.append(label);
    }
    document.getElementById(`die-${die}-values`).replaceChildren(choices);
  }
}

rollForm.addEventListener("change", (event) => {
  if (blockedOwnControls() || game.currentRoll !== null) {
    return;
  }
  const input = event.target;
  if (input.name === "die-1" || input.name === "die-2") {
    selectedDice[input.name === "die-1" ? 0 : 1] = Number(input.value);
    confirmButton.disabled = !selectedDice.every(isValidDieValue);
  }
});

rollForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (blockedOwnControls() || game.currentRoll !== null) {
    return;
  }
  try {
    updateGame(confirmOwnRoll(game, ...selectedDice));
  } catch (error) {
    appStatus.textContent = error.message;
    return;
  }
  const options = currentOptions();
  selectedNumber = options.find((option) => option.targets.length > 0)?.value ?? null;
  const numbers = options.map((option) => option.value).join(" or ");
  appStatus.textContent = game.currentRoll.status === "failed"
    ? `No legal placement — failed roll (${numbers}). Own roll ${game.ownRollCount} counted.`
    : `Own roll ${game.ownRollCount} counted. Choose ${numbers} and a highlighted cell.`;
  render();
  if (game.currentRoll.status === "pending") {
    numberOptions.querySelector("button[aria-pressed='true']").focus();
  } else {
    nextButton.focus();
  }
});

numberOptions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-number]");
  if (blockedOwnControls() || !button || button.disabled || game.currentRoll?.status !== "pending") {
    return;
  }
  selectedNumber = Number(button.dataset.number);
  render();
  numberOptions.querySelector(`button[data-number='${selectedNumber}']`).focus({ preventScroll: true });
});

document.getElementById("board-rows").addEventListener("click", (event) => {
  const cell = event.target.closest("button[data-coordinate]");
  if (!cell || cell.disabled) {
    return;
  }
  if (removingOwnNumber) {
    const value = getCellValue(game.board, cell.dataset.coordinate);
    if (value === null) {
      return;
    }
    removalSelection = { coordinate: cell.dataset.coordinate, value };
    render();
    confirmRemovalButton.focus();
    return;
  }
  if (enteringNumber()) {
    if (externalNumber === null) {
      return;
    }
    try {
      updateGame(receivingStolenNumber
        ? placeStolenNumber(game, cell.dataset.coordinate, externalNumber)
        : placeExternalNumber(game, cell.dataset.coordinate, externalNumber));
    } catch (error) {
      appStatus.textContent = error.message;
      return;
    }
    appStatus.textContent = `${receivingStolenNumber ? "Placed stolen" : "Took"} ${externalNumber} at ${cell.dataset.coordinate}. Own rolls unchanged (${game.ownRollCount}).`;
    const wasStolen = receivingStolenNumber;
    takingFailedRoll = false;
    receivingStolenNumber = false;
    externalNumber = null;
    selectedNumber = null;
    externalForm.reset();
    render();
    (wasStolen ? nextButton : takeButton).focus();
    return;
  }
  if (game.currentRoll?.status !== "pending") {
    return;
  }
  try {
    updateGame(placeOwnRollNumber(game, cell.dataset.coordinate, selectedNumber));
  } catch (error) {
    appStatus.textContent = error.message;
    return;
  }
  appStatus.textContent = `Placed ${selectedNumber} at ${cell.dataset.coordinate}. Own roll ${game.ownRollCount} counted once.`;
  selectedNumber = null;
  render();
  (game.schnapszahlAction ? enterStolenButton : nextButton).focus();
});

nextButton.addEventListener("click", () => {
  if (blockedOwnControls() || !game.currentRoll || game.currentRoll.status === "pending") {
    return;
  }
  updateGame(prepareNextOwnRoll(game));
  selectedDice = [null, null];
  selectedNumber = null;
  rollForm.reset();
  appStatus.textContent = "Roll two physical dice and record their values.";
  render();
  document.getElementById("die-1-1").focus();
});

takeButton.addEventListener("click", () => {
  if (blockedOwnControls() || game.currentRoll?.status === "pending") {
    return;
  }
  if (game.currentRoll !== null) {
    updateGame(prepareNextOwnRoll(game));
    selectedDice = [null, null];
    rollForm.reset();
  }
  takingFailedRoll = true;
  externalNumber = null;
  selectedNumber = null;
  externalForm.reset();
  externalInput.removeAttribute("aria-invalid");
  appStatus.textContent = "Enter the number announced by the other player. Your own rolls stay unchanged.";
  render();
  externalInput.focus();
});

externalInput.addEventListener("input", () => {
  if (!enteringNumber()) {
    return;
  }
  externalNumber = null;
  selectedNumber = null;
  externalInput.removeAttribute("aria-invalid");
  appStatus.textContent = "Enter two digits from 1 through 6, then show placements.";
  render();
});

externalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!enteringNumber()) {
    return;
  }
  externalNumber = null;
  selectedNumber = null;
  let targets;
  try {
    const value = parseExternalNumber(externalInput.value);
    targets = getExternalNumberTargets(game, value);
    externalNumber = value;
    selectedNumber = value;
  } catch (error) {
    externalInput.setAttribute("aria-invalid", "true");
    appStatus.textContent = error.message;
    render();
    externalInput.focus();
    return;
  }
  externalInput.removeAttribute("aria-invalid");
  appStatus.textContent = targets.length === 0
    ? receivingStolenNumber
      ? `${externalNumber} cannot be placed here. It is destroyed; nothing is added. Finish the action. Own rolls unchanged (${game.ownRollCount}).`
      : `${externalNumber} cannot currently be placed on your board. Own rolls unchanged (${game.ownRollCount}).`
    : `Choose a highlighted cell to ${receivingStolenNumber ? "place the stolen" : "take"} ${externalNumber}. Own rolls unchanged (${game.ownRollCount}).`;
  render();
  if (targets.length > 0) {
    document.getElementById(`cell-${targets[0]}`).focus();
  } else {
    externalInput.focus();
  }
});

cancelExternalButton.addEventListener("click", () => {
  if (!enteringNumber()) {
    return;
  }
  const wasStolen = receivingStolenNumber;
  takingFailedRoll = false;
  receivingStolenNumber = false;
  externalNumber = null;
  selectedNumber = null;
  externalForm.reset();
  appStatus.textContent = wasStolen ? "Enter a stolen number or finish the Schnapszahl action without placement." : "Roll two physical dice and record their values.";
  render();
  (wasStolen ? enterStolenButton : takeButton).focus();
});

enterStolenButton.addEventListener("click", () => {
  if (!game.schnapszahlAction || enteringNumber() || removingOwnNumber) {
    return;
  }
  receivingStolenNumber = true;
  externalNumber = null;
  selectedNumber = null;
  externalForm.reset();
  externalInput.removeAttribute("aria-invalid");
  appStatus.textContent = "Enter the number removed from the opponent’s board. Your own rolls stay unchanged.";
  render();
  externalInput.focus();
});

finishSchnapszahlButton.addEventListener("click", () => {
  if (!game.schnapszahlAction) {
    return;
  }
  updateGame(finishSchnapszahlAction(game));
  receivingStolenNumber = false;
  externalNumber = null;
  selectedNumber = null;
  externalForm.reset();
  appStatus.textContent = "Schnapszahl action finished without placement. Own rolls unchanged.";
  render();
  nextButton.focus();
});

startRemovalButton.addEventListener("click", () => {
  if (blockedOwnControls() || game.currentRoll?.status === "pending") {
    return;
  }
  if (game.currentRoll !== null) {
    updateGame(prepareNextOwnRoll(game));
    selectedDice = [null, null];
    rollForm.reset();
  }
  removingOwnNumber = true;
  removalSelection = null;
  selectedNumber = null;
  appStatus.textContent = "Select the occupied cell stolen or destroyed by another player, then confirm removal.";
  render();
  document.querySelector(".board-cell:not(:disabled)")?.focus();
});

confirmRemovalButton.addEventListener("click", () => {
  if (!removingOwnNumber || !removalSelection) {
    return;
  }
  const { coordinate, value } = removalSelection;
  try {
    updateGame(removeOwnNumber(game, coordinate));
  } catch (error) {
    appStatus.textContent = error.message;
    return;
  }
  removingOwnNumber = false;
  removalSelection = null;
  appStatus.textContent = `Removed ${value} from ${coordinate}. Only that cell was cleared. Own rolls unchanged (${game.ownRollCount}).`;
  render();
  startRemovalButton.focus();
});

cancelRemovalButton.addEventListener("click", () => {
  if (!removingOwnNumber) {
    return;
  }
  removingOwnNumber = false;
  removalSelection = null;
  appStatus.textContent = "Removal cancelled. Board and own rolls unchanged.";
  render();
  startRemovalButton.focus();
});

newGameButton.addEventListener("click", () => {
  resetConfirmOpen = true;
  render();
  cancelNewGameButton.focus();
});

cancelNewGameButton.addEventListener("click", () => {
  resetConfirmOpen = false;
  render();
  newGameButton.focus();
});

document.getElementById("confirm-new-game").addEventListener("click", () => {
  if (!resetConfirmOpen) {
    return;
  }
  if (!clearSavedGame()) {
    showStorageStatus("The saved game could not be cleared. Your current game was kept; try again or cancel.");
    return;
  }
  // Do not immediately save an empty record: reset deliberately removes the save.
  game = createGameState();
  selectedDice = [null, null];
  selectedNumber = null;
  takingFailedRoll = false;
  externalNumber = null;
  receivingStolenNumber = false;
  removingOwnNumber = false;
  removalSelection = null;
  resetConfirmOpen = false;
  rollForm.reset();
  externalForm.reset();
  externalInput.removeAttribute("aria-invalid");
  showStorageStatus("");
  appStatus.textContent = "New game started. Roll two physical dice and record their values.";
  render();
  document.getElementById("die-1-1").focus();
});

createDiceControls();
if (game.currentRoll) {
  for (let die = 1; die <= 2; die += 1) {
    document.getElementById(`die-${die}-${game.currentRoll.dice[die - 1]}`).checked = true;
  }
}
if (game.currentRoll?.status === "pending") {
  selectedNumber = currentOptions().find((option) => option.targets.length > 0).value;
  appStatus.textContent = `Continue own roll ${game.ownRollCount}; it is already counted. Choose a number and a highlighted cell.`;
} else if (game.schnapszahlAction) {
  appStatus.textContent = "Your Schnapszahl action is still pending. Enter the stolen number or finish the action.";
} else if (game.currentRoll?.status === "failed") {
  appStatus.textContent = `Failed own roll ${game.ownRollCount} is already counted. Choose Next roll to continue.`;
} else if (game.currentRoll?.status === "placed") {
  appStatus.textContent = `Own roll ${game.ownRollCount} is complete and counted. Choose Next roll to continue.`;
} else {
  appStatus.textContent = "Roll two physical dice and record their values.";
}
if (restoredGame.status === "invalid") {
  showStorageStatus("Saved data could not be restored. A new game is shown; the old save is kept until you play or reset.");
} else if (restoredGame.status === "unavailable") {
  showStorageStatus("Local storage is unavailable. Changes may not survive a reload.");
} else if (restoredGame.status === "restored") {
  showStorageStatus("Saved game restored.");
}
render();
