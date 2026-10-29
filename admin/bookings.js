/* =============================================================================
   SheOnTheRun admin — Bookings.
   Consultation requests from the website calendar. A request holds its time until she
   confirms or cancels it; cancelling gives the time back to the calendar.
   ========================================================================== */
(function () {
  "use strict";
  var S = window.SOTR, h = S.h;

  var STATUS = [["new", "New"], ["confirmed", "Confirmed"], ["cancelled", "Cancelled"]];
  function label(v) { var x = STATUS.filter(function (i) { return i[0] === v; })[0]; return x ? x[1] : v; }

  /** A Lebanese local number (03 123 456, 70 123 456) becomes international for the WhatsApp link. */
  function waDigits(phone) {
    var d = String(phone || "").replace(/\D/g, "");
    if (d.indexOf("00") === 0) return d.slice(2);
    if (d.indexOf("0") === 0) return "961" + d.slice(1);
    if (d.length <= 8) return "961" + d;
    return d;
  }
  function shortDay(iso) {
    var d = new Date(iso + "T12:00:00Z");
    return isNaN(d) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  }

  S.bookingsView = function (page) {
    var st = { status: "", scope: "upcoming", page: 1, open: null };
    var box = h("div", {});
    S.put(page,
      h("h1", {}, "Bookings"),
      h("p", { class: "muted" }, "Consultation requests from your website calendar. A new request holds its time until you confirm or cancel it — and it’s also emailed to you. Set the times you offer under Availability."),
      box);

    function load() {
      var qs = "?status=" + encodeURIComponent(st.status) + "&scope=" + st.scope + "&page=" + st.page;
      return S.api("GET", "/admin/bookings" + qs).then(paint);
    }

    function paint(r) {
      var tabs = h("div", { class: "tabs", role: "tablist" }, [["", "All"]].concat(STATUS).map(function (t) {
        var n = t[0] === "" ? r.counts.all : r.counts[t[0]];
        return h("button", { type: "button", role: "tab", class: "tab" + (st.status === t[0] ? " on" : ""), "aria-selected": st.status === t[0] ? "true" : "false",
          onclick: function () { st.status = t[0]; st.page = 1; st.open = null; load(); } }, t[1], h("span", { class: "tabn" }, String(n || 0)));
      }));
      var scope = h("div", { class: "tabs", role: "group", "aria-label": "Which dates" }, [["upcoming", "Upcoming"], ["past", "Past"]].map(function (s) {
        return h("button", { type: "button", class: "tab" + (st.scope === s[0] ? " on" : ""), "aria-pressed": st.scope === s[0] ? "true" : "false",
          onclick: function () { st.scope = s[0]; st.page = 1; st.open = null; load(); } }, s[1]);
      }));
      var list = r.bookings.length ? r.bookings.map(card)
        : [h("p", { class: "muted empty" }, st.scope === "past" ? "Nothing in the past." : st.status ? "Nothing here." : "No requests yet. They appear here when someone picks a time on your website.")];
      var pages = Math.max(1, Math.ceil(r.total / r.per));
      S.put(box,
        h("div", { class: "inbox-head" }, tabs, scope),
        h("div", { class: "inbox" }, list),
        pages > 1 ? h("div", { class: "pager" },
          h("button", { type: "button", class: "btn ghost small", disabled: st.page <= 1, onclick: function () { st.page--; load(); } }, "← Earlier"),
          h("span", { class: "muted" }, "Page " + st.page + " of " + pages),
          h("button", { type: "button", class: "btn ghost small", disabled: st.page >= pages, onclick: function () { st.page++; load(); } }, "Later →")) : null);
      S.refreshCounts && S.refreshCounts();
    }

    function card(b) {
      var open = st.open === b.id;
      var head = h("button", { type: "button", class: "inbox-row" + (open ? " open" : "") + (b.status === "new" ? " fresh" : ""), "aria-expanded": open ? "true" : "false",
        onclick: function () { st.open = open ? null : b.id; load(); } },
        h("span", { class: "ir-main" }, h("strong", {}, shortDay(b.date) + " · " + b.time), h("span", { class: "muted" }, " · " + b.name)),
        h("span", { class: "ir-sub muted" }, b.service + " · " + b.place_label),
        h("span", { class: "ir-flags" }, h("span", { class: "flag " + (b.status === "new" ? "info" : b.status === "cancelled" ? "muted" : "ok") }, label(b.status))));
      return h("div", { class: "inbox-item" }, head, open ? detail(b) : null);
    }

    function detail(b) {
      function update(call) { return call.then(function () { S.toast("Saved."); return load(); }, function (e) { S.toast(e.message, "bad"); }); }
      var first = b.name.split(" ")[0];
      var wa = "https://wa.me/" + waDigits(b.phone) + "?text=";
      var confirmText = "Hi " + first + "! Your booking is confirmed: " + b.service + ", " + b.when + " (" + b.place_label + "). Looking forward to seeing you.";
      var moveText = "Hi " + first + ", thank you for your request for " + b.when + ". Unfortunately I can’t do that time — could we find another one?";
      var notes = h("textarea", { rows: 3, maxlength: 2000, id: "bnotes-" + b.id, placeholder: "Private notes — only admins see these" }, b.notes || "");
      return h("div", { class: "inbox-detail" },
        b.mail_status === "failed" ? h("div", { class: "alert warn" }, "The email alert for this request couldn’t be sent. Check the Hosting check on the Overview page.") : null,
        h("div", { class: "cols" },
          h("div", {},
            h("h3", {}, "When"),
            h("p", {}, h("strong", {}, b.when), " (Beirut time)"),
            h("p", {}, b.place_label),
            h("p", { class: "muted" }, b.service)),
          h("div", {},
            h("h3", {}, "Client"),
            h("p", {}, h("strong", {}, b.name)),
            h("p", {}, h("a", { href: "tel:" + b.phone.replace(/[^\d+]/g, "") }, b.phone), " · ", h("a", { href: wa + encodeURIComponent(""), target: "_blank", rel: "noopener" }, "WhatsApp ↗")),
            b.email ? h("p", {}, h("a", { href: "mailto:" + b.email }, b.email)) : null)),
        b.note ? h("div", {}, h("h3", {}, "Their note"), h("p", { class: "pre message" }, b.note)) : null,
        h("h3", {}, "Status"),
        h("div", { class: "status-row", role: "group", "aria-label": "Booking status" }, STATUS.map(function (s) {
          return h("button", { type: "button", class: "btn small" + (b.status === s[0] ? "" : " ghost"), "aria-pressed": b.status === s[0] ? "true" : "false",
            onclick: function () {
              if (s[0] === b.status) return;
              if (s[0] === "cancelled" && !window.confirm("Cancel this booking? The time goes back on your calendar for others to pick.")) return;
              update(S.api("PUT", "/admin/bookings/" + b.id + "/status", { status: s[0] }));
            } }, s[1]);
        })),
        b.status !== "cancelled" ? h("div", { class: "row mt" },
          h("a", { class: "btn small", href: wa + encodeURIComponent(confirmText), target: "_blank", rel: "noopener" }, "WhatsApp them: it’s confirmed"),
          h("a", { class: "btn ghost small", href: wa + encodeURIComponent(moveText), target: "_blank", rel: "noopener" }, "WhatsApp them: ask for another time")) : null,
        h("h3", {}, "Notes"), notes,
        h("div", { class: "row mt" },
          h("button", { type: "button", class: "btn small", onclick: function () { update(S.api("PUT", "/admin/bookings/" + b.id + "/notes", { notes: notes.value })); } }, "Save notes"),
          h("button", { type: "button", class: "btn danger small", onclick: function () {
            if (!window.confirm("Delete this booking for good? " + b.name + "’s details are removed and the time goes back on your calendar.")) return;
            S.api("DELETE", "/admin/bookings/" + b.id).then(function () { st.open = null; S.toast("Deleted."); return load(); }, function (e) { S.toast(e.message, "bad"); });
          } }, "Delete")));
    }

    return load();
  };
})();
