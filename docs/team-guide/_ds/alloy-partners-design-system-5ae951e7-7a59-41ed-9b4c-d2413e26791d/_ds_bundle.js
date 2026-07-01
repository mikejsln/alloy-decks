/* @ds-bundle: {"format":3,"namespace":"AlloyPartnersDesignSystem_5ae951","components":[],"sourceHashes":{"ui_kits/deck/deck-stage.js":"522102a1c71e","ui_kits/deck/image-slot.js":"9309434cb09c","ui_kits/deck/slides.jsx":"2a425ba7c048","ui_kits/website/components.jsx":"d76d9727d390","ui_kits/website/pages.jsx":"ce5f05db03cf"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.AlloyPartnersDesignSystem_5ae951 = window.AlloyPartnersDesignSystem_5ae951 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/deck/deck-stage.js
try { (() => {
/**
 * <deck-stage> — reusable web component for HTML decks.
 *
 * Handles:
 *  (a) speaker notes — reads <script type="application/json" id="speaker-notes">
 *      and posts {slideIndexChanged: N} to the parent window on nav.
 *  (b) keyboard navigation — ←/→, PgUp/PgDn, Space, Home/End, number keys.
 *  (c) press R to reset to slide 0 (with a tasteful keyboard hint).
 *  (d) bottom-center overlay showing slide count + hints, fades out on idle.
 *  (e) auto-scaling — inner canvas is a fixed design size (default 1920×1080)
 *      scaled with `transform: scale()` to fit the viewport, letterboxed.
 *      Set the `noscale` attribute to render at authored size (1:1) — the
 *      PPTX exporter sets this so its DOM capture sees unscaled geometry.
 *  (f) print — `@media print` lays every slide out as its own page at the
 *      design size, so the browser's Print → Save as PDF produces a clean
 *      one-page-per-slide PDF with no extra setup.
 *
 * Slides are HIDDEN, not unmounted. Non-active slides stay in the DOM with
 * `visibility: hidden` + `opacity: 0`, so their state (videos, iframes,
 * form inputs, React trees) is preserved across navigation.
 *
 * Lifecycle event — the component dispatches a `slidechange` CustomEvent on
 * itself whenever the active slide changes (including the initial mount).
 * The event bubbles and composes out of shadow DOM, so you can listen on
 * the <deck-stage> element or on document:
 *
 *   document.querySelector('deck-stage').addEventListener('slidechange', (e) => {
 *     e.detail.index         // new 0-based index
 *     e.detail.previousIndex // previous index, or -1 on init
 *     e.detail.total         // total slide count
 *     e.detail.slide         // the new active slide element
 *     e.detail.previousSlide // the prior slide element, or null on init
 *     e.detail.reason        // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
 *   });
 *
 * Persistence: current slide index is saved to localStorage keyed by the
 * document path, so refresh returns you to the same place.
 *
 * Usage:
 *   <deck-stage width="1920" height="1080">
 *     <section data-label="Title">...</section>
 *     <section data-label="Agenda">...</section>
 *   </deck-stage>
 *
 * Slides are the direct element children of <deck-stage>. Each slide is
 * automatically tagged with:
 *   - data-screen-label="NN Label"   (1-indexed, for comment flow)
 *   - data-om-validate="no_overflowing_text,no_overlapping_text,slide_sized_text"
 */

