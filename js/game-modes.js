import { initializeApp } from "./app.js?v=two-player-1";
import { initializeTwoPlayer } from "./two-player-app.js?v=frontline-visual-1";
import { readGameMode, writeGameMode } from "./two-player-storage.js?v=frontline-1";

const copy = {
  en: { mode: "Game mode", classic: "3P+ · Classic Frosty Dice", two: "2P · Two players on one device", question: "Switch game mode?", detail: "Your current game will stay saved on this device.", cancel: "Cancel", confirm: "Switch", failed: "The game mode could not be saved. Your current game was kept.", reset: "Start a new two-player game? Both boards and Undo will be cleared.", keep: "Keep current game", clear: "Clear both boards and start again", undo: "Undo last move", newGame: "Reset two-player game" },
  de: { mode: "Spielmodus", classic: "3P+ · Klassisches Frosty Dice", two: "2P · Zwei Spieler auf einem Gerät", question: "Spielmodus wechseln?", detail: "Deine aktuelle Partie bleibt auf diesem Gerät gespeichert.", cancel: "Abbrechen", confirm: "Wechseln", failed: "Der Spielmodus konnte nicht gespeichert werden. Deine aktuelle Partie bleibt erhalten.", reset: "Neues Zweispielerspiel starten? Beide Bretter und der Rückgängig-Stand werden gelöscht.", keep: "Aktuelle Partie behalten", clear: "Beide Bretter leeren und neu starten", undo: "Letzten Zug rückgängig machen", newGame: "Zweispielerspiel zurücksetzen" },
};

