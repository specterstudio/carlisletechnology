# Carlisle runtime

`carlisle-runtime.js` is the single execution owner for Carlisle Technology's custom runtime behavior.

It currently owns:

- one-flight Swiper, GSAP, ScrollTrigger, and Finsweet dependency loading;
- viewport-proximate Swiper loading, with no Swiper download for mobile industry stacks;
- generic, secondary, tertiary, and mobile-static industry sliders;
- the homepage hero animation;
- homepage latest-resource card selection without Finsweet;
- removal of the homepage's hidden resource-source DOM after card selection;
- responsive `sizes` correction for industry-card imagery;
- dynamic years and the global accessibility repair.

The production consumer must use an immutable Git commit and SHA-384 integrity value. Do not use `@main` in Webflow.

```html
<script
  src="https://cdn.jsdelivr.net/gh/specterstudio/carlisletechnology@COMMIT/webflow/carlisle-technology/scripts/runtime/carlisle-runtime.js"
  integrity="sha384-INTEGRITY"
  crossorigin="anonymous"
  defer
  data-carlisle-runtime="0.1.3"
></script>
```

Enable browser diagnostics with:

```js
localStorage.setItem("carlisle-runtime-debug", "true");
```
