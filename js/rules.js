// A presentation preference, independent of the game save and its reset/Undo.
export const RULES_LANGUAGE_KEY = "frosty-dice.rules-language";

const illustrations = {
  en: {
    src: "./assets/Rules.png", width: 2480, height: 3508,
    alt: "Hand-drawn Frosty Dice game rules",
    box: { x: 73, y: 2754, width: 2312, height: 696 },
    additional: {
      heading: "Additional Rules", open: "Open Additional Rules", close: "Close Additional Rules",
      paragraphs: [
        "All numbers placed on the board turn into points.",
        "Placing two prime numbers next to eachother freezes the cell.",
        "Before a normal dice turn, a player may challenge another player. Both secretly bid Frosty Dollars, then confirm and reveal. The higher bid wins. Equal bids have no winner: bid again until the bids differ.",
        "Both players spend their confirmed bids regardless of who wins. After the Challenge, the player who initiated it may still take their normal dice turn.",
        "The winner chooses exactly one action: Freeze an eligible opponent cell OR remove Attack Ice from an eligible cell of their own. Both players have the same options. New Attack Ice is not allowed in the first row.",
      ],
    },
  },
  de: {
    src: "./assets/rules_german.png", width: 2480, height: 3508,
    alt: "Handgezeichnete Spielregeln für Frosty Dice",
    box: { x: 73, y: 2754, width: 2312, height: 696 },
    additional: {
      heading: "Zusätzliche Regeln", open: "Zusätzliche Regeln öffnen", close: "Zusätzliche Regeln schließen",
      paragraphs: [
        "Alle Zahlen, die auf dem Spielfeld platziert werden, zählen als Punkte.",
        "Werden zwei Primzahlen nebeneinander platziert, friert das entsprechende Feld ein.",
        "Vor dem normalen Würfelzug kann ein Spieler einen anderen herausfordern. Beide bieten verdeckt Frosty Dollars und bestätigen ihre Gebote.",
        "Die Gebote werden aufgedeckt; das höhere Gebot gewinnt. Gleiche Gebote haben keinen Gewinner: Beide bieten erneut, bis sich die Gebote unterscheiden.",
        "Beide Spieler bezahlen ihr bestätigtes Gebot, unabhängig vom Gewinner. Wer die Challenge begonnen hat, darf danach noch seinen normalen Würfelzug machen.",
        "Der Gewinner wählt genau eine Aktion: ein geeignetes gegnerisches Feld einfrieren ODER Attack Ice von einem geeigneten eigenen Feld entfernen. Beide Spieler haben dieselben Optionen. In der ersten Reihe darf kein neues Attack Ice platziert werden.",
      ],
    },
  },
};