export function initializeGameModes(document, storage) {
  const byId = (id) => document.getElementById(id);
  const classic = initializeApp(document, storage);
  const twoPlayer = initializeTwoPlayer(document, storage);
  const controllers = { "3p-plus": classic, "2p": twoPlayer };
  const dialog = byId("mode-switch-dialog");
  const trigger = byId("game-mode-trigger");
  const options = byId("game-mode-options");
  const choices = [byId("mode-2p"), byId("mode-3p-plus")];
  let mode = readGameMode(storage);
  let pending = null;
  let failed = false;
  let language = byId("rules-language-de")?.getAttribute("aria-pressed") === "true" ? "de" : "en";
  const originalReset = ["reset-warning", "cancel-new-game", "confirm-new-game"].map((id) => byId(id).textContent);
  const originalSnowman = byId("new-game").getAttribute("aria-label");

  function renderText() {
    const t = copy[language];
    byId("game-mode-switch").setAttribute("aria-label", t.mode);
    trigger.setAttribute("aria-label", t.mode + ": " + (mode === "2p" ? "2P" : "3P+"));
    byId("game-mode-label").textContent = mode === "2p" ? "2P" : "3P+";
    options.setAttribute("aria-label", t.mode);
    byId("mode-2p").textContent = language === "de" ? "2 Spieler" : "2 Players";
    byId("mode-3p-plus").textContent = language === "de" ? "3+ Spieler" : "3+ Players";
    byId("mode-2p").setAttribute("aria-label", t.two);
    byId("mode-3p-plus").setAttribute("aria-label", t.classic);
    byId("mode-switch-heading").textContent = t.question;
    byId("mode-switch-detail").textContent = t.detail;
    byId("cancel-mode-switch").textContent = t.cancel;
    byId("confirm-mode-switch").textContent = t.confirm;
    dialog.lang = language;
    byId("mode-status").textContent = failed ? t.failed : mode === "2p" ? t.two : t.classic;
    byId("mode-status").className = failed ? "mode-feedback" : "visually-hidden";
    if (mode === "2p") {
      byId("reset-warning").textContent = t.reset;
      byId("cancel-new-game").textContent = t.keep;
      byId("confirm-new-game").textContent = t.clear;
      byId("new-game").setAttribute("aria-label", t.newGame);
      byId("undo-move").setAttribute("aria-label", t.undo);
      byId("undo-move").setAttribute("title", t.undo);
    } else {
      ["reset-warning", "cancel-new-game", "confirm-new-game"].forEach((id, i) => { byId(id).textContent = originalReset[i]; });
      byId("new-game").setAttribute("aria-label", originalSnowman);
      byId("undo-move").setAttribute("aria-label", "Undo last move");
      byId("undo-move").setAttribute("title", "Undo last move");
    }
  }
  function activate() {
    // Deactivate first, then let only the visible controller render shared controls.
    controllers[mode === "2p" ? "3p-plus" : "2p"].setActive(false);
    controllers[mode].setActive(true);
    byId("classic-game").hidden = mode !== "3p-plus";
    byId("two-player-game").hidden = mode !== "2p";
    byId("open-challenge").hidden = mode === "2p";
    byId("open-receipt").hidden = mode === "2p";
    byId("mode-2p").setAttribute("aria-checked", String(mode === "2p"));
    byId("mode-3p-plus").setAttribute("aria-checked", String(mode === "3p-plus"));
    byId("game-mode-switch").dataset.mode = mode;
    renderText();
  }
  function finishSwitch(next) {
    if (!writeGameMode(next, storage)) { failed = true; renderText(); return false; }
    mode = next; failed = false; activate();
    byId(mode === "2p" ? "two-player-board-2" : "game-board").focus({ preventScroll: true });
    return true;
  }
  function requestMode(next) {
    if (!["2p", "3p-plus"].includes(next) || next === mode || dialog.open || classic.isBusy()) return false;
    failed = false; renderText();
    if (!controllers[mode].hasProgress()) return finishSwitch(next);
    pending = next;
    dialog.showModal(); byId("cancel-mode-switch").focus({ preventScroll: true });
    return true;
  }
  function cancel() {
    pending = null; if (dialog.open) dialog.close();
    trigger.focus({ preventScroll: true });
  }
  function closeOptions(returnFocus = false) {
    options.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (returnFocus) trigger.focus({ preventScroll: true });
  }
  function openOptions(index = mode === "2p" ? 0 : 1) {
    if (dialog.open || classic.isBusy()) return;
    options.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    choices[index].focus({ preventScroll: true });
  }
  trigger.addEventListener("click", () => { if (options.hidden) openOptions(); else closeOptions(true); });
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); openOptions(event.key === "ArrowDown" ? 0 : 1);
    }
  });
  options.addEventListener("keydown", (event) => {
    const index = choices.indexOf(document.activeElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
      choices[next].focus({ preventScroll: true });
    }
  });
  for (const element of [trigger, options]) element.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !options.hidden) { event.preventDefault(); event.stopPropagation(); closeOptions(true); }
  });
  for (const [index, next] of ["2p", "3p-plus"].entries()) choices[index].addEventListener("click", () => {
    if (options.hidden) return;
    closeOptions(true); requestMode(next);
  });
  for (const type of ["pointerdown", "click", "focusin"]) document.addEventListener(type, (event) => {
    if (!byId("game-mode-switch").contains(event.target)) closeOptions();
  });
  byId("cancel-mode-switch").addEventListener("click", cancel);
  byId("confirm-mode-switch").addEventListener("click", () => {
    if (!dialog.open || pending === null) return;
    const next = pending; pending = null; dialog.close();
    if (!finishSwitch(next)) trigger.focus({ preventScroll: true });
  });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); cancel(); });
  dialog.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); } });
  dialog.addEventListener("close", () => { if (!dialog.open) pending = null; });
  document.addEventListener("ruleslanguagechange", (event) => { language = event.detail; renderText(); });
  closeOptions();
  activate();
  return { getMode: () => mode, requestMode, classic, twoPlayer };
}

if (typeof document !== "undefined") {
  const start = () => { if (document.getElementById("game-mode-switch")) initializeGameModes(document); };
  if (document.readyState === "complete") start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}
