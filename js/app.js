// Board rendering is presentation only; game rules belong in game.js.
import "./game.js";
import "./scoring.js";
import "./storage.js";

const columns = ["A", "B", "C", "D"];
const rowCount = 7;

function createCell(coordinate) {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.id = `cell-${coordinate}`;
  cell.className = "board-cell";
  cell.disabled = true;

  const marker = coordinate === "A1" ? "Start" : coordinate === "D7" ? "Goal" : "";
  cell.setAttribute("aria-label", `${coordinate}, ${marker ? `${marker.toLowerCase()}, ` : ""}empty`);

  if (marker) {
    cell.classList.add(`board-cell--${marker.toLowerCase()}`);

    const markerLabel = document.createElement("span");
    markerLabel.className = "board-cell__marker";
    markerLabel.textContent = marker;

    const coordinateLabel = document.createElement("span");
    coordinateLabel.className = "board-cell__coordinate";
    coordinateLabel.textContent = coordinate;

    cell.append(markerLabel, coordinateLabel);
  }

  return cell;
}

function renderBoard() {
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
      entry.append(createCell(`${column}${rowNumber}`));
      row.append(entry);
    }

    rows.append(row);
  }

  document.getElementById("board-columns").replaceChildren(headerRow);
  document.getElementById("board-rows").replaceChildren(rows);
}

renderBoard();

const appStatus = document.getElementById("app-status");
appStatus.textContent = "Board preview only. Play controls will be added later.";
