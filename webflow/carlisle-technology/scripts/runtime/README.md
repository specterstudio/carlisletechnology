# Carlisle runtime

`carlisle-runtime.js` is the single execution owner for Carlisle Technology's custom runtime behavior.

It currently owns:

- one-flight Swiper, GSAP, ScrollTrigger, and Finsweet dependency loading;
- viewport-proximate Swiper loading, with no Swiper download for mobile industry stacks;
- generic, secondary, tertiary, and mobile-static industry sliders;
- the homepage hero animation;
- the homepage hero's pre-paint layout reservation and critical CSS contract;
- homepage latest-resource card selection without Finsweet;
- removal of the homepage's hidden resource-source DOM after card selection;
- responsive `sizes` correction for industry-card imagery;
- dynamic years and the global accessibility repair.

The production consumer must use an immutable Git commit and SHA-384 integrity value. Do not use `@main` in Webflow.

Inline `carlisle-hero-critical.css` and `carlisle-hero-prepaint.js` in the Webflow site head. The small synchronous pre-paint bootstrap reserves the hero's authored footprint before the deferred runtime initializes; this prevents the runtime spacer and overlapping navigation from shifting the page after first paint.

```html
<script
  src="https://cdn.jsdelivr.net/gh/specterstudio/carlisletechnology@COMMIT/webflow/carlisle-technology/scripts/runtime/carlisle-runtime.js"
  integrity="sha384-INTEGRITY"
  crossorigin="anonymous"
  defer
  data-carlisle-runtime="0.1.4"
></script>
```

Enable browser diagnostics with:

```js
localStorage.setItem("carlisle-runtime-debug", "true");
```