(() => {
  const DESIGN_W_DEFAULT = 1920;
  const DESIGN_H_DEFAULT = 1080;
  const STORAGE_PREFIX = 'deck-stage:slide:';
  const OVERLAY_HIDE_MS = 1800;
  const VALIDATE_ATTR = 'no_overflowing_text,no_overlapping_text,slide_sized_text';
  const pad2 = n => String(n).padStart(2, '0');
  const stylesheet = `
    :host {
      position: fixed;
      inset: 0;
      display: block;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      overflow: hidden;
    }

    .stage {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .canvas {
      position: relative;
      transform-origin: center center;
      flex-shrink: 0;
      background: #fff;
      will-change: transform;
    }

    /* Slides live in light DOM (via <slot>) so authored CSS still applies.
       We absolutely position each slotted child to stack them. */
    ::slotted(*) {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }
    ::slotted([data-deck-active]) {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
    }

    /* Tap zones for mobile — back/forward thirds like Stories.
       Transparent, no visible UI, don't block the overlay. */
    .tapzones {
      position: fixed;
      inset: 0;
      display: flex;
      z-index: 2147482000;
      pointer-events: none;
    }
    .tapzone {
      flex: 1;
      pointer-events: auto;
      -webkit-tap-highlight-color: transparent;
    }
    /* Only activate tap zones on coarse pointers (touch devices). */
    @media (hover: hover) and (pointer: fine) {
      .tapzones { display: none; }
    }

    .overlay {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translate(-50%, 6px) scale(0.92);
      filter: blur(6px);
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      background: #000;
      color: #fff;
      border-radius: 999px;
      font-size: 12px;
      font-feature-settings: "tnum" 1;
      letter-spacing: 0.01em;
      opacity: 0;
      pointer-events: none;
      transition: opacity 260ms ease, transform 260ms cubic-bezier(.2,.8,.2,1), filter 260ms ease;
      transform-origin: center bottom;
      z-index: 2147483000;
      user-select: none;
    }
    .overlay[data-visible] {
      opacity: 1;
      pointer-events: auto;
      transform: translate(-50%, 0) scale(1);
      filter: blur(0);
    }

    .btn {
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: 0;
      margin: 0;
      padding: 0;
      color: inherit;
      font: inherit;
      cursor: default;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      min-width: 28px;
      border-radius: 999px;
      color: rgba(255,255,255,0.72);
      transition: background 140ms ease, color 140ms ease;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .btn:active { background: rgba(255,255,255,0.18); }
    .btn:focus { outline: none; }
    .btn:focus-visible { outline: none; }
    .btn::-moz-focus-inner { border: 0; }
    .btn svg { width: 14px; height: 14px; display: block; }
    .btn.reset {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
      padding: 0 10px 0 12px;
      gap: 6px;
      color: rgba(255,255,255,0.72);
    }
    .btn.reset .kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: 10px;
      line-height: 1;
      color: rgba(255,255,255,0.88);
      background: rgba(255,255,255,0.12);
      border-radius: 4px;
    }

    .count {
      font-variant-numeric: tabular-nums;
      color: #fff;
      font-weight: 500;
      padding: 0 8px;
      min-width: 42px;
      text-align: center;
      font-size: 12px;
    }
    .count .sep { color: rgba(255,255,255,0.45); margin: 0 3px; font-weight: 400; }
    .count .total { color: rgba(255,255,255,0.55); }

    .divider {
      width: 1px;
      height: 14px;
      background: rgba(255,255,255,0.18);
      margin: 0 2px;
    }

    /* ── Print: one page per slide, no chrome ────────────────────────────
       The screen layout stacks every slide at inset:0 inside a scaled
       canvas; for print we want them in document flow at the authored
       design size so the browser paginates one slide per sheet. The
       @page size is set from the width/height attributes via the inline
       <style id="deck-stage-print-page"> that connectedCallback injects
       into <head> (the @page at-rule has no effect inside shadow DOM). */
    @media print {
      :host {
        position: static;
        inset: auto;
        background: none;
        overflow: visible;
        color: inherit;
      }
      .stage { position: static; display: block; }
      .canvas {
        transform: none !important;
        width: auto !important;
        height: auto !important;
        background: none;
        will-change: auto;
      }
      ::slotted(*) {
        position: relative !important;
        inset: auto !important;
        width: var(--deck-design-w) !important;
        height: var(--deck-design-h) !important;
        box-sizing: border-box !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto;
        break-after: page;
        page-break-after: always;
        break-inside: avoid;
        overflow: hidden;
      }
      ::slotted(*:last-child) {
        break-after: auto;
        page-break-after: auto;
      }
      .overlay, .tapzones { display: none !important; }
    }
  `;
  class DeckStage extends HTMLElement {
    static get observedAttributes() {
      return ['width', 'height', 'noscale'];
    }
    constructor() {
      super();
      this._root = this.attachShadow({
        mode: 'open'
      });
      this._index = 0;
      this._slides = [];
      this._notes = [];
      this._hideTimer = null;
      this._mouseIdleTimer = null;
      this._storageKey = STORAGE_PREFIX + (location.pathname || '/');
      this._onKey = this._onKey.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onSlotChange = this._onSlotChange.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onTapBack = this._onTapBack.bind(this);
      this._onTapForward = this._onTapForward.bind(this);
    }
    get designWidth() {
      return parseInt(this.getAttribute('width'), 10) || DESIGN_W_DEFAULT;
    }
    get designHeight() {
      return parseInt(this.getAttribute('height'), 10) || DESIGN_H_DEFAULT;
    }
    connectedCallback() {
      this._render();
      this._loadNotes();
      this._syncPrintPageRule();
      window.addEventListener('keydown', this._onKey);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('mousemove', this._onMouseMove, {
        passive: true
      });
      // Initial collection + layout happens via slotchange, which fires on mount.
    }
    disconnectedCallback() {
      window.removeEventListener('keydown', this._onKey);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('mousemove', this._onMouseMove);
      if (this._hideTimer) clearTimeout(this._hideTimer);
      if (this._mouseIdleTimer) clearTimeout(this._mouseIdleTimer);
    }
    attributeChangedCallback() {
      if (this._canvas) {
        this._canvas.style.width = this.designWidth + 'px';
        this._canvas.style.height = this.designHeight + 'px';
        this._canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
        this._canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');
        this._fit();
        this._syncPrintPageRule();
      }
    }
    _render() {
      const style = document.createElement('style');
      style.textContent = stylesheet;
      const stage = document.createElement('div');
      stage.className = 'stage';
      const canvas = document.createElement('div');
      canvas.className = 'canvas';
      canvas.style.width = this.designWidth + 'px';
      canvas.style.height = this.designHeight + 'px';
      canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
      canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');
      const slot = document.createElement('slot');
      slot.addEventListener('slotchange', this._onSlotChange);
      canvas.appendChild(slot);
      stage.appendChild(canvas);

      // Tap zones (mobile): left third = back, right third = forward.
      const tapzones = document.createElement('div');
      tapzones.className = 'tapzones export-hidden';
      tapzones.setAttribute('aria-hidden', 'true');
      const tzBack = document.createElement('div');
      tzBack.className = 'tapzone tapzone--back';
      const tzMid = document.createElement('div');
      tzMid.className = 'tapzone tapzone--mid';
      tzMid.style.pointerEvents = 'none';
      const tzFwd = document.createElement('div');
      tzFwd.className = 'tapzone tapzone--fwd';
      tzBack.addEventListener('click', this._onTapBack);
      tzFwd.addEventListener('click', this._onTapForward);
      tapzones.append(tzBack, tzMid, tzFwd);

      // Overlay: compact, solid black, with clickable controls.
      const overlay = document.createElement('div');
      overlay.className = 'overlay export-hidden';
      overlay.setAttribute('role', 'toolbar');
      overlay.setAttribute('aria-label', 'Deck controls');
      overlay.innerHTML = `
        <button class="btn prev" type="button" aria-label="Previous slide" title="Previous (←)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>
        </button>
        <span class="count" aria-live="polite"><span class="current">1</span><span class="sep">/</span><span class="total">1</span></span>
        <button class="btn next" type="button" aria-label="Next slide" title="Next (→)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>
        </button>
        <span class="divider"></span>
        <button class="btn reset" type="button" aria-label="Reset to first slide" title="Reset (R)">Reset<span class="kbd">R</span></button>
      `;
      overlay.querySelector('.prev').addEventListener('click', () => this._go(this._index - 1, 'click'));
      overlay.querySelector('.next').addEventListener('click', () => this._go(this._index + 1, 'click'));
      overlay.querySelector('.reset').addEventListener('click', () => this._go(0, 'click'));
      this._root.append(style, stage, tapzones, overlay);
      this._canvas = canvas;
      this._slot = slot;
      this._overlay = overlay;
      this._countEl = overlay.querySelector('.current');
      this._totalEl = overlay.querySelector('.total');
    }

    /** @page must live in the document stylesheet — it's a no-op inside
     *  shadow DOM. Inject/update a single <head> style tag so the print
     *  sheet matches the design size and Save-as-PDF yields one slide per
     *  page with no margins. */
    _syncPrintPageRule() {
      const id = 'deck-stage-print-page';
      let tag = document.getElementById(id);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
        document.head.appendChild(tag);
      }
      tag.textContent = '@page { size: ' + this.designWidth + 'px ' + this.designHeight + 'px; margin: 0; } ' + '@media print { html, body { margin: 0 !important; padding: 0 !important; background: none !important; overflow: visible !important; height: auto !important; } ' + '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }';
    }
    _onSlotChange() {
      this._collectSlides();
      this._restoreIndex();
      this._applyIndex({
        showOverlay: false,
        broadcast: true,
        reason: 'init'
      });
      this._fit();
    }
    _collectSlides() {
      const assigned = this._slot.assignedElements({
        flatten: true
      });
      this._slides = assigned.filter(el => {
        // Skip template/style/script nodes even if someone slots them.
        const tag = el.tagName;
        return tag !== 'TEMPLATE' && tag !== 'SCRIPT' && tag !== 'STYLE';
      });
      this._slides.forEach((slide, i) => {
        const n = i + 1;
        // Determine a label for comment flow: prefer explicit data-label,
        // then an existing data-screen-label, then first heading, else "Slide".
        let label = slide.getAttribute('data-label');
        if (!label) {
          const existing = slide.getAttribute('data-screen-label');
          if (existing) {
            // Strip any leading number the author may have included.
            label = existing.replace(/^\s*\d+\s*/, '').trim() || existing;
          }
        }
        if (!label) {
          const h = slide.querySelector('h1, h2, h3, [data-title]');
          if (h) label = (h.textContent || '').trim().slice(0, 40);
        }
        if (!label) label = 'Slide';
        slide.setAttribute('data-screen-label', `${pad2(n)} ${label}`);

        // Validation attribute for comment flow / auto-checks.
        if (!slide.hasAttribute('data-om-validate')) {
          slide.setAttribute('data-om-validate', VALIDATE_ATTR);
        }
        slide.setAttribute('data-deck-slide', String(i));
      });
      if (this._totalEl) this._totalEl.textContent = String(this._slides.length || 1);
      if (this._index >= this._slides.length) this._index = Math.max(0, this._slides.length - 1);
    }
    _loadNotes() {
      const tag = document.getElementById('speaker-notes');
      if (!tag) {
        this._notes = [];
        return;
      }
      try {
        const parsed = JSON.parse(tag.textContent || '[]');
        if (Array.isArray(parsed)) this._notes = parsed;
      } catch (e) {
        console.warn('[deck-stage] Failed to parse #speaker-notes JSON:', e);
        this._notes = [];
      }
    }
    _restoreIndex() {
      try {
        const raw = localStorage.getItem(this._storageKey);
        if (raw != null) {
          const n = parseInt(raw, 10);
          if (Number.isFinite(n) && n >= 0 && n < this._slides.length) {
            this._index = n;
          }
        }
      } catch (e) {/* ignore */}
    }
    _persistIndex() {
      try {
        localStorage.setItem(this._storageKey, String(this._index));
      } catch (e) {/* ignore */}
    }
    _applyIndex({
      showOverlay = true,
      broadcast = true,
      reason = 'init'
    } = {}) {
      if (!this._slides.length) return;
      const prev = this._prevIndex == null ? -1 : this._prevIndex;
      const curr = this._index;
      this._slides.forEach((s, i) => {
        if (i === curr) s.setAttribute('data-deck-active', '');else s.removeAttribute('data-deck-active');
      });
      if (this._countEl) this._countEl.textContent = String(curr + 1);
      this._persistIndex();
      if (broadcast) {
        // (1) Legacy: host-window postMessage for speaker-notes renderers.
        try {
          window.postMessage({
            slideIndexChanged: curr
          }, '*');
        } catch (e) {}

        // (2) In-page CustomEvent on the <deck-stage> element itself.
        //     Bubbles and composes out of shadow DOM so slide code can listen:
        //       document.querySelector('deck-stage').addEventListener('slidechange', e => {
        //         e.detail.index, e.detail.previousIndex, e.detail.total, e.detail.slide, e.detail.reason
        //       });
        const detail = {
          index: curr,
          previousIndex: prev,
          total: this._slides.length,
          slide: this._slides[curr] || null,
          previousSlide: prev >= 0 ? this._slides[prev] || null : null,
          reason: reason // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
        };
        this.dispatchEvent(new CustomEvent('slidechange', {
          detail,
          bubbles: true,
          composed: true
        }));
      }
      this._prevIndex = curr;
      if (showOverlay) this._flashOverlay();
    }
    _flashOverlay() {
      if (!this._overlay) return;
      this._overlay.setAttribute('data-visible', '');
      if (this._hideTimer) clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        this._overlay.removeAttribute('data-visible');
      }, OVERLAY_HIDE_MS);
    }
    _fit() {
      if (!this._canvas) return;
      // PPTX export sets noscale so the DOM capture sees authored-size
      // geometry — the scaled canvas is in shadow DOM, so the exporter's
      // resetTransformSelector can't reach .canvas.style.transform directly.
      if (this.hasAttribute('noscale')) {
        this._canvas.style.transform = 'none';
        return;
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const s = Math.min(vw / this.designWidth, vh / this.designHeight);
      this._canvas.style.transform = `scale(${s})`;
    }
    _onResize() {
      this._fit();
    }
    _onMouseMove() {
      // Keep overlay visible while mouse moves; hide after idle.
      this._flashOverlay();
    }
    _onTapBack(e) {
      e.preventDefault();
      this._go(this._index - 1, 'tap');
    }
    _onTapForward(e) {
      e.preventDefault();
      this._go(this._index + 1, 'tap');
    }
    _onKey(e) {
      // Ignore when the user is typing.
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      let handled = true;
      if (key === 'ArrowRight' || key === 'PageDown' || key === ' ' || key === 'Spacebar') {
        this._go(this._index + 1, 'keyboard');
      } else if (key === 'ArrowLeft' || key === 'PageUp') {
        this._go(this._index - 1, 'keyboard');
      } else if (key === 'Home') {
        this._go(0, 'keyboard');
      } else if (key === 'End') {
        this._go(this._slides.length - 1, 'keyboard');
      } else if (key === 'r' || key === 'R') {
        this._go(0, 'keyboard');
      } else if (/^[0-9]$/.test(key)) {
        // 1..9 jump to that slide; 0 jumps to 10.
        const n = key === '0' ? 9 : parseInt(key, 10) - 1;
        if (n < this._slides.length) this._go(n, 'keyboard');
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        this._flashOverlay();
      }
    }
    _go(i, reason = 'api') {
      if (!this._slides.length) return;
      const clamped = Math.max(0, Math.min(this._slides.length - 1, i));
      if (clamped === this._index) {
        this._flashOverlay();
        return;
      }
      this._index = clamped;
      this._applyIndex({
        showOverlay: true,
        broadcast: true,
        reason
      });
    }

    // Public API ------------------------------------------------------------

    /** Current slide index (0-based). */
    get index() {
      return this._index;
    }
    /** Total slide count. */
    get length() {
      return this._slides.length;
    }
    /** Programmatically navigate. */
    goTo(i) {
      this._go(i, 'api');
    }
    next() {
      this._go(this._index + 1, 'api');
    }
    prev() {
      this._go(this._index - 1, 'api');
    }
    reset() {
      this._go(0, 'api');
    }
  }
  if (!customElements.get('deck-stage')) {
    customElements.define('deck-stage', DeckStage);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/deck/deck-stage.js", error: String((e && e.message) || e) }); }

// ui_kits/deck/image-slot.js
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
/* BEGIN USAGE */
/**
 * <image-slot> — user-fillable image placeholder.
 *
 * Drop this into a deck, mockup, or page wherever you want the user to
 * supply an image. You control the slot's shape and size; the user fills it
 * by dragging an image file onto it (or clicking to browse). The dropped
 * image persists across reloads via a .image-slots.state.json sidecar —
 * same read-via-fetch / write-via-window.omelette pattern as
 * design_canvas.jsx, so the filled slot shows on share links, downloaded
 * zips, and PPTX export. Outside the omelette runtime the slot is read-only.
 *
 * The host bridge only allows sidecar writes at the project root, so the
 * HTML that uses this component is assumed to live at the project root too
 * (same constraint as design_canvas.jsx).
 *
 * Attributes:
 *   id           Persistence key. REQUIRED for the drop to survive reload —
 *                every slot on the page needs a distinct id.
 *   shape        'rect' | 'rounded' | 'circle' | 'pill'   (default 'rounded')
 *                'circle' applies 50% border-radius; on a non-square slot
 *                that's an ellipse — set equal width and height for a true
 *                circle.
 *   radius       Corner radius in px for 'rounded'.       (default 12)
 *   mask         Any CSS clip-path value. Overrides `shape` — use this for
 *                hexagons, blobs, arbitrary polygons.
 *   fit          object-fit: cover | contain | fill.       (default 'cover')
 *                With cover (the default) double-clicking the filled slot
 *                enters a reframe mode: the whole image spills past the mask
 *                (translucent outside, opaque inside), drag to reposition,
 *                corner-drag to scale. The crop persists alongside the image
 *                in the sidecar. contain/fill stay static.
 *   position     object-position for fit=contain|fill.     (default '50% 50%')
 *   placeholder  Empty-state caption.                      (default 'Drop an image')
 *   src          Optional initial/fallback image URL. A user drop overrides
 *                it; clearing the drop reveals src again.
 *
 * Size and layout come from ordinary CSS on the element — width/height
 * inline or from a parent grid — so it composes with any layout.
 *
 * Usage:
 *   <image-slot id="hero"   style="width:800px;height:450px" shape="rounded" radius="20"
 *               placeholder="Drop a hero image"></image-slot>
 *   <image-slot id="avatar" style="width:120px;height:120px" shape="circle"></image-slot>
 *   <image-slot id="kite"   style="width:300px;height:300px"
 *               mask="polygon(50% 0, 100% 50%, 50% 100%, 0 50%)"></image-slot>
 */
/* END USAGE */

(() => {
  const STATE_FILE = '.image-slots.state.json';
  // 2× a ~600px slot in a 1920-wide deck — retina-sharp without making the
  // sidecar enormous. A 1200px WebP at q=0.85 is ~150-300KB.
  const MAX_DIM = 1200;
  // Raster formats only. SVG is excluded (can carry script; createImageBitmap
  // on SVG blobs is inconsistent). GIF is excluded because the canvas
  // re-encode keeps only the first frame, so an animated GIF would silently
  // go still — better to reject than surprise.
  const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];

  // ── Shared sidecar store ────────────────────────────────────────────────
  // One fetch + immediate write-on-change for every <image-slot> on the
  // page. Reads via fetch() so viewing works anywhere the HTML and sidecar
  // are served together; writes go through window.omelette.writeFile, which
  // the host allowlists to *.state.json basenames only.
  const subs = new Set();
  let slots = {};
  // ids explicitly cleared before the sidecar fetch resolved — otherwise
  // the merge below can't tell "never set" from "just deleted" and would
  // resurrect the sidecar's stale value.
  const tombstones = new Set();
  let loaded = false;
  let loadP = null;
  function load() {
    if (loadP) return loadP;
    loadP = fetch(STATE_FILE).then(r => r.ok ? r.json() : null).then(j => {
      // Merge: sidecar loses to any in-memory change that raced ahead of
      // the fetch (drop or clear) so neither is clobbered by hydration.
      if (j && typeof j === 'object') {
        const merged = Object.assign({}, j, slots);
        // A framing-only write that raced ahead of hydration must not
        // drop a user image that's only on disk — inherit u from the
        // sidecar for any in-memory entry that lacks one.
        for (const k in slots) {
          if (merged[k] && !merged[k].u && j[k]) {
            merged[k].u = typeof j[k] === 'string' ? j[k] : j[k].u;
          }
        }
        for (const id of tombstones) delete merged[id];
        slots = merged;
      }
      tombstones.clear();
    }).catch(() => {}).then(() => {
      loaded = true;
      subs.forEach(fn => fn());
    });
    return loadP;
  }

  // Serialize writes so two near-simultaneous drops on different slots
  // can't reorder at the backend and leave the sidecar with only the
  // first. A save requested mid-flight just marks dirty and re-fires on
  // completion with the then-current slots.
  let saving = false;
  let saveDirty = false;
  function save() {
    if (saving) {
      saveDirty = true;
      return;
    }
    const w = window.omelette && window.omelette.writeFile;
    if (!w) return;
    saving = true;
    Promise.resolve(w(STATE_FILE, JSON.stringify(slots))).catch(() => {}).then(() => {
      saving = false;
      if (saveDirty) {
        saveDirty = false;
        save();
      }
    });
  }
  const S_MAX = 5;
  const clampS = s => Math.max(1, Math.min(S_MAX, s));

  // Normalize a stored slot value. Pre-reframe sidecars stored a bare
  // data-URL string; newer ones store {u, s, x, y}. Either shape is valid.
  function getSlot(id) {
    const v = slots[id];
    if (!v) return null;
    return typeof v === 'string' ? {
      u: v,
      s: 1,
      x: 0,
      y: 0
    } : v;
  }
  function setSlot(id, val) {
    if (!id) return;
    if (val) {
      slots[id] = val;
      tombstones.delete(id);
    } else {
      delete slots[id];
      if (!loaded) tombstones.add(id);
    }
    subs.forEach(fn => fn());
    // A drop is rare + high-value — write immediately so nav-away can't lose
    // it. Gate on the initial read so we don't overwrite a sidecar we haven't
    // merged yet; the merge in load() keeps this change once the read lands.
    if (loaded) save();else load().then(save);
  }

  // ── Image downscale ─────────────────────────────────────────────────────
  // Encode through a canvas so the sidecar carries resized bytes, not the
  // raw upload. Longest side is capped at 2× the slot's rendered width
  // (retina) and at MAX_DIM. WebP keeps alpha and is ~10× smaller than PNG
  // for photos, so there's no need for per-image format picking.
  async function toDataUrl(file, targetW) {
    const bitmap = await createImageBitmap(file);
    try {
      const cap = Math.min(MAX_DIM, Math.max(1, Math.round(targetW * 2)) || MAX_DIM);
      const scale = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
      return canvas.toDataURL('image/webp', 0.85);
    } finally {
      bitmap.close && bitmap.close();
    }
  }

  // ── Custom element ──────────────────────────────────────────────────────
  const stylesheet = ':host{display:inline-block;position:relative;vertical-align:top;' + '  font:13px/1.3 system-ui,-apple-system,sans-serif;color:rgba(0,0,0,.55);width:240px;height:160px}' + '.frame{position:absolute;inset:0;overflow:hidden;background:rgba(0,0,0,.04)}' +
  // .frame img (clipped) and .spill (unclipped ghost + handles) share the
  // same left/top/width/height in frame-%, computed by _applyView(), so the
  // inside-mask crop and the outside-mask spill stay pixel-aligned.
  '.frame img{position:absolute;max-width:none;transform:translate(-50%,-50%);' + '  -webkit-user-drag:none;user-select:none;touch-action:none}' +
  // Reframe mode (double-click): the full image spills past the mask. The
  // spill layer is sized to the IMAGE bounds so its corners are where the
  // resize handles belong. The ghost <img> inside is translucent; the real
  // clipped <img> underneath shows the opaque in-mask crop.
  '.spill{position:absolute;transform:translate(-50%,-50%);display:none;z-index:1;' + '  cursor:grab;touch-action:none}' + ':host([data-panning]) .spill{cursor:grabbing}' + '.spill .ghost{position:absolute;inset:0;width:100%;height:100%;opacity:.35;' + '  pointer-events:none;-webkit-user-drag:none;user-select:none;' + '  box-shadow:0 0 0 1px rgba(0,0,0,.2),0 12px 32px rgba(0,0,0,.2)}' + '.spill .handle{position:absolute;width:12px;height:12px;border-radius:50%;' + '  background:#fff;box-shadow:0 0 0 1.5px #c96442,0 1px 3px rgba(0,0,0,.3);' + '  transform:translate(-50%,-50%)}' + '.spill .handle[data-c=nw]{left:0;top:0;cursor:nwse-resize}' + '.spill .handle[data-c=ne]{left:100%;top:0;cursor:nesw-resize}' + '.spill .handle[data-c=sw]{left:0;top:100%;cursor:nesw-resize}' + '.spill .handle[data-c=se]{left:100%;top:100%;cursor:nwse-resize}' + ':host([data-reframe]){z-index:10}' + ':host([data-reframe]) .spill{display:block}' + ':host([data-reframe]) .frame{box-shadow:0 0 0 2px #c96442}' + '.empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' + '  justify-content:center;gap:6px;text-align:center;padding:12px;box-sizing:border-box;' + '  cursor:pointer;user-select:none}' + '.empty svg{opacity:.45}' + '.empty .cap{max-width:90%;font-weight:500;letter-spacing:.01em}' + '.empty .sub{font-size:11px}' + '.empty .sub u{text-underline-offset:2px;text-decoration-color:rgba(0,0,0,.25)}' + '.empty:hover .sub u{color:rgba(0,0,0,.75);text-decoration-color:currentColor}' + ':host([data-over]) .frame{outline:2px solid #c96442;outline-offset:-2px;' + '  background:rgba(201,100,66,.10)}' + '.ring{position:absolute;inset:0;pointer-events:none;border:1.5px dashed rgba(0,0,0,.25);' + '  transition:border-color .12s}' + ':host([data-over]) .ring{border-color:#c96442}' + ':host([data-filled]) .ring{display:none}' +
  // Controls sit BELOW the mask (top:100%), absolutely positioned so the
  // author-declared slot height is unaffected. The gap is padding, not a
  // top offset, so the hover target stays contiguous with the frame.
  '.ctl{position:absolute;top:100%;left:50%;transform:translateX(-50%);padding-top:8px;' + '  display:flex;gap:6px;opacity:0;pointer-events:none;transition:opacity .12s;z-index:2;' + '  white-space:nowrap}' + ':host([data-filled][data-editable]:hover) .ctl,:host([data-reframe]) .ctl' + '  {opacity:1;pointer-events:auto}' + '.ctl button{appearance:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer;' + '  background:rgba(0,0,0,.65);color:#fff;font:11px/1 system-ui,-apple-system,sans-serif;' + '  backdrop-filter:blur(6px)}' + '.ctl button:hover{background:rgba(0,0,0,.8)}' + '.err{position:absolute;left:8px;bottom:8px;right:8px;color:#b3261e;font-size:11px;' + '  background:rgba(255,255,255,.85);padding:4px 6px;border-radius:5px;pointer-events:none}';
  const icon = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' + 'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>' + '<path d="m21 15-5-5L5 21"/></svg>';
  class ImageSlot extends HTMLElement {
    static get observedAttributes() {
      return ['shape', 'radius', 'mask', 'fit', 'position', 'placeholder', 'src', 'id'];
    }
    constructor() {
      super();
      const root = this.attachShadow({
        mode: 'open'
      });
      // .spill and .ctl sit OUTSIDE .frame so overflow:hidden + border-radius
      // on the frame (circle, pill, rounded) can't clip them.
      root.innerHTML = '<style>' + stylesheet + '</style>' + '<div class="frame" part="frame">' + '  <img part="image" alt="" draggable="false" style="display:none">' + '  <div class="empty" part="empty">' + icon + '    <div class="cap"></div>' + '    <div class="sub">or <u>browse files</u></div></div>' + '  <div class="ring" part="ring"></div>' + '</div>' + '<div class="spill">' + '  <img class="ghost" alt="" draggable="false">' + '  <div class="handle" data-c="nw"></div><div class="handle" data-c="ne"></div>' + '  <div class="handle" data-c="sw"></div><div class="handle" data-c="se"></div>' + '</div>' + '<div class="ctl"><button data-act="replace" title="Replace image">Replace</button>' + '  <button data-act="clear" title="Remove image">Remove</button></div>' + '<input type="file" accept="' + ACCEPT.join(',') + '" hidden>';
      this._frame = root.querySelector('.frame');
      this._ring = root.querySelector('.ring');
      this._img = root.querySelector('.frame img');
      this._empty = root.querySelector('.empty');
      this._cap = root.querySelector('.cap');
      this._sub = root.querySelector('.sub');
      this._spill = root.querySelector('.spill');
      this._ghost = root.querySelector('.ghost');
      this._err = null;
      this._input = root.querySelector('input');
      this._depth = 0;
      this._gen = 0;
      this._view = {
        s: 1,
        x: 0,
        y: 0
      };
      this._subFn = () => this._render();
      // Shadow-DOM listeners live with the shadow DOM — bound once here so
      // disconnect/reconnect (e.g. React remount) doesn't stack handlers.
      this._empty.addEventListener('click', () => this._input.click());
      root.addEventListener('click', e => {
        const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'replace') {
          this._exitReframe(true);
          this._input.click();
        }
        if (act === 'clear') {
          this._exitReframe(false);
          this._gen++;
          this._local = null;
          if (this.id) setSlot(this.id, null);else this._render();
        }
      });
      this._input.addEventListener('change', () => {
        const f = this._input.files && this._input.files[0];
        if (f) this._ingest(f);
        this._input.value = '';
      });
      // naturalWidth/Height aren't known until load — re-apply so the cover
      // baseline is computed from real dimensions, not the 100%×100% fallback.
      this._img.addEventListener('load', () => this._applyView());
      // Gated on editable + fit=cover so share links and contain/fill slots
      // stay static.
      this.addEventListener('dblclick', e => {
        if (!this.hasAttribute('data-editable') || !this._reframes()) return;
        e.preventDefault();
        if (this.hasAttribute('data-reframe')) this._exitReframe(true);else this._enterReframe();
      });
      // Pan + resize both originate on the spill layer. A handle pointerdown
      // drives an aspect-locked resize anchored at the opposite corner; any
      // other pointerdown on the spill pans. Offsets are frame-% so a
      // reframed slot survives responsive resize / PPTX export.
      this._spill.addEventListener('pointerdown', e => {
        if (e.button !== 0 || !this.hasAttribute('data-reframe')) return;
        e.preventDefault();
        e.stopPropagation();
        this._spill.setPointerCapture(e.pointerId);
        const rect = this.getBoundingClientRect();
        const fw = rect.width || 1,
          fh = rect.height || 1;
        const corner = e.target.getAttribute && e.target.getAttribute('data-c');
        let move;
        if (corner) {
          // Resize about the OPPOSITE corner. Viewport-px throughout (rect
          // fw/fh, not clientWidth) so the math survives a transform:scale()
          // ancestor — deck_stage renders slides scaled-to-fit.
          const iw = this._img.naturalWidth || 1,
            ih = this._img.naturalHeight || 1;
          const base = Math.max(fw / iw, fh / ih);
          const sx = corner.includes('e') ? 1 : -1;
          const sy = corner.includes('s') ? 1 : -1;
          const s0 = this._view.s;
          const w0 = iw * base * s0,
            h0 = ih * base * s0;
          const cx0 = (50 + this._view.x) / 100 * fw;
          const cy0 = (50 + this._view.y) / 100 * fh;
          const ox = cx0 - sx * w0 / 2,
            oy = cy0 - sy * h0 / 2;
          const diag0 = Math.hypot(w0, h0);
          const ux = sx * w0 / diag0,
            uy = sy * h0 / diag0;
          move = ev => {
            const proj = (ev.clientX - rect.left - ox) * ux + (ev.clientY - rect.top - oy) * uy;
            const s = clampS(s0 * proj / diag0);
            const d = diag0 * s / s0;
            this._view.s = s;
            this._view.x = (ox + ux * d / 2) / fw * 100 - 50;
            this._view.y = (oy + uy * d / 2) / fh * 100 - 50;
            this._clampView();
            this._applyView();
          };
        } else {
          this.setAttribute('data-panning', '');
          const start = {
            px: e.clientX,
            py: e.clientY,
            x: this._view.x,
            y: this._view.y
          };
          move = ev => {
            this._view.x = start.x + (ev.clientX - start.px) / fw * 100;
            this._view.y = start.y + (ev.clientY - start.py) / fh * 100;
            this._clampView();
            this._applyView();
          };
        }
        const up = () => {
          try {
            this._spill.releasePointerCapture(e.pointerId);
          } catch {}
          this._spill.removeEventListener('pointermove', move);
          this._spill.removeEventListener('pointerup', up);
          this._spill.removeEventListener('pointercancel', up);
          this.removeAttribute('data-panning');
          this._dragUp = null;
        };
        // Stashed so _exitReframe (Escape / outside-click mid-drag) can
        // tear the capture + listeners down synchronously.
        this._dragUp = up;
        this._spill.addEventListener('pointermove', move);
        this._spill.addEventListener('pointerup', up);
        this._spill.addEventListener('pointercancel', up);
      });
      // Wheel zoom stays available inside reframe mode as a trackpad nicety —
      // zooms toward the cursor (offset' = cursor·(1-k) + offset·k).
      this.addEventListener('wheel', e => {
        if (!this.hasAttribute('data-reframe')) return;
        e.preventDefault();
        const r = this.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width * 100 - 50;
        const cy = (e.clientY - r.top) / r.height * 100 - 50;
        const prev = this._view.s;
        const next = clampS(prev * Math.pow(1.0015, -e.deltaY));
        if (next === prev) return;
        const k = next / prev;
        this._view.s = next;
        this._view.x = cx * (1 - k) + this._view.x * k;
        this._view.y = cy * (1 - k) + this._view.y * k;
        this._clampView();
        this._applyView();
      }, {
        passive: false
      });
    }
    connectedCallback() {
      // Warn once per page — an id-less slot works for the session but
      // cannot persist, and two id-less slots would share nothing.
      if (!this.id && !ImageSlot._warned) {
        ImageSlot._warned = true;
        console.warn('<image-slot> without an id will not persist its dropped image.');
      }
      this.addEventListener('dragenter', this);
      this.addEventListener('dragover', this);
      this.addEventListener('dragleave', this);
      this.addEventListener('drop', this);
      subs.add(this._subFn);
      // width%/height% in _applyView encode the frame aspect at call time —
      // a host resize (responsive grid, pane divider) would stretch the
      // image until the next _render. Re-render on size change: _render()
      // re-seeds _view from stored before clamp/apply, so a shrink→grow
      // cycle round-trips instead of ratcheting x/y toward the narrower
      // frame's clamp range.
      this._ro = new ResizeObserver(() => this._render());
      this._ro.observe(this);
      load();
      this._render();
    }
    disconnectedCallback() {
      subs.delete(this._subFn);
      this.removeEventListener('dragenter', this);
      this.removeEventListener('dragover', this);
      this.removeEventListener('dragleave', this);
      this.removeEventListener('drop', this);
      if (this._ro) {
        this._ro.disconnect();
        this._ro = null;
      }
      this._exitReframe(false);
    }
    _enterReframe() {
      if (this.hasAttribute('data-reframe')) return;
      this.setAttribute('data-reframe', '');
      this._applyView();
      // Close on click outside (the spill handler stopPropagation()s so
      // in-image drags don't reach this) and on Escape. Listeners are held
      // on the instance so _exitReframe / disconnectedCallback can detach
      // exactly what was attached.
      this._outside = e => {
        if (e.composedPath && e.composedPath().includes(this)) return;
        this._exitReframe(true);
      };
      this._esc = e => {
        if (e.key === 'Escape') this._exitReframe(true);
      };
      document.addEventListener('pointerdown', this._outside, true);
      document.addEventListener('keydown', this._esc, true);
    }
    _exitReframe(commit) {
      if (!this.hasAttribute('data-reframe')) return;
      if (this._dragUp) this._dragUp();
      this.removeAttribute('data-reframe');
      this.removeAttribute('data-panning');
      if (this._outside) document.removeEventListener('pointerdown', this._outside, true);
      if (this._esc) document.removeEventListener('keydown', this._esc, true);
      this._outside = this._esc = null;
      if (commit) this._commitView();
    }
    attributeChangedCallback() {
      if (this.shadowRoot) this._render();
    }

    // handleEvent — one listener object for all four drag events keeps the
    // add/remove symmetric and the depth counter correct.
    handleEvent(e) {
      if (e.type === 'dragenter' || e.type === 'dragover') {
        // Without preventDefault the browser never fires 'drop'.
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        if (e.type === 'dragenter') this._depth++;
        this.setAttribute('data-over', '');
      } else if (e.type === 'dragleave') {
        // dragenter/leave fire for every descendant crossing — count depth
        // so hovering the icon inside the empty state doesn't flicker.
        if (--this._depth <= 0) {
          this._depth = 0;
          this.removeAttribute('data-over');
        }
      } else if (e.type === 'drop') {
        e.preventDefault();
        e.stopPropagation();
        this._depth = 0;
        this.removeAttribute('data-over');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) this._ingest(f);
      }
    }
    async _ingest(file) {
      this._setError(null);
      if (!file || ACCEPT.indexOf(file.type) < 0) {
        this._setError('Drop a PNG, JPEG, WebP, or AVIF image.');
        return;
      }
      // toDataUrl can take hundreds of ms on a large photo. A Clear or a
      // newer drop during that window would be clobbered when this await
      // resumes — bump + capture a generation so stale encodes bail.
      const gen = ++this._gen;
      try {
        const w = this.clientWidth || this.offsetWidth || MAX_DIM;
        const url = await toDataUrl(file, w);
        if (gen !== this._gen) return;
        // Only exit reframe once the new image is in hand — a rejected type
        // or decode failure leaves the in-progress crop untouched.
        this._exitReframe(false);
        const val = {
          u: url,
          s: 1,
          x: 0,
          y: 0
        };
        setSlot(this.id || '', val);
        // Keep a session-local copy for id-less slots so the drop still
        // shows, even though it cannot persist.
        if (!this.id) {
          this._local = val;
          this._render();
        }
      } catch (err) {
        if (gen !== this._gen) return;
        this._setError('Could not read that image.');
        console.warn('<image-slot> ingest failed:', err);
      }
    }
    _setError(msg) {
      if (this._err) {
        this._err.remove();
        this._err = null;
      }
      if (!msg) return;
      const d = document.createElement('div');
      d.className = 'err';
      d.textContent = msg;
      this.shadowRoot.appendChild(d);
      this._err = d;
      setTimeout(() => {
        if (this._err === d) {
          d.remove();
          this._err = null;
        }
      }, 3000);
    }

    // Reframing (pan/resize) is only meaningful for fit=cover — contain/fill
    // keep the old object-fit path and double-click is a no-op.
    _reframes() {
      return this.hasAttribute('data-filled') && (this.getAttribute('fit') || 'cover') === 'cover';
    }

    // Cover-baseline geometry, shared by clamp/apply/resize. Null until the
    // img has loaded (naturalWidth is 0 before that) or when the slot has no
    // layout box — ResizeObserver fires with a 0×0 rect under display:none,
    // and clamping against a degenerate 1×1 frame would silently pull the
    // stored pan toward zero.
    _geom() {
      const iw = this._img.naturalWidth,
        ih = this._img.naturalHeight;
      const fw = this.clientWidth,
        fh = this.clientHeight;
      if (!iw || !ih || !fw || !fh) return null;
      return {
        iw,
        ih,
        fw,
        fh,
        base: Math.max(fw / iw, fh / ih)
      };
    }
    _clampView() {
      // Pan range on each axis is half the overflow past the frame edge.
      const g = this._geom();
      if (!g) return;
      const mx = Math.max(0, (g.iw * g.base * this._view.s / g.fw - 1) * 50);
      const my = Math.max(0, (g.ih * g.base * this._view.s / g.fh - 1) * 50);
      this._view.x = Math.max(-mx, Math.min(mx, this._view.x));
      this._view.y = Math.max(-my, Math.min(my, this._view.y));
    }
    _applyView() {
      const g = this._geom();
      const fit = this.getAttribute('fit') || 'cover';
      if (fit !== 'cover' || !g) {
        // Non-cover, or dimensions not known yet (before img load).
        this._img.style.width = '100%';
        this._img.style.height = '100%';
        this._img.style.left = '50%';
        this._img.style.top = '50%';
        this._img.style.objectFit = fit;
        this._img.style.objectPosition = this.getAttribute('position') || '50% 50%';
        return;
      }
      // Cover baseline: img fills the frame on its tighter axis at s=1, so
      // pan works immediately on the overflowing axis without zooming first.
      // Width/height and left/top are all frame-% — depends only on the
      // frame aspect ratio, so a responsive resize keeps the same crop. The
      // spill layer mirrors the same box so its corners = image corners.
      const k = g.base * this._view.s;
      const w = g.iw * k / g.fw * 100 + '%';
      const h = g.ih * k / g.fh * 100 + '%';
      const l = 50 + this._view.x + '%';
      const t = 50 + this._view.y + '%';
      this._img.style.width = w;
      this._img.style.height = h;
      this._img.style.left = l;
      this._img.style.top = t;
      this._img.style.objectFit = '';
      this._spill.style.width = w;
      this._spill.style.height = h;
      this._spill.style.left = l;
      this._spill.style.top = t;
    }
    _commitView() {
      const v = {
        s: this._view.s,
        x: this._view.x,
        y: this._view.y
      };
      if (this._userUrl) v.u = this._userUrl;
      // Framing-only (no u) persists too so an author-src slot remembers its
      // crop; clearing the sidecar still falls through to src=.
      if (this.id) setSlot(this.id, v);else {
        this._local = v;
      }
    }
    _render() {
      // Shape / mask. Presets use border-radius so the dashed ring can
      // follow the rounded outline; clip-path is only applied for an
      // explicit `mask` (the ring is hidden there since a rectangle
      // dashed border chopped by an arbitrary polygon looks broken).
      const mask = this.getAttribute('mask');
      const shape = (this.getAttribute('shape') || 'rounded').toLowerCase();
      let radius = '';
      if (shape === 'circle') radius = '50%';else if (shape === 'pill') radius = '9999px';else if (shape === 'rounded') {
        const n = parseFloat(this.getAttribute('radius'));
        radius = (Number.isFinite(n) ? n : 12) + 'px';
      }
      this._frame.style.borderRadius = mask ? '' : radius;
      this._frame.style.clipPath = mask || '';
      this._ring.style.borderRadius = mask ? '' : radius;
      this._ring.style.display = mask ? 'none' : '';

      // Controls and reframe entry gate on this so share links stay read-only.
      const editable = !!(window.omelette && window.omelette.writeFile);
      this.toggleAttribute('data-editable', editable);
      this._sub.style.display = editable ? '' : 'none';

      // Content. The sidecar is also writable by the agent's write_file
      // tool, so its value isn't guaranteed canvas-originated — only accept
      // data:image/ URLs from it. The `src` attribute is author-controlled
      // (Claude wrote it into the HTML) so it passes through unchanged.
      let stored = this.id ? getSlot(this.id) : this._local;
      if (stored && stored.u && !/^data:image\//i.test(stored.u)) stored = null;
      const srcAttr = this.getAttribute('src') || '';
      this._userUrl = stored && stored.u || null;
      const url = this._userUrl || srcAttr;
      // Don't clobber an in-flight reframe with a store-triggered re-render.
      if (!this.hasAttribute('data-reframe')) {
        this._view = {
          s: stored && Number.isFinite(stored.s) ? clampS(stored.s) : 1,
          x: stored && Number.isFinite(stored.x) ? stored.x : 0,
          y: stored && Number.isFinite(stored.y) ? stored.y : 0
        };
      }
      this._cap.textContent = this.getAttribute('placeholder') || 'Drop an image';
      // Toggle via style.display — the [hidden] attribute alone loses to
      // the display:flex / display:block rules in the stylesheet above.
      if (url) {
        if (this._img.getAttribute('src') !== url) {
          this._img.src = url;
          this._ghost.src = url;
        }
        this._img.style.display = 'block';
        this._empty.style.display = 'none';
        this.setAttribute('data-filled', '');
        this._clampView();
        this._applyView();
      } else {
        this._img.style.display = 'none';
        this._img.removeAttribute('src');
        this._ghost.removeAttribute('src');
        this._empty.style.display = 'flex';
        this.removeAttribute('data-filled');
      }
    }
  }
  if (!customElements.get('image-slot')) {
    customElements.define('image-slot', ImageSlot);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/deck/image-slot.js", error: String((e && e.message) || e) }); }

// ui_kits/deck/slides.jsx
try { (() => {
// Alloy Partners — deck slide layouts (2026 system)
// Rebuilt to match the real Agentic Studio + Alloy Overview decks.
// Each exported component is a single <section> slide; drop inside <deck-stage>.
//
// Palette used: ink #26262B (body), ultramarine #2929E2, azure #3172F4,
// electric blue #6CE3FF, muted #7F7F7F, off-white #F4F4F4, smoke #D9D6DB,
// mid-grey #B0B2B8, black #000.

const FONT = "'NeuSans','DM Sans',system-ui,sans-serif";
const MONO = "'Roboto Mono',monospace";
const INK = '#26262B';
const slideBase = {
  width: 1920,
  height: 1080,
  position: 'relative',
  fontFamily: FONT,
  color: INK,
  overflow: 'hidden',
  boxSizing: 'border-box'
};

// ---- Shared chrome ----------------------------------------------------------

// The signature diagonal-line cluster, anchored bottom-right by default.
function Diagonals({
  color = '#2929E2',
  opacity = 1,
  corner = 'br',
  size = 760
}) {
  const pos = {
    br: {
      right: -120,
      bottom: -160
    },
    tr: {
      right: -120,
      top: -160
    },
    bl: {
      left: -120,
      bottom: -160
    }
  }[corner];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      width: size,
      height: size * 1.25,
      ...pos,
      opacity,
      pointerEvents: 'none',
      backgroundImage: `repeating-linear-gradient(58deg, ${color} 0, ${color} 2px, transparent 2px, transparent 30px)`,
      WebkitMaskImage: 'radial-gradient(120% 120% at 100% 100%, #000 55%, transparent 100%)',
      maskImage: 'radial-gradient(120% 120% at 100% 100%, #000 55%, transparent 100%)'
    }
  });
}
function Wordmark({
  light = false,
  size = 40
}) {
  const path = light ? '../../assets/logo-white.svg' : '../../assets/logo-black.svg';
  const src = window.__resources && window.__resources[light ? 'logoWhite' : 'logoBlack'] || path;
  return /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "Alloy",
    style: {
      height: size * 0.62,
      width: 'auto',
      display: 'block'
    }
  });
}
function Eyebrow({
  children,
  tone = 'accent',
  size = 22
}) {
  const color = {
    accent: '#2929E2',
    dark: '#6CE3FF',
    muted: '#7F7F7F',
    white: '#fff'
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 500,
      fontSize: size,
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
      color
    }
  }, children);
}
function Footer({
  n,
  dark,
  note = 'Proprietary & Confidential'
}) {
  const c = dark ? 'rgba(255,255,255,0.5)' : '#7F7F7F';
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      bottom: 52,
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 18,
      color: c
    }
  }, note), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 80,
      bottom: 52,
      fontFamily: MONO,
      fontSize: 18,
      color: c
    }
  }, String(n).padStart(2, '0')));
}

