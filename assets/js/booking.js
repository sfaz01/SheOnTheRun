/* =============================================================================
   BOOKING — the calendar on the DietOnTheRun page.
   Shows the times Fatima has set on the admin's Availability page (GET /api/availability),
   lets a client pick one and send a request (POST /api/bookings). The request holds that
   time until she confirms it. Until she has set times up, nothing here appears and the
   "Book" buttons keep opening WhatsApp, exactly as before.
   ========================================================================== */
(function () {
  "use strict";

  var host = document.querySelector("[data-booking]");
  if (!host) return;
  var section = host.closest("section");
  var AR = document.documentElement.lang === "ar" || document.documentElement.dir === "rtl";
  var OFFER = window.SITE_OFFER || { services: [], packages: [] };
  var CFG = window.SITE || {};

  /* ------------------------------------------------------------ words ---- */
  var AR_WORDS = {
    "Book a time": "احجزي موعداً",
    "Pick how you'd like to meet, choose a day and a time, and send your request. I'll confirm by WhatsApp or phone — your time is held for you until I do.": "اختاري كيف تحبّين اللقاء، ثم اليوم والوقت، وأرسلي طلبك. سأؤكّد عبر واتساب أو الهاتف — ويبقى الموعد محجوزاً لكِ إلى أن أفعل.",
    "How would you like to meet?": "كيف تحبّين أن نلتقي؟",
    "In person": "حضورياً",
    "Online": "أونلاين",
    "Gemmayze clinic or Ohana Fitness, Haret Hreik": "عيادة الجمّيزة أو أوهانا فتنس في حارة حريك",
    "Video call, from anywhere": "مكالمة فيديو، من أي مكان",
    "What would you like to book?": "ماذا تودّين أن تحجزي؟",
    "Next available": "أقرب موعد متاح",
    "Choose this time": "اختاري هذا الموعد",
    "Choose a day": "اختاري يوماً",
    "Previous month": "الشهر السابق",
    "Next month": "الشهر التالي",
    "Times on {x}": "المواعيد يوم {x}",
    "Choose a day to see the times.": "اختاري يوماً لعرض المواعيد.",
    "No times are open for this way of meeting right now. Try the other one, or message me on WhatsApp.": "لا توجد مواعيد متاحة لهذه الطريقة حالياً. جرّبي الطريقة الأخرى أو راسليني على واتساب.",
    "Your time": "موعدك",
    "Change": "تغيير",
    "Your details": "بياناتك",
    "Full name": "الاسم الكامل",
    "Phone number": "رقم الهاتف",
    "Email (optional)": "البريد الإلكتروني (اختياري)",
    "Anything I should know? (optional)": "هل من شيء أودّ معرفته؟ (اختياري)",
    "Request this time": "اطلبي هذا الموعد",
    "Sending…": "جارٍ الإرسال…",
    "Times are Beirut time. A request isn't a booking until I confirm it.": "المواعيد بتوقيت بيروت. الطلب ليس حجزاً مؤكَّداً إلى أن أؤكّده.",
    "Enter your full name.": "أدخلي اسمك الكامل.",
    "Enter a phone number I can reach you on.": "أدخلي رقم هاتف يمكنني التواصل معك عليه.",
    "That email address doesn't look right.": "عنوان البريد الإلكتروني غير صحيح.",
    "That time has just been taken. Please choose another.": "تمّ حجز هذا الموعد للتوّ. اختاري موعداً آخر.",
    "That didn't go through. Please try again, or message me on WhatsApp.": "لم يتمّ الإرسال. حاولي مجدداً أو راسليني على واتساب.",
    "Request received": "وصلني طلبك",
    "Thank you, {x}.": "شكراً، {x}.",
    "Reference": "المرجع",
    "What happens next": "ما الذي سيحدث بعد ذلك",
    "I confirm your time by WhatsApp or phone, usually within a day.": "أؤكّد موعدك عبر واتساب أو الهاتف، عادةً خلال يوم.",
    "Until then, your time is held for you.": "إلى ذلك الحين، يبقى موعدك محجوزاً لكِ.",
    "If it doesn't suit you, tell me and we'll find another.": "إن لم يناسبك، أخبريني ونجد موعداً آخر.",
    "Book another time": "احجزي موعداً آخر",
    "Prefer WhatsApp? Message me": "تفضّلين واتساب؟ راسليني",
    "See open times": "شاهدي المواعيد المتاحة",
    "Gemmayze clinic": "عيادة الجمّيزة",
    "Ohana Fitness, Haret Hreik": "أوهانا فتنس، حارة حريك",
    "Consultation": "استشارة",
    "{x} package": "باقة {x}"
  };
  function t(s, vars) {
    var out = AR && AR_WORDS[s] != null ? AR_WORDS[s] : s;
    if (vars) Object.keys(vars).forEach(function (k) { out = out.split("{" + k + "}").join(vars[k]); });
    return out;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function placeName(key, fallback) { return t(fallback || key); }

  /* ------------------------------------------------------------ dates ---- */
  var LOCALE = AR ? "ar-LB" : "en-GB";
  function utc(iso) { var p = iso.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)); }
  function fmt(iso, opts) { return new Intl.DateTimeFormat(LOCALE, Object.assign({ timeZone: "UTC" }, opts)).format(utc(iso)); }
  function monthKey(iso) { return iso.slice(0, 7); }
  function addMonths(key, n) {
    var y = +key.slice(0, 4), m = +key.slice(5, 7) - 1 + n;
    return new Date(Date.UTC(y + Math.floor(m / 12), ((m % 12) + 12) % 12, 1)).toISOString().slice(0, 7);
  }
  function addDays(iso, n) { var d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  /* ------------------------------------------------------------ state ---- */
  var data = null;                 // what GET /api/availability returned
  var globalSwitch = document.querySelector("[data-switch]");
  var state = {
    mode: pressedMode() || "in-person", service: "", month: "", date: "", slot: null,
    form: { name: "", phone: "", email: "", note: "" }, errors: {}, sending: false, done: null, notice: ""
  };
  var focusKey = "";

  function pressedMode() {
    var b = globalSwitch && globalSwitch.querySelector('button[aria-pressed="true"]');
    return b ? b.getAttribute("data-mode") : "";
  }

  /* Slots she offers, narrowed to the chosen way of meeting. */
  function slotsFor(iso) {
    return ((data.days || {})[iso] || []).filter(function (s) { return state.mode === "online" ? s.place === "online" : s.place !== "online"; });
  }
  function nextAvailable() {
    var dates = Object.keys(data.days || {}).sort();
    for (var i = 0; i < dates.length; i++) {
      var s = slotsFor(dates[i]);
      if (s.length) return { date: dates[i], slot: s[0] };
    }
    return null;
  }
  function serviceOptions() {
    var list = [];
    (OFFER.services || []).forEach(function (s) {
      if ((s.modes || ["in-person", "online"]).indexOf(state.mode) > -1) list.push({ id: s.id, label: s.title + (s.duration ? " — " + s.duration : "") });
    });
    (OFFER.packages || []).forEach(function (p) { list.push({ id: p.id, label: t("{x} package", { x: p.name }) + (p.length ? " — " + p.length : "") }); });
    return list;
  }
  function ensureService() {
    var list = serviceOptions();
    if (!list.some(function (o) { return o.id === state.service; })) state.service = list.length ? list[0].id : "general";
  }

  /* ------------------------------------------------------------ render --- */
  function modeCards() {
    function card(mode, title, sub) {
      var on = state.mode === mode;
      return '<button type="button" class="bk-mode' + (on ? " on" : "") + '" role="radio" aria-checked="' + on + '" data-bk-mode="' + mode + '">' +
        '<span class="bk-mode-t">' + esc(title) + '</span><span class="bk-mode-s">' + esc(sub) + "</span></button>";
    }
    return '<div class="bk-modes" role="radiogroup" aria-label="' + esc(t("How would you like to meet?")) + '">' +
      card("in-person", t("In person"), t("Gemmayze clinic or Ohana Fitness, Haret Hreik")) +
      card("online", t("Online"), t("Video call, from anywhere")) + "</div>";
  }

  function calendar() {
    var today = data.today;
    var last = addDays(today, data.horizonDays || 28);
    var first = monthKey(today), end = monthKey(last);
    var y = +state.month.slice(0, 4), m = +state.month.slice(5, 7) - 1;
    var start = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;            // Monday first
    var count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var cells = "";
    for (var i = 0; i < start; i++) cells += '<span class="bk-day blank" aria-hidden="true"></span>';
    for (var d = 1; d <= count; d++) {
      var iso = state.month + "-" + (d < 10 ? "0" : "") + d;
      var n = iso < today || iso > last ? 0 : slotsFor(iso).length;
      var sel = state.date === iso;
      cells += n
        ? '<button type="button" class="bk-day open' + (sel ? " sel" : "") + '" data-bk-date="' + iso + '" aria-pressed="' + sel + '" aria-label="' + esc(fmt(iso, { weekday: "long", day: "numeric", month: "long" }) + ", " + n) + '">' + d + "</button>"
        : '<span class="bk-day off" aria-hidden="true">' + d + "</span>";
    }
    var dows = "";
    for (var k = 0; k < 7; k++) dows += "<span>" + esc(fmt("2026-11-" + (2 + k < 10 ? "0" : "") + (2 + k), { weekday: "narrow" })) + "</span>"; // 2 Nov 2026 is a Monday
    return '<div class="bk-cal" role="group" aria-label="' + esc(t("Choose a day")) + '">' +
      '<div class="bk-cal-head">' +
        '<button type="button" class="bk-nav" data-bk-month="-1" aria-label="' + esc(t("Previous month")) + '"' + (state.month <= first ? " disabled" : "") + ">" + (AR ? "›" : "‹") + "</button>" +
        '<span class="bk-month">' + esc(fmt(state.month + "-01", { month: "long", year: "numeric" })) + "</span>" +
        '<button type="button" class="bk-nav" data-bk-month="1" aria-label="' + esc(t("Next month")) + '"' + (state.month >= end ? " disabled" : "") + ">" + (AR ? "‹" : "›") + "</button>" +
      "</div>" +
      '<div class="bk-dow" aria-hidden="true">' + dows + "</div>" +
      '<div class="bk-days">' + cells + "</div></div>";
  }

  function times() {
    if (!state.date) return '<p class="bk-hint">' + esc(t("Choose a day to see the times.")) + "</p>";
    var list = slotsFor(state.date);
    return "<h3>" + esc(t("Times on {x}", { x: fmt(state.date, { weekday: "long", day: "numeric", month: "long" }) })) + "</h3>" +
      '<div class="bk-times-list">' + list.map(function (s) {
        var on = state.slot && state.slot.time === s.time && state.slot.place === s.place;
        return '<button type="button" class="bk-time' + (on ? " on" : "") + '" data-bk-time="' + s.time + '" data-bk-place="' + s.place + '" aria-pressed="' + on + '">' +
          "<b>" + s.time + "</b><small>" + esc(placeName(s.place, (data.places || {})[s.place])) + "</small></button>";
      }).join("") + "</div>";
  }

  function field(name, label, control, hint) {
    return '<div class="bk-field"><label for="bk-' + name + '">' + esc(label) + "</label>" + control +
      '<p class="bk-err" id="bk-' + name + '-e" role="alert"' + (state.errors[name] ? "" : " hidden") + ">" + esc(state.errors[name] || "") + "</p></div>";
  }

  function form() {
    var f = state.form;
    var when = state.slot
      ? fmt(state.date, { weekday: "long", day: "numeric", month: "long" }) + " · " + state.slot.time
      : "";
    if (!state.slot) return '<div class="bk-form empty"><p class="bk-hint">' + esc(t("Choose a day to see the times.")) + "</p></div>";
    return '<form class="bk-form" data-bk-form novalidate>' +
      '<div class="bk-chosen"><div><span>' + esc(t("Your time")) + "</span><b>" + esc(when) + "</b><small>" +
        esc(placeName(state.slot.place, (data.places || {})[state.slot.place])) + "</small></div>" +
        '<button type="button" class="tlink" data-bk-change>' + esc(t("Change")) + "</button></div>" +
      "<h3>" + esc(t("Your details")) + "</h3>" +
      field("name", t("Full name"), '<input id="bk-name" name="name" autocomplete="name" value="' + esc(f.name) + '" required>') +
      field("phone", t("Phone number"), '<input id="bk-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+961 70 123 456" value="' + esc(f.phone) + '" required>') +
      field("email", t("Email (optional)"), '<input id="bk-email" name="email" type="email" autocomplete="email" value="' + esc(f.email) + '">') +
      field("note", t("Anything I should know? (optional)"), '<textarea id="bk-note" name="note" rows="3" maxlength="600">' + esc(f.note) + "</textarea>") +
      '<div class="bk-trap" aria-hidden="true"><label>Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<button class="btn lilac block lg" type="submit"' + (state.sending ? " disabled" : "") + ">" + esc(state.sending ? t("Sending…") : t("Request this time")) + "</button>" +
      '<p class="bk-note" role="status">' + esc(state.notice || t("Times are Beirut time. A request isn't a booking until I confirm it.")) + "</p>" +
      "</form>";
  }

  function whatsapp() {
    var digits = String(CFG.whatsapp || "").replace(/\D/g, "");
    if (digits.length < 8) return "";
    return '<a class="tlink" href="https://wa.me/' + digits + '" target="_blank" rel="noopener">' + esc(t("Prefer WhatsApp? Message me")) + "</a>";
  }

  function doneView() {
    var d = state.done;
    return '<div class="bk-done" role="status" tabindex="-1" data-bk-done>' +
      '<span class="bk-done-mark" aria-hidden="true">✓</span>' +
      "<h3>" + esc(t("Request received")) + "</h3>" +
      '<p class="bk-done-lede">' + esc(t("Thank you, {x}.", { x: d.first })) + "</p>" +
      '<dl class="bk-receipt"><div><dt>' + esc(t("Your time")) + "</dt><dd>" + esc(d.when) + "<small>" + esc(d.place) + "</small></dd></div>" +
      (d.number ? "<div><dt>" + esc(t("Reference")) + '</dt><dd class="num">' + esc(d.number) + "</dd></div>" : "") + "</dl>" +
      "<h4>" + esc(t("What happens next")) + '</h4><ol class="bk-next-steps"><li>' + esc(t("I confirm your time by WhatsApp or phone, usually within a day.")) + "</li><li>" +
        esc(t("Until then, your time is held for you.")) + "</li><li>" + esc(t("If it doesn't suit you, tell me and we'll find another.")) + "</li></ol>" +
      '<button type="button" class="btn lilac" data-bk-again>' + esc(t("Book another time")) + "</button></div>";
  }

  function render() {
    ensureService();
    if (state.done) { host.innerHTML = doneView(); focusNow(); return; }
    var next = nextAvailable();
    var services = serviceOptions();
    host.innerHTML =
      modeCards() +
      '<div class="bk-grid">' +
        '<div class="bk-pick">' +
          '<div class="bk-field"><label for="bk-service">' + esc(t("What would you like to book?")) + "</label>" +
            '<select id="bk-service">' + services.map(function (o) { return '<option value="' + esc(o.id) + '"' + (o.id === state.service ? " selected" : "") + ">" + esc(o.label) + "</option>"; }).join("") + "</select></div>" +
          (next
            ? '<div class="bk-next"><span>' + esc(t("Next available")) + "</span><b>" + esc(fmt(next.date, { weekday: "short", day: "numeric", month: "short" }) + " · " + next.slot.time) + "</b>" +
              '<button type="button" class="tlink" data-bk-next>' + esc(t("Choose this time")) + "</button></div>"
            : '<p class="bk-hint bk-empty">' + esc(t("No times are open for this way of meeting right now. Try the other one, or message me on WhatsApp.")) + "</p>") +
          calendar() +
          '<div class="bk-times" aria-live="polite">' + times() + "</div>" +
        "</div>" +
        form() +
      "</div>" +
      (data.note ? '<p class="bk-site-note">' + esc(data.note) + "</p>" : "") +
      '<p class="bk-alt">' + whatsapp() + "</p>";
    focusNow();
  }

  function focusNow() {
    var key = focusKey;
    focusKey = "";
    if (!key) return;
    var el = host.querySelector(key === "done" ? "[data-bk-done]" : key);
    if (el) el.focus();
  }

  /* ------------------------------------------------------------ actions --- */
  function setMode(mode, fromGlobal) {
    if (state.mode === mode) return;
    state.mode = mode;
    state.date = ""; state.slot = null;
    var next = nextAvailable();
    state.month = next ? monthKey(next.date) : monthKey(data.today);
    render();
    if (!fromGlobal && globalSwitch) {
      var b = globalSwitch.querySelector('button[data-mode="' + mode + '"]');
      if (b && b.getAttribute("aria-pressed") !== "true") b.click();
    }
  }

  function pickDate(iso, key) {
    state.date = iso; state.slot = null; state.errors = {};
    focusKey = key || ('[data-bk-date="' + iso + '"]');
    render();
  }

  function validate() {
    var f = state.form, e = {};
    var digits = f.phone.replace(/\D/g, "");
    if (f.name.trim().length < 2) e.name = t("Enter your full name.");
    if (!/^[+0-9 ()\-]{7,25}$/.test(f.phone.trim()) || digits.length < 7 || digits.length > 15) e.phone = t("Enter a phone number I can reach you on.");
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = t("That email address doesn't look right.");
    state.errors = e;
    return Object.keys(e).length === 0;
  }

  function submit() {
    readForm();
    if (!validate()) { render(); var first = host.querySelector(".bk-err:not([hidden])"); if (first) { var input = host.querySelector("#" + first.id.replace(/-e$/, "")); if (input) input.focus(); } return; }
    state.sending = true; state.notice = ""; render();
    var f = state.form;
    fetch("/api/bookings", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ service: state.service, date: state.date, time: state.slot.time, place: state.slot.place, name: f.name, phone: f.phone, email: f.email, note: f.note, website: (host.querySelector('[name="website"]') || {}).value || "" })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; }); })
      .then(function (res) {
        state.sending = false;
        if (res.r.ok) {
          state.done = { first: f.name.trim().split(/\s+/)[0], when: fmt(state.date, { weekday: "long", day: "numeric", month: "long" }) + " · " + state.slot.time, place: placeName(state.slot.place, (data.places || {})[state.slot.place]), number: res.d.booking_number || "" };
          state.form = { name: "", phone: "", email: "", note: "" };
          focusKey = "done"; load(true); render(); return;
        }
        if (res.d && res.d.code === "slot_taken") {
          state.slot = null; state.notice = ""; state.errors = {};
          load(true).then(function () { render(); var n = host.querySelector(".bk-times"); if (n) n.insertAdjacentHTML("afterbegin", '<p class="bk-err" role="alert">' + esc(t("That time has just been taken. Please choose another.")) + "</p>"); });
          return;
        }
        if (res.d && res.d.field && state.form[res.d.field] !== undefined) {
          state.errors = {}; state.errors[res.d.field] = t(res.d.field === "email" ? "That email address doesn't look right." : res.d.field === "phone" ? "Enter a phone number I can reach you on." : "Enter your full name.");
          render(); return;
        }
        state.notice = t("That didn't go through. Please try again, or message me on WhatsApp.");
        render();
      }, function () {
        state.sending = false; state.notice = t("That didn't go through. Please try again, or message me on WhatsApp."); render();
      });
  }

  function readForm() {
    var f = host.querySelector("[data-bk-form]");
    if (!f) return;
    ["name", "phone", "email", "note"].forEach(function (k) { if (f.elements[k]) state.form[k] = f.elements[k].value; });
  }

  host.addEventListener("click", function (e) {
    var el;
    if ((el = e.target.closest("[data-bk-mode]"))) { readForm(); setMode(el.getAttribute("data-bk-mode")); return; }
    if ((el = e.target.closest("[data-bk-month]"))) { state.month = addMonths(state.month, +el.getAttribute("data-bk-month")); focusKey = '[data-bk-month="' + el.getAttribute("data-bk-month") + '"]'; readForm(); render(); return; }
    if ((el = e.target.closest("[data-bk-date]"))) { readForm(); pickDate(el.getAttribute("data-bk-date")); return; }
    if ((el = e.target.closest("[data-bk-time]"))) {
      readForm();
      state.slot = { time: el.getAttribute("data-bk-time"), place: el.getAttribute("data-bk-place") };
      state.errors = {}; focusKey = "#bk-name"; render();
      var fm = host.querySelector("[data-bk-form]");
      if (fm && fm.scrollIntoView && window.matchMedia("(max-width: 899px)").matches) fm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (e.target.closest("[data-bk-next]")) {
      var n = nextAvailable();
      if (n) { state.month = monthKey(n.date); state.date = n.date; state.slot = { time: n.slot.time, place: n.slot.place }; state.errors = {}; focusKey = "#bk-name"; readForm(); render(); }
      return;
    }
    if (e.target.closest("[data-bk-change]")) { readForm(); state.slot = null; focusKey = '[data-bk-date="' + state.date + '"]'; render(); return; }
    if (e.target.closest("[data-bk-again]")) { state.done = null; state.date = ""; state.slot = null; var nx = nextAvailable(); state.month = nx ? monthKey(nx.date) : monthKey(data.today); render(); return; }
  });
  host.addEventListener("change", function (e) {
    if (e.target.id === "bk-service") state.service = e.target.value;
  });
  host.addEventListener("input", function (e) {
    var k = (e.target.name || "");
    if (state.form[k] !== undefined) {
      state.form[k] = e.target.value;
      if (state.errors[k]) { delete state.errors[k]; var box = host.querySelector("#bk-" + k + "-e"); if (box) { box.hidden = true; box.textContent = ""; } }
    }
  });
  host.addEventListener("submit", function (e) {
    if (!e.target.closest("[data-bk-form]")) return;
    e.preventDefault();
    submit();
  });

  /* A Book button on a service or package opens this calendar with that choice picked. */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-book]");
    if (!b || !data || !data.configured) return;
    e.preventDefault();
    var id = String(b.getAttribute("data-book") || "").split(":").pop();
    if (id) state.service = id;
    state.done = null;
    if (section) {
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      try { history.replaceState(null, "", "#book"); } catch (err) {}
    }
    render();
  });

  /* Stay in step with the switch at the top of the page. */
  if (globalSwitch && window.MutationObserver) {
    new MutationObserver(function () {
      var m = pressedMode();
      if (data && m && m !== state.mode) { readForm(); setMode(m, true); }
    }).observe(globalSwitch, { attributes: true, subtree: true, attributeFilter: ["aria-pressed"] });
  }

  /* ------------------------------------------------------------ start ---- */
  function load(quiet) {
    return fetch("/api/availability", { headers: { "Accept": "application/json" }, cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        data = d;
        if (!d.configured) { if (section) section.hidden = true; return; }
        if (!state.month) { var n = nextAvailable(); state.month = n ? monthKey(n.date) : monthKey(d.today); }
        if (section) section.hidden = false;
        document.documentElement.classList.add("has-booking");
        document.querySelectorAll("[data-book-link]").forEach(function (a) { a.hidden = false; });
        if (!quiet) render();
      })
      .catch(function () { if (section) section.hidden = true; });
  }
  load();
})();
