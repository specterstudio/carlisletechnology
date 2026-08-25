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

  assert.equal(window.CarlisleRuntime.version, "0.1.0");
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
});