// Render a headline string with {curly} words emphasized in accent color.
function emph(text, color = '#2929E2') {
  const parts = String(text).split(/(\{[^}]+\})/g);
  return parts.map((p, i) => p.startsWith('{') && p.endsWith('}') ? /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      color
    }
  }, p.slice(1, -1)) : /*#__PURE__*/React.createElement("span", {
    key: i
  }, p));
}

// ============ 1. COVER ============
function CoverSlide({
  eyebrow = 'Alloy Partners · June 2026',
  title = 'Agentic Venture Studio',
  subtitle = 'From existing ideas to launched ventures, at the speed of AI.'
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": "01 Cover",
    style: {
      ...slideBase,
      background: '#000',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement(Diagonals, {
    color: "#2929E2",
    corner: "br",
    size: 900,
    opacity: 0.9
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 72,
      left: 80
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    light: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      bottom: 200,
      right: 760
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 36
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "white"
  }, eyebrow)), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 132,
      lineHeight: 0.98,
      letterSpacing: '-0.025em',
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: FONT,
      fontWeight: 300,
      fontSize: 34,
      lineHeight: 1.35,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 36,
      maxWidth: 900
    }
  }, subtitle)), /*#__PURE__*/React.createElement(Footer, {
    n: 1,
    dark: true
  }));
}

