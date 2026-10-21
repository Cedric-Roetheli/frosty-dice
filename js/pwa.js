// Independent from game startup: unavailable/blocked service workers are harmless.
window.addEventListener("load", async () => {
  try {
    if (!("serviceWorker" in navigator)) return;
    await navigator.serviceWorker.register("/service-worker.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    // Keep the normal website usable without an installation or error prompt.
  }
}, { once: true });
