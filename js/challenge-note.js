// Temporary presentation only: never reads, saves, or changes canonical game state.
export function createChallengeNote(document) {
  const note = document.getElementById("challenge-banknote");
  const rotor = document.getElementById("challenge-note-rotor");
  const shake = document.getElementById("challenge-note-shake");
  const bidFace = document.getElementById("challenge-bid-face");
  const cover = document.getElementById("reveal-bid");
  const input = document.getElementById("challenge-bid");
  const feedback = document.getElementById("bid-feedback");
  const close = document.getElementById("close-challenge");
  const dialog = document.getElementById("challenge-dialog");
  const view = document.defaultView ?? globalThis;
  const motion = view.matchMedia?.("(prefers-reduced-motion: reduce)");
  const flipDuration = 500;
  const revealFlipDuration = 700;
  const shakeDuration = 400 + 800;
  let phase = "editing";
  let amount = "";
  let pending = null;
  let generation = 0;

  note.style.setProperty("--bid-flip-duration", flipDuration + "ms");
  note.style.setProperty("--bid-reveal-duration", revealFlipDuration + "ms");
  note.style.setProperty("--bid-shake-duration", shakeDuration + "ms");

  function setPhase(next) {
    view.clearTimeout?.(pending);
    pending = null;
    generation += 1;
    phase = next;
    note.dataset.phase = phase;
    const readable = phase === "editing" || phase === "revealed";
    bidFace.hidden = phase === "hidden" || phase === "shaking";
    bidFace.inert = !readable;
    bidFace.setAttribute("aria-hidden", String(!readable));
    input.disabled = !readable;
    input.tabIndex = readable ? 0 : -1;
    cover.hidden = readable;
    cover.disabled = phase !== "hidden";
    cover.setAttribute("aria-hidden", String(phase !== "hidden"));
    if (phase === "editing" || phase === "revealed") feedback.textContent = "";
    if (phase === "hidden") {
      feedback.textContent = cover.getAttribute("aria-label");
      if (dialog.open && document.activeElement === close) cover.focus({ preventScroll: true });
    }
    if (phase === "revealed") input.value = amount;

    if (phase === "shaking" || phase.startsWith("flipping-")) {
      const expected = phase;
      const token = generation;
      const duration = phase === "shaking" ? shakeDuration
        : phase === "flipping-to-revealed" ? revealFlipDuration : flipDuration;
      // Events normally advance the phase; this also handles missed CSS events.
      pending = view.setTimeout?.(() => {
        if (generation === token && phase === expected && dialog.open) finishMotion();
      }, duration + 100);
    }
  }

  function finishMotion() {
    if (!dialog.open) return;
    if (phase === "flipping-to-hidden") setPhase("hidden");
    else if (phase === "shaking") setPhase("flipping-to-revealed");
    else if (phase === "flipping-to-revealed") setPhase("revealed");
  }

  rotor.addEventListener("transitionend", (event) => {
    if (event.target === rotor && event.propertyName === "transform" && phase.startsWith("flipping-")) finishMotion();
  });
  shake.addEventListener("animationend", (event) => {
    if (event.target === shake && event.animationName === "frosty-dollar-shake" && phase === "shaking") finishMotion();
  });
  cover.addEventListener("click", () => {
    if (!dialog.open || phase !== "hidden") return;
    // Keep keyboard focus inside the dialog before disabling the reveal button.
    close.focus({ preventScroll: true });
    input.value = amount;
    setPhase(motion?.matches ? "revealed" : "shaking");
  });
  motion?.addEventListener?.("change", () => {
    if (!motion.matches) return;
    if (phase === "flipping-to-hidden") setPhase("hidden");
    else if (phase === "shaking" || phase === "flipping-to-revealed") setPhase("revealed");
  });

  function reset() {
    amount = "";
    input.value = "";
    input.readOnly = false;
    const german = document.getElementById("rules-image")?.lang === "de";
    cover.lang = german ? "de" : "en";
    cover.setAttribute("aria-label", german ? "Zum Aufdecken tippen" : "Tap to reveal");
    setPhase("editing");
  }

  reset();
  return {
    reset,
    conceal(value) {
      if (phase !== "editing") return;
      amount = String(value);
      input.value = amount;
      input.readOnly = true;
      setPhase(motion?.matches ? "hidden" : "flipping-to-hidden");
    },
  };
}