function preferenceStorage(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

// Fixed-body locking also prevents background touch scrolling on iOS.
function lockRulesPage(document) {
  const view = document.defaultView;
  const body = document.body;
  const x = view.scrollX;
  const y = view.scrollY;
  const previous = {
    position: body.style.position, top: body.style.top, left: body.style.left,
    width: body.style.width, overflow: body.style.overflow,
  };
  Object.assign(body.style, {
    position: "fixed", top: -y + "px", left: -x + "px", width: "100%", overflow: "hidden",
  });
  return () => {
    Object.assign(body.style, previous);
    view.scrollTo({ left: x, top: y, behavior: "instant" });
  };
}

export function initializeRules(document, storage) {
  const image = document.getElementById("rules-image");
  const trigger = document.getElementById("open-additional-rules");
  const dialog = document.getElementById("additional-rules-dialog");
  const heading = document.getElementById("additional-rules-heading");
  const text = document.getElementById("additional-rules-text");
  const closeButton = document.getElementById("close-additional-rules");
  let language = "en";
  let unlockScroll = null;
  let backdropPointer = false;
  const controls = ["de", "en"].map((language) => ({
    language,
    button: document.getElementById("rules-language-" + language),
    fill: document.getElementById("rules-fill-" + language),
  }));
  if (controls.some(({ button, fill }) => !button || !fill)) return;

  function showLanguage(selectedLanguage) {
    language = selectedLanguage;
    const illustration = illustrations[language];
    const section = document.getElementById("rules");
    if (section) section.lang = language;
    const pageHeading = document.getElementById("rules-heading");
    if (pageHeading) pageHeading.textContent = image
      ? language === "de" ? "Alle Regeln" : "Full Rules"
      : language === "de" ? "Regeln" : "Rules";
    if (image) {
      // Reserve this image's own aspect ratio before changing its source.
      image.width = illustration.width;
      image.height = illustration.height;
      image.alt = illustration.alt;
      image.lang = language;
      image.src = illustration.src;
      document.documentElement.lang = language;
      document.title = (language === "de" ? "Alle Regeln" : "Full Rules") + " — Frosty Dice";
    }
    if (trigger) {
      trigger.style.left = illustration.box.x / illustration.width * 100 + "%";
      trigger.style.top = illustration.box.y / illustration.height * 100 + "%";
      trigger.style.width = illustration.box.width / illustration.width * 100 + "%";
      trigger.style.height = illustration.box.height / illustration.height * 100 + "%";
      trigger.setAttribute("aria-label", illustration.additional.open);
      trigger.hidden = false;
    }
    for (const [id, en, de] of [["full-rules-link", "FULL RULES", "ALLE REGELN"],
      ["back-to-game", "BACK TO GAME", "ZURÜCK ZUM SPIEL"]]) {
      const link = document.getElementById(id);
      if (link) { link.textContent = language === "de" ? de : en; link.lang = language; }
    }
    for (const control of controls) {
      const active = control.language === language;
      control.button.setAttribute("aria-pressed", String(active));
      control.fill.hidden = !active;
    }
    if (dialog?.open) renderAdditionalRules();
    document.dispatchEvent(new document.defaultView.CustomEvent("ruleslanguagechange", { detail: language }));
  }

  function readPreference() {
    try {
      const saved = preferenceStorage(storage).getItem(RULES_LANGUAGE_KEY);
      return saved === "de" || saved === "en" ? saved : "en";
    } catch {
      return language; // Blocked storage still permits switching for this visit.
    }
  }
  showLanguage(readPreference());

  for (const control of controls) {
    // Native buttons handle touch, mouse, Enter, and Space without custom keys.
    control.button.addEventListener("click", () => {
      showLanguage(control.language);
      try {
        preferenceStorage(storage).setItem(RULES_LANGUAGE_KEY, control.language);
      } catch {
        // A failed preference write must not prevent language switching.
      }
    });
  }
  function restoreLanguage() {
    const saved = readPreference();
    if (saved !== language) showLanguage(saved);
  }
  // A Back navigation may restore a frozen page without re-running its modules.
  document.defaultView.addEventListener?.("pageshow", restoreLanguage);
  document.defaultView.addEventListener?.("storage", (event) => {
    if (event.key === RULES_LANGUAGE_KEY || event.key === null) restoreLanguage();
  });

  // The main page only needs language controls; the illustrated dialog is here.
  if (!image || !trigger || !dialog || !heading || !text || !closeButton) return;

  function renderAdditionalRules() {
    const content = illustrations[language].additional;
    dialog.lang = language;
    heading.textContent = content.heading;
    closeButton.setAttribute("aria-label", content.close);
    text.replaceChildren(...content.paragraphs.map((paragraph) => {
      const element = document.createElement("p");
      element.textContent = paragraph;
      return element;
    }));
    text.scrollTop = 0;
  }

  function finishClose() {
    if (!unlockScroll) return;
    unlockScroll();
    unlockScroll = null;
    backdropPointer = false;
    trigger.focus({ preventScroll: true });
  }

  function closeRules() {
    if (dialog.open) dialog.close();
    finishClose();
  }

  trigger.addEventListener("click", () => {
    if (dialog.open) return;
    renderAdditionalRules();
    unlockScroll = lockRulesPage(document);
    try {
      dialog.showModal();
    } catch (error) {
      finishClose();
      throw error;
    }
    closeButton.focus({ preventScroll: true });
  });
  closeButton.addEventListener("click", closeRules);
  dialog.addEventListener("close", () => { if (!dialog.open) finishClose(); });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeRules();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeRules();
  });
  function isBackdrop(event) {
    if (event.target !== dialog) return false;
    const bounds = dialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }
  dialog.addEventListener("pointerdown", (event) => { backdropPointer = isBackdrop(event); });
  dialog.addEventListener("click", (event) => {
    if (backdropPointer && isBackdrop(event)) closeRules();
    backdropPointer = false;
  });

}

if (typeof document !== "undefined" && document.getElementById("rules-language-de")) {
  initializeRules(document);
}
