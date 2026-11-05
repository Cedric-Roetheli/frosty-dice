import { getScoreBreakdown } from "./scoring.js?v=v3-multipliers-1";

const dollars = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const RECEIPT_BACKGROUNDS = Object.freeze([
  "./assets/receipt.png",
  "./assets/receipt2.png",
  "./assets/receipt3.png",
  "./assets/receipt4.png",
  "./assets/receipt6.png",
  "./assets/receipt7.png",
]);

export function chooseReceiptBackground(random = Math.random) {
  return RECEIPT_BACKGROUNDS[Math.floor(random() * RECEIPT_BACKGROUNDS.length)];
}

export function formatFrostyDollars(value) {
  return "$" + dollars.format(value);
}

export function getSaleSticker(balance) {
  if (balance < 100) return "./assets/sale_orange.png";
  if (balance < 500) return "./assets/sale_yellow.png";
  if (balance < 1000) return "./assets/sale_green.png";
  return "./assets/sale_pink.png";
}

// Presentation only: read authoritative state, never spend, save, or create Undo.
export function createReceipt(document, readGame, random = Math.random) {
  const dialog = document.getElementById("receipt-dialog");
  const art = document.getElementById("receipt-art");
  const opener = document.getElementById("open-receipt");
  const closeButton = document.getElementById("close-receipt");
  const list = document.getElementById("receipt-history");
  let opened = false;
  let backdropPointer = false;

  function render() {
    const game = readGame();
    const scoring = getScoreBreakdown(game.board, game.pointsSpent ?? 0);
    document.getElementById("receipt-board-value").textContent = formatFrostyDollars(scoring.baseSum + scoring.streetBonus);
    // The dollar sign is part of the receipt's balance markup.
    document.getElementById("current-score").textContent = dollars.format(scoring.score);
    document.getElementById("receipt-sale-sticker").src = getSaleSticker(scoring.score);
    const history = game.challengeHistory ?? [];
    const entries = history.map((entry) => {
      const row = document.createElement("li");
      row.className = "receipt-transaction";
      const number = document.createElement("span");
      number.textContent = "1x Challenge #" + String(entry.id).padStart(2, "0");
      const amount = document.createElement("span");
      amount.textContent = "-" + formatFrostyDollars(entry.amount);
      row.append(number, amount);
      return row;
    });
    if (entries.length === 0) {
      const empty = document.createElement("li");
      empty.className = "receipt-empty";
      empty.textContent = "No Challenges yet";
      entries.push(empty);
    }
    list.replaceChildren(...entries);
    const earlierSpending = (game.pointsSpent ?? 0) - history.reduce((sum, entry) => sum + entry.amount, 0);
    const priorSpending = document.getElementById("receipt-prior-spending");
    priorSpending.hidden = earlierSpending === 0;
    priorSpending.textContent = earlierSpending === 0 ? "" : "Earlier spending: -" + formatFrostyDollars(earlierSpending);
  }

  function finishClose() {
    if (!opened) return;
    opened = false;
    backdropPointer = false;
    opener.focus({ preventScroll: true });
  }

  function close() {
    if (dialog.open) dialog.close();
    finishClose();
  }

  closeButton.addEventListener("click", close);
  dialog.addEventListener("close", () => { if (!dialog.open) finishClose(); });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  function isBackdrop(event) {
    if (event.target !== dialog) return false;
    const bounds = dialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }
  dialog.addEventListener("pointerdown", (event) => { backdropPointer = isBackdrop(event); });
  dialog.addEventListener("click", (event) => {
    if (backdropPointer && isBackdrop(event)) close();
    backdropPointer = false;
  });

  return {
    get isOpen() { return dialog.open; },
    close,
    render,
    open() {
      if (dialog.open) return;
      art.src = chooseReceiptBackground(random);
      render();
      list.scrollTop = 0;
      dialog.showModal();
      opened = true;
      closeButton.focus({ preventScroll: true });
    },
  };
}
