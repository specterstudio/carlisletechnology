(function carlisleHeroPrepaint(window, document) {
  "use strict";

  const VERSION = "0.1.5";
  const SNAPSHOT_NAME = "__CarlisleHeroPrepaint";
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
    const nav = document.querySelector(".nav_component");
    const navText = document.querySelector(
      [
        ".nav_desktop_wrap .nav_links_link",
        ".nav_desktop_wrap .nav_links_link *",
        ".nav_desktop_logo",
        ".nav_desktop_logo *",
        ".nav_mobile_logo",
        ".nav_mobile_logo *",
      ].join(", ")
    );
    const navStyles = nav ? window.getComputedStyle(nav) : null;
    const navTextStyles = navText ? window.getComputedStyle(navText) : null;
    const layout = {
      rect: {
        width: rect.width,
        height: rect.height,
      },
      styles: {
        display: styles.display === "inline" ? "block" : styles.display,
        margin: styles.margin,
        flex: styles.flex,
        gridColumn: styles.gridColumn,
        gridRow: styles.gridRow,
      },
      borderRadius: styles.borderRadius || "0px",
    };
    const spacer = document.createElement("div");
    spacer.setAttribute("aria-hidden", "true");
    spacer.dataset.heroVisualSpacer = "";
    spacer.dataset.carlisleHeroPrepaint = VERSION;
    Object.assign(spacer.style, {
      display: layout.styles.display,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: layout.styles.margin,
      flex: layout.styles.flex,
      gridColumn: layout.styles.gridColumn,
      gridRow: layout.styles.gridRow,
      visibility: "hidden",
      pointerEvents: "none",
    });
    visual.parentNode.insertBefore(spacer, visual);

    if (!hadReadyClass) root.classList.remove("hero-anim-ready");
    window[SNAPSHOT_NAME] = {
      version: VERSION,
      layout,
      scrollY: window.scrollY || 0,
      navEnd: {
        background: navStyles?.backgroundColor || "transparent",
        color: navTextStyles?.color || "currentColor",
      },
    };
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
