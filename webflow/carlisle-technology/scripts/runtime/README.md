# Carlisle runtime

`carlisle-runtime.js` is the single execution owner for Carlisle Technology's custom runtime behavior.

It currently owns:

- one-flight Swiper, GSAP, ScrollTrigger, and Finsweet dependency loading;
- viewport-proximate Swiper loading, with no Swiper download for mobile industry stacks;
- generic, secondary, tertiary, and mobile-static industry sliders;
- the homepage hero animation;
- a static authored hero when reduced motion is requested, including preference changes while the animation is running;
- the homepage hero's pre-paint layout reservation and critical CSS contract;
- homepage latest-resource card selection without Finsweet;
- removal of the homepage's hidden resource-source DOM after card selection;
- responsive `sizes` correction for industry-card imagery;
- dynamic years and the global accessibility repair.

The accessibility repair preserves native form labels and explicit roles. It also removes obsolete list-item roles only from Finsweet's standalone previous/next copies, including cards inserted after initial load; source collection list roles remain intact.

The site head is the canonical hero critical CSS owner. Keep the old Hero Section Codes CSS embed retired so it cannot override the reduced-motion styles.

The production consumer must use an immutable Git commit and SHA-384 integrity value. Do not use `@main` in Webflow.

Inline `carlisle-hero-critical.css` and `carlisle-hero-prepaint.js` in the Webflow site head. The small synchronous pre-paint bootstrap reserves the hero's authored footprint and captures the hero/navigation layout snapshot before the deferred runtime initializes. The runtime reuses that snapshot instead of forcing duplicate post-paint style reads, preserving zero CLS while reducing mobile blocking work.

```html
<script
  src="https://cdn.jsdelivr.net/gh/specterstudio/carlisletechnology@COMMIT/webflow/carlisle-technology/scripts/runtime/carlisle-runtime.js"
  integrity="sha384-INTEGRITY"
  crossorigin="anonymous"
  defer
  data-carlisle-runtime="0.1.8"
></script>
```

Enable browser diagnostics with:

```js
localStorage.setItem("carlisle-runtime-debug", "true");
```