// ============ 2. SECTION DIVIDER ============
function SectionDivider({
  n = 2,
  num = 1,
  title = 'Context'
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Section · ${title}`,
    style: {
      ...slideBase,
      background: '#F4F4F4'
    }
  }, /*#__PURE__*/React.createElement(Diagonals, {
    color: "#2929E2",
    corner: "tr",
    size: 680,
    opacity: 0.85
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: '50%',
      transform: 'translateY(-50%)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 500,
      fontSize: 30,
      letterSpacing: '0.14em',
      color: '#2929E2',
      marginBottom: 28
    }
  }, String(num).padStart(2, '0')), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 168,
      lineHeight: 0.96,
      letterSpacing: '-0.025em',
      margin: 0
    }
  }, title)), /*#__PURE__*/React.createElement(Footer, {
    n: n,
    note: ""
  }));
}

// ============ 3. STATEMENT (emphasis-word) ============
// Big centered claim, one word colored. (Alloy Overview style.)
function StatementSlide({
  n = 3,
  eyebrow = 'Meet Alloy Partners',
  text = 'We co-create {advantaged} startups with leading corporations and entrepreneurs.',
  dark = false,
  accent = '#3172F4'
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Statement`,
    style: {
      ...slideBase,
      background: dark ? '#000' : '#F4F4F4',
      color: dark ? '#fff' : INK,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 140px'
    }
  }, /*#__PURE__*/React.createElement(Diagonals, {
    color: dark ? '#fff' : '#2929E2',
    corner: "br",
    size: 620,
    opacity: dark ? 0.5 : 0.7
  }), eyebrow && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 48
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: dark ? 'dark' : 'accent'
  }, eyebrow)), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 104,
      lineHeight: 1.08,
      letterSpacing: '-0.02em',
      margin: 0,
      maxWidth: 1500
    }
  }, emph(text, accent)), /*#__PURE__*/React.createElement(Footer, {
    n: n,
    dark: dark,
    note: ""
  }));
}

