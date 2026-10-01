/* =============================================================================
   SheOnTheRun admin — Phase 0: sign-in, two-step code, dashboard shell, server check.
   Plain JavaScript, no build step. Every string from the server goes through
   textContent (never innerHTML), so nothing it sends can inject markup.
   ========================================================================== */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var csrf = "";
  var session = { stage: "anonymous" };

  /* ------------------------------------------------------------------ helpers */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === "class") el.className = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) child.forEach(function (c) { append(el, c); });
    else el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  function mount(node) {
    app.replaceChildren(node);
    var focus = node.querySelector("[autofocus], input:not([type=checkbox]), h1");
    if (focus) { if (focus.tagName === "H1") focus.setAttribute("tabindex", "-1"); focus.focus({ preventScroll: true }); }
  }

  function api(method, path, body, retried) {
    var opts = { method: method, credentials: "same-origin", headers: {} };
    if (method !== "GET") {
      opts.headers["Content-Type"] = "application/json";
      opts.headers["X-CSRF-Token"] = csrf;
      opts.body = JSON.stringify(body || {});
    }
    return fetch("/api" + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok) return data;
        if (data.code === "csrf" && !retried) {
          return loadState().then(function () { return api(method, path, body, true); });
        }
        var err = new Error(data.error || "Something went wrong. Please try again.");
        err.code = data.code; err.status = res.status;
        throw err;
      });
    }, function () { throw new Error("Can’t reach the server. Check your connection."); });
  }

  function loadState() {
    return api("GET", "/auth/state").then(function (s) { session = s; csrf = s.csrf; return s; });
  }

  /** A form that disables its button while sending and shows errors in one live region. */
  function form(fields, submitLabel, onSubmit, extra) {
    var errBox = h("div", { role: "alert" });
    var btn = h("button", { class: "btn block", type: "submit" }, submitLabel);
    var f = h("form", { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      errBox.replaceChildren();
      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = "One moment…";
      Promise.resolve(onSubmit(f)).catch(function (err) {
        errBox.replaceChildren(h("div", { class: "alert error" }, err.message));
        var first = f.querySelector("input"); if (first && err.code !== "locked") first.select();
      }).then(function () { btn.disabled = false; btn.textContent = label; });
    } }, fields, errBox, btn, extra);
    return f;
  }
  function field(id, label, attrs, hint) {
    return h("div", { class: "field" },
      h("label", { for: id }, label),
      h("input", Object.assign({ id: id, name: id }, attrs)),
      hint ? h("p", { class: "hint" }, hint) : null);
  }
  function val(f, id) { return f.querySelector("#" + id).value; }

  function authCard(title, intro) {
    var wrap = h("main", { class: "auth" });
    var card = h("div", { class: "card" },
      h("div", { class: "brand" }, h("span", {}, "She", h("b", {}, "OnTheRun"), " · Admin")),
      h("h1", {}, title),
      intro ? h("p", { class: "muted" }, intro) : null);
    wrap.appendChild(card);
    return { wrap: wrap, card: card };
  }

  /* ------------------------------------------------------------------- routing */
  function route() {
    if (session.stage === "full") return dashboard();
    if (session.stage === "password") return session.next === "enroll" ? enroll() : secondStep();
    return session.setup_available ? setup() : login();
  }

  function refreshAndRoute() { return loadState().then(route); }

  /* --------------------------------------------------------------------- screens */
  function setup() {
    var v = authCard("Welcome — let’s create your account", "This is the one-time setup. You’ll need the setup key you were given.");
    v.card.appendChild(form([
      field("token", "Setup key", { type: "password", autocomplete: "off", required: true }),
      field("email", "Your email", { type: "email", autocomplete: "username", required: true }),
      field("password", "Choose a password", { type: "password", autocomplete: "new-password", required: true, minlength: 12 }, "At least 12 characters. Three or four random words is a great password."),
      field("password2", "Repeat the password", { type: "password", autocomplete: "new-password", required: true })
    ], "Create account", function (f) {
      if (val(f, "password") !== val(f, "password2")) throw new Error("The two passwords don’t match.");
      return api("POST", "/auth/setup", { token: val(f, "token"), email: val(f, "email"), password: val(f, "password") }).then(refreshAndRoute);
    }));
    mount(v.wrap);
  }

  function login() {
    var v = authCard("Sign in", "Welcome back.");
    v.card.appendChild(form([
      field("email", "Email", { type: "email", autocomplete: "username", required: true }),
      field("password", "Password", { type: "password", autocomplete: "current-password", required: true })
    ], "Continue", function (f) {
      return api("POST", "/auth/login", { email: val(f, "email"), password: val(f, "password") }).then(refreshAndRoute);
    }));
    mount(v.wrap);
  }

  function secondStep() {
    var useRecovery = false;
    var v = authCard("Enter your code", "Open your authenticator app and type the 6-digit code for SheOnTheRun.");
    var toggle = h("button", { type: "button", class: "linklike" }, "I can’t use my app — use a recovery code");
    var f = form([h("div", { class: "field", id: "codeField" })], "Sign in", function (fm) {
      return api("POST", "/auth/2fa", { code: val(fm, "code") }).then(function (r) {
        return refreshAndRoute().then(function () {
          if (r.recovery_used) notice("You signed in with a recovery code. " + r.recovery_left + " left — keep them somewhere safe.");
        });
      });
    }, h("p", { class: "muted", style: false }, toggle));
    function renderField() {
      var box = f.querySelector("#codeField");
      box.replaceChildren(
        h("label", { for: "code" }, useRecovery ? "Recovery code" : "6-digit code"),
        h("input", useRecovery
          ? { id: "code", name: "code", type: "text", autocomplete: "off", autocapitalize: "none", spellcheck: "false", placeholder: "xxxxx-xxxxx", required: true }
          : { id: "code", name: "code", type: "text", class: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 7, placeholder: "000000", required: true }));
      toggle.textContent = useRecovery ? "Use my authenticator app instead" : "I can’t use my app — use a recovery code";
      box.querySelector("input").focus();
    }
    toggle.addEventListener("click", function () { useRecovery = !useRecovery; renderField(); });
    v.card.appendChild(f);
    v.card.appendChild(h("p", { class: "muted" }, h("button", { type: "button", class: "linklike", onclick: signOut }, "Start again")));
    mount(v.wrap);
    renderField();
  }

  function enroll() {
    var v = authCard("Add a second lock", "Every sign-in asks for a code from your phone, so a stolen password alone can’t open the admin.");
    var body = h("div", {}, h("p", { class: "muted" }, "Preparing…"));
    v.card.appendChild(body);
    mount(v.wrap);
    api("POST", "/auth/2fa/begin").then(function (r) {
      var qr = qrcode(0, "M"); qr.addData(r.uri); qr.make();
      body.replaceChildren(
        h("ol", { class: "steps" },
          h("li", {}, "Install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password)."),
          h("li", {}, "In the app, add an account and scan this code."),
          h("li", {}, "Type the 6-digit number it shows below.")),
        h("div", { class: "qr" },
          h("img", { src: qr.createDataURL(5, 2), alt: "QR code to add SheOnTheRun to your authenticator app" }),
          h("details", {}, h("summary", {}, "Can’t scan? Enter the key by hand"), h("p", { class: "secret" }, r.secret.replace(/(.{4})/g, "$1 ").trim()))),
        form([
          h("div", { class: "field" },
            h("label", { for: "code" }, "6-digit code"),
            h("input", { id: "code", name: "code", type: "text", class: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 7, placeholder: "000000", required: true, autofocus: true }))
        ], "Turn on and continue", function (f) {
          return api("POST", "/auth/2fa/enable", { code: val(f, "code") }).then(function (res) {
            return loadState().then(function () { recoveryCodes(res.recovery_codes); });
          });
        }));
    }).catch(function (err) {
      body.replaceChildren(h("div", { class: "alert error" }, err.message), h("button", { class: "btn ghost", onclick: signOut }, "Start again"));
    });
  }

  function recoveryCodes(codes) {
    var v = authCard("Save your recovery codes", "If you ever lose your phone, each of these lets you in once. They are shown only now.");
    var text = "SheOnTheRun admin — recovery codes\nEach code works once.\n\n" + codes.join("\n") + "\n";
    var go = h("button", { class: "btn block", disabled: true, onclick: route }, "Go to the dashboard");
    var ack = h("input", { type: "checkbox", id: "ack", onchange: function () { go.disabled = !ack.checked; } });
    var copyBtn = h("button", { class: "btn ghost small", type: "button", onclick: function () {
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
        function () { copyBtn.textContent = "Copied"; }, function () { copyBtn.textContent = "Copy failed — use Download"; });
    } }, "Copy");
    var dl = h("a", { class: "btn ghost small", download: "sheontherun-recovery-codes.txt", href: URL.createObjectURL(new Blob([text], { type: "text/plain" })) }, "Download");
    v.card.appendChild(h("div", {},
      h("ul", { class: "codes" }, codes.map(function (c) { return h("li", {}, c); })),
      h("div", { class: "row" }, copyBtn, dl, h("button", { class: "btn ghost small", type: "button", onclick: function () { window.print(); } }, "Print")),
      h("label", { class: "check", for: "ack" }, ack, h("span", {}, "I’ve saved these somewhere safe (a password manager, or printed).")),
      go));
    mount(v.wrap);
  }

  function notice(msg) {
    var box = h("div", { class: "alert warn", role: "status" }, msg);
    var main = document.querySelector(".main");
    if (main) main.insertBefore(box, main.firstChild);
  }

  function signOut() {
    return api("POST", "/auth/logout").catch(function () {}).then(refreshAndRoute);
  }

  /* ----------------------------------------------------------------- dashboard */
  var SOON = [["Shop & products", "Phase 1"], ["Runs & events", "Phase 1"], ["Services & packages", "Phase 1"], ["FAQ & testimonials", "Phase 1"],
              ["Photos", "Phase 2"], ["Journal", "Phase 2"], ["Orders", "Phase 3"], ["Messages", "Phase 3"]];

  function dashboard() {
    var tab = location.hash === "#account" ? "account" : "home";
    var page = h("div", { class: "main", id: "main" });
    var nav = h("nav", { class: "nav", "aria-label": "Admin sections" }, h("ul", {},
      h("li", {}, h("a", { href: "#", "aria-current": tab === "home" ? "page" : false }, "Overview")),
      SOON.map(function (s) { return h("li", {}, h("span", { class: "soon" }, s[0], h("span", { class: "tag" }, s[1]))); }),
      h("li", {}, h("a", { href: "#account", "aria-current": tab === "account" ? "page" : false }, "Account"))));
    var shell = h("div", { class: "shell" },
      h("header", { class: "topbar" },
        h("div", { class: "brand" }, h("span", {}, "She", h("b", {}, "OnTheRun"), " · Admin")),
        h("div", { class: "who" }, h("span", {}, session.user.email), h("button", { class: "btn ghost small", onclick: signOut }, "Sign out"))),
      h("div", { class: "layout" }, nav, page));
    app.replaceChildren(shell);
    window.onhashchange = function () { if (session.stage === "full") dashboard(); };
    (tab === "account" ? accountView : homeView)(page);
  }

  function homeView(page) {
    page.appendChild(h("h1", {}, "Hello, and welcome"));
    page.appendChild(h("p", { class: "muted" }, "This is your control room. For now it holds the secure sign-in and a health check of the hosting. Editors for the shop, events, prices and the rest arrive next."));

    var list = h("ul", { class: "checks" });
    var pill = h("span", { class: "pill warn" }, "Checking…");
    var panel = h("section", { class: "panel" }, h("h2", {}, "Hosting check", pill), list);
    page.appendChild(panel);
    page.appendChild(h("section", { class: "panel" },
      h("h2", {}, "What’s coming"),
      h("ul", { class: "roadmap" },
        [["Phase 1", "Products, events, services & prices, FAQ, testimonials, site settings — with English and Arabic side by side."],
         ["Phase 2", "Photo library and the Journal."],
         ["Phase 3", "Shop orders, order alerts by email, and the messages inbox."]].map(function (r) {
          return h("li", {}, h("span", { class: "tag when" }, r[0]), h("span", {}, r[1]));
        }))));

    api("GET", "/admin/server-check").then(function (r) {
      var bad = r.checks.filter(function (c) { return c.status === "fail"; }).length;
      var warn = r.checks.filter(function (c) { return c.status === "warn"; }).length;
      pill.className = "pill " + (bad ? "fail" : warn ? "warn" : "ok");
      pill.textContent = bad ? bad + " to fix" : warn ? warn + " to look at" : "All good";
      var order = { fail: 0, warn: 1, ok: 2 };
      r.checks.slice().sort(function (a, b) { return order[a.status] - order[b.status]; }).forEach(function (c) {
        list.appendChild(h("li", {},
          h("span", { class: "pill " + c.status }, c.status === "ok" ? "OK" : c.status === "warn" ? "Check" : "Fix"),
          h("span", { class: "what" }, c.label),
          h("span", { class: "detail" }, c.detail)));
      });
    }).catch(function (err) {
      pill.className = "pill fail"; pill.textContent = "Error";
      list.appendChild(h("li", {}, h("span", { class: "detail" }, err.message)));
      if (err.code === "auth") refreshAndRoute();
    });
  }

  function accountView(page) {
    page.appendChild(h("h1", {}, "Account"));
    page.appendChild(h("section", { class: "panel" },
      h("h2", {}, "Sign-in"),
      h("p", {}, "Signed in as ", h("strong", {}, session.user.email), "."),
      h("p", { class: "muted" }, "Two-step sign-in is on: every sign-in needs a code from your authenticator app.")));

    var done = h("div", { role: "status" });
    var f = form([
      field("current", "Current password", { type: "password", autocomplete: "current-password", required: true }),
      field("new1", "New password", { type: "password", autocomplete: "new-password", required: true, minlength: 12 }, "At least 12 characters."),
      field("new2", "Repeat new password", { type: "password", autocomplete: "new-password", required: true })
    ], "Change password", function (fm) {
      done.replaceChildren();
      if (val(fm, "new1") !== val(fm, "new2")) throw new Error("The two new passwords don’t match.");
      return api("POST", "/auth/password", { current: val(fm, "current"), new: val(fm, "new1") }).then(function () {
        fm.reset();
        done.replaceChildren(h("div", { class: "alert ok" }, "Password changed."));
      });
    });
    page.appendChild(h("section", { class: "panel" }, h("h2", {}, "Change password"), done, f));
  }

  /* ---------------------------------------------------------------------- start */
  loadState().then(route).catch(function (err) {
    var v = authCard("Can’t start the admin");
    v.card.appendChild(h("div", { class: "alert error" }, err.message));
    v.card.appendChild(h("button", { class: "btn", onclick: function () { location.reload(); } }, "Try again"));
    mount(v.wrap);
  });
})();
