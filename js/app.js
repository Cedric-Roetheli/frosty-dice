// UI coordination only. Dice, roll counting, and placement rules live in game.js.
import {
  BOARD_COLUMNS as columns,
  BOARD_ROW_COUNT as rowCount,
  confirmOwnRoll,
  createGameState,
  getCellValue,
  getExternalNumberTargets,
  getRollOptions,
  isValidDieValue,
  parseExternalNumber,
  placeExternalNumber,
  placeOwnRollNumber,
  prepareNextOwnRoll,
} from "./game.js";
import "./scoring.js";
import "./storage.js";

let game = createGameState();
let selectedDice = [null, null];
let selectedNumber = null;
let takingFailedRoll = false;
let externalNumber = null;

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

function currentOptions() {
  if (takingFailedRoll) {
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
  const isTarget = (takingFailedRoll || game.currentRoll?.status === "pending") && targets.includes(coordinate);
  const cell = document.createElement("button");
  cell.type = "button";
  cell.id = `cell-${coordinate}`;
  cell.dataset.coordinate = coordinate;
  cell.className = "board-cell";
  cell.disabled = !isTarget;

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

function renderBoard(options) {
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
  document.getElementById("number-heading").textContent = takingFailedRoll
    ? "From an opponent’s failed roll"
    : "Choose a number";
  if (takingFailedRoll) {
    const summary = document.createElement("p");
    summary.className = "external-number-summary";
    summary.textContent = options.length > 0
      ? `${externalNumber} · ${options[0].targets.length} legal ${options[0].targets.length === 1 ? "target" : "targets"}`
      : "";
    numberOptions.replaceChildren(summary);
    document.getElementById("placement-help").textContent = options[0]?.targets.length > 0
      ? `Tap a highlighted cell to take ${externalNumber}. Own rolls stay unchanged.`
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
  const pending = game.currentRoll?.status === "pending";
  const complete = game.currentRoll !== null && !pending;
  renderBoard(options);
  renderNumberOptions(options);
  document.getElementById("own-roll-count").textContent = game.ownRollCount;
  let boardMode = "Ready";
  if (takingFailedRoll) {
    boardMode = externalNumber === null ? "Take failed roll" : `Take ${externalNumber}`;
  } else if (pending) {
    boardMode = `Place ${selectedNumber}`;
  } else if (game.currentRoll?.status === "failed") {
    boardMode = "Failed roll";
  }
  document.getElementById("board-mode").textContent = boardMode;
  placementControls.hidden = options.length === 0;
  rollPanel.hidden = pending || takingFailedRoll;
  rollForm.hidden = complete;
  nextButton.hidden = !complete;
  document.getElementById("roll-heading").textContent = complete ? "Next own roll" : "Record own roll";
  confirmButton.disabled = takingFailedRoll || game.currentRoll !== null || !selectedDice.every(isValidDieValue);
  for (const fieldset of rollForm.querySelectorAll("fieldset")) {
    fieldset.disabled = takingFailedRoll || game.currentRoll !== null;
  }
  takeButton.hidden = takingFailedRoll;
  takeButton.disabled = pending;
  document.getElementById("take-help").hidden = !pending;
  externalForm.hidden = !takingFailedRoll;
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
  if (takingFailedRoll || game.currentRoll !== null) {
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
  if (takingFailedRoll || game.currentRoll !== null) {
    return;
  }
  try {
    game = confirmOwnRoll(game, ...selectedDice);
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
  if (takingFailedRoll || !button || button.disabled || game.currentRoll?.status !== "pending") {
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
  if (takingFailedRoll) {
    if (externalNumber === null) {
      return;
    }
    try {
      game = placeExternalNumber(game, cell.dataset.coordinate, externalNumber);
    } catch (error) {
      appStatus.textContent = error.message;
      return;
    }
    appStatus.textContent = `Took ${externalNumber} at ${cell.dataset.coordinate}. Own rolls unchanged (${game.ownRollCount}).`;
    takingFailedRoll = false;
    externalNumber = null;
    selectedNumber = null;
    externalForm.reset();
    render();
    takeButton.focus();
    return;
  }
  if (game.currentRoll?.status !== "pending") {
    return;
  }
  try {
    game = placeOwnRollNumber(game, cell.dataset.coordinate, selectedNumber);
  } catch (error) {
    appStatus.textContent = error.message;
    return;
  }
  appStatus.textContent = `Placed ${selectedNumber} at ${cell.dataset.coordinate}. Own roll ${game.ownRollCount} counted once.`;
  selectedNumber = null;
  render();
  nextButton.focus();
});

nextButton.addEventListener("click", () => {
  if (takingFailedRoll || !game.currentRoll || game.currentRoll.status === "pending") {
    return;
  }
  game = prepareNextOwnRoll(game);
  selectedDice = [null, null];
  selectedNumber = null;
  rollForm.reset();
  appStatus.textContent = "Roll two physical dice and record their values.";
  render();
  document.getElementById("die-1-1").focus();
});

takeButton.addEventListener("click", () => {
  if (takingFailedRoll || game.currentRoll?.status === "pending") {
    return;
  }
  if (game.currentRoll !== null) {
    game = prepareNextOwnRoll(game);
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
  if (!takingFailedRoll) {
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
  if (!takingFailedRoll) {
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
    ? `${externalNumber} cannot currently be placed on your board. Own rolls unchanged (${game.ownRollCount}).`
    : `Choose a highlighted cell to take ${externalNumber}. Own rolls unchanged (${game.ownRollCount}).`;
  render();
  if (targets.length > 0) {
    document.getElementById(`cell-${targets[0]}`).focus();
  } else {
    externalInput.focus();
  }
});

cancelExternalButton.addEventListener("click", () => {
  if (!takingFailedRoll) {
    return;
  }
  takingFailedRoll = false;
  externalNumber = null;
  selectedNumber = null;
  externalForm.reset();
  appStatus.textContent = "Roll two physical dice and record their values.";
  render();
  takeButton.focus();
});

createDiceControls();
render();
appStatus.textContent = "Roll two physical dice and record their values.";
