/* =============================================================================
   SheOnTheRun admin — Availability.
   The times clients can pick when they book a consultation. Her usual week, days off,
   one-off days, and two simple rules. Saved times are live straight away: there is no
   Publish step for something that changes every week.
   ========================================================================== */
(function () {
  "use strict";
  var S = window.SOTR, h = S.h;

  var DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];
  var HORIZON = [[14, "2 weeks"], [28, "4 weeks"], [42, "6 weeks"], [56, "8 weeks"], [84, "12 weeks"]];
  var NOTICE = [[0, "No minimum"], [3, "3 hours"], [12, "12 hours"], [24, "1 day"], [48, "2 days"], [168, "1 week"]];

  function dayLabel(iso) {
    var d = new Date(iso + "T12:00:00Z");
    return isNaN(d) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  S.availabilityView = function (page) {
    return S.api("GET", "/admin/availability").then(function (r) {
      var doc = r.doc, places = r.places, today = r.today;
      var dirty = false, errors = [];
      var root = h("div", {});
      S.pageDirty = function () { return dirty; };

      function touch() {
        if (!dirty) { dirty = true; bar(); }
      }
      function placeOptions(selected) {
        return Object.keys(places).map(function (k) { return h("option", { value: k, selected: k === selected }, places[k]); });
      }

      /* A list of times, each with where it is. */
      function slotList(list, label) {
        var box = h("div", { class: "slot-list" });
        function paint() {
          S.put(box,
            list.length ? list.map(function (s, i) {
              return h("div", { class: "slot-row" },
                h("input", { type: "time", step: "300", value: s.time, "aria-label": label + ", time " + (i + 1), oninput: function (e) { s.time = e.target.value; touch(); } }),
                h("select", { "aria-label": label + ", place " + (i + 1), onchange: function (e) { s.place = e.target.value; touch(); } }, placeOptions(s.place)),
                h("button", { type: "button", class: "icon", "aria-label": "Remove time " + (i + 1) + " on " + label, onclick: function () { list.splice(i, 1); touch(); paint(); } }, "×"));
            }) : h("p", { class: "muted small slot-none" }, "No times."),
            h("button", { type: "button", class: "btn ghost small", onclick: function () {
              var last = list[list.length - 1];
              list.push({ time: "", place: last ? last.place : "gemmayze" });
              touch(); paint();
              var inputs = box.querySelectorAll('input[type="time"]');
              if (inputs.length) inputs[inputs.length - 1].focus();
            } }, "+ Add a time"));
        }
        paint();
        return box;
      }

      function weekPanel() {
        return h("section", { class: "panel" },
          h("h2", {}, "Your usual week"),
          h("p", { class: "muted" }, "The start times clients can pick, each with where you’ll be. Leave a day empty if you don’t see clients that day."),
          h("div", { class: "avail-week" }, DAYS.map(function (d) {
            var list = doc.weekly[d[0]];
            var copy = ["mon", "tue", "wed", "thu", "fri"].indexOf(d[0]) > -1
              ? h("button", { type: "button", class: "btn ghost small", onclick: function () {
                  if (!list.length) { S.toast("Add a time to " + d[1] + " first, then copy it.", "warn"); return; }
                  var others = ["mon", "tue", "wed", "thu", "fri"].filter(function (x) { return x !== d[0] && doc.weekly[x].length; });
                  if (others.length && !window.confirm("This replaces the times already set on the other weekdays. Continue?")) return;
                  ["mon", "tue", "wed", "thu", "fri"].forEach(function (x) { if (x !== d[0]) doc.weekly[x] = clone(list); });
                  touch(); paintAll();
                } }, "Copy to every weekday")
              : null;
            return h("div", { class: "avail-day" },
              h("div", { class: "avail-head" }, h("h3", {}, d[1]), copy),
              slotList(list, d[1]));
          })));
      }

      function offPanel() {
        var input = h("input", { type: "date", id: "off-date", min: today, "aria-label": "Add a day off" });
        var chips = h("div", { class: "chips" });
        function paint() {
          S.put(chips, doc.daysOff.length ? doc.daysOff.map(function (d, i) {
            return h("span", { class: "chip" }, dayLabel(d),
              h("button", { type: "button", "aria-label": "Remove " + dayLabel(d), onclick: function () { doc.daysOff.splice(i, 1); touch(); paint(); } }, "×"));
          }) : h("p", { class: "muted small" }, "No days off."));
        }
        paint();
        return h("section", { class: "panel" },
          h("h2", {}, "Days off"),
          h("p", { class: "muted" }, "Holidays, travel, a day you need. Nothing can be booked on these days, whatever your usual week says."),
          h("div", { class: "add-day" }, input,
            h("button", { type: "button", class: "btn small", onclick: function () {
              if (!input.value) { S.toast("Choose a date first.", "warn"); return; }
              if (doc.daysOff.indexOf(input.value) === -1) { doc.daysOff.push(input.value); doc.daysOff.sort(); touch(); }
              input.value = ""; paint();
            } }, "Add day off")),
          chips);
      }

      function extraPanel() {
        var box = h("div", { class: "extra-days" });
        function paint() {
          S.put(box,
            doc.extra.length ? doc.extra.map(function (x, i) {
              return h("div", { class: "avail-day extra" },
                h("div", { class: "avail-head" },
                  h("input", { type: "date", value: x.date, min: today, "aria-label": "Date of one-off day " + (i + 1), oninput: function (e) { x.date = e.target.value; touch(); } }),
                  h("button", { type: "button", class: "btn danger small", onclick: function () { doc.extra.splice(i, 1); touch(); paint(); } }, "Remove this day")),
                slotList(x.slots, x.date ? dayLabel(x.date) : "one-off day"));
            }) : h("p", { class: "muted small" }, "No one-off days."),
            h("button", { type: "button", class: "btn ghost small", onclick: function () { doc.extra.push({ date: "", slots: [{ time: "", place: "gemmayze" }] }); touch(); paint(); } }, "+ Add a one-off day"));
        }
        paint();
        return h("section", { class: "panel" },
          h("h2", {}, "One-off days"),
          h("p", { class: "muted" }, "A Saturday clinic, an evening online — a single day with its own times. They’re added to that day’s usual times."),
          box);
      }

      function rulesPanel() {
        function pick(list, value) { return list.map(function (o) { return h("option", { value: o[0], selected: o[0] === value }, o[1]); }); }
        return h("section", { class: "panel" },
          h("h2", {}, "Rules"),
          h("div", { class: "rules" },
            h("div", { class: "field" }, h("label", { for: "av-horizon" }, "How far ahead clients can book"),
              h("select", { id: "av-horizon", onchange: function (e) { doc.horizonDays = +e.target.value; touch(); } }, pick(HORIZON, doc.horizonDays))),
            h("div", { class: "field" }, h("label", { for: "av-notice" }, "Closest a time can be to now"),
              h("select", { id: "av-notice", onchange: function (e) { doc.noticeHours = +e.target.value; touch(); } }, pick(NOTICE, doc.noticeHours)),
              h("p", { class: "hint" }, "A time stops being offered this long before it starts.")),
            h("div", { class: "field wide" },
              h("label", { class: "toggle", for: "av-auto" },
                h("input", { type: "checkbox", id: "av-auto", checked: doc.autoConfirm !== false, onchange: function (e) { doc.autoConfirm = e.target.checked; touch(); } }),
                h("span", {}, "Confirm bookings automatically")),
              h("p", { class: "hint" }, "On: a client who picks a time is booked straight away and you get an email. Off: it’s a request that holds the time until you confirm it under Bookings. Either way, you can cancel any booking and message the client.")),
            h("div", { class: "field wide" }, h("label", { for: "av-note" }, "A line shown beside the calendar (optional)"),
              h("input", { type: "text", id: "av-note", maxlength: 300, value: doc.note || "", placeholder: "e.g. Sessions are 45 minutes. Online sessions are on Zoom.", oninput: function (e) { doc.note = e.target.value; touch(); } }),
              h("p", { class: "hint" }, "Times are always shown in Beirut time."))));
      }

      var barEl = h("div", { class: "savebar", role: "region", "aria-label": "Save" });
      function bar() {
        S.put(barEl,
          dirty ? h("span", {}, "You have unsaved changes") : h("span", { class: "muted" }, r.updated_at ? "Saved. Clients see these times now." : "Nothing saved yet — until you do, the site books on WhatsApp."),
          h("span", { class: "savebar-actions" },
            h("a", { class: "btn ghost small", href: "/dietontherun.html#book", target: "_blank", rel: "noopener" }, "See what clients see"),
            h("button", { type: "button", class: "btn small", disabled: !dirty, onclick: save }, "Save availability")));
        barEl.className = "savebar" + (dirty ? " dirty" : "");
      }

      function describe(path) {
        var m = /^weekly\.(\w+)\.(\d+)\.(\w+)$/.exec(path);
        if (m) return (DAYS.filter(function (d) { return d[0] === m[1]; })[0] || [0, m[1]])[1] + ", time " + (+m[2] + 1);
        m = /^weekly\.(\w+)$/.exec(path);
        if (m) return (DAYS.filter(function (d) { return d[0] === m[1]; })[0] || [0, m[1]])[1];
        m = /^extra\.(\d+)(?:\.(\w+))?/.exec(path);
        if (m) return "One-off day " + (+m[1] + 1);
        m = /^daysOff\.(\d+)/.exec(path);
        if (m) return "Day off " + (+m[1] + 1);
        return { horizonDays: "How far ahead", noticeHours: "Closest a time can be", note: "The line beside the calendar" }[path] || path;
      }

      function save() {
        S.api("PUT", "/admin/availability", { doc: doc }).then(function (res) {
          doc = res.doc; r.updated_at = res.updated_at; dirty = false; errors = [];
          S.toast("Saved. Clients see these times now.");
          paintAll();
        }, function (err) {
          if (err.code === "invalid") {
            errors = (err.data && err.data.errors) || [];
            S.toast("Some times need fixing.", "bad");
            paintAll();
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            S.toast(err.message, "bad");
          }
        });
      }

      function paintAll() {
        S.put(root,
          errors.length ? h("div", { class: "alert error", role: "alert" },
            h("p", {}, "Some times need fixing before this can be saved:"),
            h("ul", {}, errors.map(function (e) { return h("li", {}, h("strong", {}, describe(e.path)), " — " + e.message); }))) : null,
          weekPanel(), offPanel(), extraPanel(), rulesPanel());
        bar();
      }

      S.put(page,
        h("h1", {}, "Availability"),
        h("p", { class: "muted" }, "The times clients can pick when they book a consultation on your website. Change them whenever you like — saved times are live straight away."),
        root, barEl);
      paintAll();
    });
  };
})();