// ============ 4. HEADLINE + LEAD PARAGRAPH ============
function HeadlineLeadSlide({
  n = 4,
  num = '01',
  section = 'Context',
  title = 'A clear picture of where to {focus}.',
  lead = 'A range of outputs, not a simple report. Every idea enters a structured pipeline, gets assessed and contextualized, and comes back with a clear recommendation.'
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Headline + Lead`,
    style: {
      ...slideBase,
      background: '#F4F4F4'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: 96
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "muted"
  }, num, " \xB7 ", section)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: 240,
      right: 80
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 92,
      lineHeight: 1.06,
      letterSpacing: '-0.02em',
      margin: 0,
      maxWidth: 1400
    }
  }, emph(title)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: FONT,
      fontWeight: 300,
      fontSize: 32,
      lineHeight: 1.5,
      color: INK,
      marginTop: 44,
      maxWidth: 1180
    }
  }, lead)), /*#__PURE__*/React.createElement(Footer, {
    n: n
  }));
}

// ============ 5. NUMBERED LIST + DETAIL (the workhorse) ============
function NumberedListSlide({
  n = 5,
  num = '03',
  section = 'How It Works',
  title = 'Intake to recommendation in {days}.',
  items = [{
    h: 'Intake',
    b: 'Submit ideas through a structured process: shelf ideas, emerging concepts, or early problem statements. Alloy captures them through multiple channels.'
  }, {
    h: 'Assessment',
    b: 'Alloy\u2019s agentic team runs a full battery of analysis on each idea, using human judgment and AI tools operating outside your firewall.'
  }, {
    h: 'Design',
    b: 'Promising ideas get a full business model: market, moat, economics, and a go-to-market path mapped to a clear owner.'
  }, {
    h: 'Recommendation',
    b: 'Each idea returns a clear verdict, build internally, spin out as a venture, or set aside, with the evidence behind it.'
  }]
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Numbered List`,
    style: {
      ...slideBase,
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: 96
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "accent"
  }, num, " \xB7 ", section)), /*#__PURE__*/React.createElement("h2", {
    style: {
      position: 'absolute',
      left: 80,
      top: 168,
      right: 80,
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 76,
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      margin: 0
    }
  }, emph(title)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      right: 80,
      top: 380,
      display: 'grid',
      gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      gap: 40
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: MONO,
      fontWeight: 500,
      fontSize: 26,
      color: '#2929E2'
    }
  }, String(i + 1).padStart(2, '0')), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 2,
      background: '#D9D6DB'
    }
  }), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: FONT,
      fontWeight: 500,
      fontSize: 34,
      margin: 0,
      lineHeight: 1.15
    }
  }, it.h), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: FONT,
      fontWeight: 300,
      fontSize: 23,
      lineHeight: 1.5,
      color: INK,
      margin: 0
    }
  }, it.b)))), /*#__PURE__*/React.createElement(Footer, {
    n: n
  }));
}

