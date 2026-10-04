/* =============================================================================
   SheOnTheRun admin — sign-in screens, the app shell, Overview, Publish and Account.
   The content editor itself is in editor.js; shared helpers are in core.js.
   ========================================================================== */
(function () {
  "use strict";
  var S = window.SOTR, h = S.h, api = S.api, form = S.form, field = S.field, val = S.val;
  var app = document.getElementById("app");

  function mount(node) {
    S.put(app, node);
    var focus = node.querySelector("[autofocus], input:not([type=checkbox]), h1");
    if (focus) { if (focus.tagName === "H1") focus.setAttribute("tabindex", "-1"); focus.focus({ preventScroll: true }); }
  }

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
    var s = S.session;
    if (s.stage === "full") return shell();
    if (s.stage === "password") return s.next === "enroll" ? enroll() : secondStep();
    if (location.hash === "#invite") return acceptInvite();
    return s.setup_available ? setup() : login();
  }
  function refreshAndRoute() { return S.loadState().then(route); }

  /* --------------------------------------------------------------- sign-in */
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
    v.card.appendChild(h("p", { class: "muted center" }, h("a", { href: "#invite", onclick: function (e) { e.preventDefault(); location.hash = "#invite"; acceptInvite(); } }, "I have an invite code")));
    mount(v.wrap);
  }

  function acceptInvite() {
    var v = authCard("Join the admin", "Enter the email you were invited with, the invite code you were sent, and choose a password.");
    v.card.appendChild(form([
      field("email", "Your email", { type: "email", autocomplete: "username", required: true }),
      field("code", "Invite code", { type: "text", autocomplete: "off", autocapitalize: "none", spellcheck: "false", placeholder: "xxxxx-xxxxx", required: true }),
      field("password", "Choose a password", { type: "password", autocomplete: "new-password", required: true, minlength: 12 }, "At least 12 characters. Three or four random words is a great password."),
      field("password2", "Repeat the password", { type: "password", autocomplete: "new-password", required: true })
    ], "Continue", function (f) {
      if (val(f, "password") !== val(f, "password2")) throw new Error("The two passwords don’t match.");
      return api("POST", "/auth/invite/accept", { email: val(f, "email"), code: val(f, "code"), password: val(f, "password") }).then(function () {
        history.replaceState(null, "", location.pathname);
        return refreshAndRoute();
      });
    }));
    v.card.appendChild(h("p", { class: "muted center" }, h("a", { href: "#", onclick: function (e) { e.preventDefault(); history.replaceState(null, "", location.pathname); login(); } }, "Back to sign in")));
    mount(v.wrap);
  }

  function secondStep() {
    var useRecovery = false;
    var v = authCard("Enter your code", "Open your authenticator app and type the 6-digit code for SheOnTheRun.");
    var toggle = h("button", { type: "button", class: "linklike" }, "");
    var f = form([h("div", { class: "field", id: "codeField" })], "Sign in", function (fm) {
      return api("POST", "/auth/2fa", { code: val(fm, "code") }).then(function (r) {
        return refreshAndRoute().then(function () {
          if (r.recovery_used) S.toast("You signed in with a recovery code. " + r.recovery_left + " left — keep them somewhere safe.", "warn");
        });
      });
    }, h("p", { class: "muted" }, toggle));
    function renderField() {
      var box = f.querySelector("#codeField");
      S.put(box, 
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
      S.put(body, 
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
            return S.loadState().then(function () { recoveryCodes(res.recovery_codes); });
          });
        }));
    }).catch(function (err) {
      S.put(body, h("div", { class: "alert error" }, err.message), h("button", { class: "btn ghost", onclick: signOut }, "Start again"));
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

  function signOut() {
    if (S.editorDirty() && !window.confirm("You have unsaved changes. Sign out anyway?")) return;
    S.resetEditor();
    return api("POST", "/auth/logout").catch(function () {}).then(refreshAndRoute);
  }

  /* ------------------------------------------------------------------ shell */
  var NAV = [
    ["overview", "Overview"],
    ["orders", "Orders", null, "orders_new"],
    ["messages", "Messages", null, "messages_unread"],
    ["edit/shop", "Shop & products", "shop"],
    ["edit/runs", "Runs & events", "runs"],
    ["edit/offer", "Services & packages", "offer"],
    ["edit/testimonials", "Testimonials", "testimonials"],
    ["edit/settings", "Site settings", "settings"],
    ["photos", "Photos", "images"],
    ["edit/gallery", "Photo galleries", "gallery"],
    ["edit/posts", "Journal", "posts"],
    ["plans", "Meal plans", "plans"],
    ["publish", "Publish"],
    ["account", "Account"]
  ];
  var SOON = [];

  var status = { changed: {}, last_publish: null };
  var counts = { orders_new: 0, messages_unread: 0 };
  S.refreshCounts = function () {
    return api("GET", "/admin/counts").then(function (c) { counts = c; S.refreshNav(); }).catch(function () {});
  };
  var navEl, main, lastHash = "";

  S.refreshStatus = function () {
    return api("GET", "/admin/status").then(function (s) { status = s; S.refreshNav(); return s; }).catch(function () {});
  };

  S.refreshNav = function () {
    if (!navEl) return;
    var hash = location.hash.replace(/^#/, "") || "overview";
    var count = Object.keys(status.changed || {}).filter(function (k) { return status.changed[k]; }).length;
    S.put(navEl, h("ul", {},
      NAV.map(function (n) {
        var active = hash === n[0] || hash.indexOf(n[0] + "/") === 0;
        var dirty = n[2] && S.editorArea() === n[2] && S.editorDirty();
        var pending = n[2] && status.changed[n[2]];
        return h("li", {}, h("a", { href: "#" + n[0], "aria-current": active ? "page" : false },
          h("span", {}, n[1]),
          n[0] === "publish" && count ? h("span", { class: "badge" }, String(count)) : null,
          n[3] && counts[n[3]] ? h("span", { class: "badge hot" }, String(counts[n[3]])) : null,
          dirty ? h("span", { class: "dot unsaved", title: "Unsaved changes" }, h("span", { class: "vh-label" }, "Unsaved changes"))
            : pending ? h("span", { class: "dot pending", title: "Saved, not published yet" }, h("span", { class: "vh-label" }, "Not published yet")) : null));
      }),
      SOON.map(function (s) { return h("li", {}, h("span", { class: "soon" }, s[0], h("span", { class: "tag" }, s[1]))); })));
  };

  function shell() {
    main = h("main", { class: "main", id: "main" });
    navEl = h("nav", { class: "nav", "aria-label": "Admin sections" });
    S.put(app, h("div", { class: "shell" },
      h("header", { class: "topbar" },
        h("div", { class: "brand" }, h("span", {}, "She", h("b", {}, "OnTheRun"), " · Admin")),
        h("div", { class: "who" },
          h("a", { class: "btn small", href: "#publish" }, "Publish"),
          h("span", {}, S.session.user.email),
          h("button", { class: "btn ghost small", onclick: signOut }, "Sign out"))),
      h("div", { class: "layout" }, navEl, main)));
    lastHash = location.hash;
    window.onhashchange = onHash;
    S.refreshStatus();
    S.refreshCounts();
    clearInterval(S.countTimer);
    S.countTimer = setInterval(function () { if (S.session.stage === "full" && !document.hidden) S.refreshCounts(); }, 60000);
    show();
  }

  function onHash() {
    if (S.session.stage !== "full") return;
    var next = location.hash;
    var leavingArea = S.editorDirty() && !new RegExp("^#edit/" + S.editorArea() + "(/|$)").test(next);
    if (leavingArea) {
      if (!window.confirm("You have unsaved changes in " + areaLabel(S.editorArea()) + ". Leave without saving?")) {
        history.replaceState(null, "", lastHash || "#");
        return;
      }
      S.resetEditor();
    }
    lastHash = next;
    show();
  }

  function areaHref(a) {
    var n = NAV.filter(function (x) { return x[2] === a; })[0];
    return n ? "#" + n[0] : "#edit/" + a;
  }
  function areaLabel(a) { var n = NAV.filter(function (x) { return x[2] === a; })[0]; return n ? n[1] : a; }

  function show() {
    var hash = location.hash.replace(/^#/, "");
    S.put(main, h("p", { class: "muted" }, "Loading…"));
    S.refreshNav();
    var m = /^edit\/([a-z]+)(?:\/([\w.]+))?$/.exec(hash);
    var p = m ? S.editor(main, m[1], m[2] || "")
      : hash === "orders" ? S.ordersView(main)
      : hash === "messages" ? S.messagesView(main)
      : hash === "photos" ? S.photosView(main)
      : hash === "plans" ? S.plansView(main)
      : hash === "publish" ? publishView(main)
      : hash === "account" ? accountView(main)
      : overview(main);
    Promise.resolve(p).catch(function (err) {
      if (err.code === "auth") return refreshAndRoute();
      S.put(main, h("div", { class: "alert error" }, err.message));
    }).then(function () {
      var h1 = main.querySelector("h1");
      if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
    });
  }

  /* --------------------------------------------------------------- overview */
  function overview(page) {
    return Promise.all([S.refreshStatus(), api("GET", "/admin/overview")]).then(function (res) {
      var ov = res[1];
      var changed = Object.keys(status.changed || {}).filter(function (k) { return status.changed[k]; });
      var lp = status.last_publish;

      /* ---- stat cards ---- */
      function stat(n, label, kind, href) {
        return h("a", { class: "dash-stat", href: href },
          h("span", { class: "dash-n" + (n > 0 && kind === "hot" ? " hot" : "") }, String(n)),
          h("span", { class: "dash-label" }, label));
      }
      var ordN = (ov.orders && ov.orders.new) || 0;
      var msgN = (ov.messages && ov.messages.unread) || 0;
      var evtN = ov.events ? ov.events.length : 0;
      var stockN = ov.low_stock ? ov.low_stock.length : 0;

      var stats = h("div", { class: "dash-stats" },
        stat(ordN, ordN === 1 ? "new order" : "new orders", "hot", "#orders"),
        stat(msgN, msgN === 1 ? "unread message" : "unread messages", "hot", "#messages"),
        stat(evtN, evtN === 1 ? "upcoming event" : "upcoming events", "info", "#edit/runs"),
        stat(stockN, stockN === 1 ? "low stock item" : "low stock items", stockN > 0 ? "hot" : "info", "#edit/shop"));

      /* ---- upcoming events ---- */
      var eventsPanel = null;
      if (ov.events && ov.events.length) {
        eventsPanel = h("section", { class: "panel" },
          h("h2", {}, "Upcoming"),
          h("ul", { class: "dash-list" }, ov.events.map(function (e) {
            var spotsBadge = e.spots === 0 ? h("span", { class: "flag bad" }, "Fully booked")
              : e.spots != null && e.spots <= 5 ? h("span", { class: "flag warn" }, e.spots + " spot" + (e.spots === 1 ? "" : "s") + " left")
              : null;
            return h("li", {},
              h("div", {}, h("strong", {}, e.title), spotsBadge ? h("span", { class: "row-flags" }, spotsBadge) : null,
                h("div", { class: "muted small" }, S.fmtLocal(e.starts) + (e.place ? " · " + e.place : ""))));
          })),
          h("p", { class: "muted small" }, h("a", { href: "#edit/runs" }, "Edit runs & events")));
      }

      /* ---- low stock ---- */
      var stockPanel = null;
      if (ov.low_stock && ov.low_stock.length) {
        stockPanel = h("section", { class: "panel" },
          h("h2", {}, "Low stock", h("span", { class: "pill warn" }, String(ov.low_stock.length))),
          h("ul", { class: "dash-list" }, ov.low_stock.map(function (s) {
            var label = s.name + (s.option ? " — " + s.option : "");
            return h("li", {},
              h("div", {}, h("span", {}, label),
                h("span", { class: "flag" + (s.left === 0 ? " bad" : " warn") }, s.left === 0 ? "Sold out" : s.left + " left")));
          })),
          h("p", { class: "muted small" }, h("a", { href: "#edit/shop" }, "Update stock")));
      }

      /* ---- recent orders ---- */
      var recentPanel = null;
      if (ov.recent_orders && ov.recent_orders.length) {
        var statusLabel = { new: "New", confirmed: "Confirmed", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled" };
        var statusClass = { new: "info", confirmed: "ok", out_for_delivery: "warn", delivered: "ok", cancelled: "bad" };
        recentPanel = h("section", { class: "panel" },
          h("h2", {}, "Recent orders"),
          h("ul", { class: "dash-list" }, ov.recent_orders.map(function (o) {
            var priceStr = o.unpriced ? "Some prices TBD" : "$" + Number(o.total).toFixed(2);
            return h("li", {},
              h("a", { href: "#orders", class: "dash-order" },
                h("span", {}, "#" + o.order_number + " · " + o.name),
                h("span", { class: "row-flags" },
                  h("span", { class: "flag " + (statusClass[o.status] || "") }, statusLabel[o.status] || o.status),
                  h("span", { class: "flag" }, priceStr)),
                h("span", { class: "muted small" }, S.fmtUtc(o.created_at))));
          })),
          h("p", { class: "muted small" }, h("a", { href: "#orders" }, "All orders")));
      }

      /* ---- website status ---- */
      var websitePanel = h("section", { class: "panel" },
        h("h2", {}, "Website", changed.length ? h("span", { class: "pill warn" }, changed.length + " section" + (changed.length > 1 ? "s" : "") + " not published") : h("span", { class: "pill ok" }, "Up to date")),
        lp ? h("p", {}, "Last published ", h("strong", {}, S.fmtUtc(lp.at)), lp.by ? " by " + lp.by : "", lp.note ? " — \u201c" + lp.note + "\u201d" : "", ".") : null,
        changed.length ? h("p", {}, "Waiting to go live: " + changed.map(areaLabel).join(", ") + ". ", h("a", { href: "#publish" }, "Review and publish")) : null);

      /* ---- backups ---- */
      var backupPanel = h("section", { class: "panel" },
        h("h2", {}, "Backups"),
        h("p", {}, ov.last_backup
          ? h("span", {}, "Last automatic backup: ", h("strong", {}, S.fmtUtc(ov.last_backup)), ". Nightly backups keep the newest 14 days.")
          : h("span", { class: "muted" }, "No automatic backup yet.")),
        h("p", {},
          h("a", { class: "btn ghost small", href: "/api/admin/backup", download: true }, "Download backup"),
          h("span", { class: "muted small ml-sm" }, "Content, orders and messages — keep it private.")));

      /* ---- quick links ---- */
      var quickPanel = h("section", { class: "panel" },
        h("h2", {}, "Quick links"),
        h("ul", { class: "quick" },
          h("li", {}, h("a", { href: "#orders" }, "See new orders")),
          h("li", {}, h("a", { href: "#edit/runs" }, "Add a run or event")),
          h("li", {}, h("a", { href: "#edit/shop" }, "Update products, prices or stock")),
          h("li", {}, h("a", { href: "#photos" }, "Add photos")),
          h("li", {}, h("a", { href: "#edit/posts" }, "Write a Journal article")),
          h("li", {}, h("a", { href: "#edit/offer" }, "Change consultation or package prices")),
          h("li", {}, h("a", { href: "/", target: "_blank", rel: "noopener" }, "Open the website \u2197"))));

      /* ---- activity log ---- */
      var logList = h("ul", { class: "dash-log" });
      var logPager = h("div", { class: "pager" });
      var logPanel = h("details", { class: "panel" },
        h("summary", {}, h("span", { class: "h2like" }, "Activity log")),
        logList, logPager);

      function loadLog(pg) {
        api("GET", "/admin/activity?page=" + pg).then(function (r) {
          var items = r.items || [];
          var total = r.total || 0;
          var per = r.per || 50;
          var pages = Math.ceil(total / per);
          S.put(logList, items.length
            ? items.map(function (e) {
                return h("li", {},
                  h("div", { class: "log-what" }, e.what),
                  h("div", { class: "muted small" }, e.who + " · " + S.fmtUtc(e.at)));
              })
            : h("li", { class: "muted" }, "No activity recorded yet."));
          S.put(logPager, pages > 1 ? [
            pg > 1 ? h("button", { class: "btn ghost small", type: "button", onclick: function () { loadLog(pg - 1); } }, "\u2190 Newer") : null,
            h("span", { class: "muted small" }, "Page " + pg + " of " + pages),
            pg < pages ? h("button", { class: "btn ghost small", type: "button", onclick: function () { loadLog(pg + 1); } }, "Older \u2192") : null
          ] : null);
        }).catch(function (err) { S.put(logList, h("li", { class: "muted" }, err.message)); });
      }
      logPanel.addEventListener("toggle", function () { if (logPanel.open && !logList.children.length) loadLog(1); });

      /* ---- hosting check ---- */
      var checkList = h("ul", { class: "checks" });
      var checkPill = h("span", { class: "pill warn" }, "Checking\u2026");
      var checkPanel = h("details", { class: "panel" },
        h("summary", {}, h("span", { class: "h2like" }, "Hosting check "), checkPill), checkList);

      api("GET", "/admin/server-check").then(function (r) {
        var bad = r.checks.filter(function (c) { return c.status === "fail"; }).length;
        var warn = r.checks.filter(function (c) { return c.status === "warn"; }).length;
        checkPill.className = "pill " + (bad ? "fail" : warn ? "warn" : "ok");
        checkPill.textContent = bad ? bad + " to fix" : warn ? warn + " to look at" : "All good";
        var order = { fail: 0, warn: 1, ok: 2 };
        r.checks.slice().sort(function (a, b) { return order[a.status] - order[b.status]; }).forEach(function (c) {
          checkList.appendChild(h("li", {},
            h("span", { class: "pill " + c.status }, c.status === "ok" ? "OK" : c.status === "warn" ? "Check" : "Fix"),
            h("span", { class: "what" }, c.label), h("span", { class: "detail" }, c.detail)));
        });
      }).catch(function (err) { checkPill.className = "pill fail"; checkPill.textContent = "Error"; checkList.appendChild(h("li", {}, err.message)); });

      /* ---- assemble ---- */
      S.put(page,
        h("h1", {}, "Overview"),
        stats,
        websitePanel,
        eventsPanel,
        stockPanel,
        recentPanel,
        backupPanel,
        quickPanel,
        logPanel,
        checkPanel);
    });
  }

  /* ---------------------------------------------------------------- publish */
  function publishView(page) {
    return Promise.all([S.refreshStatus(), api("GET", "/admin/history")]).then(function (res) {
      var versions = res[1].versions;
      var changed = Object.keys(status.changed || {}).filter(function (k) { return status.changed[k]; });
      var unsaved = S.editorDirty();
      var result = h("div", { role: "status" });

      var publishBox = h("section", { class: "panel" }, h("h2", {}, "Publish"));
      if (unsaved) {
        publishBox.appendChild(h("div", { class: "alert warn" }, "You have unsaved changes in " + areaLabel(S.editorArea()) + ". ",
          h("a", { href: "#edit/" + S.editorArea() }, "Go back and save them"), " first, or they won’t be included."));
      }
      if (changed.length) {
        publishBox.append(
          h("p", {}, "These sections have saved changes that aren’t on the website yet:"),
          h("ul", {}, changed.map(function (a) { return h("li", {}, h("a", { href: areaHref(a) }, areaLabel(a))); })),
          form([field("note", "What changed? (optional)", { type: "text", maxlength: 200, placeholder: "e.g. Added October runs, new tee prices" })],
            "Publish now", function (f) {
              return api("POST", "/admin/publish", { note: val(f, "note") }).then(function () {
                S.toast("Published. The website shows the changes now (a refresh may be needed).");
                return publishView(page);
              }, function (err) {
                if (err.code === "invalid") {
                  var errs = (err.data && err.data.errors) || [];
                  S.put(result, h("div", { class: "alert error" }, h("p", {}, err.message),
                    h("ul", {}, errs.map(function (e) {
                      return h("li", {}, h("a", { href: areaHref(e.area) }, areaLabel(e.area)), " — " + e.message);
                    }))));
                  return;
                }
                throw err;
              });
            }, null, { inline: true }),
          result,
          h("p", { class: "muted small" },
            "Want to see it first? ",
            h("a", { href: S.previewHref(changed[0]), target: "_blank", rel: "noopener" }, "Preview the website with these changes"),
            " — only you can see it."),
          h("p", { class: "muted small" },
            "Changed your mind? ",
            h("button", { type: "button", class: "linklike", onclick: function () {
              if (!window.confirm("Throw away every saved change that isn’t published yet? The website stays as it is.")) return;
              api("POST", "/admin/discard").then(function () { S.resetEditor(); S.toast("Unpublished changes discarded."); publishView(page); }, function (e) { S.toast(e.message, "bad"); });
            } }, "Discard all unpublished changes")));
      } else {
        publishBox.appendChild(h("p", { class: "muted" }, "Everything saved is already live. Edit a section and save it, and it will show up here."));
      }

      S.put(page, 
        h("h1", {}, "Publish"),
        h("p", { class: "muted" }, "Saving keeps your work as a draft. Publishing puts every saved draft on the website at once."),
        publishBox,
        h("section", { class: "panel" },
          h("h2", {}, "History"),
          h("p", { class: "muted" }, "Every publish is kept. Restoring copies that version into your drafts; publish again to make it live."),
          h("ol", { class: "history" }, versions.map(function (v, i) {
            return h("li", {},
              h("div", {}, h("strong", {}, S.fmtUtc(v.at)), v.by ? " · " + v.by : "", i === 0 ? h("span", { class: "pill ok" }, "Live now") : null,
                v.note ? h("div", { class: "muted" }, v.note) : null),
              i === 0 ? null : h("button", { class: "btn ghost small", type: "button", onclick: function () {
                if (!window.confirm("Copy the version from " + S.fmtUtc(v.at) + " into your drafts? Your current unpublished changes are replaced.")) return;
                api("POST", "/admin/history/" + v.id + "/restore").then(function () {
                  S.resetEditor(); S.toast("Restored into your drafts. Publish to make it live."); publishView(page);
                }, function (e) { S.toast(e.message, "bad"); });
              } }, "Restore"));
          }))));
    });
  }

  /* ---------------------------------------------------------------- account */
  function accountView(page) {
    return api("GET", "/admin/admins").then(function (r) {
      var me = S.session.user;

      var emailDone = h("div", { role: "status" });
      var emailForm = form([
        field("newEmail", "New email", { type: "email", autocomplete: "email", required: true }),
        field("emailPw", "Your password", { type: "password", autocomplete: "current-password", required: true }, "To confirm it’s you.")
      ], "Change email", function (f) {
        return api("POST", "/auth/email", { email: val(f, "newEmail"), password: val(f, "emailPw") }).then(function () {
          return S.loadState().then(function () { S.toast("Email changed."); accountView(page); document.querySelector(".who span").textContent = S.session.user.email; });
        });
      }, null, { inline: true });

      var pwDone = h("div", { role: "status" });
      var pwForm = form([
        field("current", "Current password", { type: "password", autocomplete: "current-password", required: true }),
        field("new1", "New password", { type: "password", autocomplete: "new-password", required: true, minlength: 12 }, "At least 12 characters."),
        field("new2", "Repeat new password", { type: "password", autocomplete: "new-password", required: true })
      ], "Change password", function (f) {
        if (val(f, "new1") !== val(f, "new2")) throw new Error("The two new passwords don’t match.");
        return api("POST", "/auth/password", { current: val(f, "current"), new: val(f, "new1") }).then(function () {
          f.reset(); S.put(pwDone, h("div", { class: "alert ok" }, "Password changed."));
        });
      }, null, { inline: true });

      var inviteResult = h("div", { role: "status" });
      var inviteForm = form([field("inviteEmail", "Their email", { type: "email", required: true })], "Create invite", function (f) {
        var email = val(f, "inviteEmail");
        return api("POST", "/admin/admins/invite", { email: email }).then(function (inv) {
          f.reset();
          var msg = "You’re invited to the SheOnTheRun admin.\n\n1. Open https://sheontherun.com/admin/\n2. Choose “I have an invite code”\n3. Enter your email (" + email + ") and this code: " + inv.code +
            "\n\nThe code works once and expires on " + S.fmtUtc(inv.expires_at) + " (Beirut time). You’ll also set up an authenticator app on your phone.";
          var copy = h("button", { class: "btn ghost small", type: "button", onclick: function () {
            (navigator.clipboard ? navigator.clipboard.writeText(msg) : Promise.reject()).then(function () { copy.textContent = "Copied"; }, function () { copy.textContent = "Copy failed"; });
          } }, "Copy message");
          S.put(inviteResult, h("div", { class: "alert ok invite" },
            h("p", {}, "Invite created. Send this to " + email + " — by WhatsApp, for example. The code is shown only now."),
            h("pre", { class: "invite-msg" }, msg), copy));
          return reloadAdmins();
        });
      }, null, { inline: true });

      var adminsBox = h("div", {});
      function paintAdmins(data) {
        S.put(adminsBox, 
          h("ul", { class: "admins" }, data.admins.map(function (a) {
            return h("li", {},
              h("div", {}, h("strong", {}, a.email), a.you ? h("span", { class: "pill ok" }, "You") : null,
                h("div", { class: "muted small" }, a.last_login_at ? "Last signed in " + S.fmtUtc(a.last_login_at) : "Hasn’t signed in yet")),
              a.you ? null : h("button", { class: "btn danger small", type: "button", onclick: function () {
                if (!window.confirm("Remove " + a.email + "? They won’t be able to sign in any more.")) return;
                api("POST", "/admin/admins/" + a.id + "/remove").then(function () { S.toast("Removed " + a.email + "."); reloadAdmins(); }, function (e) { S.toast(e.message, "bad"); });
              } }, "Remove"));
          })),
          data.invites.length ? h("div", {}, h("h3", {}, "Waiting to accept"),
            h("ul", { class: "admins" }, data.invites.map(function (i) {
              return h("li", {}, h("div", {}, i.email, h("div", { class: "muted small" }, "Invite expires " + S.fmtUtc(i.expires_at))),
                h("button", { class: "btn ghost small", type: "button", onclick: function () {
                  api("POST", "/admin/invites/" + i.id + "/cancel").then(reloadAdmins, function (e) { S.toast(e.message, "bad"); });
                } }, "Cancel invite"));
            }))) : null);
      }
      function reloadAdmins() { return api("GET", "/admin/admins").then(paintAdmins); }
      paintAdmins(r);

      S.put(page, 
        h("h1", {}, "Account"),
        h("section", { class: "panel" }, h("h2", {}, "Your sign-in"),
          h("p", {}, "Signed in as ", h("strong", {}, me.email), ". Two-step sign-in is on."),
          h("h3", {}, "Change your email"), emailDone, emailForm,
          h("h3", {}, "Change your password"), pwDone, pwForm),
        h("section", { class: "panel" }, h("h2", {}, "Admins"),
          h("p", { class: "muted" }, "Everyone listed can edit and publish the website. Each person signs in with their own password and phone code."),
          adminsBox,
          h("h3", {}, "Invite someone"),
          h("p", { class: "muted small" }, "You get a one-time code to send them. They choose their own password and set up their own phone."),
          inviteForm, inviteResult));
    });
  }

  /* ------------------------------------------------------------------ start */
  S.loadState().then(route).catch(function (err) {
    var v = authCard("Can’t start the admin");
    v.card.appendChild(h("div", { class: "alert error" }, err.message));
    v.card.appendChild(h("button", { class: "btn", onclick: function () { location.reload(); } }, "Try again"));
    mount(v.wrap);
  });
})();
