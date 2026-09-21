import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const runtimePath = path.join(
  repositoryRoot,
  "webflow/carlisle-technology/scripts/runtime/carlisle-runtime.js"
);
const source = fs.readFileSync(runtimePath, "utf8");
const criticalCss = fs.readFileSync(
  path.join(
    repositoryRoot,
    "webflow/carlisle-technology/scripts/runtime/carlisle-hero-critical.css"
  ),
  "utf8"
);
const prepaintSource = fs.readFileSync(
  path.join(
    repositoryRoot,
    "webflow/carlisle-technology/scripts/runtime/carlisle-hero-prepaint.js"
  ),
  "utf8"
);

test("runtime parses and exposes a versioned API without booting twice", () => {
  let readyCallback;
  const document = {
    readyState: "loading",
    addEventListener(event, callback) {
      if (event === "DOMContentLoaded") readyCallback = callback;
    },
  };
  const window = {};

  vm.runInNewContext(source, {
    console,
    document,
    Map,
    Promise,
    window,
  });

  assert.equal(window.CarlisleRuntime.version, "0.1.6");
  assert.equal(window.CarlisleRuntime.state.booted, false);
  assert.equal(typeof window.CarlisleRuntime.boot, "function");
  assert.equal(typeof readyCallback, "function");

  const firstRuntime = window.CarlisleRuntime;
  vm.runInNewContext(source, {
    console,
    document,
    Map,
    Promise,
    window,
  });
  assert.equal(window.CarlisleRuntime, firstRuntime);
});

test("third-party dependencies have one canonical URL owner", () => {
  assert.equal(
    source.match(/swiper-bundle\.min\.css/g)?.length,
    1
  );
  assert.equal(
    source.match(/swiper-bundle\.min\.js/g)?.length,
    1
  );
  assert.equal(
    source.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/@finsweet\/attributes@2\/attributes\.js/g)
      ?.length,
    1
  );
});

for (const markers of [[], ["[hero-visual]"], ["[hero-content]"]]) {
  test(`pages with ${markers.join(" and ") || "no hero"} keep navigation ready without loading animation dependencies`, () => {
    const classes = new Set();
    const injectedDependencies = [];
    const document = {
      readyState: "complete",
      documentElement: { classList: { add: value => classes.add(value) }, dataset: {} },
      head: { appendChild: node => injectedDependencies.push(node) },
      querySelector: selector => markers.includes(selector) ? {} : null,
      querySelectorAll: () => [],
    };
    const window = {
      location: { pathname: "/product/icap" },
      requestIdleCallback() {},
      setTimeout() {},
    };
    vm.runInNewContext(source, { console, document, Map, Promise, window });
    assert.equal(classes.has("hero-anim-ready"), true);
    assert.equal(window.CarlisleRuntime.state.features.has("hero"), false);
    assert.equal(injectedDependencies.length, 0);
  });
}

