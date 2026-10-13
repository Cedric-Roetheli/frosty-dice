// UI coordination only. All placement, freezing, scoring, and goal rules stay pure.
import {
  BOARD_COLUMNS as columns,
  BOARD_ROW_COUNT as rowCount,
  createGameState,
  getCell,
  getDiceOptions,
  getLegalTargetCells,
  hasReachedGoal,
  isValidDieValue,
  parseNumberInput,
  placeGameNumber,
} from "./game.js";
import { getScoreBreakdown } from "./scoring.js";
import { clearSavedGame, loadGame, saveGame } from "./storage.js";

// The document/storage arguments allow startup regression tests without a browser.
export function initializeApp(document, storage) {
  const restoredGame = loadGame(storage);
  let game = restoredGame.state;
  let selectedDice = [null, null];
  let selectedNumber = null;
  // Input preview only: never stored in canonical game state or localStorage.
  let pairPreview = null;
  let enteringManually = false;
  let enteredNumber = null;
  let resetConfirmOpen = false;

  const rollForm = document.getElementById("own-roll-form");
  const confirmButton = document.getElementById("confirm-roll");
  const nextButton = document.getElementById("next-roll");
  const rollPanel = document.getElementById("roll-panel");
  const placementControls = document.getElementById("placement-controls");
  const placementHelp = document.getElementById("placement-help");
  const numberOptions = document.getElementById("number-options");
  const appStatus = document.getElementById("app-status");
  const takeButton = document.getElementById("take-failed-roll");
  const externalForm = document.getElementById("external-number-form");
  const externalInput = document.getElementById("external-number");
  const cancelExternalButton = document.getElementById("cancel-external-number");
  const scoreFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const storageStatus = document.getElementById("storage-status");
  const newGameButton = document.getElementById("new-game");
  const resetConfirmation = document.getElementById("reset-confirmation");
  const cancelNewGameButton = document.getElementById("cancel-new-game");

  function showStorageStatus(message) {
    storageStatus.textContent = message;
    storageStatus.hidden = message.length === 0;
  }

  function showAppStatus(message, tone = "info") {
    appStatus.textContent = message;
    appStatus.dataset.tone = tone;
  }

  function updateGame(nextGame) {
    game = nextGame;
    showStorageStatus(saveGame(game, storage) ? "" : "Local saving is unavailable. Changes may not survive a reload.");
  }

  function currentOptions() {
    if (enteringManually) {
      return enteredNumber === null ? [] : [{ value: enteredNumber, targets: getLegalTargetCells(game.board, enteredNumber) }];
    }
    return pairPreview === null || pairPreview.status === "placed" ? [] : getDiceOptions(game.board, ...pairPreview.dice);
  }

  function createCell(coordinate, targets) {
    const record = getCell(game.board, coordinate);
    const value = record?.value ?? null;
    const isTarget = (enteringManually || pairPreview?.status === "pending") && targets.includes(coordinate);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.id = `cell-${coordinate}`;
    cell.dataset.coordinate = coordinate;
    cell.className = "board-cell";
    cell.disabled = !isTarget;
    cell.dataset.frozen = String(record?.status === "frozen");
    cell.dataset.state = record?.status ?? "empty";
    if (value !== null) {
      cell.classList.add("board-cell--occupied");
    }

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
    if (record?.status === "frozen" || record?.status === "thawed") {
      const frozen = record.status === "frozen";
      labels.push(record.status, "permanently 0 points", frozen ? "cannot support placement" : "usable placement neighbor");
      if (frozen) {
        cell.classList.add("board-cell--frozen");
        const ice = document.createElement("img");
        ice.className = "board-cell__ice";
        ice.src = "./assets/icecube.png";
        ice.alt = "";
        // Bound the large source image even before the stylesheet is available.
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

    if (isTarget) {
      cell.classList.add("board-cell--legal");
      labels.push(`legal target for ${selectedNumber}`);
      const targetLabel = document.createElement("span");
      targetLabel.className = "board-cell__target";
      targetLabel.textContent = `+${selectedNumber}`;
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
    document.getElementById("number-heading").textContent = enteringManually ? "Entered number" : "Choose a number";
    if (enteringManually) {
      const summary = document.createElement("p");
      summary.className = "external-number-summary";
      summary.textContent = options.length > 0
        ? `${enteredNumber} · ${options[0].targets.length} legal ${options[0].targets.length === 1 ? "target" : "targets"}` : "";
      numberOptions.replaceChildren(summary);
      placementHelp.textContent = options[0]?.targets.length > 0
        ? `Tap a dashed +${enteredNumber} cell.` : "This number cannot currently be placed.";
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
        : `${option.value === selectedNumber ? "✓ Selected · " : ""}${option.targets.length} ${option.targets.length === 1 ? "target" : "targets"}`;
      button.append(value, help);
      return button;
    });
    numberOptions.replaceChildren(...buttons);
    placementHelp.textContent = pairPreview?.status === "pending"
      ? `Tap a dashed +${selectedNumber} cell to place it.`
      : "No legal targets for this pair.";
  }

  function render() {
    const options = currentOptions();
    const scoring = getScoreBreakdown(game.board);
    const goalStatus = document.getElementById("goal-status");
    const goalMessage = hasReachedGoal(game.board) ? "You have reached the goal at D7!" : "";
    goalStatus.hidden = goalMessage.length === 0;
    if (goalStatus.textContent !== goalMessage) goalStatus.textContent = goalMessage;
    renderBoard(options, scoring.streetRows);
    renderNumberOptions(options);
    document.getElementById("current-score").textContent = scoreFormat.format(scoring.score);
    const streetBonus = document.getElementById("street-bonus");
    streetBonus.hidden = scoring.streetRows.length === 0;
    streetBonus.textContent = `Street bonus +${scoring.streetBonus} · ${scoring.streetRows.length} ${scoring.streetRows.length === 1 ? "Street" : "Streets"}`;

    const pending = pairPreview?.status === "pending";
    const complete = pairPreview !== null && !pending;
    const boardMode = document.getElementById("board-mode");
    boardMode.textContent = enteringManually ? (enteredNumber === null ? "Enter number" : `Place ${enteredNumber}`)
      : pending ? `Place ${selectedNumber}` : pairPreview?.status === "unplaceable" ? "No legal targets" : "Ready";
    boardMode.dataset.tone = pairPreview?.status === "unplaceable" && !enteringManually ? "warning" : "info";
    placementControls.hidden = options.length === 0;
    placementHelp.hidden = !enteringManually && pairPreview?.status === "unplaceable";
    rollPanel.hidden = pending || enteringManually;
    rollForm.hidden = complete;
    nextButton.hidden = !complete;
    document.getElementById("roll-heading").textContent = complete ? "Next pair" : "Record chosen pair";
    confirmButton.disabled = enteringManually || pairPreview !== null || !selectedDice.every(isValidDieValue);
    for (const fieldset of rollForm.querySelectorAll("fieldset")) fieldset.disabled = enteringManually || pairPreview !== null;
    takeButton.hidden = enteringManually;
    takeButton.disabled = pending;
    document.getElementById("take-help").hidden = !pending;
    externalForm.hidden = !enteringManually;
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
        const check = document.createElement("span");
        check.className = "dice-check";
        check.textContent = "✓";
        check.setAttribute("aria-hidden", "true");
        text.append(check);
        label.append(input, text);
        choices.append(label);
      }
      document.getElementById(`die-${die}-values`).replaceChildren(choices);
    }
  }

  rollForm.addEventListener("change", (event) => {
    if (enteringManually || pairPreview !== null) return;
    const input = event.target;
    if (input.name === "die-1" || input.name === "die-2") {
      selectedDice[input.name === "die-1" ? 0 : 1] = Number(input.value);
      confirmButton.disabled = !selectedDice.every(isValidDieValue);
    }
  });

  rollForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (enteringManually || pairPreview !== null) return;
    let options;
    try {
      options = getDiceOptions(game.board, ...selectedDice);
    } catch (error) {
      showAppStatus(error.message, "error");
      return;
    }
    selectedNumber = options.find((option) => option.targets.length > 0)?.value ?? null;
    pairPreview = { dice: [...selectedDice], status: selectedNumber === null ? "unplaceable" : "pending" };
    showAppStatus(selectedNumber === null
      ? `${options.map((option) => option.value).join(" or ")} cannot currently be placed. Choose Next pair to continue.`
      : "Choose a number, then tap a dashed cell.", selectedNumber === null ? "warning" : "info");
    render();
    if (selectedNumber !== null) numberOptions.querySelector("button[aria-pressed='true']").focus();
    else nextButton.focus();
  });

  numberOptions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-number]");
    if (enteringManually || !button || button.disabled || pairPreview?.status !== "pending") return;
    selectedNumber = Number(button.dataset.number);
    render();
    numberOptions.querySelector(`button[data-number='${selectedNumber}']`).focus({ preventScroll: true });
  });

  document.getElementById("board-rows").addEventListener("click", (event) => {
    const cell = event.target.closest("button[data-coordinate]");
    if (!cell || cell.disabled || selectedNumber === null) return;
    if (!enteringManually && pairPreview?.status !== "pending") return;
    try {
      updateGame(placeGameNumber(game, cell.dataset.coordinate, selectedNumber));
    } catch (error) {
      showAppStatus(error.message, "error");
      return;
    }
    const placed = getCell(game.board, cell.dataset.coordinate);
    showAppStatus(`Placed ${placed.value} at ${cell.dataset.coordinate}.${placed.status === "frozen" ? " FROZEN: 0 points; cannot support placement." : ""}`, "success");
    const wasManual = enteringManually;
    if (wasManual) {
      enteringManually = false;
      enteredNumber = null;
      externalForm.reset();
    } else {
      pairPreview = { ...pairPreview, status: "placed" };
    }
    selectedNumber = null;
    render();
    (wasManual ? takeButton : nextButton).focus();
  });

  nextButton.addEventListener("click", () => {
    if (enteringManually || pairPreview === null || pairPreview.status === "pending") return;
    pairPreview = null;
    selectedDice = [null, null];
    selectedNumber = null;
    rollForm.reset();
    showAppStatus("Enter the values of your chosen physical pair.");
    render();
    document.getElementById("die-1-1").focus();
  });

  takeButton.addEventListener("click", () => {
    if (enteringManually || pairPreview?.status === "pending") return;
    if (pairPreview !== null) {
      pairPreview = null;
      selectedDice = [null, null];
      rollForm.reset();
    }
    enteringManually = true;
    enteredNumber = null;
    selectedNumber = null;
    externalForm.reset();
    externalInput.removeAttribute("aria-invalid");
    showAppStatus("Enter a two-digit dice number.");
    render();
    externalInput.focus();
  });

  externalInput.addEventListener("input", () => {
    if (!enteringManually) return;
    enteredNumber = null;
    selectedNumber = null;
    externalInput.removeAttribute("aria-invalid");
    showAppStatus("Enter two digits from 1–6, then show placements.");
    render();
  });

  externalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!enteringManually) return;
    enteredNumber = null;
    selectedNumber = null;
    let targets;
    try {
      enteredNumber = parseNumberInput(externalInput.value);
      targets = getLegalTargetCells(game.board, enteredNumber);
      selectedNumber = enteredNumber;
    } catch (error) {
      externalInput.setAttribute("aria-invalid", "true");
      showAppStatus(error.message, "error");
      render();
      externalInput.focus();
      return;
    }
    externalInput.removeAttribute("aria-invalid");
    showAppStatus(targets.length === 0 ? `${enteredNumber} cannot currently be placed on your board.`
      : `Tap a dashed +${enteredNumber} cell.`, targets.length === 0 ? "warning" : "info");
    render();
    if (targets.length > 0) document.getElementById(`cell-${targets[0]}`).focus();
    else externalInput.focus();
  });

  cancelExternalButton.addEventListener("click", () => {
    if (!enteringManually) return;
    enteringManually = false;
    enteredNumber = null;
    selectedNumber = null;
    externalForm.reset();
    externalInput.removeAttribute("aria-invalid");
    showAppStatus("Enter the values of your chosen physical pair.");
    render();
    takeButton.focus();
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
    if (!resetConfirmOpen) return;
    if (!clearSavedGame(storage)) {
      showStorageStatus("The saved game could not be cleared. Your current game was kept; try again or cancel.");
      return;
    }
    game = createGameState();
    selectedDice = [null, null];
    selectedNumber = null;
    pairPreview = null;
    enteringManually = false;
    enteredNumber = null;
    resetConfirmOpen = false;
    rollForm.reset();
    externalForm.reset();
    externalInput.removeAttribute("aria-invalid");
    showStorageStatus("");
    showAppStatus("New game started. Enter your chosen physical pair.", "success");
    render();
    document.getElementById("die-1-1").focus();
  });

  createDiceControls();
  showAppStatus("Enter the values of your chosen physical pair.");
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
