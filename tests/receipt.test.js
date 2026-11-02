import { initializeApp } from "../js/app.js";
import { cloneGameState, confirmGameBid, createGameState, freezeGameCell, isValidGameState, placeGameNumber, undoLastMove, unfreezeGameCell } from "../js/game.js";
import { calculateScore, getCellScoreMultiplier } from "../js/scoring.js";
import { formatFrostyDollars, getSaleSticker } from "../js/receipt.js";
import { SAVE_VERSION, STORAGE_KEY, deserializeGame, loadGame, serializeGame } from "../js/storage.js";
import { appTestDocument, appTestStorage } from "./app-initialization.test.js";
import { boardFixture } from "./fixtures.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

function start(state = createGameState(), serialized = serializeGame(state)) {
  const document = appTestDocument();
  const storage = appTestStorage(serialized);
  initializeApp(document, storage);
  return { document, storage };
}

function place(document, coordinate, value) {
  document.getElementById("board-rows").emit("click", document.getElementById("cell-" + coordinate));
  const input = document.getElementById("cell-" + coordinate);
  input.value = String(value);
  input.emit("input");
}

function bid(document, amount) {
  document.getElementById("open-challenge").emit("click");
  document.getElementById("challenge-bid").value = String(amount);
  document.getElementById("challenge-form").emit("submit");
}

function open(document) {
  document.getElementById("open-receipt").emit("click");
  return document.getElementById("receipt-dialog");
}

function close(document) { document.getElementById("close-receipt").emit("click"); }
function history(document) { return document.getElementById("receipt-history").children; }

