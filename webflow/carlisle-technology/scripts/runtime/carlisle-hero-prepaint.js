(function carlisleHeroPrepaint(window, document) {
  "use strict";

  const VERSION = "0.1.4";
  const root = document.documentElement;
  if (!root || root.classList.contains("wf-design-mode") || root.classList.contains("w-editor")) {
    return;
  }

  function installSpacer() {
    const visual = document.querySelector("[hero-visual]");
    const code = document.querySelector(".hero_code");
    if (!visual || !code || !visual.parentNode) return false;

    const existing = visual.parentNode.querySelector(
      ":scope > [data-hero-visual-spacer]"
    );
    if (existing) return true;

    const hadReadyClass = root.classList.contains("hero-anim-ready");
    root.classList.add("hero-anim-ready");

    const rect = visual.getBoundingClientRect();
    const styles = window.getComputedStyle(visual);
    const spacer = document.createElement("div");
    spacer.setAttribute("aria-hidden", "true");
    spacer.dataset.heroVisualSpacer = "";
    spacer.dataset.carlisleHeroPrepaint = VERSION;
    Object.assign(spacer.style, {
      display: styles.display === "inline" ? "block" : styles.display,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: styles.margin,
      flex: styles.flex,
      gridColumn: styles.gridColumn,
      gridRow: styles.gridRow,
      visibility: "hidden",
      pointerEvents: "none",
    });
    visual.parentNode.insertBefore(spacer, visual);

    if (!hadReadyClass) root.classList.remove("hero-anim-ready");
    root.dataset.carlisleHeroPrepaint = VERSION;
    return true;
  }

  if (installSpacer()) return;

  const observer = new MutationObserver(() => {
    if (!installSpacer()) return;
    observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      installSpacer();
      observer.disconnect();
    },
    { once: true }
  );
})(window, document);
