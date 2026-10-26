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
        "Points may be used to challenge another player. The challenge is a blind auction and works as follows: both players secretly bid points, bids are then confirmed and revealed. The higher bid wins.",
        "Both bids are spent and the points subtracted from the players.",
        "The winner may freeze a cell of the losers board or unfreeze their own cell.",
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
        "Punkte können verwendet werden, um einen anderen Spieler herauszufordern. Die Herausforderung erfolgt in Form einer verdeckten Auktion und funktioniert wie folgt:",
        "Beide Spieler bieten geheim eine bestimmte Anzahl Punkte. Sobald beide Gebote bestätigt wurden, werden sie aufgedeckt. Der Spieler mit dem höheren Gebot gewinnt.",
        "Beide Spieler verlieren die jeweils gebotenen Punkte, unabhängig davon, wer gewonnen hat.",
        "Der Gewinner darf entweder ein Feld auf dem Spielfeld des Verlierers einfrieren oder eines seiner eigenen eingefrorenen Felder auftauen.",
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

  function showLanguage(selectedLanguage) {
    language = selectedLanguage;
    const illustration = illustrations[language];
    // Reserve this image's own aspect ratio before changing its source.
    image.width = illustration.width;
    image.height = illustration.height;
    image.alt = illustration.alt;
    image.lang = language;
    image.src = illustration.src;
    trigger.style.left = illustration.box.x / illustration.width * 100 + "%";
    trigger.style.top = illustration.box.y / illustration.height * 100 + "%";
    trigger.style.width = illustration.box.width / illustration.width * 100 + "%";
    trigger.style.height = illustration.box.height / illustration.height * 100 + "%";
    trigger.setAttribute("aria-label", illustration.additional.open);
    trigger.hidden = false;
    for (const control of controls) {
      const active = control.language === language;
      control.button.setAttribute("aria-pressed", String(active));
      control.fill.hidden = !active;
    }
  }

  try {
    const saved = preferenceStorage(storage).getItem(RULES_LANGUAGE_KEY);
    if (saved === "de" || saved === "en") language = saved;
  } catch {
    // Blocked storage still permits language switching for this visit.
  }
  showLanguage(language);

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

  for (const control of controls) {
    // Native buttons handle touch, mouse, Enter, and Space without custom keys.
    control.button.addEventListener("click", () => {
      showLanguage(control.language);
      try {
        preferenceStorage(storage).setItem(RULES_LANGUAGE_KEY, control.language);
      } catch {
        // A failed preference write must not prevent viewing the chosen rules.
      }
    });
  }
}

if (typeof document !== "undefined" && document.getElementById("rules-image")) {
  initializeRules(document);
}