// ============ 6. STAT BAND (about Alloy) ============
function StatBandSlide({
  n = 6,
  eyebrow = 'About Alloy Partners',
  title = 'We don\u2019t choose winners. {We build them.}',
  body = 'Alloy Partners is a venture studio purpose-built to co-create companies with corporate partners and universities. We bring the team, the tools, and the process.',
  stats = [{
    k: '50+',
    v: 'Businesses built or incubating with Fortune 500 and university partners'
  }, {
    k: '8',
    v: 'Industry-focused venture studios operating today'
  }, {
    k: '$90M+',
    v: 'Third-party capital raised by portfolio companies'
  }]
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Stat Band`,
    style: {
      ...slideBase,
      background: '#000',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement(Diagonals, {
    color: "#2929E2",
    corner: "tr",
    size: 620,
    opacity: 0.8
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: 120,
      right: 760
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 36
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "dark"
  }, eyebrow)), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 84,
      lineHeight: 1.04,
      letterSpacing: '-0.02em',
      margin: 0
    }
  }, emph(title, '#6CE3FF')), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: FONT,
      fontWeight: 300,
      fontSize: 30,
      lineHeight: 1.5,
      color: 'rgba(255,255,255,0.78)',
      marginTop: 40,
      maxWidth: 1000
    }
  }, body)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      right: 80,
      bottom: 140,
      display: 'flex',
      gap: 28,
      borderTop: '1px solid rgba(255,255,255,0.15)',
      paddingTop: 48
    }
  }, stats.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: 92,
      lineHeight: 1,
      letterSpacing: '-0.02em'
    }
  }, s.k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 300,
      fontSize: 22,
      lineHeight: 1.45,
      color: 'rgba(255,255,255,0.72)',
      marginTop: 18,
      maxWidth: 420
    }
  }, s.v)))), /*#__PURE__*/React.createElement(Footer, {
    n: n,
    dark: true
  }));
}

// ============ 7. TWO-PANEL "WHAT EACH SIDE BRINGS" ============
function TwoBringsSlide({
  n = 7,
  num = '06',
  section = 'Moving Forward',
  title = 'What each side brings to the table.',
  left = {
    h: 'Partner brings',
    items: ['Ideas, whether fully formed, early-stage, or on a shelf', 'Domain context and known constraints', 'A designated point of contact and stakeholder access', 'A 6-month initial commitment to build a working rhythm']
  },
  right = {
    h: 'Alloy brings',
    items: ['A dedicated agentic team running your idea pipeline', 'Experienced human oversight and judgment', 'Full business models and go/no-go recommendations', 'A continuous cadence, no idea ever stalls']
  }
}) {
  const Panel = ({
    data,
    dark
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: dark ? '#000' : '#D9D6DB',
      color: dark ? '#fff' : INK,
      borderRadius: 10,
      padding: 56,
      minHeight: 560
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 40
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: dark ? 'dark' : 'accent',
    size: 24
  }, data.h)), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 28
    }
  }, data.items.map((it, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      display: 'flex',
      gap: 18,
      fontFamily: FONT,
      fontWeight: 300,
      fontSize: 28,
      lineHeight: 1.35
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: dark ? '#6CE3FF' : '#2929E2',
      fontWeight: 500
    }
  }, String(i + 1).padStart(2, '0')), /*#__PURE__*/React.createElement("span", null, it)))));
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Two Brings`,
    style: {
      ...slideBase,
      background: '#F4F4F4'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: 96
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "muted"
  }, num, " \xB7 ", section)), /*#__PURE__*/React.createElement("h2", {
    style: {
      position: 'absolute',
      left: 80,
      top: 168,
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 72,
      letterSpacing: '-0.02em',
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      right: 80,
      top: 320,
      display: 'flex',
      gap: 28
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    data: left
  }), /*#__PURE__*/React.createElement(Panel, {
    data: right,
    dark: true
  })), /*#__PURE__*/React.createElement(Footer, {
    n: n
  }));
}

// ============ 8. PRICING / TERMS TABLE ============
function TermsSlide({
  n = 8,
  num = '04',
  section = 'Terms',
  title = 'Built for speed. Structured for {trust}.',
  rows = [{
    k: 'Monthly Fee',
    v: '$30,000 / month + token costs',
    note: 'Billed monthly in advance'
  }, {
    k: 'Token Costs',
    v: 'Pass-through at cost',
    note: 'Based on actual usage'
  }, {
    k: 'Token Ceiling',
    v: 'Optional monthly cap',
    note: 'Set by partner, e.g. $X / month'
  }, {
    k: 'Minimum Term',
    v: '6 months',
    note: 'Then month-to-month'
  }]
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Terms`,
    style: {
      ...slideBase,
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: 96
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "accent"
  }, num, " \xB7 ", section)), /*#__PURE__*/React.createElement("h2", {
    style: {
      position: 'absolute',
      left: 80,
      top: 168,
      right: 80,
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 80,
      letterSpacing: '-0.02em',
      margin: 0
    }
  }, emph(title)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      right: 80,
      top: 400
    }
  }, rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1.2fr 1fr',
      gap: 40,
      alignItems: 'baseline',
      padding: '34px 0',
      borderTop: '1px solid #D9D6DB'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 500,
      fontSize: 30,
      color: '#7F7F7F'
    }
  }, r.k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 38,
      color: INK
    }
  }, r.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 300,
      fontSize: 24,
      color: '#7F7F7F'
    }
  }, r.note)))), /*#__PURE__*/React.createElement(Footer, {
    n: n
  }));
}

// ============ 9. TIMELINE ============
function TimelineSlide({
  n = 9,
  eyebrow = 'Our Story',
  title = 'A decade of building the {venture studio} model.',
  milestones = [{
    y: '2015',
    h: 'First venture studio',
    b: 'High Alpha coins the term \u201Cventure studio\u201D and designs a model to launch and invest in startups.'
  }, {
    y: '2016',
    h: 'First corporate partners',
    b: 'Xerox, Cummins, Allegion, and SVB partner to launch new ventures.'
  }, {
    y: '2020',
    h: 'Alloy Partners founded',
    b: 'Alloy spins out from High Alpha, expanding the playbook to Fidelity, Vanguard, P&G and more.'
  }, {
    y: '2026',
    h: '50+ companies, 8 studios',
    b: 'Portfolio companies have raised over $90M in third-party capital.'
  }]
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Timeline`,
    style: {
      ...slideBase,
      background: '#F4F4F4'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: 96
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "accent"
  }, eyebrow)), /*#__PURE__*/React.createElement("h2", {
    style: {
      position: 'absolute',
      left: 80,
      top: 168,
      right: 80,
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 76,
      letterSpacing: '-0.02em',
      margin: 0,
      maxWidth: 1500
    }
  }, emph(title)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      right: 80,
      top: 460
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 2,
      background: '#B0B2B8',
      position: 'relative',
      marginBottom: 48
    }
  }, milestones.map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: 'absolute',
      top: -9,
      left: `${i / (milestones.length - 1) * 100}%`,
      width: 18,
      height: 18,
      borderRadius: 999,
      background: '#2929E2',
      transform: 'translateX(-50%)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${milestones.length}, 1fr)`,
      gap: 40
    }
  }, milestones.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: MONO,
      fontWeight: 500,
      fontSize: 40,
      color: '#2929E2',
      marginBottom: 18
    }
  }, m.y), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: FONT,
      fontWeight: 500,
      fontSize: 30,
      margin: 0,
      marginBottom: 14,
      lineHeight: 1.15
    }
  }, m.h), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: FONT,
      fontWeight: 300,
      fontSize: 22,
      lineHeight: 1.45,
      color: INK,
      margin: 0
    }
  }, m.b))))), /*#__PURE__*/React.createElement(Footer, {
    n: n,
    note: ""
  }));
}

// ============ 10. CASE STUDY ============
function CaseStudySlide({
  n = 10,
  eyebrow = 'Case Study',
  title = 'We partnered with Elanco to launch {Athian}, the first carbon marketplace for livestock.',
  body = 'Athian is an agtech startup for livestock producers that monetizes greenhouse-gas reductions. Through its marketplace, it has enabled large-scale emissions reduction.',
  stats = [{
    k: '$200M',
    v: 'Estimated annual future Bovaer revenue to Elanco, unlocked in part by Athian'
  }, {
    k: '85%',
    v: 'Of the U.S. large-dairy industry represented in Athian\u2019s Seed Round'
  }]
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Case Study`,
    style: {
      ...slideBase,
      background: '#000',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement(Diagonals, {
    color: "#2929E2",
    corner: "br",
    size: 640,
    opacity: 0.6
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: 110,
      right: 820
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 40
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "dark"
  }, eyebrow)), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 66,
      lineHeight: 1.1,
      letterSpacing: '-0.015em',
      margin: 0
    }
  }, emph(title, '#6CE3FF')), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: FONT,
      fontWeight: 300,
      fontSize: 28,
      lineHeight: 1.5,
      color: 'rgba(255,255,255,0.78)',
      marginTop: 40,
      maxWidth: 900
    }
  }, body)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 80,
      top: 130,
      width: 660,
      display: 'flex',
      flexDirection: 'column',
      gap: 28
    }
  }, stats.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: '#0a0a0a',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      padding: 44
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: 96,
      lineHeight: 1,
      letterSpacing: '-0.02em',
      color: '#fff'
    }
  }, s.k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 300,
      fontSize: 24,
      lineHeight: 1.45,
      color: 'rgba(255,255,255,0.72)',
      marginTop: 20
    }
  }, s.v)))), /*#__PURE__*/React.createElement(Footer, {
    n: n,
    dark: true
  }));
}

// ============ 11. PARTNER LOGO WALL ============
const ALLOY_PARTNERS = [{
  name: 'Eli Lilly',
  file: 'eli-lilly.svg',
  h: 56
}, {
  name: 'Capital One',
  file: 'capital-one.svg',
  h: 40
}, {
  name: 'Elanco',
  file: 'elanco.svg',
  h: 56
}, {
  name: 'Warner Bros. Discovery',
  file: 'warner-bros-discovery.svg',
  h: 38
}, {
  name: 'Huntington Bank',
  file: 'huntington.svg',
  h: 30
}, {
  name: 'Catalyst by Wellstar',
  file: 'catalyst-wellstar.svg',
  h: 52
}, {
  name: 'University of Notre Dame',
  file: 'notre-dame.svg',
  h: 52
}, {
  name: 'UNC',
  file: 'unc.svg',
  h: 60
}, {
  name: 'DNX',
  file: 'dnx.svg',
  h: 64
}];
function LogoWallSlide({
  n = 11,
  eyebrow = 'Our Partners',
  title = 'We partner with leading organizations to solve their most pressing problems.',
  partners = ALLOY_PARTNERS,
  base = '../../assets/partners/'
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Logo Wall`,
    style: {
      ...slideBase,
      background: '#F4F4F4'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: 96
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "accent"
  }, eyebrow)), /*#__PURE__*/React.createElement("h2", {
    style: {
      position: 'absolute',
      left: 80,
      top: 168,
      right: 80,
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 64,
      letterSpacing: '-0.015em',
      margin: 0,
      maxWidth: 1400
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      right: 80,
      top: 408,
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridAutoRows: '168px',
      gap: 24
    }
  }, partners.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    title: p.name,
    style: {
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.06)',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 40px'
    }
  }, (() => {
    const path = base + p.file;
    const src = window.__resources && window.__resources['partner_' + p.file] || path;
    return /*#__PURE__*/React.createElement("img", {
      src: src,
      alt: p.name,
      style: {
        height: p.h || 52,
        maxWidth: '72%',
        objectFit: 'contain',
        display: 'block'
      }
    });
  })()))), /*#__PURE__*/React.createElement(Footer, {
    n: n,
    note: ""
  }));
}

