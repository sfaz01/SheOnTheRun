/* =============================================================================
   SheOnTheRun admin — shared helpers (DOM builder, API client, small UI pieces).
   Every string from the server goes through textContent, never innerHTML.
   ========================================================================== */
(function () {
  "use strict";
  var S = (window.SOTR = window.SOTR || {});
  S.csrf = "";

  function append(el, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) child.forEach(function (c) { append(el, c); });
    else el.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
  }

  /** h("button", {class: "btn", onclick: fn}, "Save") */
  S.h = function (tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === "class") el.className = v;
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = !!v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  };
  var h = S.h;

  /** Replace an element's children, skipping null/false (replaceChildren would print "null"). */
  S.put = function (el) {
    var kids = [];
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) add(c);
        else kids.push(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
      });
    })(Array.prototype.slice.call(arguments, 1));
    el.replaceChildren.apply(el, kids);
    return el;
  };

  S.api = function (method, path, body, retried) {
    var opts = { method: method, credentials: "same-origin", headers: {} };
    if (method !== "GET") {
      opts.headers["Content-Type"] = "application/json";
      opts.headers["X-CSRF-Token"] = S.csrf;
      opts.body = JSON.stringify(body || {});
    }
    return fetch("/api" + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok) return data;
        if (data.code === "csrf" && !retried) {
          return S.loadState().then(function () { return S.api(method, path, body, true); });
        }
        var err = new Error(data.error || "Something went wrong. Please try again.");
        err.code = data.code; err.status = res.status; err.data = data;
        throw err;
      });
    }, function () { throw new Error("Can’t reach the server. Check your connection."); });
  };

  S.loadState = function () {
    return S.api("GET", "/auth/state").then(function (s) { S.session = s; S.csrf = s.csrf; return s; });
  };

  /** A form that disables its button while sending and shows errors in one live region. */
  S.form = function (fields, submitLabel, onSubmit, extra, opts) {
    opts = opts || {};
    var errBox = h("div", { role: "alert" });
    var btn = h("button", { class: "btn" + (opts.inline ? "" : " block"), type: "submit" }, submitLabel);
    var f = h("form", { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      errBox.replaceChildren();
      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = "One moment…";
      Promise.resolve().then(function () { return onSubmit(f); }).catch(function (err) {
        errBox.replaceChildren(h("div", { class: "alert error" }, err.message));
      }).then(function () { btn.disabled = false; btn.textContent = label; });
    } }, fields, errBox, btn, extra);
    return f;
  };

  S.field = function (id, label, attrs, hint) {
    return h("div", { class: "field" },
      h("label", { for: id }, label),
      h("input", Object.assign({ id: id, name: id }, attrs)),
      hint ? h("p", { class: "hint" }, hint) : null);
  };

  S.val = function (f, id) { return f.querySelector("#" + id).value; };

  var toastBox;
  S.toast = function (msg, kind) {
    if (!toastBox) { toastBox = h("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.appendChild(toastBox); }
    var t = h("div", { class: "toast " + (kind || "ok") }, msg);
    toastBox.appendChild(t);
    setTimeout(function () { t.classList.add("out"); }, 3200);
    setTimeout(function () { t.remove(); }, 3800);
  };

  /** "2026-10-07T18:30" → "Wed 7 Oct 2026, 18:30" (the text is Beirut time already). */
  S.fmtLocal = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s || "");
    if (!m) return s || "";
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) + ", " + m[4] + ":" + m[5];
  };

  /** "2026-10-02 09:15:00" (UTC from the server) → Beirut time, readable. */
  S.fmtUtc = function (s) {
    if (!s) return "";
    var d = new Date(s.replace(" ", "T") + "Z");
    if (isNaN(d)) return s;
    return d.toLocaleString("en-GB", { timeZone: "Asia/Beirut", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  /** Now, in Beirut, in the same "YYYY-MM-DDTHH:MM" shape events use. */
  S.nowBeirut = function () {
    var parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).reduce(function (o, p) { o[p.type] = p.value; return o; }, {});
    return parts.year + "-" + parts.month + "-" + parts.day + "T" + parts.hour + ":" + parts.minute;
  };

  /** The website page each section mostly shows; used by the Preview buttons. */
  var PREVIEW_PAGES = {
    shop: "shop.html", runs: "index.html", offer: "dietontherun.html",
    testimonials: "dietontherun.html", settings: "index.html",
    posts: "journal/index.html", gallery: "index.html", plans: "dietontherun.html"
  };
  /** A private, drafts-on-top view of the website — only a signed-in admin can open it. */
  S.previewHref = function (area) {
    return "/api/preview/page?p=" + encodeURIComponent(PREVIEW_PAGES[area] || "index.html");
  };

  S.slug = function (s) {
    return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/, "");
  };
})();
