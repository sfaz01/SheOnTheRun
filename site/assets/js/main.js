/* ============================================================
   Fatima Mouzahem — site behaviour
   Progressive enhancement only: every link, price and form
   works without JavaScript. This file adds the mobile menu,
   the in-person/online switch, filters, form conditionals,
   and the motion layer.
   ============================================================ */

(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------
     1. Mobile menu
     ---------------------------------------------------------- */
  var menuBtn = document.querySelector(".menu-btn");
  var mobileNav = document.querySelector(".mobile-nav");

  function closeMenu() {
    if (!mobileNav || !menuBtn) return;
    mobileNav.setAttribute("hidden", "");
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", function () {
      if (!mobileNav.hasAttribute("hidden")) {
        closeMenu();
      } else {
        mobileNav.removeAttribute("hidden");
        menuBtn.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
      }
    });

    Array.prototype.forEach.call(mobileNav.querySelectorAll("a"), function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !mobileNav.hasAttribute("hidden")) {
        closeMenu();
        menuBtn.focus();
      }
    });
  }

  /* ----------------------------------------------------------
     2. Header state on scroll
     ---------------------------------------------------------- */
  var header = document.querySelector(".site-header");
  var progressBar = document.querySelector(".progress i");

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;

    if (header) {
      if (y > 12) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    }

    if (progressBar) {
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docH > 0 ? (y / docH) * 100 : 0;
      progressBar.style.width = Math.min(100, Math.max(0, pct)) + "%";
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ----------------------------------------------------------
     3. Consultation mode — in person / online
     One decision drives the intro copy, the body-composition
     lines, and the pre-filled WhatsApp message on every button.
     ---------------------------------------------------------- */
  var modeButtons = document.querySelectorAll("[data-mode-btn]");

  function waLink(message) {
    var number = root.getAttribute("data-whatsapp") || "";
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
  }

  function applyMode(mode, updateUrl) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-mode-btn]"), function (btn) {
      btn.setAttribute("aria-selected", btn.getAttribute("data-mode-btn") === mode ? "true" : "false");
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-mode-only]"), function (el) {
      if (el.getAttribute("data-mode-only") === mode) el.removeAttribute("hidden");
      else el.setAttribute("hidden", "");
    });

    var label = mode === "online" ? "Online" : "In person, Beirut";
    Array.prototype.forEach.call(document.querySelectorAll("a[data-wa-message]"), function (link) {
      link.setAttribute("href", waLink(link.getAttribute("data-wa-message") + " — " + label + "."));
    });

    if (updateUrl && window.history && window.history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.set("mode", mode);
      window.history.replaceState(null, "", url.toString());
    }
  }

  if (modeButtons.length) {
    var requested = new URLSearchParams(window.location.search).get("mode");
    Array.prototype.forEach.call(modeButtons, function (btn) {
      btn.addEventListener("click", function () {
        applyMode(btn.getAttribute("data-mode-btn"), true);
      });
    });
    applyMode(requested === "online" || requested === "in-person" ? requested : "in-person", false);
  }

  /* ----------------------------------------------------------
     4. Event filters
     ---------------------------------------------------------- */
  var chips = document.querySelectorAll(".filters .chip");

  if (chips.length) {
    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener("click", function () {
        var filter = chip.getAttribute("data-filter");

        Array.prototype.forEach.call(chips, function (c) {
          c.setAttribute("aria-pressed", c === chip ? "true" : "false");
        });

        var shown = 0;
        Array.prototype.forEach.call(document.querySelectorAll(".events [data-type]"), function (event) {
          if (filter === "all" || event.getAttribute("data-type") === filter) {
            event.removeAttribute("hidden");
            shown++;
          } else {
            event.setAttribute("hidden", "");
          }
        });

        var empty = document.querySelector("[data-filter-empty]");
        if (empty) {
          if (shown === 0) empty.removeAttribute("hidden");
          else empty.setAttribute("hidden", "");
        }
      });
    });
  }

  /* ----------------------------------------------------------
     5. Contact form — conditional fields + submit
     ---------------------------------------------------------- */
  var contactForm = document.querySelector("#contact-form");

  if (contactForm) {
    var reason = contactForm.querySelector("#reason");
    var conditionals = contactForm.querySelectorAll("[data-show-for]");

    var syncConditionals = function () {
      var value = reason ? reason.value : "";
      Array.prototype.forEach.call(conditionals, function (block) {
        var matches = block.getAttribute("data-show-for").split(" ").indexOf(value) !== -1;
        if (matches) block.removeAttribute("hidden");
        else block.setAttribute("hidden", "");
      });
    };

    if (reason) reason.addEventListener("change", syncConditionals);
    syncConditionals();

    contactForm.addEventListener("submit", function (e) {
      // No backend is wired yet — see README.md, "Before launch".
      e.preventDefault();
      var success = document.querySelector("#contact-success");
      if (!success) return;
      contactForm.setAttribute("hidden", "");
      success.removeAttribute("hidden");
      success.setAttribute("tabindex", "-1");
      success.focus();
    });
  }

  /* ----------------------------------------------------------
     6. Email capture
     ---------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-capture]"), function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var button = form.querySelector("button");
      if (!button) return;
      var original = button.textContent;
      button.textContent = "You are on the list";
      button.disabled = true;
      window.setTimeout(function () {
        button.textContent = original;
        button.disabled = false;
        form.reset();
      }, 3000);
    });
  });

  /* ----------------------------------------------------------
     7. Booking analytics hook
     WhatsApp bookings leave the site, so this click is the only
     conversion signal available. Swap console.info for the real
     analytics call at launch.
     ---------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-booking]"), function (link) {
    link.addEventListener("click", function () {
      var selected = document.querySelector('[data-mode-btn][aria-selected="true"]');
      console.info("booking_intent", {
        item: link.getAttribute("data-booking"),
        mode: selected ? selected.getAttribute("data-mode-btn") : null
      });
    });
  });

  /* ----------------------------------------------------------
     8. Credential marquee — duplicate the group for a seamless
        loop, so the markup only has to list the credentials once
     ---------------------------------------------------------- */
  var track = document.querySelector(".marquee-track");
  if (track && !reduceMotion) {
    var group = track.querySelector(".marquee-group");
    if (group) {
      var clone = group.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    }
  }

  /* ----------------------------------------------------------
     9. Scroll reveals
        Applied from JS against existing markup, so nothing is
        hidden when JavaScript is unavailable.
     ---------------------------------------------------------- */
  if (!reduceMotion && "IntersectionObserver" in window) {
    var selectors = [
      ".section-head",
      ".door",
      ".card",
      ".statement",
      ".pkg",
      ".step",
      ".event",
      ".testimonial",
      ".article-card",
      ".stat",
      ".org",
      ".tl",
      ".cta",
      ".pub",
      ".product",
      ".cat",
      ".mosaic .ph",
      ".prose",
      ".pullquote",
      ".hero-media",
      ".soon"
    ];

    var targets = document.querySelectorAll(selectors.join(","));

    // stagger items inside the same row/group
    var groups = {};
    Array.prototype.forEach.call(targets, function (el) {
      el.classList.add("reveal");
      var parentKey = el.parentNode ? (el.parentNode.className || "root") : "root";
      groups[parentKey] = groups[parentKey] || 0;
      var index = groups[parentKey]++;
      el.style.setProperty("--d", Math.min(index, 5) * 80 + "ms");
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );

    Array.prototype.forEach.call(targets, function (el) {
      // anything already in view on load reveals immediately,
      // so the first screen is never blank
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92) {
        el.classList.add("in");
      } else {
        observer.observe(el);
      }
    });
  }

  /* ----------------------------------------------------------
     10. Animated statistics
     ---------------------------------------------------------- */
  var counters = document.querySelectorAll("[data-count]");

  if (counters.length) {
    var runCount = function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      if (reduceMotion || !isFinite(target)) {
        el.textContent = String(target);
        return;
      }
      var duration = 1100;
      var start = null;
      var step = function (ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(target * eased));
        if (p < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };

    if ("IntersectionObserver" in window) {
      var counterObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              runCount(entry.target);
              counterObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.4 }
      );
      Array.prototype.forEach.call(counters, function (el) {
        counterObserver.observe(el);
      });
    } else {
      Array.prototype.forEach.call(counters, runCount);
    }
  }

  /* ----------------------------------------------------------
     11. Current year
     ---------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-year]"), function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
