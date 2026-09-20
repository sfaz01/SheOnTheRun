/* ============================================================================
   MOTION — GSAP + ScrollTrigger + Lenis
   ----------------------------------------------------------------------------
   Everything in here is decoration. If the CDN is blocked, a library fails to
   load, or the visitor has asked for reduced motion, the page still reads
   exactly the same — nothing here is responsible for showing content.
   ========================================================================== */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COARSE = window.matchMedia("(pointer: coarse)").matches;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  /* ------------------------------------------------------------ lightbox -- */
  /* Built in rather than pulled in: it's 60 lines, and a dependency here would
     cost more than it saves. */
  var LB = (function () {
    var el, imgWrap, capEl, items = [], index = 0, lastFocus = null;

    function build() {
      el = document.createElement("div");
      el.className = "lightbox";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-label", "Photo viewer");
      el.innerHTML =
        '<button class="lb-close" type="button" aria-label="Close">&times;</button>' +
        '<button class="lb-nav lb-prev" type="button" aria-label="Previous photo">&#8592;</button>' +
        '<button class="lb-nav lb-next" type="button" aria-label="Next photo">&#8594;</button>' +
        '<div class="lb-stage"></div>' +
        '<p class="lb-cap measured"></p>';
      document.body.appendChild(el);
      imgWrap = $(".lb-stage", el);
      capEl = $(".lb-cap", el);
      $(".lb-close", el).addEventListener("click", close);
      $(".lb-prev", el).addEventListener("click", function () { go(-1); });
      $(".lb-next", el).addEventListener("click", function () { go(1); });
      el.addEventListener("click", function (e) { if (e.target === el) close(); });
      document.addEventListener("keydown", function (e) {
        if (!el.classList.contains("open")) return;
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
        if (e.key === "Tab") {
          var f = $$("button", el);
          var i = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
      });
    }

    function render() {
      var it = items[index];
      imgWrap.innerHTML = "";
      var img = new Image();
      img.src = it.src;
      img.alt = it.alt || "";
      img.decoding = "async";
      imgWrap.appendChild(img);
      capEl.textContent = it.caption || "";
      capEl.style.visibility = it.caption ? "visible" : "hidden";
      var multi = items.length > 1;
      $(".lb-prev", el).hidden = !multi;
      $(".lb-next", el).hidden = !multi;
    }

    function go(d) { index = (index + d + items.length) % items.length; render(); }

    function open(list, i) {
      if (!el) build();
      items = list; index = i;
      lastFocus = document.activeElement;
      render();
      el.classList.add("open");
      document.body.classList.add("locked");
      $(".lb-close", el).focus();
    }

    function close() {
      el.classList.remove("open");
      document.body.classList.remove("locked");
      imgWrap.innerHTML = "";
      if (lastFocus) lastFocus.focus();
    }

    return { open: open };
  })();

  /* The widest file the browser has been offered, so the viewer shows the
     full-size photograph rather than the thumbnail-sized one on the page. */
  function bestSrc(img) {
    var best = img.currentSrc || img.src, bestW = 0;
    (img.getAttribute("srcset") || "").split(",").forEach(function (part) {
      var bits = part.trim().split(/\s+/);
      var w = parseInt(bits[1], 10) || 0;
      if (bits[0] && w > bestW) { bestW = w; best = bits[0]; }
    });
    return best;
  }

  /* Any container marked data-lightbox turns its figures into a viewer. */
  $$("[data-lightbox]").forEach(function (group) {
    var figs = $$("figure", group).filter(function (f) { return $("img", f); });
    figs.forEach(function (f, i) {
      f.setAttribute("tabindex", "0");
      f.setAttribute("role", "button");
      f.setAttribute("aria-label", "Open photo" + (f.getAttribute("data-caption") ? ": " + f.getAttribute("data-caption") : ""));
      function fire(e) {
        if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        LB.open(figs.map(function (x) {
          var im = $("img", x);
          return {
            src: bestSrc(im),
            alt: im.getAttribute("alt") || "",
            caption: (x.querySelector("figcaption") || {}).textContent ||
                     x.getAttribute("data-caption") || ""
          };
        }), i);
      }
      f.addEventListener("click", fire);
      f.addEventListener("keydown", fire);
    });
  });

  /* ------------------------------------------------------- libraries in -- */
  function load(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  if (REDUCED) return;   /* everything below is motion; stop here. */

  var CDN = "https://cdnjs.cloudflare.com/ajax/libs/";
  var NPM = "https://cdn.jsdelivr.net/npm/";

  Promise.all([
    load(CDN + "gsap/3.12.5/gsap.min.js"),
    load(NPM + "lenis@1.1.18/dist/lenis.min.js").catch(function () { return null; })
  ])
    .then(function () { return load(CDN + "gsap/3.12.5/ScrollTrigger.min.js"); })
    .then(start)
    .catch(function () { /* no libraries, no motion — the page is fine */ });

  function start() {
    if (!window.gsap || !window.ScrollTrigger) return;
    var gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);
    var ST = window.ScrollTrigger;

    /* ---------------------------------------------------- smooth scroll -- */
    if (window.Lenis && !COARSE) {
      var lenis = new window.Lenis({
        duration: 0.85,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        wheelMultiplier: 1.05,
        touchMultiplier: 1.4,
        infinite: false
      });
      lenis.on("scroll", ST.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      document.documentElement.classList.add("lenis", "lenis-smooth", "lenis-on");

      /* In-page anchors have to go through Lenis or they fight each other. */
      document.addEventListener("click", function (e) {
        var a = e.target.closest('a[href^="#"], a[href*=".html#"]');
        if (!a) return;
        var hash = a.getAttribute("href").split("#")[1];
        var target = hash && document.getElementById(hash);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -88 });
        history.replaceState(null, "", "#" + hash);
      });
    }

    /* -------------------------------------------------- headline reveal -- */
    /* Words rise in sequence, like a field coming off the line. */
    $$("[data-split]").forEach(function (el) {
      if (el.dataset.splitDone) return;
      el.dataset.splitDone = "1";
      var html = el.innerHTML;
      el.innerHTML = html.replace(/(^|>)([^<]+)(?=<|$)/g, function (m, pre, text) {
        if (!text.trim()) return m;
        return pre + text.split(/(\s+)/).map(function (w) {
          return /^\s+$/.test(w) ? w : (w ? '<span class="w"><i>' + w + "</i></span>" : "");
        }).join("");
      });
      var words = el.querySelectorAll(".w > i");
      var base = { yPercent: 108, duration: 1.05, ease: "power3.out", stagger: 0.035 };

      /* A headline already on screen plays straight away. Waiting on a scroll
         trigger for something above the fold is how headlines end up stuck. */
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
        gsap.from(words, Object.assign({ delay: 0.12 }, base));
      } else {
        gsap.from(words, Object.assign({
          scrollTrigger: { trigger: el, start: "top 88%", once: true }
        }, base));
      }
    });

    /* Safety net: if anything ever leaves a headline mid-animation — a refresh
       at the wrong moment, a trigger that never fires — reveal it. Text is
       never allowed to be hidden by decoration. */
    (function rescue(tries) {
      $$("[data-split]").forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        el.querySelectorAll(".w > i").forEach(function (w) {
          var t = getComputedStyle(w).transform;
          if (t && t !== "none" && Math.abs(parseFloat(t.split(",")[5] || 0)) > 2) {
            gsap.to(w, { yPercent: 0, duration: .4, ease: "power2.out" });
          }
        });
      });
      if (tries > 0) setTimeout(function () { rescue(tries - 1); }, 1200);
    })(4);

    /* -------------------------------------------------------- parallax --- */
    $$("[data-parallax]").forEach(function (el) {
      var depth = parseFloat(el.getAttribute("data-parallax")) || 12;
      var img = el.querySelector("img") || el;
      gsap.fromTo(img,
        { yPercent: -depth / 2 },
        {
          yPercent: depth / 2, ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true }
        });
    });

    /* --------------------------------------------------- image unveils --- */
    $$("[data-reveal-img]").forEach(function (el) {
      gsap.fromTo(el,
        { clipPath: "inset(0% 0% 100% 0%)" },
        {
          clipPath: "inset(0% 0% 0% 0%)", duration: 1.15, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true }
        });
    });

    /* ------------------------------------------------------- counters ---- */
    $$("[data-count]").forEach(function (el) {
      var end = parseFloat(el.getAttribute("data-count"));
      var suffix = el.getAttribute("data-count-suffix") || "";
      /* Zero-pad the counted run so a figure split across static and animated
         digits (the "20" + "17" of a year) never shows a ragged width. */
      var pad = parseInt(el.getAttribute("data-count-pad"), 10) || 0;
      var o = { v: 0 };
      gsap.to(o, {
        v: end, duration: 1.6, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
        onUpdate: function () {
          var t = String(Math.round(o.v));
          while (t.length < pad) { t = "0" + t; }
          el.textContent = t + suffix;
        }
      });
    });

    /* --------------------------------------- pinned horizontal gallery --- */
    $$("[data-hscroll]").forEach(function (section) {
      var track = section.querySelector(".hs-track");
      if (!track) return;
      if (window.innerWidth < 760) return;          /* phones just swipe it */
      var distance = function () { return Math.max(0, track.scrollWidth - window.innerWidth + 80); };
      var barFill = section.querySelector(".hs-bar-fill");
      gsap.to(track, {
        x: function () { return -distance(); },
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top 12%",
          end: function () { return "+=" + Math.round(distance() * 0.85); },
          pin: true,
          scrub: 0.4,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: function (self) {
            if (barFill) {
              var p = Math.round(self.progress * 100);
              barFill.style.width = Math.max(12, p) + "%";
            }
          }
        }
      });
    });

    /* -------------------------------------- sticky timeline image swap --- */
    var tlStage = $("[data-tl-stage]");
    if (tlStage) {
      var frames = $$("[data-tl-frame]", tlStage);
      $$("[data-tl-year]").forEach(function (item, i) {
        ST.create({
          trigger: item,
          start: "top 62%",
          end: "bottom 38%",
          onToggle: function (self) {
            if (!self.isActive) return;
            frames.forEach(function (f, j) {
              gsap.to(f, { autoAlpha: j === i ? 1 : 0, duration: .5, ease: "power2.out" });
              f.style.zIndex = j === i ? 2 : 1;
            });
          }
        });
      });
    }

    /* ------------------------------------------------ header hide/show --- */
    var header = $(".site-header");
    if (header) {
      var last = 0;
      ST.create({
        start: 0, end: "max",
        onUpdate: function (self) {
          var y = self.scroll();
          if (y > 420 && y > last) header.classList.add("tucked");
          else header.classList.remove("tucked");
          last = y;
        }
      });
    }

    /* Lay everything out once fonts and images have settled. */
    window.addEventListener("load", function () { ST.refresh(); });
    if (document.fonts) document.fonts.ready.then(function () { ST.refresh(); });
  }
})();
