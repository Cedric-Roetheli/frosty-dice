// A presentation preference, independent of the game save and its reset/Undo.
export const RULES_LANGUAGE_KEY = "frosty-dice.rules-language";

const illustrations = {
  en: {
    src: "./assets/Rules.png", width: 2480, height: 3508,
    alt: "Hand-drawn Frosty Dice game rules",
  },
  de: {
    src: "./assets/rules_german.png", width: 2480, height: 3508,
    alt: "Handgezeichnete Spielregeln für Frosty Dice",
  },
};

function preferenceStorage(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

export function initializeRules(document, storage) {
  const image = document.getElementById("rules-image");
  const controls = ["de", "en"].map((language) => ({
    language,
    button: document.getElementById("rules-language-" + language),
    fill: document.getElementById("rules-fill-" + language),
  }));

  function showLanguage(language) {
    const illustration = illustrations[language];
    // Reserve this image's own aspect ratio before changing its source.
    image.width = illustration.width;
    image.height = illustration.height;
    image.alt = illustration.alt;
    image.lang = language;
    image.src = illustration.src;
    for (const control of controls) {
      const active = control.language === language;
      control.button.setAttribute("aria-pressed", String(active));
      control.fill.hidden = !active;
    }
  }

  let language = "en";
  try {
    const saved = preferenceStorage(storage).getItem(RULES_LANGUAGE_KEY);
    if (saved === "de" || saved === "en") language = saved;
  } catch {
    // Blocked storage still permits language switching for this visit.
  }
  showLanguage(language);

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
