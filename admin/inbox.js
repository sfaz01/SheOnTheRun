/* =============================================================================
   SheOnTheRun admin — Orders and Messages.
   Plain lists with a status filter, search, and one open item at a time.
   ========================================================================== */
(function () {
  "use strict";
  var S = window.SOTR, h = S.h;

  var ORDER_STATUS = [["new", "New"], ["confirmed", "Confirmed"], ["out_for_delivery", "Out for delivery"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]];
  var MSG_STATUS = [["unread", "Unread"], ["handled", "Handled"], ["archived", "Archived"]];
  function label(list, v) { var x = list.filter(function (i) { return i[0] === v; })[0]; return x ? x[1] : v; }

  function money(o) { return o.unpriced ? (o.total ? "$" + o.total + " + to confirm" : "Price to confirm") : "$" + o.total; }

  /** A Lebanese local number (03 123 456, 70 123 456) becomes international for the WhatsApp link. */
  function waDigits(phone) {
    var d = String(phone || "").replace(/\D/g, "");
    if (d.indexOf("00") === 0) return d.slice(2);
    if (d.indexOf("0") === 0) return "961" + d.slice(1);
    if (d.length <= 8) return "961" + d;
    return d;
  }

  function tabs(list, counts, current, onPick, allLabel) {
    var items = [["", allLabel || "All"]].concat(list);
    return h("div", { class: "tabs", role: "tablist" }, items.map(function (t) {
      var n = t[0] === "" ? counts.all : counts[t[0]];
      return h("button", { type: "button", role: "tab", class: "tab" + (current === t[0] ? " on" : ""), "aria-selected": current === t[0] ? "true" : "false",
        onclick: function () { onPick(t[0]); } }, t[1], h("span", { class: "tabn" }, String(n || 0)));
    }));
  }

  function pager(page, total, per, go) {
    var pages = Math.max(1, Math.ceil(total / per));
    if (pages <= 1) return null;
    return h("div", { class: "pager" },
      h("button", { type: "button", class: "btn ghost small", disabled: page <= 1, onclick: function () { go(page - 1); } }, "← Newer"),
      h("span", { class: "muted" }, "Page " + page + " of " + pages),
      h("button", { type: "button", class: "btn ghost small", disabled: page >= pages, onclick: function () { go(page + 1); } }, "Older →"));
  }

  /* ------------------------------------------------------------------ orders */
  S.ordersView = function (page) {
    var st = { status: "", q: "", page: 1, open: null };
    var box = h("div", {});
    S.put(page, h("h1", {}, "Orders"), h("p", { class: "muted" }, "Orders placed on the shop. New ones also arrive by email."), box);

    function load() {
      var qs = "?status=" + encodeURIComponent(st.status) + "&q=" + encodeURIComponent(st.q) + "&page=" + st.page;
      return S.api("GET", "/admin/orders" + qs).then(paint);
    }

    function paint(r) {
      var list = r.orders.length ? r.orders.map(card) : [h("p", { class: "muted empty" }, st.q || st.status ? "No orders match." : "No orders yet. They’ll appear here as soon as someone checks out.")];
      var search = h("input", { type: "search", class: "photo-search", placeholder: "Search by name, phone or order number", "aria-label": "Search orders", value: st.q,
        onkeydown: function (e) { if (e.key === "Enter") { st.q = e.target.value.trim(); st.page = 1; load(); } } });
      S.put(box,
        h("div", { class: "inbox-head" }, tabs(ORDER_STATUS, r.counts, st.status, function (v) { st.status = v; st.page = 1; st.open = null; load(); }),
          h("a", { class: "btn ghost small", href: "/api/admin/orders/export", download: "" }, "Export all (CSV)")),
        search,
        h("div", { class: "inbox" }, list),
        pager(st.page, r.total, r.per, function (p) { st.page = p; load(); }));
      S.refreshCounts && S.refreshCounts();
    }

    function card(o) {
      var open = st.open === o.id;
      var head = h("button", { type: "button", class: "inbox-row" + (open ? " open" : "") + (o.status === "new" ? " fresh" : ""), "aria-expanded": open ? "true" : "false",
        onclick: function () { st.open = open ? null : o.id; load(); } },
        h("span", { class: "ir-main" }, h("strong", {}, o.name), h("span", { class: "muted" }, " · " + o.order_number)),
        h("span", { class: "ir-sub muted" }, S.fmtUtc(o.created_at) + " · " + o.governorate),
        h("span", { class: "ir-flags" },
          h("span", { class: "flag " + (o.status === "new" ? "info" : o.status === "cancelled" ? "muted" : o.status === "delivered" ? "ok" : "warn") }, label(ORDER_STATUS, o.status)),
          h("span", { class: "flag " + (o.payment_status === "paid" ? "ok" : "muted") }, o.payment_status === "paid" ? "Paid" : "Unpaid"),
          h("span", { class: "ir-total" }, money(o))));
      return h("div", { class: "inbox-item" }, head, open ? detail(o) : null);
    }

    function detail(o) {
      function update(call) {
        return call.then(function () { S.toast("Saved."); return load(); }, function (e) { S.toast(e.message, "bad"); });
      }
      var wa = waDigits(o.phone);
      var items = h("table", { class: "items" }, h("tbody", {}, o.items.map(function (i) {
        return h("tr", {}, h("td", {}, i.qty + " ×"), h("td", {}, i.name + (i.option ? " (" + i.option + ")" : "")),
          h("td", { class: "r" }, i.price === null ? "to confirm" : "$" + (Math.round(i.price * i.qty * 100) / 100)));
      })), h("tfoot", {}, h("tr", {}, h("td", { colspan: "2" }, "Total"), h("td", { class: "r" }, money(o)))));

      var statuses = h("div", { class: "status-row", role: "group", "aria-label": "Order status" }, ORDER_STATUS.map(function (s) {
        return h("button", { type: "button", class: "btn small" + (o.status === s[0] ? "" : " ghost"), "aria-pressed": o.status === s[0] ? "true" : "false",
          onclick: function () {
            if (s[0] === o.status) return;
            if (s[0] === "cancelled" && !window.confirm("Cancel this order? The items go back into stock.")) return;
            update(S.api("PUT", "/admin/orders/" + o.id + "/status", { status: s[0] }));
          } }, s[1]);
      }));

      var ref = h("input", { type: "text", maxlength: 100, value: o.payment_ref || "", id: "pay-ref-" + o.id, placeholder: "e.g. Whish transfer number" });
      var notes = h("textarea", { rows: 3, maxlength: 2000, id: "notes-" + o.id, placeholder: "Private notes — only admins see these" }, o.notes || "");

      return h("div", { class: "inbox-detail" },
        o.mail_status === "failed" ? h("div", { class: "alert warn" }, "The email alert for this order couldn’t be sent. Check the Hosting check on the Overview page.") : null,
        h("div", { class: "cols" },
          h("div", {}, h("h3", {}, "Customer"),
            h("p", {}, h("strong", {}, o.name)),
            h("p", {}, h("a", { href: "tel:" + o.phone.replace(/[^\d+]/g, "") }, o.phone), " · ", h("a", { href: "https://wa.me/" + wa, target: "_blank", rel: "noopener" }, "WhatsApp ↗")),
            h("p", { class: "pre" }, o.governorate + "\n" + o.address)),
          h("div", {}, h("h3", {}, "Items"), items)),
        h("h3", {}, "Status"), statuses,
        h("h3", {}, "Payment"),
        h("p", { class: "muted" }, o.payment_label),
        h("div", { class: "pay-row" },
          h("label", { class: "toggle", for: "paid-" + o.id }, h("input", { type: "checkbox", id: "paid-" + o.id, checked: o.payment_status === "paid" }), h("span", {}, "Paid")),
          ref,
          h("button", { type: "button", class: "btn small", onclick: function () {
            update(S.api("PUT", "/admin/orders/" + o.id + "/payment", { payment_status: document.getElementById("paid-" + o.id).checked ? "paid" : "unpaid", payment_ref: ref.value }));
          } }, "Save payment")),
        h("h3", {}, "Notes"), notes,
        h("div", { class: "row mt" },
          h("button", { type: "button", class: "btn small", onclick: function () { update(S.api("PUT", "/admin/orders/" + o.id + "/notes", { notes: notes.value })); } }, "Save notes"),
          h("button", { type: "button", class: "btn danger small", onclick: function () {
            if (!window.confirm("Delete order " + o.order_number + "? This removes the customer’s details for good" + (o.status !== "cancelled" ? " and puts the items back into stock" : "") + ".")) return;
            S.api("DELETE", "/admin/orders/" + o.id).then(function () { st.open = null; S.toast("Deleted."); return load(); }, function (e) { S.toast(e.message, "bad"); });
          } }, "Delete order")));
    }

    return load();
  };

  /* ---------------------------------------------------------------- messages */
  S.messagesView = function (page) {
    var st = { status: "", page: 1, open: null };
    var box = h("div", {});
    S.put(page, h("h1", {}, "Messages"), h("p", { class: "muted" }, "Everything sent through the Connect form. Each one is also emailed to the inbox you chose for its subject."), box);

    function load() {
      return S.api("GET", "/admin/messages?status=" + encodeURIComponent(st.status) + "&page=" + st.page).then(paint);
    }

    function paint(r) {
      var list = r.messages.length ? r.messages.map(card) : [h("p", { class: "muted empty" }, st.status ? "Nothing here." : "No messages yet.")];
      S.put(box,
        h("div", { class: "inbox-head" }, tabs(MSG_STATUS, r.counts, st.status, function (v) { st.status = v; st.page = 1; st.open = null; load(); })),
        h("div", { class: "inbox" }, list),
        pager(st.page, r.total, r.per, function (p) { st.page = p; load(); }));
      S.refreshCounts && S.refreshCounts();
    }

    function card(m) {
      var open = st.open === m.id;
      var head = h("button", { type: "button", class: "inbox-row" + (open ? " open" : "") + (m.status === "unread" ? " fresh" : ""), "aria-expanded": open ? "true" : "false",
        onclick: function () { st.open = open ? null : m.id; load(); } },
        h("span", { class: "ir-main" }, h("strong", {}, m.name), h("span", { class: "muted" }, " · " + m.topic_label)),
        h("span", { class: "ir-sub muted" }, S.fmtUtc(m.created_at) + " · " + m.message.slice(0, 90) + (m.message.length > 90 ? "…" : "")),
        h("span", { class: "ir-flags" }, h("span", { class: "flag " + (m.status === "unread" ? "info" : "muted") }, label(MSG_STATUS, m.status))));
      return h("div", { class: "inbox-item" }, head, open ? detail(m) : null);
    }

    function detail(m) {
      function update(call) { return call.then(function () { S.toast("Saved."); return load(); }, function (e) { S.toast(e.message, "bad"); }); }
      var notes = h("textarea", { rows: 3, maxlength: 2000, id: "mnotes-" + m.id, placeholder: "Private notes — only admins see these" }, m.notes || "");
      return h("div", { class: "inbox-detail" },
        m.mail_status === "failed" ? h("div", { class: "alert warn" }, "The email alert for this message couldn’t be sent. Check the Hosting check on the Overview page.") : null,
        h("p", { class: "muted" }, "From ", h("strong", {}, m.name), m.email ? h("span", {}, " · ", h("a", { href: "mailto:" + m.email + "?subject=" + encodeURIComponent("Re: your message to SheOnTheRun") }, m.email)) : " (no email given)",
          m.routed_to ? " · alert sent to " + m.routed_to : ""),
        h("p", { class: "pre message" }, m.message),
        h("div", { class: "status-row" },
          m.status !== "handled" ? h("button", { type: "button", class: "btn small", onclick: function () { update(S.api("PUT", "/admin/messages/" + m.id + "/status", { status: "handled" })); } }, "Mark as handled") : null,
          m.status !== "unread" ? h("button", { type: "button", class: "btn ghost small", onclick: function () { update(S.api("PUT", "/admin/messages/" + m.id + "/status", { status: "unread" })); } }, "Mark as unread") : null,
          m.status !== "archived" ? h("button", { type: "button", class: "btn ghost small", onclick: function () { update(S.api("PUT", "/admin/messages/" + m.id + "/status", { status: "archived" })); } }, "Archive") : null),
        h("h3", {}, "Notes"), notes,
        h("div", { class: "row mt" },
          h("button", { type: "button", class: "btn small", onclick: function () { update(S.api("PUT", "/admin/messages/" + m.id + "/notes", { notes: notes.value })); } }, "Save notes"),
          h("button", { type: "button", class: "btn danger small", onclick: function () {
            if (!window.confirm("Delete this message for good?")) return;
            S.api("DELETE", "/admin/messages/" + m.id).then(function () { st.open = null; S.toast("Deleted."); return load(); }, function (e) { S.toast(e.message, "bad"); });
          } }, "Delete")));
    }

    return load();
  };
})();
