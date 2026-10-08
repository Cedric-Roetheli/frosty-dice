// UI coordination only. Dice, roll counting, and placement rules live in game.js.
import {
  BOARD_COLUMNS as columns,
  BOARD_ROW_COUNT as rowCount,
  confirmOwnRoll,
  createGameState,
  getCellValue,
  getRollOptions,
  isValidDieValue,
  placeOwnRollNumber,
  prepareNextOwnRoll,
} from "./game.js";
import "./scoring.js";
import "./storage.js";

let game = createGameState();
let selectedDice = [null, null];
let selectedNumber = null;

const rollForm = document.getElementById("own-roll-form");
const confirmButton = document.getElementById("confirm-roll");
const nextButton = document.getElementById("next-roll");
const rollPanel = document.getElementById("roll-panel");
const placementControls = document.getElementById("placement-controls");
const numberOptions = document.getElementById("number-options");
const appStatus = document.getElementById("app-status");

function currentOptions() {
  if (!game.currentRoll || game.currentRoll.status === "placed") {
    return [];
  }
  return getRollOptions(game.board, ...game.currentRoll.dice);
}

function createCell(coordinate, targets) {
  const value = getCellValue(game.board, coordinate);
  const isTarget = game.currentRoll?.status === "pending" && targets.includes(coordinate);
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
  document.getElementById("board-mode").textContent = pending
    ? `Place ${selectedNumber}`
    : game.currentRoll?.status === "failed" ? "Failed roll" : "Ready";
  placementControls.hidden = options.length === 0;
  rollPanel.hidden = pending;
  rollForm.hidden = complete;
  nextButton.hidden = !complete;
  document.getElementById("roll-heading").textContent = complete ? "Next own roll" : "Record own roll";
  confirmButton.disabled = game.currentRoll !== null || !selectedDice.every(isValidDieValue);
  for (const fieldset of rollForm.querySelectorAll("fieldset")) {
    fieldset.disabled = game.currentRoll !== null;
  }
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
  if (game.currentRoll !== null) {
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
  if (game.currentRoll !== null) {
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
  if (!button || button.disabled || game.currentRoll?.status !== "pending") {
    return;
  }
  selectedNumber = Number(button.dataset.number);
  render();
  numberOptions.querySelector(`button[data-number='${selectedNumber}']`).focus({ preventScroll: true });
});

document.getElementById("board-rows").addEventListener("click", (event) => {
  const cell = event.target.closest("button[data-coordinate]");
  if (!cell || cell.disabled || game.currentRoll?.status !== "pending") {
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
  if (!game.currentRoll || game.currentRoll.status === "pending") {
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

createDiceControls();
render();
appStatus.textContent = "Roll two physical dice and record their values.";
