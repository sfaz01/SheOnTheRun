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

  var isJournal = window.location.pathname.indexOf("/journal/") !== -1;
  var rootRel = isJournal ? "../" : "";

  /* Every booking button on the site comes through here. If the number isn't
     configured yet the button still works — it lands on Connect with the right
     interest pre-selected — so the site is never broken while she sets it up. */
  function waLink(message, interest) {
    if (WA_READY) return "https://wa.me/" + WA_DIGITS + "?text=" + encodeURIComponent(message);
    return rootRel + "connect.html?interest=" + encodeURIComponent(interest || "nutrition") +
           "&note=" + encodeURIComponent(message);
  }

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
  var IMG_BASE = isJournal ? "../public/images/" : "public/images/";

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
        '<a class="btn block" href="' + esc(waLink(msg, "nutrition")) + '"' + waAttrs() + ">" +
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
        '<a class="btn' + (p.featured ? "" : " ghost") + ' block" href="' + esc(waLink(msg, "nutrition")) + '"' + waAttrs() + ">" +
          "Book " + esc(p.name) + ' <span class="arw" aria-hidden="true">→</span></a>' +
      "</article>";
    }).join("");
    observeReveals(host);
  }

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
    if (!QUOTES.length) { section.remove(); return; }
    host.innerHTML = QUOTES.map(function (q) {
      return '<figure class="quote reveal">' +
        (q.sample ? '<span class="q-sample">Sample — replace before launch</span>' : "") +
        "<blockquote>" + esc(q.quote) + "</blockquote>" +
        '<figcaption><span class="q-name">' + esc(q.name) + "</span>" +
        '<span class="measured q-detail">' + esc(q.detail) + "</span></figcaption>" +
      "</figure>";
    }).join("");
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
          '<p class="measured e-where">' + esc(e.place) + (e.note ? " · " + esc(e.note) : "") + "</p></div>" +
        (e.link
          ? '<a class="btn ghost sm" href="' + esc(e.link) + '">Details <span class="arw" aria-hidden="true">→</span></a>'
          : '<a class="btn ghost sm" href="' + esc(waLink(msg, "sheontherun")) + '"' + waAttrs() +
            '>Join <span class="arw" aria-hidden="true">→</span></a>') +
      "</article>";
    }).join("");
  })();

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
        : '<a class="btn ghost block" data-order="' + esc(p.id) + '" data-name="' + esc(p.name) +
          '" data-cat="' + esc(catName) + '" href="' +
          esc(waLink(orderMessage(p.name, catName, hasOptions ? p.options[0] : ""), "shop")) + '"' + waAttrs() +
          '>Order on WhatsApp <span class="arw" aria-hidden="true">→</span></a>';

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

    /* Keep the order link in step with the chosen size. */
    host.addEventListener("change", function (e) {
      var sel = e.target.closest("select[data-option-for]");
      if (!sel) return;
      var card = sel.closest(".product");
      var link = $("a[data-order]", card);
      if (!link) return;
      link.href = waLink(orderMessage(link.getAttribute("data-name"), link.getAttribute("data-cat"), sel.value), "shop");
    });

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

    host.innerHTML = live.map(function (p) {
      return '<a class="post reveal" href="' + (isJournal ? '' : 'journal/') + esc(p.slug) + '.html">' +
        media(p.image, p.title, "r-32", p.title) +
        '<div class="p-meta"><span class="measured">' + esc(p.kicker) + "</span>" +
          '<span class="measured">' + esc(dateLong(p.date)) + " · " + esc(p.readingTime) + "</span></div>" +
        "<h3>" + esc(p.title) + "</h3>" +
        "<p>" + esc(p.excerpt) + "</p>" +
        '<span class="tlink">Read <span class="arw" aria-hidden="true">→</span></span>' +
      "</a>";
    }).join("");
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
    a.setAttribute("href", waLink(msg, interest));
    if (WA_READY) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
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
        subject: interestLabel + " — enquiry from " + (name || "your website"),
        body: "Hi Fatima,\n\n" + message +
          "\n\n—\nName: " + name +
          (email ? "\nEmail: " + email : "") +
          "\nAbout: " + interestLabel +
          "\nSent from your website."
      };
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var c = compose();
      window.location.href = mailLink(c.subject, c.body);
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

  /* ------------------------------------------------- 15. SETUP REMINDER -- */
  /* Only ever shows on a local machine, so it can't reach a visitor. */
  (function () {
    var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === "file:";
    if (!local) return;
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

  /* ------------------------------------------------------------- 16. BOOT */
  if (switchEl) { setMode(mode); requestAnimationFrame(positionThumb); }
  else { renderServices(); renderPackages(); }
  observeReveals();

  document.fonts && document.fonts.ready.then(function () {
    positionThumb();
  });
})();