// ============ 12. TEAM / BIO ============
function TeamBioSlide({
  n = 12,
  eyebrow = 'Leadership',
  name = 'Elliott Parker',
  role = 'Founder & CEO',
  bio = 'Founder, investor, and former Managing Director at High Alpha and Principal at Innosight. Our team includes former Fortune 500 CVC leaders, engineers, designers, and founder/CEOs.',
  slotId = 'team-headshot'
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Team Bio`,
    style: {
      ...slideBase,
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: 110,
      width: 880
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 40
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "accent"
  }, eyebrow)), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 96,
      letterSpacing: '-0.02em',
      margin: 0,
      lineHeight: 1.0
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 500,
      fontSize: 34,
      color: '#2929E2',
      marginTop: 22
    }
  }, role), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: FONT,
      fontWeight: 300,
      fontSize: 30,
      lineHeight: 1.5,
      color: INK,
      marginTop: 44
    }
  }, bio)), /*#__PURE__*/React.createElement("image-slot", {
    id: slotId,
    shape: "rounded",
    radius: "12",
    placeholder: "Drop headshot",
    style: {
      position: 'absolute',
      right: 80,
      top: 110,
      width: 760,
      height: 860,
      borderRadius: 12,
      overflow: 'hidden',
      background: '#D9D6DB',
      display: 'block'
    }
  }), /*#__PURE__*/React.createElement(Footer, {
    n: n
  }));
}

// ============ 13. CLOSING ============
function ClosingSlide({
  n = 13,
  title = 'Think we should be building together?',
  contacts = [{
    h: 'Email',
    v: 'hello@alloypartners.com'
  }, {
    h: 'Web',
    v: 'alloypartners.com'
  }, {
    h: 'Office',
    v: 'Indianapolis · New York'
  }]
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": `${String(n).padStart(2, '0')} Closing`,
    style: {
      ...slideBase,
      background: '#000',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement(Diagonals, {
    color: "#2929E2",
    corner: "br",
    size: 900,
    opacity: 0.85
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 72,
      left: 80
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    light: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      top: 300,
      right: 700
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 36
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "dark"
  }, "Let\u2019s build")), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 104,
      lineHeight: 1.0,
      letterSpacing: '-0.025em',
      margin: 0
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 80,
      right: 80,
      bottom: 140,
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 48,
      paddingTop: 48,
      borderTop: '1px solid rgba(255,255,255,0.15)'
    }
  }, contacts.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 500,
      fontSize: 18,
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
      color: '#6CE3FF',
      marginBottom: 16
    }
  }, c.h), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT,
      fontWeight: 400,
      fontSize: 34
    }
  }, c.v)))), /*#__PURE__*/React.createElement(Footer, {
    n: n,
    dark: true,
    note: ""
  }));
}
Object.assign(window, {
  CoverSlide,
  SectionDivider,
  StatementSlide,
  HeadlineLeadSlide,
  NumberedListSlide,
  StatBandSlide,
  TwoBringsSlide,
  TermsSlide,
  TimelineSlide,
  CaseStudySlide,
  LogoWallSlide,
  TeamBioSlide,
  ClosingSlide
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/deck/slides.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/components.jsx
try { (() => {
// Alloy Partners — website components
// Cosmetic-only; factored for reuse. Shares ./components.jsx via window globals.

const {
  useState
} = React;

// ============ LAYOUT ============

function AccentBar({
  color = 'var(--alloy-azure)'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 10,
      background: color,
      width: '100%'
    }
  });
}
function SiteHeader({
  current,
  onNav
}) {
  const links = ['Home', 'Approach', 'Portfolio', 'Insights', 'Contact'];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 10,
      background: '#fff',
      borderBottom: '1px solid rgba(0,0,0,0.06)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: '0 auto',
      padding: '18px 40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 48
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => onNav('Home'),
    style: {
      cursor: 'pointer',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-black.svg",
    alt: "Alloy",
    style: {
      height: 22,
      width: 'auto',
      display: 'block'
    }
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 32
    }
  }, links.filter(l => l !== 'Home').map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    onClick: () => onNav(l),
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: 14,
      color: current === l ? '#2929E2' : '#000',
      textDecoration: 'none',
      cursor: 'pointer'
    }
  }, l)))), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNav('Contact'),
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: 13,
      padding: '10px 20px',
      borderRadius: 999,
      border: 'none',
      background: '#2929E2',
      color: '#fff',
      cursor: 'pointer'
    }
  }, "Get in touch")), /*#__PURE__*/React.createElement(AccentBar, null));
}

// ============ PRIMITIVES ============

function Eyebrow({
  children,
  muted,
  white,
  style
}) {
  const color = white ? '#fff' : muted ? '#7F7F7F' : '#2929E2';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color,
      marginBottom: 14,
      ...style
    }
  }, children);
}
function SectionNumber({
  n,
  title,
  dark
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 14,
      color: dark ? 'rgba(255,255,255,0.55)' : '#7F7F7F',
      letterSpacing: '0.04em',
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontVariantNumeric: 'tabular-nums'
    }
  }, String(n).padStart(2, '0')), "\xA0\xA0", title);
}
function Button({
  children,
  variant = 'primary',
  onClick,
  style
}) {
  const styles = {
    primary: {
      background: '#2929E2',
      color: '#fff',
      border: 'none'
    },
    azure: {
      background: '#3172F4',
      color: '#fff',
      border: 'none'
    },
    secondary: {
      background: 'transparent',
      color: '#000',
      border: '1px solid #000'
    },
    ghost: {
      background: 'transparent',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.4)'
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: 14,
      padding: '14px 26px',
      borderRadius: 999,
      cursor: 'pointer',
      ...styles,
      ...style
    }
  }, children);
}

// ============ HEROES ============

function HomeHero({
  onNav
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#F4F4F4',
      padding: '96px 40px 120px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Venture-building by startup rules"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: 80,
      lineHeight: 1.02,
      letterSpacing: '-0.02em',
      margin: 0,
      maxWidth: 1000
    }
  }, "We don't pick winners.", /*#__PURE__*/React.createElement("br", null), "We make them."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 19,
      lineHeight: 1.5,
      color: '#3A3A3A',
      marginTop: 32,
      maxWidth: 640
    }
  }, "Alloy co-creates and scales advantaged companies with corporations and entrepreneurs. 40+ companies built. 8+ studios. One playbook, run at scale."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 40
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => onNav('Approach')
  }, "Our approach"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => onNav('Portfolio')
  }, "See the portfolio"))));
}
function DarkHero({
  eyebrow,
  title,
  lede,
  num
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#000',
      color: '#fff',
      padding: '96px 40px 120px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: '0 auto'
    }
  }, num != null && /*#__PURE__*/React.createElement(SectionNumber, {
    n: num,
    title: eyebrow,
    dark: true
  }), num == null && /*#__PURE__*/React.createElement(Eyebrow, {
    white: true
  }, eyebrow), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: 68,
      lineHeight: 1.05,
      letterSpacing: '-0.015em',
      margin: 0,
      maxWidth: 1000
    }
  }, title), lede && /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 18,
      lineHeight: 1.55,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 28,
      maxWidth: 640
    }
  }, lede)));
}

// ============ CARDS ============

function FeatureCard({
  eyebrow,
  title,
  body,
  fill = 'light',
  icon
}) {
  const bg = {
    light: '#F4F4F4',
    mid: '#D9D6DB',
    grey: '#B0B2B8',
    dark: '#000'
  }[fill];
  const fg = fill === 'dark' ? '#fff' : '#000';
  const bodyFg = fill === 'dark' ? 'rgba(255,255,255,0.78)' : '#3A3A3A';
  const ebFg = fill === 'dark' ? '#6CE3FF' : '#2929E2';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 8,
      padding: 32,
      border: fill === 'light' ? '1px solid rgba(0,0,0,0.06)' : 'none',
      color: fg,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      minHeight: 220
    }
  }, icon && /*#__PURE__*/React.createElement("i", {
    className: `ph ${icon}`,
    style: {
      fontSize: 28,
      color: ebFg,
      marginBottom: 4
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: ebFg
    }
  }, eyebrow), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: 22,
      lineHeight: 1.2,
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 14,
      lineHeight: 1.6,
      color: bodyFg,
      margin: 0
    }
  }, body));
}
function StatCallout({
  eyebrow,
  stat,
  caption,
  highlight
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: highlight ? '#3172F4' : '#0a0a0a',
      border: highlight ? 'none' : '1px solid rgba(255,255,255,0.10)',
      borderRadius: 8,
      padding: '32px 24px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      minHeight: 200,
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: highlight ? '#fff' : '#6CE3FF'
    }
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 700,
      fontSize: 56,
      lineHeight: 1,
      color: '#fff',
      letterSpacing: '-0.01em'
    }
  }, stat), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 13,
      lineHeight: 1.5,
      color: 'rgba(255,255,255,0.75)'
    }
  }, caption));
}
function PortfolioTile({
  name,
  sector,
  launched,
  partner
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#F4F4F4',
      borderRadius: 8,
      padding: 28,
      border: '1px solid rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      cursor: 'pointer',
      minHeight: 200
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 8,
      background: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: 'DM Sans',
      fontWeight: 700,
      fontSize: 20
    }
  }, name.slice(0, 1)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: '#7F7F7F',
      marginBottom: 6
    }
  }, sector), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: 20,
      margin: 0,
      marginBottom: 8
    }
  }, name), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 13,
      lineHeight: 1.5,
      color: '#3A3A3A',
      margin: 0
    }
  }, "Built with ", partner)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Roboto Mono',
      fontSize: 11,
      color: '#7F7F7F'
    }
  }, launched));
}
function InsightCard({
  category,
  date,
  title,
  readTime
}) {
  return /*#__PURE__*/React.createElement("article", {
    style: {
      padding: '28px 0',
      borderTop: '1px solid #D9D6DB',
      display: 'flex',
      gap: 32,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 160
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: '#2929E2',
      marginBottom: 6
    }
  }, category), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Roboto Mono',
      fontSize: 12,
      color: '#7F7F7F'
    }
  }, date)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: 24,
      lineHeight: 1.25,
      margin: 0,
      marginBottom: 10
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 13,
      color: '#7F7F7F'
    }
  }, readTime, " \xB7 Read \u2192")));
}
function Quote({
  children,
  author,
  role
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#F4F4F4',
      padding: '100px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1000,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: 42,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
      color: '#000'
    }
  }, "\"", children, "\""), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 32,
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 999,
      background: '#000'
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: 15
    }
  }, author), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 13,
      color: '#7F7F7F'
    }
  }, role)))));
}
function CTABand({
  onNav
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#000',
      color: '#fff',
      padding: '80px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 40
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: 44,
      lineHeight: 1.1,
      letterSpacing: '-0.01em',
      margin: 0,
      maxWidth: 700
    }
  }, "Think we should be building together?"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => onNav('Contact')
  }, "Start a conversation")));
}
function Footer() {
  const cols = [{
    h: 'Alloy',
    items: ['About', 'Approach', 'Team', 'Careers']
  }, {
    h: 'Programs',
    items: ['Venture Studio', 'Portfolio', 'Insights', 'Press']
  }, {
    h: 'Contact',
    items: ['hello@alloypartners.com', 'LinkedIn', 'X / Twitter']
  }];
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: '#000',
      color: '#fff',
      padding: '72px 40px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr',
      gap: 40
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-white.svg",
    alt: "Alloy",
    style: {
      height: 34,
      width: 'auto',
      display: 'block'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 14,
      lineHeight: 1.55,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 16,
      maxWidth: 320
    }
  }, "We co-create and scale advantaged companies with corporations and entrepreneurs.")), cols.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.h
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: '#6CE3FF',
      marginBottom: 18
    }
  }, c.h), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, c.items.map(i => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 14,
      color: 'rgba(255,255,255,0.85)'
    }
  }, i)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 64,
      paddingTop: 24,
      borderTop: '1px solid rgba(255,255,255,0.10)',
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 12,
      color: 'rgba(255,255,255,0.55)'
    }
  }, /*#__PURE__*/React.createElement("div", null, "\xA9 2026 Alloy Partners"), /*#__PURE__*/React.createElement("div", null, "Indianapolis \xB7 New York"))));
}
Object.assign(window, {
  SiteHeader,
  AccentBar,
  Eyebrow,
  SectionNumber,
  Button,
  HomeHero,
  DarkHero,
  FeatureCard,
  StatCallout,
  PortfolioTile,
  InsightCard,
  Quote,
  CTABand,
  Footer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/components.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/pages.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Alloy Partners — website pages
// Expects components.jsx to be loaded first (exports via window globals).

function HomePage({
  onNav
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(HomeHero, {
    onNav: onNav
  }), /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#fff',
      padding: '100px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(SectionNumber, {
    n: 1,
    title: "Approach"
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: 44,
      lineHeight: 1.15,
      letterSpacing: '-0.01em',
      margin: 0,
      maxWidth: 900
    }
  }, "The atomic unit of innovation is an entrepreneur in a startup."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 48,
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(FeatureCard, {
    icon: "ph-handshake",
    eyebrow: "Aligned",
    title: "Skin in the game",
    body: "Shared outcomes, shared P&L. We build with our partners, not for them."
  }), /*#__PURE__*/React.createElement(FeatureCard, {
    icon: "ph-rocket-launch",
    eyebrow: "Builder-first",
    title: "40+ companies, 8+ studios",
    body: "Proof, not theory. We've been operating this playbook since 2015.",
    fill: "mid"
  }), /*#__PURE__*/React.createElement(FeatureCard, {
    icon: "ph-graph",
    eyebrow: "Alloyed",
    title: "Corporations + entrepreneurs",
    body: "Advantaged companies, built where both sides strengthen each other.",
    fill: "dark"
  })))), /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#000',
      padding: '80px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    white: true
  }, "Scaled organizations need a new growth lever"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: 36,
      lineHeight: 1.15,
      margin: 0,
      color: '#fff',
      maxWidth: 800
    }
  }, "Why incumbents are losing to startups."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginTop: 48
    }
  }, /*#__PURE__*/React.createElement(StatCallout, {
    eyebrow: "R & D",
    stat: "41\xD7",
    caption: "Decline in research productivity since 1930s"
  }), /*#__PURE__*/React.createElement(StatCallout, {
    eyebrow: "New",
    stat: "Startup",
    caption: "Creation",
    highlight: true
  }), /*#__PURE__*/React.createElement(StatCallout, {
    eyebrow: "CVC",
    stat: "4\xD7",
    caption: "Increase in early stage VC valuations over the past 10 years"
  }), /*#__PURE__*/React.createElement(StatCallout, {
    eyebrow: "M & A",
    stat: "2\xD7",
    caption: "Increase in acquisition prices over the past 10 years"
  })))), /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#F4F4F4',
      padding: '100px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(SectionNumber, {
    n: 2,
    title: "Portfolio"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 40
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: 40,
      letterSpacing: '-0.01em',
      margin: 0,
      maxWidth: 700,
      lineHeight: 1.15
    }
  }, "Built alongside the world's boldest operators."), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => onNav('Portfolio')
  }, "See all \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(PortfolioTile, {
    name: "Mendel",
    sector: "Health \xB7 Animal",
    launched: "Launched 2024",
    partner: "Elanco"
  }), /*#__PURE__*/React.createElement(PortfolioTile, {
    name: "Banyan",
    sector: "Fintech",
    launched: "Launched 2023",
    partner: "Huntington Bank"
  }), /*#__PURE__*/React.createElement(PortfolioTile, {
    name: "Nova",
    sector: "Health Systems",
    launched: "Launched 2024",
    partner: "Wellstar"
  }), /*#__PURE__*/React.createElement(PortfolioTile, {
    name: "Forge",
    sector: "Insurance",
    launched: "Launched 2022",
    partner: "Capital One"
  })))), /*#__PURE__*/React.createElement(CTABand, {
    onNav: onNav
  }));
}
function ApproachPage({
  onNav
}) {
  const steps = [{
    h: 'Co-diagnose',
    b: 'We sit with operators to find the real wedge — not the deck version. Typically 4–6 weeks.'
  }, {
    h: 'Co-design',
    b: 'Build the company thesis together. Founders identified. P&L modeled. Risks named and priced.'
  }, {
    h: 'Co-build',
    b: 'Stand up the company with a full operating team. Ship in 90 days, not 18 months.'
  }, {
    h: 'Co-scale',
    b: 'Capital, customers, and corporate infrastructure unlocked through the alloy of partners + entrepreneurs.'
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DarkHero, {
    num: 1,
    eyebrow: "Our Approach",
    title: "Venture building by startup rules, at corporate scale.",
    lede: "Four stages. One operating system. Built over a decade, run with skin in the game."
  }), /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#F4F4F4',
      padding: '100px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 20
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: '#2929E2'
    }
  }, String(i + 1).padStart(2, '0')), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: 22,
      margin: 0,
      lineHeight: 1.2
    }
  }, s.h), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 14,
      lineHeight: 1.6,
      color: '#3A3A3A',
      margin: 0
    }
  }, s.b)))))), /*#__PURE__*/React.createElement(Quote, {
    author: "Elliott Parker",
    role: "CEO, Alloy Partners"
  }, "In a world that sees disruptors and incumbents as adversaries, we believe they can win together."), /*#__PURE__*/React.createElement(CTABand, {
    onNav: onNav
  }));
}
function PortfolioPage({
  onNav
}) {
  const [filter, setFilter] = useState('All');
  const companies = [{
    name: 'Mendel',
    sector: 'Health · Animal',
    launched: '2024',
    partner: 'Elanco'
  }, {
    name: 'Banyan',
    sector: 'Fintech',
    launched: '2023',
    partner: 'Huntington Bank'
  }, {
    name: 'Nova',
    sector: 'Health Systems',
    launched: '2024',
    partner: 'Wellstar'
  }, {
    name: 'Forge',
    sector: 'Insurance',
    launched: '2022',
    partner: 'Capital One'
  }, {
    name: 'Atlas',
    sector: 'Pharma',
    launched: '2023',
    partner: 'Eli Lilly'
  }, {
    name: 'Meridian',
    sector: 'Fintech',
    launched: '2024',
    partner: 'SVB'
  }, {
    name: 'Orbit',
    sector: 'Health · Animal',
    launched: '2022',
    partner: 'Elanco'
  }, {
    name: 'Kiln',
    sector: 'Insurance',
    launched: '2024',
    partner: 'Capital One'
  }];
  const sectors = ['All', ...new Set(companies.map(c => c.sector))];
  const shown = filter === 'All' ? companies : companies.filter(c => c.sector === filter);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#F4F4F4',
      padding: '80px 40px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(SectionNumber, {
    n: 2,
    title: "Portfolio"
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: 60,
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      margin: 0
    }
  }, "40+ companies, built in alloy."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 48,
      flexWrap: 'wrap'
    }
  }, sectors.map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => setFilter(s),
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: 12,
      padding: '8px 16px',
      borderRadius: 999,
      border: filter === s ? 'none' : '1px solid rgba(0,0,0,0.15)',
      background: filter === s ? '#000' : 'transparent',
      color: filter === s ? '#fff' : '#000',
      cursor: 'pointer'
    }
  }, s))))), /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#F4F4F4',
      padding: '20px 40px 100px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16
    }
  }, shown.map(c => /*#__PURE__*/React.createElement(PortfolioTile, _extends({
    key: c.name
  }, c, {
    launched: `Launched ${c.launched}`
  })))))), /*#__PURE__*/React.createElement(CTABand, {
    onNav: onNav
  }));
}
function InsightsPage({
  onNav
}) {
  const posts = [{
    category: 'Playbook',
    date: 'Apr 2026',
    title: 'Why the CVC playbook is 20 years old and breaking.',
    readTime: '7 min'
  }, {
    category: 'Field Note',
    date: 'Mar 2026',
    title: 'Building a health-system venture in 90 days with Wellstar.',
    readTime: '12 min'
  }, {
    category: 'POV',
    date: 'Feb 2026',
    title: 'AI-native venture building isn\'t a tool change. It\'s a team change.',
    readTime: '9 min'
  }, {
    category: 'Interview',
    date: 'Jan 2026',
    title: 'Elliott Parker on why incumbents keep losing.',
    readTime: '18 min'
  }, {
    category: 'Playbook',
    date: 'Dec 2025',
    title: 'Speed to tangible impact: the 14-month benchmark.',
    readTime: '6 min'
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#fff',
      padding: '80px 40px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1000,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(SectionNumber, {
    n: 4,
    title: "Insights"
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: 56,
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      margin: 0
    }
  }, "Field notes from the studio floor."))), /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#fff',
      padding: '40px 40px 100px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1000,
      margin: '0 auto'
    }
  }, posts.map(p => /*#__PURE__*/React.createElement(InsightCard, _extends({
    key: p.title
  }, p))))), /*#__PURE__*/React.createElement(CTABand, {
    onNav: onNav
  }));
}
function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#F4F4F4',
      padding: '80px 40px 100px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 900,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(SectionNumber, {
    n: 5,
    title: "Contact"
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: 52,
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      margin: 0,
      maxWidth: 700
    }
  }, "Think we should be building together?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 17,
      lineHeight: 1.55,
      color: '#3A3A3A',
      marginTop: 24,
      maxWidth: 560
    }
  }, "We partner with corporations serious about venture building and operators serious about shipping."), submitted ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 40,
      padding: '32px 28px',
      borderRadius: 8,
      background: '#000',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      color: '#6CE3FF'
    }
  }, "Received"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: 20
    }
  }, "Thanks. Someone from Alloy's team will be in touch within two business days.")) : /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      setSubmitted(true);
    },
    style: {
      marginTop: 40,
      display: 'grid',
      gap: 20,
      maxWidth: 560
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Name",
    placeholder: "First and last"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Email",
    type: "email",
    placeholder: "you@company.com"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Company",
    placeholder: "Where you work"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "What are you thinking about?",
    as: "textarea",
    placeholder: "A program, a partnership, a problem to unstick\u2026"
  }), /*#__PURE__*/React.createElement(Button, {
    style: {
      justifySelf: 'flex-start'
    }
  }, "Send \u2192")))));
}
function Field({
  label,
  as = 'input',
  ...props
}) {
  const El = as;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: 12
    }
  }, label), /*#__PURE__*/React.createElement(El, _extends({}, props, {
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 300,
      fontSize: 15,
      padding: '14px 16px',
      border: '1px solid rgba(0,0,0,0.15)',
      borderRadius: 4,
      background: '#fff',
      outline: 'none',
      minHeight: as === 'textarea' ? 120 : undefined,
      resize: as === 'textarea' ? 'vertical' : undefined
    }
  })));
}
Object.assign(window, {
  HomePage,
  ApproachPage,
  PortfolioPage,
  InsightsPage,
  ContactPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/pages.jsx", error: String((e && e.message) || e) }); }

})();