export async function runReceiptTests(sources) {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }
  if (!sources) {
    try {
      sources = Object.fromEntries(await Promise.all(Object.entries({ html: "../index.html", css: "../css/style.css" }).map(async ([name, url]) => {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error("Cannot load " + url);
        return [name, await response.text()];
      })));
    } catch (error) {
      return [{ name: "Receipt source files are available", passed: false, message: error.message }];
    }
  }

  test("Frosty Dollars use a dollar sign and grouped whole-number amounts", () => {
    for (const [amount, text] of [[0, "$0"], [25, "$25"], [150, "$150"], [1420, "$1,420"]]) {
      assertEqual(formatFrostyDollars(amount), text);
    }
  });

  const stickerCases = [[0, "orange"], [99, "orange"], [100, "yellow"], [499, "yellow"],
    [500, "green"], [999, "green"], [1000, "pink"], [1500, "pink"]];
  function boardWithSixes(count, startValue) {
    return boardFixture(["A1", startValue], ...Array.from({ length: count }, (_, index) =>
      ["ABCD"[index % 4] + (Math.floor(index / 4) + 2), 66]));
  }
  function assertSticker(document, color) {
    assertEqual(document.getElementById("receipt-sale-sticker").src, "./assets/sale_" + color + ".png");
  }

  test("Sale sticker thresholds include every requested boundary and a balance above $1000", () => {
    for (const [balance, color] of stickerCases) {
      assertEqual(getSaleSticker(balance), "./assets/sale_" + color + ".png");
    }
  });

  test("Saved balances render the correct sticker on load and opening without persisting its color", () => {
    const board = boardWithSixes(12, 16);
    assertEqual(calculateScore(board), 1600);
    for (const [balance, color] of stickerCases) {
      const state = { board, undo: null, pointsSpent: 1600 - balance };
      const { document, storage } = start(state);
      const saved = storage.getItem(STORAGE_KEY);
      assertSticker(document, color);
      open(document);
      assertSticker(document, color);
      assertEqual(document.getElementById("receipt-total").textContent, formatFrostyDollars(balance));
      close(document);
      assertEqual(storage.getItem(STORAGE_KEY), saved);
      assert(!saved.includes("sticker"));
      assert(!saved.includes("sale_"));
    }
  });

  test("Board Value $1200 minus $350 spending selects green for the authoritative $850 balance", () => {
    const board = boardWithSixes(9, 12);
    assertEqual(calculateScore(board), 1200);
    const { document } = start({ board, undo: null, pointsSpent: 350 });
    open(document);
    assertEqual(document.getElementById("receipt-board-value").textContent, "$1,200");
    assertEqual(document.getElementById("receipt-total").textContent, "$850");
    assertSticker(document, "green");
  });

  test("Challenge deductions, bid Undo, and confirmed Reset refresh the derived sticker", () => {
    const { document, storage } = start({ board: boardWithSixes(9, 12), undo: null, pointsSpent: 200 });
    assertSticker(document, "pink");
    bid(document, 1);
    document.getElementById("close-challenge").emit("click");
    assertSticker(document, "green");
    assertEqual(loadGame(storage).state.pointsSpent, 201);
    document.getElementById("undo-move").emit("click");
    assertSticker(document, "pink");
    assertEqual(loadGame(storage).state.pointsSpent, 200);
    bid(document, 501);
    document.getElementById("close-challenge").emit("click");
    assertSticker(document, "yellow");
    bid(document, 400);
    document.getElementById("close-challenge").emit("click");
    assertSticker(document, "orange");
    assertEqual(loadGame(storage).state.pointsSpent, 1101);
    assertEqual(loadGame(storage).state.challengeHistory.length, 2);
    document.getElementById("new-game").emit("click");
    document.getElementById("confirm-new-game").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), null);
    open(document);
    assertEqual(document.getElementById("receipt-total").textContent, "$0");
    assertSticker(document, "orange");
  });

  test("Legal placement and repdigit scoring update the sticker and placement Undo restores it", () => {
    const { document } = start();
    place(document, "A1", 46);
    assertSticker(document, "orange");
    place(document, "B1", 55);
    assertEqual(document.getElementById("receipt-total").textContent, "$156");
    assertSticker(document, "yellow");
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("receipt-total").textContent, "$46");
    assertSticker(document, "orange");
  });

  test("Completing a Street uses its existing repdigit multiplier when choosing the sticker", () => {
    const { document } = start({ board: boardFixture(["A2", 55], ["B2", 56], ["C2", 61]), undo: null });
    assertSticker(document, "yellow");
    place(document, "D2", 62);
    assertEqual(document.getElementById("receipt-total").textContent, "$578");
    assertSticker(document, "green");
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("receipt-total").textContent, "$227");
    assertSticker(document, "yellow");
  });

  test("The balance stays on one line and only its separately clipped sticker rotates", () => {
    const row = sources.css.match(/\.receipt-total\s*\{([^}]+)\}/)?.[1];
    assert(row.includes("grid-template-columns: max-content minmax(0, 1fr)"));
    assert(!row.includes("flex-direction: column"));
    const sticker = sources.css.match(/\.receipt-sale-sticker\s*\{([^}]+)\}/)?.[1];
    const clip = sources.css.match(/\.receipt-sticker-clip\s*\{([^}]+)\}/)?.[1];
    const amount = sources.css.match(/\.receipt-balance-amount\s*\{([^}]+)\}/)?.[1];
    assert(sticker.includes("rotate(-8deg)"));
    assert(sticker.includes("height: auto"));
    assert(clip.includes("overflow: hidden"));
    assert(clip.includes("z-index: 0"));
    assert(amount.includes("z-index: 1"));
    assert(amount.includes("font-weight: 400"));
    assert(amount.includes("color: #000"));
    assert(amount.includes("white-space: nowrap"));
    assert(!amount.includes("transform"));
    assert(!amount.includes("overflow"));
    const { document } = start();
    const art = document.getElementById("receipt-sale-sticker");
    const total = document.getElementById("receipt-total");
    assertEqual(art.parentNode.parentNode, total.parentNode);
    assert(art.parentNode !== total.parentNode);
    assertEqual(art.alt, "");
    assertEqual(art.width, 1024);
    assertEqual(art.height, 1024);
  });

  test("The header exposes only a dollar button and the balance belongs to a closed native dialog", () => {
    const header = sources.html.match(/<header[\s\S]*?<\/header>/)?.[0];
    assert(header.includes('id="open-receipt"'));
    assert(header.includes('aria-label="Open Frosty Fresh Goods receipt"'));
    assert(!header.includes("current-score"));
    assert(!header.includes("Points"));
    const dialog = sources.html.match(/<dialog id="receipt-dialog"[\s\S]*?<\/dialog>/)?.[0];
    assert(dialog && !dialog.split(">")[0].includes(" open"));
    assert(dialog.includes('id="current-score"'));
    assert(dialog.includes('aria-labelledby="receipt-heading"'));
    const { document } = start({ board: boardFixture(["A1", 22]), undo: null });
    assertEqual(document.getElementById("receipt-dialog").open, false);
    assertEqual(document.getElementById("open-receipt").textContent, "$");
    assert(!document.getElementById("app-header").textContent.includes("44"));
  });

  test("Opening and closing the receipt changes focus without spending, saving, or replacing Undo", () => {
    const state = placeGameNumber(createGameState(), "A1", 22);
    const { document, storage } = start(state);
    const before = storage.getItem(STORAGE_KEY);
    const dialog = open(document);
    assert(dialog.open);
    assertEqual(document.activeElement, document.getElementById("close-receipt"));
    assertEqual(document.getElementById("receipt-board-value").textContent, "$44");
    assertEqual(document.getElementById("receipt-total").textContent, "$44");
    assertEqual(storage.getItem(STORAGE_KEY), before);
    close(document);
    assert(!dialog.open);
    assertEqual(document.activeElement, document.getElementById("open-receipt"));
    assertEqual(storage.getItem(STORAGE_KEY), before);
    assertDeepEqual(loadGame(storage).state, state);
  });

  test("Escape, native cancellation, and backdrop clicks close the receipt accessibly", () => {
    for (const method of ["escape", "cancel", "backdrop", "native close"]) {
      const { document, storage } = start();
      const before = storage.getItem(STORAGE_KEY);
      const dialog = open(document);
      if (method === "escape") assert(dialog.emit("keydown", dialog, { key: "Escape" }).defaultPrevented);
      if (method === "cancel") assert(dialog.emit("cancel").defaultPrevented);
      if (method === "backdrop") {
        dialog.emit("pointerdown", dialog, { clientX: 0, clientY: 0 });
        dialog.emit("click", dialog, { clientX: 0, clientY: 0 });
      }
      if (method === "native close") { dialog.close(); dialog.emit("close"); }
      assert(!dialog.open);
      assertEqual(document.activeElement, document.getElementById("open-receipt"));
      assertEqual(storage.getItem(STORAGE_KEY), before);
    }
  });

  test("Reading the receipt or finishing a scroll inside it never dismisses it", () => {
    const { document } = start();
    const dialog = open(document);
    dialog.emit("pointerdown", dialog, { clientX: 100, clientY: 200 });
    dialog.emit("click", dialog, { clientX: 100, clientY: 200 });
    assert(dialog.open);
    dialog.emit("pointerdown", document.getElementById("receipt-history"));
    dialog.emit("click", dialog, { clientX: 0, clientY: 0 });
    assert(dialog.open);
  });

  test("The open receipt guards placement, Freeze, Undo, Reset, and Challenge handlers", () => {
    const { document, storage } = start(placeGameNumber(createGameState(), "A1", 22));
    const before = storage.getItem(STORAGE_KEY);
    const dialog = open(document);
    document.getElementById("board-rows").emit("click", document.getElementById("cell-B1"));
    document.getElementById("toggle-attack-ice").emit("click");
    document.getElementById("undo-move").emit("click");
    document.getElementById("new-game").emit("click");
    document.getElementById("confirm-new-game").emit("click");
    document.getElementById("open-challenge").emit("click");
    assert(dialog.open);
    assertEqual(document.getElementById("challenge-dialog").open, false);
    assertEqual(document.getElementById("cell-B1").tagName, "button");
    assertEqual(storage.getItem(STORAGE_KEY), before);
    close(document);
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("cell-A1").dataset.state, "empty");
  });

  test("A pending bid keeps receipt opening unavailable until Challenge closes", () => {
    const { document } = start();
    document.getElementById("open-challenge").emit("click");
    open(document);
    assertEqual(document.getElementById("receipt-dialog").open, false);
    document.getElementById("close-challenge").emit("click");
    assert(open(document).open);
  });

  test("Board Value reuses repdigits, Streets, combined 4x, and both Prime damage states", () => {
    const cases = [
      [boardFixture(["A1", 16]), 16],
      [boardFixture(["A1", 22]), 44],
      [boardFixture(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14]), 122],
      [boardFixture(["A1", 21], ["B1", 22], ["C1", 23], ["D1", 24]), 224],
      [boardFixture(["A1", 23], ["B1", 31, "thawed"], ["A2", 23, "frozen"]), 23],
      [boardFixture(["A1", 11, "frozen"], ["A2", 22, "thawed"]), 0],
    ];
    for (const [board, value] of cases) {
      const { document } = start({ board, undo: null });
      open(document);
      assertEqual(document.getElementById("receipt-board-value").textContent, formatFrostyDollars(value));
      assertEqual(document.getElementById("receipt-total").textContent, formatFrostyDollars(calculateScore(board)));
    }
    assertEqual(getCellScoreMultiplier(cases[3][0][0][1], true), 4);
  });

  test("Freeze, Unfreeze, and their Undo update Board Value while preserving base repdigit points", () => {
    let state = { board: boardFixture(["A2", 21], ["B2", 22], ["C2", 23], ["D2", 24]), undo: null };
    state = confirmGameBid(state, 10);
    const { document, storage } = start(state);
    for (const [action, boardValue] of [["Freeze", 112], ["Unfreeze", 224]]) {
      document.getElementById("board-rows").emit("click", document.getElementById("cell-B2"));
      assertEqual(document.getElementById("toggle-attack-ice").textContent, action);
      document.getElementById("toggle-attack-ice").emit("click");
      open(document);
      assertEqual(document.getElementById("receipt-board-value").textContent, "$" + boardValue);
      assertEqual(document.getElementById("receipt-total").textContent, "$" + (boardValue - 10));
      assertEqual(history(document)[0].textContent, "1x Challenge #01-$10");
      close(document);
    }
    document.getElementById("undo-move").emit("click");
    open(document);
    assertEqual(document.getElementById("receipt-board-value").textContent, "$112");
    assertEqual(loadGame(storage).state.pointsSpent, 10);
  });

  test("Placements and Undo refresh receipt values on every opening, including after reaching D7", () => {
    const { document } = start();
    place(document, "A1", 16);
    open(document);
    assertEqual(document.getElementById("receipt-board-value").textContent, "$16");
    close(document);
    place(document, "B1", 24);
    open(document);
    assertEqual(document.getElementById("receipt-board-value").textContent, "$40");
    close(document);
    document.getElementById("undo-move").emit("click");
    open(document);
    assertEqual(document.getElementById("receipt-board-value").textContent, "$16");
    const goal = start({ board: boardFixture(["C7", 46]), undo: null });
    place(goal.document, "D7", 55);
    assertEqual(goal.document.getElementById("goal-status").hidden, false);
    assertEqual(goal.document.getElementById("receipt-dialog").open, false);
    open(goal.document);
    assertEqual(goal.document.getElementById("receipt-board-value").textContent, "$156");
  });

  test("Each confirmed bid adds one chronological expense without deducting it twice", () => {
    let state = { board: boardFixture(["A1", 46]), undo: null };
    for (const amount of [12, 20, 0]) state = confirmGameBid(state, amount);
    assertEqual(state.pointsSpent, 32);
    assertEqual(calculateScore(state.board, state.pointsSpent), 14);
    assertDeepEqual(state.challengeHistory, [12, 20, 0].map((amount, index) => ({ id: index + 1, amount })));
    const { document } = start(state);
    open(document);
    assertDeepEqual(history(document).map((row) => row.textContent), ["1x Challenge #01-$12", "1x Challenge #02-$20", "1x Challenge #03-$0"]);
    assertEqual(document.getElementById("receipt-total").textContent, "$14");
    close(document);
    document.getElementById("open-challenge").emit("click");
    assertEqual(document.getElementById("challenge-bid").max, "14");
    assertEqual(document.getElementById("bid-limit").textContent, "Available Frosty Dollars: $14");
  });

  test("Invalid and cancelled bids create no transactions and preserve the current snapshot", () => {
    const { document, storage } = start(placeGameNumber(createGameState(), "A1", 22));
    const before = storage.getItem(STORAGE_KEY);
    for (const amount of ["", "45", "-1", "1.5", "word"]) {
      bid(document, amount);
      assertEqual(storage.getItem(STORAGE_KEY), before);
      document.getElementById("close-challenge").emit("click");
    }
    document.getElementById("open-challenge").emit("click");
    document.getElementById("challenge-bid").value = "12";
    document.getElementById("close-challenge").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), before);
    assertDeepEqual(loadGame(storage).state.challengeHistory ?? [], []);
  });

  test("Repeated Confirm, revealing, animation callbacks, and receipt refreshes never add expenses", () => {
    const { document, storage } = start({ board: boardFixture(["A1", 46]), undo: null });
    bid(document, 12);
    for (let tap = 0; tap < 4; tap += 1) document.getElementById("challenge-form").emit("submit");
    const before = storage.getItem(STORAGE_KEY);
    document.runTimers();
    document.getElementById("reveal-bid").emit("click");
    document.runTimers();
    document.runTimers();
    document.getElementById("close-challenge").emit("click");
    open(document);
    close(document);
    open(document);
    assertEqual(storage.getItem(STORAGE_KEY), before);
    assertEqual(loadGame(storage).state.challengeHistory.length, 1);
    assertEqual(document.getElementById("receipt-total").textContent, "$34");
  });

  test("Manual Freeze and Unfreeze preserve expenses without recording extra transactions", () => {
    const { document, storage } = start({ board: boardFixture(["A2", 22]), undo: null });
    bid(document, 5);
    document.getElementById("close-challenge").emit("click");
    const expected = [{ id: 1, amount: 5 }];
    for (const action of ["Freeze", "Unfreeze"]) {
      document.getElementById("board-rows").emit("click", document.getElementById("cell-A2"));
      document.getElementById("toggle-attack-ice").emit("click");
      assertDeepEqual(loadGame(storage).state.challengeHistory, expected);
    }
    open(document);
    assertEqual(history(document)[0].textContent, "1x Challenge #01-$5");
  });

  test("Bid Undo removes its transaction, refunds once, and leaves no earlier Undo or phantom expense", () => {
    const { document, storage } = start({ board: boardFixture(["A1", 46]), undo: null });
    bid(document, 12);
    document.getElementById("close-challenge").emit("click");
    bid(document, 20);
    document.getElementById("close-challenge").emit("click");
    document.getElementById("undo-move").emit("click");
    open(document);
    assertEqual(document.getElementById("receipt-total").textContent, "$34");
    assertEqual(history(document).length, 1);
    assertEqual(history(document)[0].textContent, "1x Challenge #01-$12");
    close(document);
    document.getElementById("undo-move").emit("click");
    assertEqual(loadGame(storage).state.challengeHistory.length, 1);
    assertEqual(loadGame(storage).state.undo, null);
  });

  test("Placement, Freeze, Unfreeze, and their Undo preserve complete transaction records", () => {
    const paid = confirmGameBid({ board: boardFixture(["A1", 22], ["A2", 22]), undo: null }, 12);
    const placed = placeGameNumber(paid, "B1", 24);
    const frozen = freezeGameCell(paid, "A2");
    const unfrozen = unfreezeGameCell(frozen, "A2");
    for (const state of [placed, frozen, unfrozen]) {
      const restored = undoLastMove(deserializeGame(serializeGame(state)));
      assertEqual(restored.pointsSpent, 12);
      assertDeepEqual(restored.challengeHistory, paid.challengeHistory);
      assertEqual(restored.undo, null);
    }
  });

  test("Transactions and their Undo snapshot are independent deep copies", () => {
    const before = confirmGameBid({ board: boardFixture(["A1", 46]), undo: null }, 5);
    const after = confirmGameBid(before, 6);
    const cloned = cloneGameState(after);
    assertDeepEqual(cloned, after);
    assert(cloned.challengeHistory !== after.challengeHistory);
    assert(cloned.challengeHistory[0] !== after.challengeHistory[0]);
    assert(after.undo.challengeHistory[0] !== after.challengeHistory[0]);
    cloned.challengeHistory[0].amount = 1;
    cloned.undo.challengeHistory[0].amount = 2;
    assertEqual(before.challengeHistory[0].amount, 5);
    assertEqual(after.challengeHistory[0].amount, 5);
  });

  test("History survives reload while the receipt and unfinished bid remain closed", () => {
    const paid = confirmGameBid(confirmGameBid({ board: boardFixture(["A1", 46]), undo: null }, 5), 6);
    const { document, storage } = start(paid);
    open(document);
    const restored = start(undefined, storage.getItem(STORAGE_KEY));
    assertEqual(restored.document.getElementById("receipt-dialog").open, false);
    assertEqual(restored.document.getElementById("challenge-dialog").open, false);
    assertEqual(restored.document.getElementById("challenge-bid").value, "");
    open(restored.document);
    assertEqual(restored.document.getElementById("receipt-total").textContent, "$35");
    assertDeepEqual(history(restored.document).map((row) => row.textContent), ["1x Challenge #01-$5", "1x Challenge #02-$6"]);
  });

  test("Version 7 preserves aggregate spending and bid Undo without inventing older transactions", () => {
    const legacy = { board: boardFixture(["A1", 22]), undo: { board: boardFixture(["A1", 22]), pointsSpent: 3 }, pointsSpent: 10 };
    const saved = JSON.stringify({ version: 7, state: legacy });
    const state = deserializeGame(saved);
    assertDeepEqual(state, legacy);
    assertEqual(calculateScore(state.board, state.pointsSpent), 34);
    assertEqual(calculateScore(undoLastMove(state).board, undoLastMove(state).pointsSpent), 41);
    const { document, storage } = start(undefined, saved);
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    open(document);
    assertEqual(document.getElementById("receipt-total").textContent, "$34");
    assertEqual(document.getElementById("receipt-prior-spending").textContent, "Earlier spending: -$10");
    assertEqual(history(document)[0].textContent, "No Challenges yet");
    close(document);
    bid(document, 7);
    document.getElementById("close-challenge").emit("click");
    assertEqual(JSON.parse(storage.getItem(STORAGE_KEY)).version, SAVE_VERSION);
    open(document);
    assertEqual(document.getElementById("receipt-total").textContent, "$27");
    assertEqual(history(document)[0].textContent, "1x Challenge #01-$7");
    assertEqual(document.getElementById("receipt-prior-spending").textContent, "Earlier spending: -$10");
    close(document);
    document.getElementById("undo-move").emit("click");
    assertEqual(loadGame(storage).state.pointsSpent, 10);
    assertDeepEqual(loadGame(storage).state.challengeHistory ?? [], []);
  });

  test("Balance keeps the authoritative zero floor when previous deductions exceed current Board Value", () => {
    const { document } = start({ board: boardFixture(["A1", 22]), undo: null, pointsSpent: 70 });
    open(document);
    assertEqual(document.getElementById("receipt-board-value").textContent, "$44");
    assertEqual(document.getElementById("receipt-total").textContent, "$0");
    close(document);
    document.getElementById("open-challenge").emit("click");
    assertEqual(document.getElementById("challenge-bid").max, "0");
  });

  test("Malformed, duplicate, overspent, or mismatched transaction records fall back safely", () => {
    const paid = confirmGameBid({ board: boardFixture(["A1", 46]), undo: null }, 5);
    const badHistories = [null, {}, [null], [{ id: 2, amount: 5 }],
      [{ id: 1, amount: -1 }], [{ id: 1, amount: 6 }],
      [{ id: 1, amount: 1.5 }],
      [{ id: 1, amount: 5, extra: true }],
      [paid.challengeHistory[0], paid.challengeHistory[0]], []];
    for (const challengeHistory of badHistories) {
      const state = { ...paid, challengeHistory };
      assert(!isValidGameState(state));
      assertThrows(() => serializeGame(state));
      const saved = JSON.stringify({ version: SAVE_VERSION, state });
      const storage = appTestStorage(saved);
      assertEqual(loadGame(storage).status, "invalid");
      assertEqual(storage.getItem(STORAGE_KEY), saved);
    }
    for (const version of [2, 3, 4, 5, 6, 7]) {
      assertEqual(deserializeGame(JSON.stringify({ version, state: paid })), null);
    }
  });

  test("Reset clears spending and history, restarts numbering, and preserves Rules language", () => {
    const { document, storage } = start(confirmGameBid({ board: boardFixture(["A1", 22]), undo: null }, 5));
    storage.setItem("frosty-dice.rules-language", "de");
    document.getElementById("new-game").emit("click");
    document.getElementById("confirm-new-game").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(storage.getItem("frosty-dice.rules-language"), "de");
    open(document);
    assertEqual(document.getElementById("receipt-total").textContent, "$0");
    assertEqual(history(document)[0].textContent, "No Challenges yet");
    close(document);
    bid(document, 0);
    assertDeepEqual(loadGame(storage).state.challengeHistory, [{ id: 1, amount: 0 }]);
  });

  test("Version-8 outcome fields are discarded while preserving expenses, spending, and exact Undo", () => {
    const initial = { board: boardFixture(["A1", 22], ["A2", 22]), undo: null };
    const paid = confirmGameBid(confirmGameBid(initial, 5), 6);
    for (const current of [paid, placeGameNumber(paid, "B1", 24), freezeGameCell(paid, "A2")]) {
      const legacy = JSON.parse(JSON.stringify(current));
      legacy.challengeHistory.forEach((entry, index) => { entry.outcome = index === 0 ? "won" : "unknown"; });
      legacy.undo.challengeHistory.forEach((entry) => { entry.outcome = "lost"; });
      const saved = JSON.stringify({ version: 8, state: legacy });
      const storage = appTestStorage(saved);
      const restored = loadGame(storage);
      assertEqual(restored.status, "restored");
      assertDeepEqual(restored.state, current);
      assertDeepEqual(undoLastMove(restored.state), undoLastMove(current));
      assertEqual(storage.getItem(STORAGE_KEY), saved);
      const rewritten = serializeGame(restored.state);
      assertEqual(JSON.parse(rewritten).version, 8);
      assert(!rewritten.includes("outcome"));
      assertEqual(calculateScore(restored.state.board, restored.state.pointsSpent), calculateScore(current.board, current.pointsSpent));
    }
  });

  test("Receipt rows are regular-weight supermarket expenses with leaders and no outcome column or heading", () => {
    const state = confirmGameBid(confirmGameBid({ board: boardFixture(["A1", 46]), undo: null }, 5), 6);
    const { document } = start(state);
    open(document);
    for (const [index, row] of history(document).entries()) {
      assertEqual(row.children.length, 2);
      assertEqual(row.children[0].textContent, "1x Challenge #0" + (index + 1));
      assertEqual(row.children[1].textContent, "-$" + (index + 5));
      assert(!/[?✓✗]/.test(row.textContent));
    }
    const markup = sources.html.match(/<dialog id="receipt-dialog"[\s\S]*?<\/dialog>/)?.[0];
    assert(markup.includes("BALANCE (SALDO)"));
    assert(!markup.includes("YOUR BALANCE"));
    assert(!markup.includes("CHALLENGE HISTORY"));
    assert(!markup.includes(">TOTAL<"));
    const rowStyle = sources.css.match(/\.receipt-transaction\s*\{([^}]+)\}/)?.[1];
    assert(rowStyle.includes("font-weight: 400"));
    assert(sources.css.includes("border-bottom: 1px dotted currentColor"));
    assert(sources.css.includes("clamp(0.75rem, 3.8cqw, 0.9375rem)"));
    assert(sources.css.includes("clamp(0.8125rem, 4.1cqw, 1.125rem)"));
    assert(sources.css.includes("clamp(1.25rem, 6.4cqw, 1.75rem)"));
  });

  test("The receipt button has a white circular outline and keeps its 48px target and hidden balance", () => {
    const style = sources.css.match(/\.receipt-button\s*\{([^}]+)\}/)?.[1];
    for (const declaration of ["border: 1px solid #fff", "border-radius: 50%", "background: transparent", "color: #fff", "width: 48px", "min-height: 48px"]) {
      assert(style.includes(declaration), declaration);
    }
    const { document } = start();
    assertEqual(document.getElementById("open-receipt").textContent, "$");
  });

  test("Prime Ice renders its full-cell image through placement, receipt close, reload, and thaw", () => {
    const { document, storage } = start();
    place(document, "A1", 23);
    place(document, "B1", 31);
    function frozenImage(document, coordinate) {
      const cell = document.getElementById("cell-" + coordinate);
      const ice = cell.querySelector("img");
      assertEqual(ice.src, "./assets/icecube.png");
      assertEqual(ice.className, "board-cell__ice");
      assertEqual(ice.parentNode.className, "board-cell__ice-layer");
      assertEqual(ice.hidden, false);
      assertEqual(ice.parentNode.hidden, false);
      assertEqual(cell.children.at(-1).className, "board-cell__value");
    }
    frozenImage(document, "B1");
    const saved = storage.getItem(STORAGE_KEY);
    open(document);
    close(document);
    frozenImage(document, "B1");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    const restored = start(undefined, saved);
    frozenImage(restored.document, "B1");
    place(restored.document, "A2", 23);
    assertEqual(restored.document.getElementById("cell-B1").querySelector("img"), null);
    frozenImage(restored.document, "A2");
  });

  test("Attack Ice renders its cell-sized image through receipt close and reload, and Undo removes it", () => {
    const { document, storage } = start();
    place(document, "A1", 22);
    place(document, "A2", 22);
    document.getElementById("board-rows").emit("click", document.getElementById("cell-A2"));
    document.getElementById("toggle-attack-ice").emit("click");
    function attackImage(document) {
      const cell = document.getElementById("cell-A2");
      const ice = cell.querySelector("img");
      assertEqual(ice.src, "./assets/icecube2.png");
      assertEqual(ice.parentNode.className, "board-cell__ice-layer");
      assertEqual(ice.hidden, false);
      assertEqual(cell.dataset.attackIce, "true");
      assertEqual(cell.querySelectorAll("span").at(-1).textContent, "22");
    }
    attackImage(document);
    const saved = storage.getItem(STORAGE_KEY);
    open(document);
    close(document);
    attackImage(document);
    const restored = start(undefined, saved);
    attackImage(restored.document);
    restored.document.getElementById("undo-move").emit("click");
    assertEqual(restored.document.getElementById("cell-A2").querySelector("img"), null);
    assertEqual(restored.document.getElementById("cell-A2").dataset.attackIce, "false");
  });

  test("Ice sizing uses an inset layer with explicit paint order and preserves the approved fill", () => {
    const layer = sources.css.match(/\.board-cell__ice-layer\s*\{([^}]+)\}/)?.[1];
    const image = sources.css.match(/\.board-cell__ice\s*\{([^}]+)\}/)?.[1];
    assert(layer.includes("position: absolute"));
    assert(layer.includes("inset: 0"));
    assert(layer.includes("z-index: 0"));
    assert(layer.includes("pointer-events: none"));
    assert(image.includes("display: block"));
    assert(image.includes("width: 100%"));
    assert(image.includes("height: 100%"));
    assert(image.includes("object-fit: var(--ice-image-fit)"));
    assert(sources.css.includes("--ice-image-fit: fill;"));
    assert(sources.css.match(/\.street-marker\s*\{([^}]+)\}/)[1].includes("z-index: 1"));
    const labels = sources.css.match(/\.board-cell--frozen \.board-cell__value,[\s\S]*?\{([^}]+)\}/)?.[1];
    assert(labels.includes("z-index: 1"));
  });

  test("Long histories render chronologically inside a bounded scrolling list without stretching the art", () => {
    const challengeHistory = Array.from({ length: 120 }, (_, index) => ({ id: index + 1, amount: 0 }));
    const { document } = start({ board: boardFixture(["A1", 22]), undo: null, pointsSpent: 0, challengeHistory });
    open(document);
    assertEqual(history(document).length, 120);
    assertEqual(history(document)[0].textContent, "1x Challenge #01-$0");
    assertEqual(history(document)[119].textContent, "1x Challenge #120-$0");
    assertEqual(document.getElementById("receipt-board-value").textContent, "$44");
    assertEqual(document.getElementById("receipt-total").textContent, "$44");
    const content = sources.css.match(/\.receipt-content\s*\{([^}]+)\}/)?.[1];
    const list = sources.css.match(/\.receipt-history\s*\{([^}]+)\}/)?.[1];
    assert(content.includes("top: 38%"));
    assert(content.includes("height: 25.5%"));
    assert(list.includes("min-height: 0"));
    assert(list.includes("overflow-y: auto"));
    assert(sources.css.includes(".receipt-art { display: block; width: 100%; height: auto;"));
    assert(sources.html.includes('src="./assets/receipt.png" alt="" width="1440" height="3200"'));
  });

  test("Receipt typography is local, arrival is 450ms, and reduced motion disables the slide", () => {
    assert(sources.css.includes('font-family: "American Typewriter", "Courier New", Courier, monospace;'));
    assert(sources.css.includes("animation: receipt-arrive 450ms"));
    assert(sources.css.includes("@media (prefers-reduced-motion: reduce) {\n  .receipt-dialog[open] .receipt-paper { animation: none; }"));
    assert(!sources.html.includes("fonts.googleapis"));
    assert(!sources.css.includes("@font-face"));
  });

  return results;
}