test("Finsweet is explicitly excluded from the homepage", () => {
  assert.match(
    source,
    /if \(window\.location\.pathname === "\/"\) return false;/
  );
  assert.match(source, /whenIdle\(\(\) => \{/);
});

test("homepage resources are copied before their hidden source DOM is removed", () => {
  const copyIndex = source.indexOf("resources.forEach((entry, index) => copyCard");
  const removeIndex = source.indexOf("if (sourceRoot) sourceRoot.remove()");

  assert.ok(copyIndex > -1);
  assert.ok(removeIndex > copyIndex);
});

test("industry sliders remain static on mobile", () => {
  assert.match(source, /id === "industry"/);
  assert.match(source, /matchMedia\("\(max-width: 767px\)"\)/);
  assert.match(source, /industry-mobile-static/);
  assert.match(source, /classList\.remove\("swiper", "swiper-initialized", "swiper-horizontal"\)/);
  assert.match(source, /addEventListener\("change", updateIndustrySliders\)/);
});

test("Swiper is scheduled by viewport proximity instead of loaded during boot", () => {
  assert.match(source, /new window\.IntersectionObserver/);
  assert.match(source, /rootMargin: SLIDER_ROOT_MARGIN/);
  assert.match(source, /once\("slider-scheduler", scheduleSliders\)/);
  assert.doesNotMatch(source, /once\("sliders", \(\) => ensureSwiper\(\)\.then\(initSliders\)\)/);
});

test("boot observes an off-screen slider without injecting a Swiper dependency", async () => {
  let readyCallback;
  let observerOptions;
  const observed = [];
  const injectedDependencies = [];
  const component = {
    dataset: {},
    getAttribute(name) {
      return name === "data-slider-id" ? "tertiary" : null;
    },
  };
  const document = {
    readyState: "loading",
    documentElement: { classList: { add() {} }, dataset: {} },
    head: { appendChild(node) { injectedDependencies.push(node); } },
    addEventListener(event, callback) {
      if (event === "DOMContentLoaded") readyCallback = callback;
    },
    querySelector(selector) {
      return selector === "[data-slider='component']" ? component : null;
    },
    querySelectorAll(selector) {
      return selector.startsWith("[data-slider='component']:not") ? [component] : [];
    },
  };
  const window = {
    IntersectionObserver: class {
      constructor(_callback, options) {
        observerOptions = options;
      }
      observe(node) {
        observed.push(node);
      }
    },
    localStorage: { getItem() { return null; } },
    location: { pathname: "/" },
    matchMedia() {
      return { addEventListener() {}, matches: false };
    },
    requestIdleCallback() {},
    setTimeout() {},
  };

  vm.runInNewContext(source, { console, document, Map, Promise, window });
  readyCallback();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(observed, [component]);
  assert.equal(observerOptions.rootMargin, "320px 0px");
  assert.equal(injectedDependencies.length, 0);
});

test("mobile industry stacks do not require Swiper", () => {
  const mobileBranch = source.slice(
    source.indexOf("function initializeSliderComponent"),
    source.indexOf("function activateSliderComponent")
  );
  assert.match(mobileBranch, /if \(isMobileIndustry\) \{/);
  assert.ok(mobileBranch.indexOf("initIndustrySlider(component)") < mobileBranch.indexOf("ensureSwiper()"));
});

test("industry-card images receive a bounded responsive sizes rule", () => {
  assert.match(source, /document\.querySelectorAll\("\.card_industry_bg_img"\)/);
  assert.match(
    source,
    /\(max-width: 767px\) 100vw, \(max-width: 991px\) 50vw, 33vw/
  );
});

test("hero critical CSS keeps the overlapping navigation out of document flow", () => {
  assert.match(criticalCss, /\.nav_component\s*\{[^}]*position: fixed !important;/s);
  assert.match(criticalCss, /\[hero-visual\]\s*\{[^}]*position: fixed !important;/s);
});

test("hero pre-paint bootstrap parses and reserves the authored visual footprint", () => {
  assert.doesNotThrow(() => new vm.Script(prepaintSource));
  assert.match(prepaintSource, /data-hero-visual-spacer/);
  assert.match(prepaintSource, /insertBefore\(spacer, visual\)/);
  assert.match(prepaintSource, /window\[SNAPSHOT_NAME\] = \{/);
  assert.match(prepaintSource, /scrollY: window\.scrollY \|\| 0/);
  assert.match(prepaintSource, /navEnd: \{/);
});

test("runtime reuses the pre-paint layout snapshot without measuring again", () => {
  assert.match(source, /:scope > \[data-hero-visual-spacer\]/);
  assert.match(source, /prepaintSnapshot\?\.version === VERSION/);
  assert.match(source, /\? prepaintSnapshot\.layout\s+: measureNaturalVisualLayout\(\)/);
  assert.match(source, /\? prepaintSnapshot\.navEnd\s+: \{/);
  assert.match(source, /hasPrepaintSnapshot \? prepaintSnapshot\.scrollY \|\| 0 : window\.scrollY \|\| 0/);
});
