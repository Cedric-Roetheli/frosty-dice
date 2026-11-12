import { initializeApp } from "./app.js?v=new-game-menu-1";
import { initializeTwoPlayer } from "./two-player-app.js?v=frontline-guides-2";
import { readGameMode, writeGameMode } from "./two-player-storage.js?v=frontline-1";

const copy = {
  en: {
    title: "New Game", classic: "3+ Players", classicDetail: "Classic Frosty Dice",
    two: "2 Players", twoDetail: "One device · Frosty Frontline",
    warning: "Start a new game? Progress in the selected mode will be cleared. Your other game stays saved.",
    cancel: "Cancel", confirm: "Start New Game", failed: "The new game could not be started. Your progress was kept.",
    undo: "Undo last move",
  },
  de: {
    title: "Neues Spiel", classic: "3+ Spieler", classicDetail: "Klassisches Frosty Dice",
    two: "2 Spieler", twoDetail: "Ein Gerät · Frosty Frontline",
    warning: "Neues Spiel starten? Der Fortschritt im gewählten Modus wird gelöscht. Das andere Spiel bleibt gespeichert.",
    cancel: "Abbrechen", confirm: "Neues Spiel starten", failed: "Das neue Spiel konnte nicht gestartet werden. Dein Spielfortschritt bleibt erhalten.",
    undo: "Letzten Zug rückgängig machen",
  },
};

export function initializeGameModes(document, storage) {
  const byId = (id) => document.getElementById(id);
  const classic = initializeApp(document, storage);
  const twoPlayer = initializeTwoPlayer(document, storage);
  const controllers = { "3p-plus": classic, "2p": twoPlayer };
  const dialog = byId("new-game-menu");
  const snowman = byId("new-game");
  const options = byId("new-game-options");
  const confirmation = byId("new-game-confirmation");
  const choices = { "3p-plus": byId("mode-3p-plus"), "2p": byId("mode-2p") };
  let mode = readGameMode(storage);
  let pending = null;
  let failed = false;
  let language = byId("rules-language-de")?.getAttribute("aria-pressed") === "true" ? "de" : "en";

  function renderText() {
    const t = copy[language];
    dialog.lang = language;
    snowman.setAttribute("aria-label", t.title);
    byId("new-game-menu-heading").textContent = t.title;
    byId("new-game-3p-label").textContent = t.classic;
    byId("new-game-3p-description").textContent = t.classicDetail;
    byId("new-game-2p-label").textContent = t.two;
    byId("new-game-2p-description").textContent = t.twoDetail;
    byId("new-game-warning").textContent = t.warning;
    byId("cancel-mode-switch").textContent = t.cancel;
    byId("confirm-mode-switch").textContent = t.confirm;
    byId("mode-status").textContent = failed ? t.failed : "";
    byId("mode-status").className = failed ? "mode-feedback" : "visually-hidden";
    choices["3p-plus"].dataset.current = String(mode === "3p-plus");
    choices["2p"].dataset.current = String(mode === "2p");
    byId("undo-move").setAttribute("aria-label", t.undo);
    byId("undo-move").setAttribute("title", t.undo);
  }

  function activate() {
    // Deactivate first, then let only the visible controller render shared controls.
    controllers[mode === "2p" ? "3p-plus" : "2p"].setActive(false);
    controllers[mode].setActive(true);
    byId("classic-game").hidden = mode !== "3p-plus";
    byId("two-player-game").hidden = mode !== "2p";
    byId("open-challenge").hidden = mode === "2p";
    byId("open-receipt").hidden = mode === "2p";
    renderText();
    document.dispatchEvent(new document.defaultView.CustomEvent("gamemodechange", { detail: mode }));
  }

  function closeMenu(returnFocus = true) {
    pending = null;
    options.hidden = false;
    confirmation.hidden = true;
    dialog.removeAttribute("aria-describedby");
    if (dialog.open) dialog.close();
    snowman.setAttribute("aria-expanded", "false");
    if (returnFocus) snowman.focus({ preventScroll: true });
  }

  function openMenu() {
    if (dialog.open || classic.isBusy()) return false;
    controllers[mode].dismissDraft();
    failed = false; renderText();
    options.hidden = false; confirmation.hidden = true;
    dialog.showModal();
    snowman.setAttribute("aria-expanded", "true");
    choices[mode].focus({ preventScroll: true });
    return true;
  }

  function showFailure() {
    failed = true; pending = null;
    if (!dialog.open) {
      dialog.showModal();
      snowman.setAttribute("aria-expanded", "true");
    }
    options.hidden = false; confirmation.hidden = true;
    dialog.removeAttribute("aria-describedby");
    renderText();
    choices[mode].focus({ preventScroll: true });
  }

  function startNewGame(next) {
    const previous = mode;
    if (next !== previous && !writeGameMode(next, storage)) { showFailure(); return false; }
    if (!controllers[next].resetGame()) {
      if (next !== previous) writeGameMode(previous, storage);
      showFailure(); return false;
    }
    mode = next; failed = false;
    closeMenu(false);
    activate();
    byId(mode === "2p" ? "two-player-board-2" : "game-board").focus({ preventScroll: true });
    return true;
  }

  function requestMode(next) {
    if (!["2p", "3p-plus"].includes(next) || pending !== null || classic.isBusy()) return false;
    failed = false; renderText();
    // A new game clears the selected save; also confirm before leaving a game
    // with progress even when that other save is retained.
    if (!controllers[mode].hasProgress() && !controllers[next].hasProgress()) return startNewGame(next);
    pending = next;
    options.hidden = true; confirmation.hidden = false;
    dialog.setAttribute("aria-describedby", "new-game-warning");
    if (!dialog.open) {
      dialog.showModal();
      snowman.setAttribute("aria-expanded", "true");
    }
    byId("cancel-mode-switch").focus({ preventScroll: true });
    return true;
  }

  snowman.addEventListener("click", openMenu);
  choices["3p-plus"].addEventListener("click", () => { if (dialog.open && !options.hidden) requestMode("3p-plus"); });
  choices["2p"].addEventListener("click", () => { if (dialog.open && !options.hidden) requestMode("2p"); });
  byId("cancel-mode-switch").addEventListener("click", () => closeMenu());
  byId("confirm-mode-switch").addEventListener("click", () => {
    if (!dialog.open || pending === null) return;
    const next = pending; pending = null;
    startNewGame(next);
  });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeMenu(); });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(); }
  });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) closeMenu(); });
  dialog.addEventListener("close", () => {
    if (!dialog.open) { pending = null; snowman.setAttribute("aria-expanded", "false"); }
  });
  document.addEventListener("ruleslanguagechange", (event) => { language = event.detail; renderText(); });
  activate();
  return { getMode: () => mode, requestMode, classic, twoPlayer };
}

if (typeof document !== "undefined") {
  const start = () => { if (document.getElementById("new-game-menu")) initializeGameModes(document); };
  if (document.readyState === "complete") start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}
