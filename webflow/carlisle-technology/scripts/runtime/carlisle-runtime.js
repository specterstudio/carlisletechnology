(function carlisleRuntimeBootstrap(window, document) {
  "use strict";

  const VERSION = "0.1.6";
  const RUNTIME_NAME = "CarlisleRuntime";
  const SWIPER_VERSION = "8";
  const SWIPER_CSS = `https://cdn.jsdelivr.net/npm/swiper@${SWIPER_VERSION}/swiper-bundle.min.css`;
  const SWIPER_JS = `https://cdn.jsdelivr.net/npm/swiper@${SWIPER_VERSION}/swiper-bundle.min.js`;
  const FINSWEET_LIST = "https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js";
  const GSAP_JS = "https://cdn.prod.website-files.com/gsap/3.15.0/gsap.min.js";
  const SCROLL_TRIGGER_JS = "https://cdn.prod.website-files.com/gsap/3.15.0/ScrollTrigger.min.js";
  const SLIDER_ROOT_MARGIN = "320px 0px";

  const existingRuntime = window[RUNTIME_NAME];
  if (existingRuntime && existingRuntime.version === VERSION) return;

  const state = {
    booted: false,
    dependencies: new Map(),
    features: new Map(),
  };
  let industryMediaBound = false;
  let sliderObserver;

  function debug(...args) {
    if (window.localStorage && window.localStorage.getItem("carlisle-runtime-debug") === "true") {
      console.info(`[Carlisle Runtime ${VERSION}]`, ...args);
    }
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }

  function whenIdle(callback, timeout = 1500) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(callback, { timeout });
      return;
    }

    window.setTimeout(callback, Math.min(timeout, 250));
  }

  function once(key, callback) {
    if (state.features.has(key)) return state.features.get(key);

    const result = Promise.resolve().then(callback);
    state.features.set(key, result);
    return result;
  }

  function loadStyle(key, href) {
    if (state.dependencies.has(key)) return state.dependencies.get(key);

    const dependency = new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[href="${href}"]`);
      if (existing) {
        if (existing.sheet) {
          resolve(existing);
          return;
        }

        existing.addEventListener("load", () => resolve(existing), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.carlisleDependency = key;
      link.addEventListener("load", () => resolve(link), { once: true });
      link.addEventListener("error", reject, { once: true });
      document.head.appendChild(link);
    });

    state.dependencies.set(key, dependency);
    return dependency;
  }

  function loadScript(key, src, options = {}) {
    if (state.dependencies.has(key)) return state.dependencies.get(key);

    const dependency = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (options.test && options.test()) {
          resolve(existing);
          return;
        }

        existing.addEventListener("load", () => resolve(existing), { once: true });
        existing.addEventListener("error", reject, { once: true });

        if (!options.test) resolve(existing);
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.carlisleDependency = key;

      if (options.module) script.type = "module";
      if (options.attributes) {
        Object.entries(options.attributes).forEach(([name, value]) => {
          script.setAttribute(name, value);
        });
      }

      script.addEventListener("load", () => resolve(script), { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.appendChild(script);
    });

    state.dependencies.set(key, dependency);
    return dependency;
  }

  function ensureSwiper() {
    if (window.Swiper) return Promise.resolve(window.Swiper);

    return Promise.all([
      loadStyle("swiper-css", SWIPER_CSS),
      loadScript("swiper-js", SWIPER_JS, { test: () => Boolean(window.Swiper) }),
    ]).then(() => window.Swiper);
  }

  function ensureGsap(needsScrollTrigger) {
    const gsapReady = window.gsap
      ? Promise.resolve(window.gsap)
      : loadScript("gsap", GSAP_JS, { test: () => Boolean(window.gsap) }).then(() => window.gsap);

    if (!needsScrollTrigger) return gsapReady;

    return gsapReady.then(() => {
      if (window.ScrollTrigger) return window.ScrollTrigger;

      return loadScript("scroll-trigger", SCROLL_TRIGGER_JS, {
        test: () => Boolean(window.ScrollTrigger),
      }).then(() => window.ScrollTrigger);
    });
  }

  function flattenDisplayContents(slot) {
    if (!slot) return;

    let changed = true;
    while (changed) {
      changed = false;
      [...slot.children].forEach((child) => {
        if (!child.classList.contains("u-display-contents")) return;

        while (child.firstChild) slot.insertBefore(child.firstChild, child);
        child.remove();
        changed = true;
      });
    }
  }

  function unwrapCmsList(slot) {
    const dynamicList = [...slot.children].find((child) => child.classList.contains("w-dyn-list"));
    if (!dynamicList) return;

    const items = dynamicList.querySelector(".w-dyn-items");
    if (!items) return;

    const originalChildren = [...slot.children];
    [...items.children].forEach((item) => {
      const visibleChild = [...item.children].find(
        (child) => !child.classList.contains("w-condition-invisible")
      );
      if (visibleChild) slot.appendChild(visibleChild);
    });
    originalChildren.forEach((child) => child.remove());
  }

  function prepareSlider(component) {
    const element = component.querySelector(".slider_element");
    const wrapper = component.querySelector(".slider_list");
    if (!element || !wrapper) return null;

    unwrapCmsList(wrapper);
    flattenDisplayContents(wrapper);

    element.classList.add("swiper");
    wrapper.classList.add("swiper-wrapper");
    wrapper.style.removeProperty("transform");

    [...wrapper.children].forEach((slide) => {
      slide.classList.add("swiper-slide");
    });

    return { element, wrapper };
  }

  function commonSliderOptions(component, element) {
    return {
      slidesPerView: "auto",
      followFinger: element.getAttribute("data-follow-finger") === "true",
      freeMode: element.getAttribute("data-free-mode") === "true",
      slideToClickedSlide: element.getAttribute("data-slide-to-clicked") === "true",
      centeredSlides: false,
      autoHeight: false,
      speed: Number(element.getAttribute("data-speed")) || 600,
      mousewheel: {
        enabled: element.getAttribute("data-mousewheel") === "true",
        forceToAxis: true,
      },
      keyboard: {
        enabled: true,
        onlyInViewport: true,
      },
      navigation: {
        nextEl: component.querySelector("[data-slider='next'] button"),
        prevEl: component.querySelector("[data-slider='previous'] button"),
      },
      slideActiveClass: "is-active",
      slideDuplicateActiveClass: "is-active",
    };
  }

  function initSecondarySlider(component) {
    if (component.dataset.carlisleSlider === "secondary") return;
    const prepared = prepareSlider(component);
    const pagination = component.querySelector(".slider_bullet_list_secondary");
    if (!prepared || !pagination) return;

    if (prepared.element.swiper && !prepared.element.swiper.destroyed) {
      prepared.element.swiper.destroy(true, true);
    }

    pagination.replaceChildren();
    component.sliderSecondarySwiper = new window.Swiper(prepared.element, {
      ...commonSliderOptions(component, prepared.element),
      loop: false,
      rewind: true,
      observer: true,
      observeParents: true,
      autoplay: {
        delay: Number(prepared.element.getAttribute("data-autoplay-delay")) || 4000,
        disableOnInteraction: false,
        pauseOnMouseEnter: false,
      },
      pagination: {
        el: pagination,
        bulletActiveClass: "is-active",
        bulletClass: "slider_bullet_item_secondary",
        bulletElement: "button",
        clickable: true,
      },
    });
    component.dataset.carlisleSlider = "secondary";
  }

  function initTertiarySlider(component) {
    if (component.dataset.carlisleSlider === "tertiary") return;
    const prepared = prepareSlider(component);
    if (!prepared) return;

    new window.Swiper(prepared.element, {
      ...commonSliderOptions(component, prepared.element),
      loopAdditionalSlides: 10,
      pagination: false,
    });
    component.dataset.carlisleSlider = "tertiary";
  }

  function initGenericSlider(component) {
    if (component.dataset.carlisleSlider) return;
    const prepared = prepareSlider(component);
    if (!prepared) return;

    const id = component.getAttribute("data-slider-id");
    new window.Swiper(prepared.element, {
      ...commonSliderOptions(component, prepared.element),
      loopAdditionalSlides: 10,
      pagination: {
        el: component.querySelector(".slider_bullet_list"),
        bulletActiveClass: "is-active",
        bulletClass: "slider_bullet_item",
        bulletElement: "button",
        clickable: true,
      },
    });
    component.dataset.carlisleSlider = id || "generic";
  }

  function initIndustrySlider(component) {
    const prepared = prepareSlider(component);
    if (!prepared) return;

    if (prepared.element.swiper && !prepared.element.swiper.destroyed) {
      prepared.element.swiper.destroy(true, true);
    }

    if (window.matchMedia("(max-width: 767px)").matches) {
      prepared.element.classList.remove("swiper", "swiper-initialized", "swiper-horizontal");
      prepared.wrapper.classList.remove("swiper-wrapper");
      prepared.wrapper.style.removeProperty("transform");
      prepared.wrapper.style.removeProperty("transition-duration");
      [...prepared.wrapper.children].forEach((slide) => {
        slide.classList.remove(
          "swiper-slide",
          "swiper-slide-active",
          "swiper-slide-next",
          "swiper-slide-prev",
          "swiper-slide-duplicate",
          "is-active"
        );
        slide.removeAttribute("role");
        slide.removeAttribute("aria-label");
        slide.style.removeProperty("width");
        slide.style.removeProperty("margin-right");
      });
      component.dataset.carlisleSlider = "industry-mobile-static";
      component.dataset.industrySliderMode = "stack";
      return;
    }

    new window.Swiper(prepared.element, {
      ...commonSliderOptions(component, prepared.element),
      loopAdditionalSlides: 10,
      observer: true,
      observeParents: true,
      pagination: false,
    });
    component.dataset.carlisleSlider = "industry";
    component.dataset.industrySliderMode = "slider";
  }

  function getSliderComponents() {
    return [
      ...document.querySelectorAll(
        "[data-slider='component']:not([data-slider='component'] [data-slider='component'])"
      ),
    ];
  }

  function initSliderComponent(component) {
    const id = component.getAttribute("data-slider-id");
    if (id === "secondary") initSecondarySlider(component);
    else if (id === "tertiary") initTertiarySlider(component);
    else if (id === "industry") initIndustrySlider(component);
    else initGenericSlider(component);
  }

  function initializeSliderComponent(component) {
    const isMobileIndustry =
      component.getAttribute("data-slider-id") === "industry" &&
      window.matchMedia("(max-width: 767px)").matches;

    if (isMobileIndustry) {
      initIndustrySlider(component);
      return Promise.resolve();
    }

    return ensureSwiper().then(() => initSliderComponent(component));
  }

  function activateSliderComponent(component) {
    if (component.dataset.carlisleSliderActivated === "true") return;
    component.dataset.carlisleSliderActivated = "true";
    if (sliderObserver) sliderObserver.unobserve(component);

    initializeSliderComponent(component).catch((error) => {
      delete component.dataset.carlisleSliderActivated;
      console.error("[Carlisle Runtime] Slider failed to initialize.", error);
    });
  }

  function observeSliderComponent(component) {
    if (component.dataset.carlisleSliderScheduled === "true") return;
    component.dataset.carlisleSliderScheduled = "true";
    sliderObserver.observe(component);
  }

  function bindIndustryMedia() {
    if (industryMediaBound || !document.querySelector("[data-slider-id='industry']")) return;
    industryMediaBound = true;
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const updateIndustrySliders = () => {
      document.querySelectorAll("[data-slider-id='industry']").forEach((component) => {
        delete component.dataset.carlisleSlider;

        if (mobileQuery.matches) {
          initIndustrySlider(component);
          return;
        }

        if (component.dataset.carlisleSliderActivated === "true") {
          initializeSliderComponent(component).catch((error) => {
            console.error("[Carlisle Runtime] Industry slider failed to initialize.", error);
          });
          return;
        }

        delete component.dataset.carlisleSliderScheduled;
        observeSliderComponent(component);
      });
    };

    if (mobileQuery.addEventListener) mobileQuery.addEventListener("change", updateIndustrySliders);
    else mobileQuery.addListener(updateIndustrySliders);
  }

  function scheduleSliders() {
    const components = getSliderComponents();
    if (!components.length) return;

    if (!("IntersectionObserver" in window)) {
      components.forEach((component) => {
        if (
          component.getAttribute("data-slider-id") === "industry" &&
          window.matchMedia("(max-width: 767px)").matches
        ) {
          initIndustrySlider(component);
        }
      });
      whenIdle(() => {
        ensureSwiper()
          .then(initSliders)
          .catch((error) => {
            console.error("[Carlisle Runtime] Swiper failed to initialize.", error);
          });
      }, 2500);
      bindIndustryMedia();
      return;
    }

    sliderObserver = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) activateSliderComponent(entry.target);
        });
      },
      { rootMargin: SLIDER_ROOT_MARGIN, threshold: 0.01 }
    );

    components.forEach((component) => {
      const isMobileIndustry =
        component.getAttribute("data-slider-id") === "industry" &&
        window.matchMedia("(max-width: 767px)").matches;
      if (isMobileIndustry) initIndustrySlider(component);
      else observeSliderComponent(component);
    });
    bindIndustryMedia();
  }

  function initSliders() {
    getSliderComponents().forEach(initSliderComponent);
    bindIndustryMedia();
  }

  function copyCard(sourceCard, slot) {
    const runtimeClasses = [...slot.classList].filter(
      (className) => className.startsWith("swiper") || className === "is-active"
    );
    slot.className = [...new Set([...sourceCard.classList, ...runtimeClasses])].join(" ");

    [...slot.attributes].forEach((attribute) => {
      if (attribute.name !== "class") slot.removeAttribute(attribute.name);
    });
    [...sourceCard.attributes].forEach((attribute) => {
      if (attribute.name !== "class") slot.setAttribute(attribute.name, attribute.value);
    });
    slot.replaceChildren(...[...sourceCard.childNodes].map((node) => node.cloneNode(true)));
  }

  function initHomeResources() {
    const component = document.querySelector(
      '[data-slider="component"][data-slider-id="tertiary"][data-slider-instance="resources"]'
    );
    if (!component || component.dataset.homeResourcesConnected === "true") return false;

    const section = component.closest("section") || document;
    const slots = [...component.querySelectorAll(".slider_list > .card_resource_wrap")];
    const sourceLists = [
      ...section.querySelectorAll('[fs-list-element="list"][fs-list-combine="resources"]'),
      ...section.querySelectorAll('[fs-list-element="list"][fs-list-instance="resources"]'),
    ];
    if (!slots.length || !sourceLists.length) return false;

    const resources = sourceLists
      .flatMap((list) => [...list.children])
      .map((item, index) => {
        const dateValue = item.querySelector('[fs-list-field="date"]')?.textContent?.trim() || "";
        const time = Date.parse(dateValue);
        return {
          card: item.querySelector(".card_resource_wrap"),
          index,
          time: Number.isFinite(time) ? time : 0,
        };
      })
      .filter((entry) => entry.card && entry.time)
      .sort((a, b) => b.time - a.time || a.index - b.index)
      .slice(0, slots.length);

    if (resources.length < slots.length) return false;
    resources.forEach((entry, index) => copyCard(entry.card, slots[index]));

    const sourceRoot = sourceLists[0].closest(".resource_all_comp");
    if (sourceRoot) sourceRoot.remove();
    else sourceLists.forEach((list) => list.closest(".w-dyn-list")?.remove());

    component.dataset.homeResourcesConnected = "true";
    return true;
  }

  function shouldLoadFinsweet() {
    if (window.location.pathname === "/") return false;
    return Boolean(document.querySelector("[fs-list-element], [fs-list-field], [fs-cmsfilter-element]"));
  }

  function initFinsweet() {
    if (!shouldLoadFinsweet()) return Promise.resolve(false);

    return loadScript("finsweet-list", FINSWEET_LIST, {
      module: true,
      attributes: { "fs-list": "" },
    }).then(() => true);
  }

  function initDynamicYears() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll("#copyright-year, [data-dynamic-year]").forEach((element) => {
      element.textContent = year;
    });
  }

  function initResponsiveImages() {
    document.querySelectorAll(".card_industry_bg_img").forEach((image) => {
      image.sizes = "(max-width: 767px) 100vw, (max-width: 991px) 50vw, 33vw";
      image.dataset.carlisleResponsiveSizes = "industry-card";
    });
  }

  function initAccessibilityPatch() {
    const socialLabels = [
      ["facebook", "Visit Carlisle Technology on Facebook"],
      ["instagram", "Visit Carlisle Technology on Instagram"],
      ["linkedin", "Visit Carlisle Technology on LinkedIn"],
      ["youtube", "Visit Carlisle Technology on YouTube"],
    ];

    const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
    const hasName = (element) =>
      clean(element.getAttribute("aria-label")) ||
      clean(element.getAttribute("aria-labelledby")) ||
      clean(element.textContent);

    function inferLabel(element) {
      const href = (element.getAttribute("href") || "").toLowerCase();
      const social = socialLabels.find(([network]) => href.includes(network));
      if (social) return social[1];

      const container = element.closest(
        '.nav_dropdown_link_wrap,.card_resource_wrap,.card_resource_category_wrap,.footer_link,.tab_button_item,[data-trigger="hover"],article,li'
      );
      const text = container?.querySelector(
        '.nav_dropdown_text,.card_resource_heading,.card_resource_category_heading,.footer_link_text,.tab_button_text,h1,h2,h3,h4,h5,h6,[class*="heading"],[class*="title"],[class*="text"]'
      );
      return clean(text?.textContent) || clean(element.getAttribute("title")) || "Open link";
    }

    function patch(root = document) {
      root.querySelectorAll('[role="list"]').forEach((list) => {
        const children = [...list.children].filter(
          (child) => !/^(script|style|template)$/i.test(child.tagName || "")
        );
        if (!children.length) list.removeAttribute("role");
        else if (!list.querySelector(':scope > [role="listitem"], :scope > li')) {
          children.forEach((child) => child.setAttribute("role", "listitem"));
        }
      });

      root.querySelectorAll('[role="tablist"] > .tab_button_item').forEach((tab) => {
        if (!tab.hasAttribute("role")) tab.setAttribute("role", "tab");
      });
      root.querySelectorAll("a,button").forEach((element) => {
        if (!hasName(element)) element.setAttribute("aria-label", inferLabel(element));
      });
    }

    patch();
    if (!window.MutationObserver) return;

    let scheduled = false;
    const observer = new MutationObserver((mutations) => {
      if (scheduled || !mutations.some((mutation) => mutation.addedNodes.length)) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        patch();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 5000);
  }

  function initHero() {
    const root = document.documentElement;
    if (root.classList.contains("wf-design-mode") || root.classList.contains("w-editor")) {
      root.classList.add("hero-anim-ready");
      return;
    }

    const visual = document.querySelector("[hero-visual]");
    const content = document.querySelector("[hero-content]");
    if (!visual || !content || !window.gsap) {
      root.classList.add("hero-anim-ready");
      return;
    }

    if (window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);

    const gsap = window.gsap;
    const items = ["#hero-heading", "[hero-btn-1]", "[hero-btn-2]"]
      .map((selector) => content.querySelector(selector))
      .filter(Boolean);
    const nav = document.querySelector(".nav_component");
    const navText = gsap.utils.toArray(
      [
        ".nav_desktop_wrap .nav_links_link",
        ".nav_desktop_wrap .nav_links_link *",
        ".nav_desktop_logo",
        ".nav_desktop_logo *",
        ".nav_mobile_logo",
        ".nav_mobile_logo *",
      ].join(", ")
    );
    const originalStyles = new Map(
      [visual, content, nav, ...items, ...navText]
        .filter(Boolean)
        .map((element) => [element, element.getAttribute("style")])
    );
    const prepaintSnapshot = window.__CarlisleHeroPrepaint;
    const hasPrepaintSnapshot =
      prepaintSnapshot?.version === VERSION &&
      prepaintSnapshot.layout?.rect &&
      prepaintSnapshot.layout?.styles &&
      prepaintSnapshot.navEnd;
    const navEnd = hasPrepaintSnapshot
      ? prepaintSnapshot.navEnd
      : {
          background: nav ? getComputedStyle(nav).backgroundColor : "transparent",
          color: navText[0] ? getComputedStyle(navText[0]).color : "currentColor",
        };

    let spacer = visual.parentNode?.querySelector(
      ":scope > [data-hero-visual-spacer]"
    ) || null;
    let naturalLayout = null;
    let stateName = "expanded";
    let tween = null;
    let lastTouchY = 0;
    let lastScrollY = hasPrepaintSnapshot ? prepaintSnapshot.scrollY || 0 : window.scrollY || 0;
    let finalRadius = "0px";

    const viewportHeight = () =>
      window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const restore = (element) => {
      if (!element) return;
      const style = originalStyles.get(element);
      if (style === null) element.removeAttribute("style");
      else element.setAttribute("style", style);
    };

    function measureNaturalVisualLayout() {
      const currentStyle = visual.getAttribute("style");
      const hadReadyClass = root.classList.contains("hero-anim-ready");
      const spacerDisplay = spacer?.style.display;

      if (spacer) spacer.style.display = "none";
      root.classList.add("hero-anim-ready");
      restore(visual);

      const rect = visual.getBoundingClientRect();
      const styles = getComputedStyle(visual);
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

      if (currentStyle === null) visual.removeAttribute("style");
      else visual.setAttribute("style", currentStyle);
      if (!hadReadyClass) root.classList.remove("hero-anim-ready");
      if (spacer) spacer.style.display = spacerDisplay || layout.styles.display;

      finalRadius = layout.borderRadius;
      return layout;
    }

    function ensureSpacer(layout) {
      if (!spacer) {
        spacer = document.createElement("div");
        spacer.setAttribute("aria-hidden", "true");
        spacer.dataset.heroVisualSpacer = "";
        visual.parentNode.insertBefore(spacer, visual);
      }

      const rect = layout.rect;
      const styles = layout.styles;
      Object.assign(spacer.style, {
        display: styles.display,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: styles.margin,
        flex: styles.flex,
        gridColumn: styles.gridColumn,
        gridRow: styles.gridRow,
        visibility: "hidden",
        pointerEvents: "none",
      });
      return spacer;
    }

    function setNavStart() {
      if (nav) gsap.set(nav, { zIndex: 100, backgroundColor: "transparent" });
      gsap.set(navText, { color: "#fff" });
    }

    function setFullscreen(layout) {
      ensureSpacer(layout);
      setNavStart();
      gsap.set(visual, {
        autoAlpha: 1,
        position: "fixed",
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: viewportHeight(),
        margin: 0,
        zIndex: 10,
        overflow: "hidden",
        borderRadius: 0,
      });
      gsap.set(content, {
        autoAlpha: 1,
        visibility: "visible",
        position: "relative",
        zIndex: 11,
      });
      gsap.set(items, { y: 0, autoAlpha: 1, visibility: "visible" });
    }

    function removeSpacer() {
      if (spacer) spacer.remove();
      spacer = null;
    }

    function collapseHero() {
      if (stateName === "collapsed" || stateName === "collapsing") return;
      stateName = "collapsing";
      if (tween) tween.kill();
      const targetRect = (
        spacer || ensureSpacer(measureNaturalVisualLayout())
      ).getBoundingClientRect();

      tween = gsap.timeline({
        defaults: { ease: "power3.inOut", overwrite: "auto" },
        onComplete() {
          stateName = "collapsed";
          tween = null;
          removeSpacer();
          restore(visual);
          [nav, ...navText].filter(Boolean).forEach(restore);
          gsap.set(content, { autoAlpha: 0, visibility: "hidden" });
          lastScrollY = window.scrollY || 0;
          if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        },
      });

      tween
        .to(items, { y: -28, autoAlpha: 0, duration: 0.4, stagger: 0.06, ease: "power2.in" }, 0)
        .to(content, { y: -18, autoAlpha: 0, duration: 0.4, ease: "power2.in" }, 0)
        .to(nav, { backgroundColor: navEnd.background, duration: 0.45 }, 0)
        .to(navText, { color: navEnd.color, duration: 0.45 }, 0)
        .to(
          visual,
          {
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: finalRadius,
            duration: 0.95,
          },
          0
        );
    }

    function expandHero() {
      if (stateName === "expanded" || stateName === "expanding") return;
      stateName = "expanding";
      if (tween) tween.kill();
      const rect = visual.getBoundingClientRect();
      naturalLayout = {
        ...naturalLayout,
        rect: {
          width: rect.width,
          height: rect.height,
        },
      };
      ensureSpacer(naturalLayout);

      gsap.set(visual, {
        position: "fixed",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        margin: 0,
        zIndex: 10,
        overflow: "hidden",
        borderRadius: finalRadius,
      });
      gsap.set(content, { y: 24, autoAlpha: 0, visibility: "visible" });
      gsap.set(items, { y: 28, autoAlpha: 0, visibility: "visible" });

      tween = gsap.timeline({
        defaults: { ease: "power3.inOut", overwrite: "auto" },
        onComplete() {
          stateName = "expanded";
          tween = null;
          setNavStart();
          gsap.set(content, { y: 0, autoAlpha: 1, visibility: "visible" });
          lastScrollY = window.scrollY || 0;
          if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        },
      });

      tween
        .to(nav, { backgroundColor: "transparent", duration: 0.45 }, 0)
        .to(navText, { color: "#fff", duration: 0.45 }, 0)
        .to(
          visual,
          {
            top: 0,
            left: 0,
            width: window.innerWidth,
            height: viewportHeight(),
            borderRadius: 0,
            duration: 0.95,
          },
          0
        )
        .to(content, { y: 0, autoAlpha: 1, duration: 0.65, ease: "power3.out" }, 0.25)
        .to(items, { y: 0, autoAlpha: 1, duration: 0.65, stagger: 0.1, ease: "power3.out" }, 0.3);
    }

    function syncToScroll() {
      if (stateName === "collapsing" || stateName === "expanding") return;
      const y = window.scrollY || 0;
      const scrollingUp = y < lastScrollY;
      if (stateName === "expanded" && y > 8) collapseHero();
      else if (stateName === "collapsed" && scrollingUp && y <= 8) expandHero();
      lastScrollY = y;
    }

    function prevent(event) {
      if (event.cancelable) event.preventDefault();
    }

    function handleWheel(event) {
      const nearTop = window.scrollY <= 9;
      if (stateName === "collapsing" || stateName === "expanding") prevent(event);
      else if (event.deltaY > 0 && stateName === "expanded" && nearTop) {
        prevent(event);
        collapseHero();
      } else if (event.deltaY < 0 && stateName === "collapsed" && nearTop) {
        prevent(event);
        expandHero();
      }
    }

    function handleTouchMove(event) {
      if (!event.touches?.length) return;
      const currentY = event.touches[0].clientY;
      const deltaY = lastTouchY - currentY;
      const nearTop = window.scrollY <= 9;
      if (Math.abs(deltaY) >= 8) {
        if (stateName === "collapsing" || stateName === "expanding") prevent(event);
        else if (deltaY > 0 && stateName === "expanded" && nearTop) {
          prevent(event);
          collapseHero();
        } else if (deltaY < 0 && stateName === "collapsed" && nearTop) {
          prevent(event);
          expandHero();
        }
      }
      lastTouchY = currentY;
    }

    naturalLayout = hasPrepaintSnapshot
      ? prepaintSnapshot.layout
      : measureNaturalVisualLayout();
    finalRadius = naturalLayout.borderRadius || "0px";
    setFullscreen(naturalLayout);
    root.classList.add("hero-anim-ready");
    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    window.addEventListener(
      "touchstart",
      (event) => {
        lastTouchY = event.touches?.[0]?.clientY || 0;
      },
      { passive: true }
    );
    window.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });
    window.addEventListener(
      "scroll",
      () => window.requestAnimationFrame(syncToScroll),
      { passive: true }
    );
    window.addEventListener("resize", () => {
      if (stateName === "expanded") {
        gsap.set(visual, { width: window.innerWidth, height: viewportHeight() });
      }
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  function boot() {
    if (state.booted) return;
    state.booted = true;
    document.documentElement.dataset.carlisleRuntime = VERSION;

    initDynamicYears();
    initResponsiveImages();
    initAccessibilityPatch();
    initHomeResources();

    const hasSliders = Boolean(document.querySelector("[data-slider='component']"));
    if (hasSliders) {
      once("slider-scheduler", scheduleSliders);
    }

    const hasHero = Boolean(
      document.querySelector("[hero-visual]") && document.querySelector("[hero-content]")
    );
    if (hasHero) {
      once("hero", () => ensureGsap(true).then(initHero)).catch((error) => {
        document.documentElement.classList.add("hero-anim-ready");
        console.error("[Carlisle Runtime] Hero failed to initialize.", error);
      });
    } else {
      // Pages without a complete animated hero must keep their authored navigation.
      document.documentElement.classList.add("hero-anim-ready");
    }

    whenIdle(() => {
      once("finsweet", initFinsweet).catch((error) => {
        console.error("[Carlisle Runtime] Finsweet failed to initialize.", error);
      });
    });

    debug("booted", {
      sliders: hasSliders,
      hero: hasHero,
      finsweet: shouldLoadFinsweet(),
    });
  }

  window[RUNTIME_NAME] = {
    version: VERSION,
    state,
    boot,
    ensureGsap,
    ensureSwiper,
    initHomeResources,
    initSliders,
    scheduleSliders,
  };

  onReady(boot);
})(window, document);
