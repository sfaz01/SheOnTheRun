/* ============================================================================
   FATIMA MOUZAHEM — site behaviour
   No framework, no build step. Everything reads from /data/*.js.
   ========================================================================== */
(function () {
  "use strict";

  var CFG      = window.SITE || {};
  var RUNS     = window.SITE_RUNS || { recurring: null, events: [] };
  var OFFER    = window.SITE_OFFER || { services: [], packages: [], steps: [] };
  var SHOP     = window.SITE_SHOP || { categories: [] };
  var QUOTES   = window.SITE_TESTIMONIALS || [];
  var POSTS    = window.SITE_POSTS || [];
  var PUBS     = window.SITE_PUBLICATIONS || [];
  var TOPICS   = window.SITE_RESEARCH_INTERESTS || [];

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------- helpers -- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* -------------------------------------------------- contact link builder -- */
  var RAW_WA = String(CFG.whatsapp || "");
  var WA_DIGITS = RAW_WA.replace(/\D/g, "");
  var WA_READY = WA_DIGITS.length >= 8;

  var RAW_EMAIL = String(CFG.email || "");
  var EMAIL_READY = /^[^\s@\[]+@[^\s@\]]+\.[^\s@\]]+$/.test(RAW_EMAIL);

  var IS_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === "file:";

  var isJournal = !document.querySelector("base[data-root]") &&
                  window.location.pathname.indexOf("/journal/") !== -1;
  /* Pages one folder down (the Journal, the Arabic site) reach the root with
     "../". A page can also say so itself with <html data-root="../">. */
  var rootRel = document.documentElement.getAttribute("data-root") || (isJournal ? "../" : "");

  /* Every booking button on the site comes through here. If the number isn't
     configured yet the button still works — it lands on Connect with the right
     interest pre-selected — so the site is never broken while she sets it up. */
  function waLink(message, interest) {
    if (WA_READY) return "https://wa.me/" + WA_DIGITS + "?text=" + encodeURIComponent(message);
    return rootRel + "connect.html?interest=" + encodeURIComponent(interest || "nutrition") +
           "&note=" + encodeURIComponent(message);
  }

  /* Consultations and packages go to a real calendar once she has one; until
     then they fall back to WhatsApp like everything else. */
  var BOOK_URL = /^https:\/\//.test(String(CFG.bookingUrl || "")) ? CFG.bookingUrl : "";
  function bookLink(message, interest) { return BOOK_URL || waLink(message, interest); }
  function bookAttrs() { return BOOK_URL || WA_READY ? ' target="_blank" rel="noopener"' : ""; }

  function mailLink(subject, body) {
    if (!EMAIL_READY) return rootRel + "connect.html";
    return "mailto:" + RAW_EMAIL +
           "?subject=" + encodeURIComponent(subject || "") +
           "&body=" + encodeURIComponent(body || "");
  }

  function bookingMessage(what, mode) {
    var where = mode === "online" ? "online" : mode === "in-person" ? "in person" : "";
    return "Hi Fatima! I'd like to book " + what + (where ? ", " + where : "") +
           ". I found you through your website.";
  }

  /* --------------------------------------------------------------- media -- */
  var IMAGES = window.SITE_IMAGES || {};
  var IMG_BASE = rootRel + "public/images/";

  /* Every photograph goes through here: WebP with a JPEG fallback, the right
     width for the device, and alt text pulled from the image library so it is
     written once and never drifts. */
  function pic(name, opt) {
    opt = opt || {};
    var m = IMAGES[name];
    if (!m) return "";
    var widths = m.w;
    var biggest = widths[widths.length - 1];
    var sizes = opt.sizes || "(min-width: 900px) 45vw, 92vw";
    var alt = opt.alt != null ? opt.alt : m.alt;

    function set(ext) {
      return widths.map(function (w) {
        return IMG_BASE + name + "-" + w + "." + ext + " " + w + "w";
      }).join(", ");
    }

    return '<picture>' +
      '<source type="image/webp" srcset="' + set("webp") + '" sizes="' + esc(sizes) + '">' +
      '<img src="' + IMG_BASE + name + "-" + biggest + '.jpg" srcset="' + set("jpg") +
        '" sizes="' + esc(sizes) + '" alt="' + esc(alt) +
        '" width="' + biggest + '" height="' + Math.round(biggest / m.r) + '"' +
        (opt.eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"') +
      '></picture>';
  }

  /* A photograph if we have one; a designed lane plate if we don't.
     Never a stock photo. */
  function media(name, altOverride, ratioClass, caption, sizes) {
    var r = ratioClass || "r-45";
    if (name && IMAGES[name]) {
      return '<div class="fig ' + r + '" data-reveal-img>' +
             pic(name, { alt: altOverride, sizes: sizes }) + "</div>";
    }
    return '<div class="ph ' + r + '"><span class="ph-cap">' + esc(caption || "Photo to come") + "</span></div>";
  }

  /* Static markup writes <div class="fig r-x" data-img="slot-name"></div> and
     this fills it, so pages stay readable and alt text stays in one place. */
  $$("[data-img]").forEach(function (el) {
    var name = el.getAttribute("data-img");
    if (!IMAGES[name]) {
      el.className = el.className.replace("fig", "ph");
      el.innerHTML = '<span class="ph-cap">' + esc(el.getAttribute("data-cap") || "Photo to come") + "</span>";
      return;
    }
    el.innerHTML = pic(name, {
      sizes: el.getAttribute("data-sizes") || undefined,
      alt: el.getAttribute("data-alt") || undefined,
      eager: el.hasAttribute("data-eager")
    });
  });

  function swapToPlaceholder(img) {
    var fig = img.closest(".fig");
    if (!fig) return;
    var ratio = (fig.className.match(/\br-[\w]+\b/) || ["r-45"])[0];
    var ph = document.createElement("div");
    ph.className = "ph " + ratio;
    ph.innerHTML = '<span class="ph-cap">' + esc(img.getAttribute("data-fallback") || "Photo to come") + "</span>";
    fig.replaceWith(ph);
  }

  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.hasAttribute("data-fallback")) swapToPlaceholder(t);
  }, true);

  /* This script is deferred, so some images may already have failed before the
     listener above existed. Sweep for those, now and once more on full load. */
  function sweepBrokenImages() {
    $$("img[data-fallback]").forEach(function (img) {
      if (img.complete && img.naturalWidth === 0) swapToPlaceholder(img);
    });
  }
  sweepBrokenImages();
  window.addEventListener("load", sweepBrokenImages);

  /* ------------------------------------------------------- Beirut clock -- */
  /* Events hide themselves once they're over, on Beirut wall-clock time,
     wherever in the world the visitor happens to be. */
  function beirutNowKey() {
    try {
      var p = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Beirut", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false
      }).formatToParts(new Date()).reduce(function (o, x) { o[x.type] = x.value; return o; }, {});
      var hh = p.hour === "24" ? "00" : p.hour;
      return p.year + "-" + p.month + "-" + p.day + "T" + hh + ":" + p.minute;
    } catch (err) {
      var d = new Date();
      return d.toISOString().slice(0, 16);
    }
  }

  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  function parseLocal(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(s || ""));
    if (!m) return null;
    return {
      y: +m[1], mo: +m[2], d: +m[3], h: m[4] ? +m[4] : 0, mi: m[5] ? +m[5] : 0,
      weekday: DAYS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]
    };
  }

  function timeLabel(p) {
    if (p.h === 0 && p.mi === 0) return "";
    var h12 = p.h % 12 === 0 ? 12 : p.h % 12;
    return h12 + ":" + String(p.mi).padStart(2, "0") + " " + (p.h < 12 ? "AM" : "PM");
  }

  function dateLong(s) {
    var p = parseLocal(s);
    if (!p) return "";
    return p.d + " " + MONTHS[p.mo - 1] + " " + p.y;
  }

  /* ------------------------------------------------------------- header -- */
  var header = $(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("stuck", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var menuBtn = $(".menu-btn");
  var drawer = $(".drawer");
  if (menuBtn && drawer) {
    var setDrawer = function (open) {
      menuBtn.setAttribute("aria-expanded", String(open));
      drawer.hidden = !open;
      document.body.classList.toggle("locked", open);
    };
    menuBtn.addEventListener("click", function () {
      setDrawer(menuBtn.getAttribute("aria-expanded") !== "true");
    });
    drawer.addEventListener("click", function (e) {
      if (e.target.closest("a")) setDrawer(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") {
        setDrawer(false); menuBtn.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1040) setDrawer(false);
    });
  }

  /* --------------------------------------------- current page in the nav -- */
  (function () {
    function norm(p) {
      p = String(p || "").split("#")[0].split("?")[0].replace(/\/index\.html$/, "/");
      if (p.length > 1) p = p.replace(/\/$/, "");
      return p || "/";
    }
    var here = norm(location.pathname);
    $$("[data-nav] a").forEach(function (a) {
      if (norm(a.pathname) === here) a.setAttribute("aria-current", "page");
    });
  })();

  /* ----------------------------------------------------- reveal on scroll -- */
  function observeReveals(root) {
    var els = $$(".reveal:not(.in)", root || document);
    if (!els.length) return;
    if (REDUCED || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    els.forEach(function (el, i) {
      if (!el.style.getPropertyValue("--delay")) {
        el.style.setProperty("--delay", Math.min(i % 6, 5) * 55 + "ms");
      }
      io.observe(el);
    });
  }

  /* Safety net. Anything already on screen gets revealed outright rather than
     waiting on the observer — so landing on #packages never shows a blank
     section, and a browser that mishandles IntersectionObserver still reads. */
  function revealInView() {
    $$(".reveal:not(.in)").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("in");
    });
  }
  window.addEventListener("load", revealInView);
  window.addEventListener("hashchange", function () { setTimeout(revealInView, 60); });
  setTimeout(revealInView, 900);

  /* ================================================================== RENDER
     Each block below only runs if its container is on the page.
     ====================================================================== */

  /* ----------------------------------------------------- 1. THE SWITCH -- */
  var mode = "in-person";
  var switchEl = $("[data-switch]");

  function positionThumb() {
    if (!switchEl) return;
    var thumb = $(".thumb", switchEl);
    var active = $('button[aria-pressed="true"]', switchEl);
    if (!thumb || !active) return;
    thumb.style.width = active.offsetWidth + "px";
    thumb.style.transform = "translateX(" + (active.offsetLeft - 4) + "px)";
  }

  function setMode(next) {
    mode = next;
    if (switchEl) {
      $$("button", switchEl).forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === next));
      });
      positionThumb();
    }
    $$("[data-mode-note]").forEach(function (el) {
      el.textContent = next === "online"
        ? "For those who prefer the flexibility of working together from wherever they are."
        : "For those who prefer face-to-face support and a more hands-on consultation experience.";
    });
    renderServices();
    renderPackages();
    try { history.replaceState(null, "", "#" + next); } catch (e) {}
  }

  if (switchEl) {
    switchEl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-mode]");
      if (b) setMode(b.getAttribute("data-mode"));
    });
    window.addEventListener("resize", positionThumb);
    if (location.hash === "#online") mode = "online";
  }

  /* ---------------------------------------------------- 2. CORE SERVICES -- */
  function renderServices() {
    var host = $("[data-services]");
    if (!host) return;
    var list = OFFER.services.filter(function (s) {
      return (s.modes || ["in-person", "online"]).indexOf(mode) > -1;
    });

    host.innerHTML = list.map(function (s) {
      var msg = bookingMessage("the " + s.title, mode);
      return '' +
      '<article class="service reveal" id="' + esc(s.id) + '">' +
        '<div class="s-top">' +
          '<span class="measured">' + esc(s.number) + "</span>" +
          '<span class="measured">' + (mode === "online" ? "Online" : "In person") + "</span>" +
        "</div>" +
        "<h3>" + esc(s.title) + "</h3>" +
        (s.tagline ? '<p class="s-tag">' + esc(s.tagline) + "</p>" : "") +
        '<p class="s-best"><b>Best for</b> — ' + esc(s.bestFor) + "</p>" +
        '<ul class="s-inc">' + (s.includes || []).map(function (i) {
          return "<li>" + esc(i) + "</li>";
        }).join("") + "</ul>" +
        '<dl class="s-meta">' +
          '<div class="s-row"><dt>Duration</dt><dd>' + esc(s.duration) + "</dd></div>" +
          '<div class="s-row"><dt>Format</dt><dd>' + (mode === "online" ? "Video call" : "Beirut clinic") + "</dd></div>" +
        "</dl>" +
        '<span class="price"><sup>$</sup>' + esc(s.price) + "</span>" +
        '<a class="btn block" href="' + esc(bookLink(msg, "nutrition")) + '"' + bookAttrs() + ">" +
          esc(s.cta) + ' <span class="arw" aria-hidden="true">→</span></a>' +
      "</article>";
    }).join("");

    var missing = OFFER.services.filter(function (s) {
      return (s.modes || []).indexOf(mode) === -1;
    });
    var noteEl = $("[data-services-note]");
    if (noteEl) {
      noteEl.innerHTML = missing.length && mode === "online"
        ? '<p class="only-inperson">' + esc(missing.map(function (s) { return s.title; }).join(", ")) +
          " is available in person only — it needs the analyser in the clinic.</p>"
        : "";
    }
    observeReveals(host);
  }

  /* --------------------------------------------------------- 3. PACKAGES -- */
  function renderPackages() {
    var host = $("[data-packages]");
    if (!host) return;

    host.innerHTML = OFFER.packages.map(function (p) {
      var inc = (p.includes || []).slice();
      if (mode === "online") {
        (p.omitOnline || []).forEach(function (line) {
          var i = inc.indexOf(line);
          if (i > -1) inc.splice(i, 1);
        });
        (p.addOnline || []).forEach(function (line, n) {
          if (inc.indexOf(line) === -1) inc.splice(Math.min(n + 1, inc.length), 0, line);
        });
      }
      var msg = bookingMessage(p.name + " package (" + p.length + ")", mode);
      return '' +
      '<article class="pack reveal' + (p.featured ? " is-featured" : "") + '" id="' + esc(p.id) + '">' +
        (p.featured && p.badge ? '<span class="p-badge">' + esc(p.badge) + "</span>" : "") +
        '<span class="measured p-len">' + esc(p.length) + "</span>" +
        "<h3>" + esc(p.name) + "</h3>" +
        '<p class="p-line">' + esc(p.line) + "</p>" +
        '<p class="p-price"><sup>$</sup>' + esc(p.price) + "</p>" +
        '<ul class="p-inc">' + inc.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>" +
        '<a class="btn' + (p.featured ? "" : " ghost") + ' block" href="' + esc(bookLink(msg, "nutrition")) + '"' + bookAttrs() + ">" +
          "Book " + esc(p.name) + ' <span class="arw" aria-hidden="true">→</span></a>' +
      "</article>";
    }).join("");
    observeReveals(host);
  }

  /* ------------------------------------------------------ 3b. FIND YOUR FIT */
  /* A few questions, one at a time, ending on a single recommendation with a
     booking button — the "which one do I pick?" answered before it's asked. */
  (function () {
    var host = $("[data-fit]");
    var FIT = OFFER.fit;
    if (!host || !FIT) return;

    var answers = {};

    function find(id) {
      if (id === "challenge" && OFFER.challenge) return { kind: "challenge", item: OFFER.challenge };
      var s = OFFER.services.filter(function (x) { return x.id === id; })[0];
      if (s) return { kind: "service", item: s };
      var p = OFFER.packages.filter(function (x) { return x.id === id; })[0];
      return p ? { kind: "package", item: p } : null;
    }

    /* Which questions apply depends on earlier answers: the "been here before?"
       question only matters for a single session, and the group challenge is
       online, so it skips the format question. */
    function flow() {
      var q = [
        { key: "goal", data: FIT.goal },
        { key: "support", data: FIT.support }
      ];
      if (answers.support === "one" && FIT.returning) q.push({ key: "returning", data: FIT.returning });
      if (answers.support !== "group") q.push({
        key: "format",
        data: { question: "Where would you like to meet?", options: [
          { id: "in-person", label: "In person, in Beirut" },
          { id: "online", label: "Online, by video call" }
        ] }
      });
      return q;
    }

    function opt(list, id) { return (list || []).filter(function (o) { return o.id === id; })[0] || {}; }

    function lanes(step, total) {
      var out = "";
      for (var i = 0; i < total; i++) out += '<i class="' + (i < step ? "on" : "") + '"></i>';
      return '<div class="fit-lanes" aria-hidden="true">' + out + "</div>";
    }

    function renderStep(i) {
      var q = flow();
      if (i >= q.length) return renderResult();
      var cur = q[i];
      host.innerHTML =
        '<div class="fit-q" data-step="' + i + '">' +
          '<div class="fit-top"><span class="measured">Question ' + (i + 1) + " of " + q.length + "</span>" +
            lanes(i, q.length) + "</div>" +
          '<h3 class="fit-question" tabindex="-1">' + esc(cur.data.question) + "</h3>" +
          '<div class="fit-opts" role="group" aria-label="' + esc(cur.data.question) + '">' +
            cur.data.options.map(function (o) {
              var chosen = answers[cur.key] === o.id;
              return '<button type="button" class="fit-opt" data-key="' + esc(cur.key) + '" data-val="' + esc(o.id) +
                '" aria-pressed="' + chosen + '"><span>' + esc(o.label) + '</span><span class="arw" aria-hidden="true">→</span></button>';
            }).join("") +
          "</div>" +
          (i > 0 ? '<button type="button" class="fit-back tlink" data-back="' + (i - 1) + '"><span class="arw" aria-hidden="true">←</span> Back</button>' : "") +
        "</div>";
    }

    function renderResult() {
      var sup = opt(FIT.support.options, answers.support);
      var pickId = sup.pick;
      if (answers.support === "one" && answers.returning) {
        pickId = opt(FIT.returning.options, answers.returning).pick || pickId;
      }
      var found = find(pickId);
      if (!found) { renderStep(0); return; }
      var it = found.item;
      var mode = answers.format || "online";
      var goal = opt(FIT.goal.options, answers.goal);

      var inc = (it.includes || []).slice();
      if (mode === "online") {
        (it.omitOnline || []).forEach(function (l) { var k = inc.indexOf(l); if (k > -1) inc.splice(k, 1); });
        (it.addOnline || []).forEach(function (l, n) { if (inc.indexOf(l) === -1) inc.splice(Math.min(n + 1, inc.length), 0, l); });
      }

      var name = it.title || it.name;
      var length = it.duration || it.length || it.dates || "";
      var where = found.kind === "challenge" ? "Online, in a group" : mode === "online" ? "Online" : "In person, Beirut";
      var msg = found.kind === "challenge"
        ? "Hi Fatima! I'd like to join " + name + ". The quiz on your website suggested it."
        : bookingMessage((found.kind === "package" ? name + " package" : "the " + name), mode).replace(
            ". I found you through your website.", ". The quiz on your website suggested it.");
      var href = found.kind === "challenge" ? waLink(msg, "nutrition") : bookLink(msg, "nutrition");
      var attrs = found.kind === "challenge" ? waAttrs() : bookAttrs();

      /* Body composition needs the clinic, so an online visitor never gets
         recommended it. Nothing in the quiz picks it today — this keeps it so. */
      host.innerHTML =
        '<div class="fit-result" role="status">' +
          '<div class="fit-top"><span class="measured">Your best fit</span>' + lanes(4, 4) + "</div>" +
          '<h3 class="fit-name" tabindex="-1">' + esc(name) + "</h3>" +
          '<p class="fit-why">' + (goal.why ? "Because " + esc(goal.why) + "." : "") + "</p>" +
          '<dl class="fit-meta">' +
            '<div><dt>Price</dt><dd>$' + esc(it.price) + (it.priceNote ? " " + esc(it.priceNote) : "") + "</dd></div>" +
            (length ? "<div><dt>" + (found.kind === "service" ? "Length" : "Runs") + "</dt><dd>" + esc(length) + "</dd></div>" : "") +
            "<div><dt>Where</dt><dd>" + esc(where) + "</dd></div>" +
          "</dl>" +
          '<ul class="fit-inc">' + inc.slice(0, 5).map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" +
          '<div class="row mt-m">' +
            '<a class="btn lg" href="' + esc(href) + '"' + attrs + ">" +
              (found.kind === "challenge" ? "Join " : "Book ") + esc(name) + ' <span class="arw" aria-hidden="true">→</span></a>' +
            '<a class="btn ghost lg" href="' + esc(BOOK_URL || waLink("Hi Fatima! I'd like to book the free 15-minute discovery call.", "nutrition")) + '"' + bookAttrs() + ">Talk it through first — free</a>" +
          "</div>" +
          '<button type="button" class="fit-back tlink mt-m" data-restart><span class="arw" aria-hidden="true">↺</span> Start again</button>' +
        "</div>";

      /* The services and packages below follow the answer. */
      if (answers.format && switchEl) setMode(answers.format);
      var h = $(".fit-name", host);
      if (h) h.focus({ preventScroll: true });
    }

    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-val]");
      if (b) {
        answers[b.getAttribute("data-key")] = b.getAttribute("data-val");
        if (b.getAttribute("data-key") === "support") { delete answers.returning; }
        var step = +b.closest("[data-step]").getAttribute("data-step");
        renderStep(step + 1);
        var q = $(".fit-question", host);
        if (q) q.focus({ preventScroll: true });
        return;
      }
      var back = e.target.closest("[data-back]");
      if (back) { renderStep(+back.getAttribute("data-back")); return; }
      if (e.target.closest("[data-restart]")) { answers = {}; renderStep(0); }
    });

    renderStep(0);
  })();

  function waAttrs() {
    return WA_READY ? ' target="_blank" rel="noopener"' : "";
  }

  /* ------------------------------------------------------- 4. HOW IT WORKS */
  (function () {
    var host = $("[data-steps]");
    if (!host) return;
    host.innerHTML = (OFFER.steps || []).map(function (s) {
      return '<div class="step reveal"><span class="measured">' + esc(s.n) + "</span>" +
             "<h3>" + esc(s.title) + "</h3><p>" + esc(s.body) + "</p></div>";
    }).join("");
  })();

  /* ------------------------------------------------------- 5. THE CHALLENGE */
  (function () {
    var host = $("[data-challenge]");
    if (!host || !OFFER.challenge) return;
    var c = OFFER.challenge;
    var msg = "Hi Fatima! I'd like to join " + c.name + ", the 6-week group nutrition challenge. I found it on your website.";
    host.innerHTML = '' +
      '<div class="challenge-grid">' +
        "<div>" +
          '<span class="measured on-deep">' + esc(c.kicker) + " · " + esc(c.dates) + "</span>" +
          "<h2 class=\"mt-s\">" + esc(c.name) + "</h2>" +
          '<p class="lede mt-s">' + esc(c.line) + " " + esc(c.body) + "</p>" +
        "</div>" +
        "<div>" +
          '<p class="c-price"><sup>$</sup>' + esc(c.price) + "</p>" +
          '<p class="measured on-deep">' + esc(c.priceNote) + "</p>" +
          '<ul class="c-inc">' + (c.includes || []).map(function (i) {
            return "<li>" + esc(i) + "</li>";
          }).join("") + "</ul>" +
          '<a class="btn on-deep mt-m" href="' + esc(waLink(msg, "nutrition")) + '"' + waAttrs() + ">" +
            esc(c.cta) + ' <span class="arw" aria-hidden="true">→</span></a>' +
        "</div>" +
      "</div>";
  })();

  /* -------------------------------------------------------- 6. TESTIMONIALS */
  (function () {
    var host = $("[data-quotes]");
    if (!host) return;
    var section = host.closest("[data-quotes-section]") || host;
    /* Sample quotes are layout filler. They show on a local preview, labelled,
       and never on the live site. */
    var list = QUOTES.filter(function (q) { return !q.sample || IS_LOCAL; });
    if (!list.length) { section.remove(); return; }
    host.innerHTML = list.map(function (q) {
      return '<figure class="quote reveal">' +
        (q.sample ? '<span class="q-sample">Sample — replace before launch</span>' : "") +
        "<blockquote>" + esc(q.quote) + "</blockquote>" +
        '<figcaption><span class="q-name">' + esc(q.name) + "</span>" +
        '<span class="measured q-detail">' + esc(q.detail) + "</span></figcaption>" +
      "</figure>";
    }).join("");
  })();

  /* ---------------------------------------------------------------- 6b. FAQ */
  (function () {
    var host = $("[data-faq]");
    if (!host) return;
    var FAQ = window.SITE_FAQ || [];
    if (!FAQ.length) { (host.closest("[data-faq-section]") || host).remove(); return; }
    host.innerHTML = FAQ.map(function (f, i) {
      return '<details class="faq-item"' + (i === 0 ? " open" : "") + ">" +
        "<summary><span>" + esc(f.q) + '</span><span class="e-sign" aria-hidden="true"></span></summary>' +
        '<div class="faq-a"><p>' + esc(f.a) + "</p></div></details>";
    }).join("");
    /* The same answers, as structured data for search engines. */
    var ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: FAQ.map(function (f) {
        return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } };
      })
    });
    document.head.appendChild(ld);
  })();

  /* ----------------------------------------------------- 7. RUNS & EVENTS -- */
  (function () {
    var host = $("[data-events]");
    if (!host) return;
    var now = beirutNowKey();
    var upcoming = (RUNS.events || [])
      .filter(function (e) { return String(e.ends || e.starts || "") >= now; })
      .sort(function (a, b) { return String(a.starts).localeCompare(String(b.starts)); });

    var max = parseInt(host.getAttribute("data-events"), 10);
    if (max > 0) upcoming = upcoming.slice(0, max);

    if (!upcoming.length) {
      host.classList.remove("events");
      host.innerHTML = '<div class="empty"><p class="measured">Nothing on the calendar</p>' +
        '<p class="mt-s">The next runs are being set. Message me and I\'ll tell you the moment they\'re up — ' +
        "or just come to a sunset run, Tuesdays and Thursdays.</p>" +
        '<a class="btn mt-m" href="' + esc(waLink("Hi Fatima! I'd like to know when the next SheOnTheRun runs are.", "sheontherun")) +
        '"' + waAttrs() + '>Ask about the next run <span class="arw" aria-hidden="true">→</span></a></div>';
      return;
    }

    host.innerHTML = upcoming.map(function (e) {
      var p = parseLocal(e.starts);
      var t = p ? timeLabel(p) : "";
      var isRange = e.ends && String(e.ends).slice(0, 10) !== String(e.starts).slice(0, 10);
      var dateBlock = isRange
        ? '<span class="e-date">' + esc(p.d + " " + MONTHS[p.mo - 1]) +
          "<small>→ " + esc(dateLong(e.ends).replace(/ \d{4}$/, "")) + "</small></span>"
        : '<span class="e-date">' + esc(p.d + " " + MONTHS[p.mo - 1]) +
          "<small>" + esc(p.weekday + (t ? " · " + t : "")) + "</small></span>";

      var msg = e.kind === "challenge"
        ? "Hi Fatima! I'd like to join " + e.title + ". I found it on your website."
        : "Hi Fatima! I'd like to join the " + e.title + " on " + dateLong(e.starts) + ".";

      return '<article class="event reveal' + (e.featured ? " is-featured" : "") + '">' +
        dateBlock +
        "<div><h3>" + esc(e.title) + "</h3>" +
          (e.detail ? '<p class="e-detail">' + esc(e.detail) + "</p>" : "") +
          '<p class="measured e-where">' + esc(e.place) + (e.note ? " · " + esc(e.note) : "") + "</p>" +
          (typeof e.spots === "number"
            ? '<p class="e-spots' + (e.spots <= 3 ? " low" : "") + '">' +
              (e.spots > 0 ? esc(e.spots) + (e.spots === 1 ? " place" : " places") + " left" : "Fully booked — ask for the waitlist") + "</p>"
            : "") +
          (e.kind !== "challenge" ? calLinks(e) : "") +
        "</div>" +
        (e.link
          ? '<a class="btn ghost sm" href="' + esc(/^(https?:|#|\.\.\/)/.test(e.link) ? e.link : rootRel + e.link) + '">Details <span class="arw" aria-hidden="true">→</span></a>'
          : '<a class="btn ghost sm" href="' + esc(waLink(msg, "sheontherun")) + '"' + waAttrs() +
            '>Join <span class="arw" aria-hidden="true">→</span></a>') +
      "</article>";
    }).join("");
  })();

  /* Add-to-calendar, in Beirut time wherever the visitor's phone is set. */
  function calStamp(s) { return String(s || "").replace(/[-:]/g, "") + "00"; }
  function calLinks(e) {
    if (!e.starts) return "";
    var end = e.ends || e.starts;
    var g = "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(e.title) +
      "&dates=" + calStamp(e.starts) + "/" + calStamp(end) +
      "&ctz=Asia/Beirut" +
      "&details=" + encodeURIComponent((e.detail || "") + " — SheOnTheRun") +
      "&location=" + encodeURIComponent(e.place || "");
    return '<p class="e-cal"><span class="measured">Add to calendar</span> ' +
      '<a href="' + esc(g) + '" target="_blank" rel="noopener">Google</a> · ' +
      '<a href="#" data-ics="' + esc(e.id || "") + '">Apple / Outlook</a></p>';
  }

  document.addEventListener("click", function (ev) {
    var a = ev.target.closest("[data-ics]");
    if (!a) return;
    ev.preventDefault();
    var e = (RUNS.events || []).filter(function (x) { return x.id === a.getAttribute("data-ics"); })[0];
    if (!e) return;
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fatima Mouzahem//SheOnTheRun//EN",
      "BEGIN:VEVENT",
      "UID:" + (e.id || "event") + "@sheontherun.com",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
      "DTSTART;TZID=Asia/Beirut:" + calStamp(e.starts),
      "DTEND;TZID=Asia/Beirut:" + calStamp(e.ends || e.starts),
      "SUMMARY:" + e.title,
      "LOCATION:" + (e.place || "").replace(/,/g, "\\,"),
      "DESCRIPTION:" + (e.detail || "").replace(/,/g, "\\,"),
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    var url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    var link = document.createElement("a");
    link.href = url; link.download = (e.id || "event") + ".ics";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  /* --------------------------------------------------- 8. WEEKLY RHYTHM -- */
  (function () {
    var host = $("[data-rhythm]");
    if (!host || !RUNS.recurring) return;
    var r = RUNS.recurring;
    var msg = "Hi Fatima! I'd like to come to a SheOnTheRun sunset run. Can you tell me where to meet?";
    host.innerHTML = "<div>" +
        '<span class="measured">Every week, all year</span>' +
        '<p class="r-when">' + esc(r.days) + " · " + esc(r.time) + "</p>" +
        '<p class="mt-s prose">' + esc(r.detail) + " Meeting point: " + esc(r.place) + ".</p>" +
      "</div>" +
      '<a class="btn" href="' + esc(waLink(msg, "sheontherun")) + '"' + waAttrs() +
      '>Come to a run <span class="arw" aria-hidden="true">→</span></a>';
  })();

  /* --------------------------------------------------------------- 9. SHOP */
  (function () {
    var host = $("[data-shop]");
    if (!host) return;
    var navHost = $("[data-shop-nav]");

    function productCard(p, catName) {
      var hasOptions = p.options && p.options.length;
      var selId = "opt-" + p.id;
      var priceHTML = (p.price || p.price === 0)
        ? '<span class="pr-price">$' + esc(p.price) + "</span>"
        : '<span class="pr-price ask">Price on WhatsApp</span>';

      var btn = p.soldOut
        ? '<span class="btn ghost block" aria-disabled="true">Sold out</span>'
        : '<button class="btn ghost block" type="button" data-add="' + esc(p.id) + '" data-name="' + esc(p.name) +
          '" data-cat="' + esc(catName) + '" data-price="' + esc(p.price == null ? "" : p.price) + '">' +
          'Add to bag <span class="arw" aria-hidden="true">+</span></button>';

      return '<article class="product reveal">' +
        media(p.image, p.name, "r-11", p.name) +
        "<h3>" + esc(p.name) + "</h3>" +
        '<p class="pr-blurb">' + esc(p.blurb) + "</p>" +
        '<div class="pr-foot">' + priceHTML + "</div>" +
        (hasOptions
          ? '<label class="vh" for="' + esc(selId) + '">Option for ' + esc(p.name) + "</label>" +
            '<select id="' + esc(selId) + '" data-option-for="' + esc(p.id) + '">' +
            p.options.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + "</option>"; }).join("") +
            "</select>"
          : "") +
        btn +
      "</article>";
    }

    host.innerHTML = SHOP.categories.map(function (c) {
      if (c.comingSoon) {
        var msg = "Hi Fatima! Please let me know when the modest activewear launches.";
        return '<section class="cat reveal" data-cat-id="' + esc(c.id) + '" id="' + esc(c.id) + '">' +
          '<div class="soon"><div class="soon-grid"><div>' +
            '<span class="measured">Coming soon</span>' +
            '<h2 class="mt-s">' + esc(c.name) + "</h2>" +
            '<p class="lede mt-s">' + esc(c.blurb) + "</p>" +
            '<a class="btn mt-m" href="' + esc(waLink(msg, "shop")) + '"' + waAttrs() +
            '>Tell me when it lands <span class="arw" aria-hidden="true">→</span></a>' +
          "</div><div>" + media("shop-jacket", "", "r-11", "Modest activewear") + "</div></div></div>" +
        "</section>";
      }
      return '<section class="cat" data-cat-id="' + esc(c.id) + '" id="' + esc(c.id) + '">' +
        '<div class="cat-head reveal"><span class="measured">' + esc(c.items.length) +
          (c.items.length === 1 ? " item" : " items") + "</span>" +
          "<h2>" + esc(c.name) + "</h2>" +
          '<p class="prose">' + esc(c.blurb) + "</p></div>" +
        '<div class="grid-p">' + c.items.map(function (p) { return productCard(p, c.name); }).join("") + "</div>" +
      "</section>";
    }).join("");

    if (navHost) {
      navHost.innerHTML = '<button type="button" data-filter="all" aria-pressed="true">Everything</button>' +
        SHOP.categories.map(function (c) {
          return '<button type="button" data-filter="' + esc(c.id) + '" aria-pressed="false">' + esc(c.name) + "</button>";
        }).join("");
      navHost.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-filter]");
        if (!b) return;
        var f = b.getAttribute("data-filter");
        $$("button", navHost).forEach(function (x) {
          x.setAttribute("aria-pressed", String(x === b));
        });
        $$("[data-cat-id]", host).forEach(function (sec) {
          sec.hidden = !(f === "all" || sec.getAttribute("data-cat-id") === f);
        });
      });
    }

    /* ---- The bag -------------------------------------------------------
       Collect several things, then send one WhatsApp message listing them
       all — how people here actually order. Remembered on this device only. */
    var BAG_KEY = "sotr_bag";
    var bag = [];
    try { bag = JSON.parse(localStorage.getItem(BAG_KEY) || "[]") || []; } catch (err) { bag = []; }
    function saveBag() { try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch (err) {} }

    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "bag-fab";
    fab.setAttribute("aria-haspopup", "dialog");
    var panel = document.createElement("div");
    panel.className = "bag";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Your bag");
    panel.hidden = true;
    document.body.appendChild(fab);
    document.body.appendChild(panel);

    function bagCount() { return bag.reduce(function (n, x) { return n + x.qty; }, 0); }

    function bagMessage() {
      return "Hi Fatima! I'd like to order from your shop:\n" + bag.map(function (x) {
        return "• " + x.qty + " × " + x.name + (x.option ? " (" + x.option + ")" : "");
      }).join("\n") + "\nIs everything in stock?";
    }

    function renderBag() {
      var n = bagCount();
      fab.hidden = n === 0;
      fab.innerHTML = 'Your bag <span class="bag-n num">' + n + "</span>";
      var total = 0, priced = true;
      bag.forEach(function (x) {
        if (x.price === "" || x.price == null) priced = false; else total += x.qty * +x.price;
      });
      panel.innerHTML =
        '<div class="bag-card">' +
          '<div class="bag-head"><h2>Your bag</h2><button type="button" class="bag-close" aria-label="Close">&times;</button></div>' +
          (bag.length
            ? '<ul class="bag-list">' + bag.map(function (x, i) {
                return '<li><div><p class="bag-name">' + esc(x.name) + "</p>" +
                  '<p class="measured">' + esc(x.option || x.cat) + "</p></div>" +
                  '<div class="bag-qty">' +
                    '<button type="button" data-qty="' + i + '" data-d="-1" aria-label="One fewer ' + esc(x.name) + '">−</button>' +
                    '<span class="num">' + x.qty + "</span>" +
                    '<button type="button" data-qty="' + i + '" data-d="1" aria-label="One more ' + esc(x.name) + '">+</button>' +
                  "</div></li>";
              }).join("") + "</ul>" +
              '<p class="bag-total">' + (priced ? "Total <b class=\"num\">$" + total + "</b>" :
                "I'll confirm prices and delivery when you message.") + "</p>" +
              '<a class="btn block lg" href="' + esc(waLink(bagMessage(), "shop")) + '"' + waAttrs() + ">" +
                'Send order on WhatsApp <span class="arw" aria-hidden="true">→</span></a>' +
              '<p class="form-note mt-s">Cash on delivery or transfer. Delivery across Lebanon, or collect at a run.</p>'
            : '<p class="prose mt-s">Nothing in here yet.</p>') +
        "</div>";
    }

    function openBag(open) {
      panel.hidden = !open;
      document.body.classList.toggle("locked", open);
      if (open) { var c = $(".bag-close", panel); if (c) c.focus(); } else fab.focus();
    }

    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-add]");
      if (!b) return;
      var sel = $("select[data-option-for]", b.closest(".product"));
      var option = sel ? sel.value : "";
      var id = b.getAttribute("data-add");
      var hit = bag.filter(function (x) { return x.id === id && x.option === option; })[0];
      if (hit) hit.qty += 1;
      else bag.push({ id: id, name: b.getAttribute("data-name"), cat: b.getAttribute("data-cat"),
                      option: option, price: b.getAttribute("data-price"), qty: 1 });
      saveBag(); renderBag();
      b.innerHTML = 'Added <span class="arw" aria-hidden="true">✓</span>';
      setTimeout(function () { b.innerHTML = 'Add to bag <span class="arw" aria-hidden="true">+</span>'; }, 1400);
      fab.classList.remove("bump"); void fab.offsetWidth; fab.classList.add("bump");
    });

    fab.addEventListener("click", function () { openBag(true); });
    panel.addEventListener("click", function (e) {
      if (e.target === panel || e.target.closest(".bag-close")) { openBag(false); return; }
      var q = e.target.closest("[data-qty]");
      if (!q) return;
      var i = +q.getAttribute("data-qty");
      bag[i].qty += +q.getAttribute("data-d");
      if (bag[i].qty <= 0) bag.splice(i, 1);
      saveBag(); renderBag();
      if (!bag.length) openBag(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) openBag(false);
    });
    renderBag();

    observeReveals(host);
  })();

  function orderMessage(name, cat, option) {
    return "Hi Fatima! I'd like to order the " + name +
      (option ? " (" + option + ")" : "") +
      (cat ? " from " + cat : "") + ". Is it in stock?";
  }

  /* ------------------------------------------------- 9b. PHOTOGRAPH SETS -- */
  var GAL = window.SITE_GALLERY || {};

  /* The moving strip. Duplicated once so the loop has no seam. */
  (function () {
    var host = $("[data-marquee]");
    if (!host || !(GAL.marquee || []).length) return;
    var row = GAL.marquee.map(function (n) {
      var m = IMAGES[n];
      if (!m) return "";
      return '<div class="mq-item" style="aspect-ratio:' + m.r + '">' +
             pic(n, { sizes: "(min-width: 900px) 22vw, 52vw" }) + "</div>";
    }).join("");
    host.innerHTML = '<div class="mq-track">' + row + row + "</div>";
    host.setAttribute("aria-hidden", "true");
  })();

  /* The pinned run of photographs. */
  (function () {
    var track = $("[data-hscroll-track]");
    if (!track || !(GAL.community || []).length) return;
    track.innerHTML = GAL.community.map(function (it, i) {
      var m = IMAGES[it.img];
      if (!m) return "";
      return '<figure class="hs-item' + (m.r > 1 ? " wide" : "") + '">' +
        '<div class="fig" style="aspect-ratio:' + m.r + '">' +
          pic(it.img, { sizes: "(min-width: 900px) 34vw, 82vw" }) + "</div>" +
        '<figcaption class="measured"><span class="num">' + String(i + 1).padStart(2, "0") +
        "</span> " + esc(it.caption) + "</figcaption>" +
      "</figure>";
    }).join("");
  })();

  /* Grids of stills — moments, fieldwork, China. */
  function renderSet(attr, key, ratioClass, withCaptions) {
    var host = $("[" + attr + "]");
    if (!host) return;
    var list = GAL[key] || [];
    if (!list.length) { host.remove(); return; }
    host.innerHTML = list.map(function (it) {
      var name = typeof it === "string" ? it : it.img;
      var cap = typeof it === "string" ? "" : it.caption;
      var m = IMAGES[name];
      if (!m) return "";
      return '<figure class="g-item" data-caption="' + esc(cap || m.alt) + '">' +
        '<div class="fig" style="aspect-ratio:' + m.r + '">' +
          pic(name, { sizes: "(min-width: 900px) 30vw, 48vw" }) + "</div>" +
        (withCaptions && cap ? '<figcaption class="measured">' + esc(cap) + "</figcaption>" : "") +
      "</figure>";
    }).join("");
  }
  /* The image column that follows the About timeline. */
  (function () {
    var stage = $("[data-tl-stage]");
    if (!stage) return;
    var names = (stage.getAttribute("data-frames") || "").split(",").map(function (s) { return s.trim(); });
    stage.innerHTML = names.map(function (n) {
      if (!IMAGES[n]) return "";
      return '<div class="tl-frame" data-tl-frame>' +
             pic(n, { sizes: "(min-width: 860px) 42vw, 92vw" }) + "</div>";
    }).join("");
  })();

  renderSet("data-set-moments", "moments", "", false);
  renderSet("data-set-fieldwork", "fieldwork", "", true);
  renderSet("data-set-china", "china", "", false);

  /* ---------------------------------------------------------- 10. JOURNAL */
  (function () {
    var host = $("[data-posts]");
    if (!host) return;
    /* Never list the article you're already reading. */
    var hereSlug = (location.pathname.match(/\/journal\/([^\/]+)\.html$/) || [])[1];
    var live = POSTS.filter(function (p) { return !p.draft && p.slug !== hereSlug; });
    var max = parseInt(host.getAttribute("data-posts"), 10);
    if (max > 0) live = live.slice(0, max);

    var section = host.closest("[data-posts-section]");
    if (!live.length) {
      if (section) { section.remove(); return; }
      host.innerHTML = '<div class="empty"><p class="measured">Nothing published yet</p>' +
        '<p class="mt-s">The first articles are being written.</p></div>';
      return;
    }

    /* On the full Journal, once there's more than one kind of article, let
       readers narrow it down. */
    var kinds = live.map(function (p) { return p.kicker; })
      .filter(function (k, i, a) { return k && a.indexOf(k) === i; });
    if (!(max > 0) && kinds.length > 1) {
      var bar = document.createElement("div");
      bar.className = "shop-nav post-filter";
      bar.setAttribute("role", "group");
      bar.setAttribute("aria-label", "Filter articles");
      bar.innerHTML = '<button type="button" data-kind="" aria-pressed="true">Everything</button>' +
        kinds.map(function (k) {
          return '<button type="button" data-kind="' + esc(k) + '" aria-pressed="false">' + esc(k) + "</button>";
        }).join("");
      host.parentNode.insertBefore(bar, host);
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("[data-kind]");
        if (!b) return;
        var k = b.getAttribute("data-kind");
        $$("button", bar).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        $$(".post", host).forEach(function (el) {
          el.hidden = !!k && el.getAttribute("data-kind") !== k;
        });
      });
    }

    host.innerHTML = live.map(function (p) {
      return '<a class="post reveal" data-kind="' + esc(p.kicker) + '" href="' + (isJournal ? '' : rootRel + 'journal/') + esc(p.slug) + '.html">' +
        media(p.image, p.title, "r-32", p.title) +
        '<div class="p-meta"><span class="measured">' + esc(p.kicker) + "</span>" +
          '<span class="measured">' + esc(dateLong(p.date)) + " · " + esc(p.readingTime) + "</span></div>" +
        "<h3>" + esc(p.title) + "</h3>" +
        "<p>" + esc(p.excerpt) + "</p>" +
        '<span class="tlink">Read <span class="arw" aria-hidden="true">→</span></span>' +
      "</a>";
    }).join("");
  })();

  /* ------------------------------------------------- 10b. READING AN ARTICLE */
  (function () {
    var article = $(".article");
    var prose = article && $(".prose", article);
    if (!prose) return;

    /* A hairline across the top that fills as you read. */
    var bar = document.createElement("div");
    bar.className = "read-progress";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = "<span></span>";
    document.body.appendChild(bar);
    var fill = bar.firstChild;
    var tick = false;
    function progress() {
      tick = false;
      var r = prose.getBoundingClientRect();
      var total = r.height - window.innerHeight * .6;
      var done = Math.min(1, Math.max(0, (window.innerHeight * .4 - r.top) / Math.max(1, total)));
      fill.style.transform = "scaleX(" + done + ")";
    }
    window.addEventListener("scroll", function () {
      if (!tick) { tick = true; requestAnimationFrame(progress); }
    }, { passive: true });
    progress();

    /* "In this article" — built from the headings, so it never goes stale. */
    var heads = $$("h2", prose);
    if (heads.length >= 3) {
      var toc = document.createElement("nav");
      toc.className = "toc mt-l";
      toc.setAttribute("aria-label", "In this article");
      toc.innerHTML = '<p class="measured">In this article</p><ol>' + heads.map(function (h, i) {
        if (!h.id) h.id = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "s" + i;
        return '<li><a href="#' + esc(h.id) + '"><span class="num">' + String(i + 1).padStart(2, "0") +
               "</span>" + esc(h.textContent) + "</a></li>";
      }).join("") + "</ol>";
      prose.parentNode.insertBefore(toc, prose);
    }

    /* Sharing: WhatsApp is how things travel here; the rest is a copy. */
    var title = ($("h1", article) || {}).textContent || document.title;
    var url = location.href.split("#")[0];
    var share = document.createElement("div");
    share.className = "share mt-l";
    share.innerHTML = '<span class="measured">Share this</span>' +
      '<a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/?text=' +
        esc(encodeURIComponent(title + " — " + url)) + '">WhatsApp</a>' +
      '<button class="btn ghost sm" type="button" data-copy>Copy link</button>' +
      (navigator.share ? '<button class="btn ghost sm" type="button" data-share>More…</button>' : "");
    prose.parentNode.insertBefore(share, prose.nextSibling);
    share.addEventListener("click", function (e) {
      var c = e.target.closest("[data-copy]");
      if (c && navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          c.textContent = "Link copied";
          setTimeout(function () { c.textContent = "Copy link"; }, 1800);
        });
      }
      if (e.target.closest("[data-share]")) navigator.share({ title: title, url: url }).catch(function () {});
    });
  })();

  /* ----------------------------------------------------- 11. PUBLICATIONS */
  (function () {
    var host = $("[data-pubs]");
    if (host) {
      host.innerHTML = PUBS.map(function (p) {
        var inner =
          '<div><span class="measured on-deep">' + esc(p.journal) + " · " + esc(p.year) + "</span></div>" +
          "<div><h3>" + esc(p.title) + "</h3>" +
            '<p class="p-sum">' + esc(p.summary) + "</p>" +
            (p.link ? '<a class="tlink mt-s" href="' + esc(p.link) + '" target="_blank" rel="noopener">Read the paper <span class="arw" aria-hidden="true">→</span></a>' : "") +
          "</div>";
        return '<article class="pub reveal">' + inner + "</article>";
      }).join("");
    }
    var topics = $("[data-topics]");
    if (topics) {
      topics.innerHTML = TOPICS.map(function (t) {
        return '<li class="chip">' + esc(t) + "</li>";
      }).join("");
    }
  })();

  /* ------------------------------------------------- 12. EXPERTISE ACCORDION */
  $$("[data-exp] .exp-head").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var item = btn.closest(".exp-item");
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      item.classList.toggle("open", !open);
    });
  });

  /* --------------------------------------------- 13. CONTACT LINKS ON PAGE */
  $$("[data-wa]").forEach(function (a) {
    var msg = a.getAttribute("data-wa") || "Hi Fatima! I found you through your website.";
    var interest = a.getAttribute("data-interest") || "general";
    /* data-book marks a booking (the discovery call) rather than a chat. */
    var book = a.hasAttribute("data-book") && BOOK_URL;
    a.setAttribute("href", book ? BOOK_URL : waLink(msg, interest));
    if (book || WA_READY) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
  });

  $$("[data-email]").forEach(function (a) {
    var subj = a.getAttribute("data-email") || "Enquiry via your website";
    a.setAttribute("href", mailLink(subj, ""));
    if (EMAIL_READY) a.textContent = a.getAttribute("data-email-label") === "address" ? RAW_EMAIL : a.textContent;
  });

  $$("[data-email-text]").forEach(function (el) {
    el.textContent = EMAIL_READY ? RAW_EMAIL : "Email — being set up";
  });

  $$("[data-instagram]").forEach(function (a) {
    if (!CFG.instagram) { a.remove(); return; }
    a.href = CFG.instagram;
    if (a.hasAttribute("data-instagram-label")) a.textContent = CFG.instagramHandle || "Instagram";
  });

  /* ----------------------------------------------------- 14. CONNECT FORM */
  (function () {
    var form = $("[data-connect]");
    if (!form) return;

    var params = new URLSearchParams(location.search);
    var wanted = params.get("interest");
    var note = params.get("note");

    if (wanted) {
      var radio = $('input[name="interest"][value="' + wanted.replace(/"/g, "") + '"]', form);
      if (radio) radio.checked = true;
    }
    if (note) {
      var msgField = $("#message", form);
      if (msgField && !msgField.value) msgField.value = note;
    }

    function compose() {
      var name = ($("#name", form) || {}).value || "";
      var interest = ($('input[name="interest"]:checked', form) || {}).nextElementSibling;
      var interestLabel = interest ? interest.textContent.trim() : "General";
      var message = ($("#message", form) || {}).value || "";
      var email = ($("#email", form) || {}).value || "";
      return {
        name: name, email: email, interest: interestLabel, message: message,
        subject: interestLabel + " — enquiry from " + (name || "your website"),
        body: "Hi Fatima,\n\n" + message +
          "\n\n—\nName: " + name +
          (email ? "\nEmail: " + email : "") +
          "\nAbout: " + interestLabel +
          "\nSent from your website."
      };
    }

    var ENDPOINT = /^https:\/\//.test(String(CFG.formEndpoint || "")) ? CFG.formEndpoint : "";
    var submitBtn = $('button[type="submit"]', form);
    var noteEl = $(".form-note", form);
    if (ENDPOINT) {
      /* With a real endpoint the reply address matters, so ask for it. */
      var emailField = $("#email", form);
      if (emailField) emailField.required = true;
      if (submitBtn) submitBtn.innerHTML = 'Send message <span class="arw" aria-hidden="true">→</span>';
      if (noteEl) noteEl.textContent = "Your message comes straight to my inbox. I usually reply within a day.";
    }

    function sent() {
      var c = compose();
      form.innerHTML = '<div class="form-done" role="status" tabindex="-1">' +
        '<span class="measured">Message received</span>' +
        '<p class="pull mt-s">Thank you' + (c.name ? ", " + esc(c.name.split(" ")[0]) : "") + '.</p>' +
        '<p class="prose mt-s">I read every message myself and usually reply within a day. ' +
        'If it&rsquo;s urgent, WhatsApp is the fastest way to reach me.</p></div>';
      var done = $(".form-done", form);
      if (done) done.focus();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var c = compose();
      if (!ENDPOINT) { window.location.href = mailLink(c.subject, c.body); return; }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Sending…"; }
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          name: c.name, email: c.email, about: c.interest,
          message: c.message, _subject: c.subject
        })
      }).then(function (r) {
        if (!r.ok) throw new Error("status " + r.status);
        sent();
      }).catch(function () {
        /* The service is down or blocked: never lose the message — hand it to
           the visitor's email app instead. */
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Send message <span class="arw" aria-hidden="true">→</span>';
        }
        if (noteEl) noteEl.textContent = "That didn't go through. Opening your email app with the message written out instead…";
        setTimeout(function () { window.location.href = mailLink(c.subject, c.body); }, 900);
      });
    });

    var waBtn = $("[data-connect-wa]", form);
    if (waBtn) {
      waBtn.addEventListener("click", function () {
        if (!form.reportValidity()) return;
        var c = compose();
        var interest = ($('input[name="interest"]:checked', form) || {}).value || "general";
        var url = waLink(c.body.replace(/^Hi Fatima,\n\n/, "Hi Fatima! "), interest);
        if (WA_READY) window.open(url, "_blank", "noopener");
        else window.location.href = url;
      });
    }
  })();

  /* --------------------------------------------------- 14b. NEWSLETTER -- */
  /* Only appears once there's somewhere for the address to go. The form posts
     straight to her newsletter provider — nothing passes through this site. */
  (function () {
    var url = String(CFG.newsletterEndpoint || "");
    var foot = $(".site-footer .wrap");
    if (!/^https:\/\//.test(url) || !foot) return;
    var box = document.createElement("div");
    box.className = "newsletter";
    box.innerHTML =
      '<div><p class="measured on-deep">Letters from the run</p>' +
      '<p class="nl-title">One short email a month: what I&rsquo;m reading, cooking and running — and the next dates.</p></div>' +
      '<form class="nl-form" method="post" action="' + esc(url) + '" target="_blank">' +
        '<label class="vh" for="nl-email">Your email</label>' +
        '<input class="nl-input" id="nl-email" type="email" name="email" required autocomplete="email" placeholder="you@example.com">' +
        '<button class="btn on-deep" type="submit">Subscribe <span class="arw" aria-hidden="true">→</span></button>' +
      "</form>";
    foot.insertBefore(box, foot.firstChild);
    $("form", box).addEventListener("submit", function () {
      var f = this;
      setTimeout(function () {
        f.innerHTML = '<p class="nl-done">Thank you — check your inbox to confirm.</p>';
      }, 50);
    });
  })();

  /* ------------------------------------------------- 15. SETUP REMINDER -- */
  /* Only ever shows on a local machine, so it can't reach a visitor. */
  (function () {
    if (!IS_LOCAL) return;
    if (sessionStorage.getItem("hide_setup_banner")) return;
    var missing = [];
    if (!WA_READY) missing.push("<code>whatsapp</code>");
    if (!EMAIL_READY) missing.push("<code>email</code>");
    if (!missing.length) return;
    var bar = document.createElement("div");
    bar.className = "setup-banner";
    bar.innerHTML = "<div>Local preview · Set " + missing.join(" and ") +
      " in <code>config.js</code></div>" +
      '<button type="button" aria-label="Dismiss">×</button>';
    bar.querySelector("button").addEventListener("click", function () {
      sessionStorage.setItem("hide_setup_banner", "1");
      bar.remove();
    });
    document.body.appendChild(bar);
  })();

  /* ------------------------------------------------- 15b. INSTANT PAGES -- */
  /* Start fetching a page the moment someone hovers or presses its link, so
     the click lands on something already loaded. Browsers that don't know
     speculation rules ignore this entirely. */
  (function () {
    if (!(window.HTMLScriptElement && HTMLScriptElement.supports &&
          HTMLScriptElement.supports("speculationrules"))) return;
    var rules = document.createElement("script");
    rules.type = "speculationrules";
    rules.textContent = JSON.stringify({
      prefetch: [{ where: { and: [{ href_matches: "/*" }, { not: { href_matches: "*.jpg" } }] }, eagerness: "moderate" }]
    });
    document.head.appendChild(rules);
  })();

  /* --------------------------------------------------- 15c. ANALYTICS ---- */
  /* Off unless configured, never on her own machine, and cookie-free either
     way — so there is no consent banner to show anyone. */
  (function () {
    if (IS_LOCAL) return;
    var s = document.createElement("script");
    s.defer = true;
    if (CFG.plausibleDomain) {
      s.src = "https://plausible.io/js/script.js";
      s.setAttribute("data-domain", CFG.plausibleDomain);
    } else if (CFG.cloudflareToken) {
      s.src = "https://static.cloudflareinsights.com/beacon.min.js";
      s.setAttribute("data-cf-beacon", JSON.stringify({ token: CFG.cloudflareToken }));
    } else return;
    document.head.appendChild(s);
  })();

  /* ------------------------------------------------------------- 16. BOOT */
  if (switchEl) { setMode(mode); requestAnimationFrame(positionThumb); }
  else { renderServices(); renderPackages(); }
  observeReveals();

  document.fonts && document.fonts.ready.then(function () {
    positionThumb();
  });
})();
