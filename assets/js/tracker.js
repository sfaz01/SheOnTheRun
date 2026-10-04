/* ============================================================================
   MEAL TRACKER — the end of the DietOnTheRun page
   ----------------------------------------------------------------------------
   A client uploads the meal plan Fatima gave them and it opens right there:
   - a plan page made in Claude (.html, like data/plans/fatimas-plate.html)
     runs exactly as it did in Claude, inside a sandboxed frame. Claude's
     window.storage is stood in for, so picks are remembered on this phone;
   - a spreadsheet plan (.csv from data/plans/meal-plan-template.csv) or a
     saved copy (.json) becomes the built-in tracker below: one pick per meal
     slot, calories and protein against the plan's targets, a week view and a
     shopping list.
   Everything is kept in this browser's storage — nothing is uploaded.
   ========================================================================== */
(function () {
  "use strict";

  var app = document.querySelector("[data-tracker]");
  if (!app) return;

  var KEY = "dotr_tracker_v1";
  var KEY_HTML = "dotr_plan_html";      // { name, title, html } — a plan made in Claude
  var KEY_STORE = "dotr_plan_store";    // what that plan saved through window.storage
  var MAX_HTML = 3 * 1024 * 1024;
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  /* Arabic pages: the tracker's own words. (A plan page made in Claude keeps
     whatever language it was written in.) */
  var AR = /^ar/i.test(document.documentElement.getAttribute("lang") || "");
  var ROOT = document.documentElement.getAttribute("data-root") || "";
  var DAY_AR = { Mon: "الإثنين", Tue: "الثلاثاء", Wed: "الأربعاء", Thu: "الخميس", Fri: "الجمعة", Sat: "السبت", Sun: "الأحد" };
  var DAY_AR_SHORT = { Mon: "إثن", Tue: "ثلا", Wed: "أرب", Thu: "خمي", Fri: "جمع", Sat: "سبت", Sun: "أحد" };
  var UI_AR = {
    "My meal plan": "خطتي الغذائية",
    "Your meal plan": "خطتك الغذائية",
    "I couldn't find the header row. It should start with: meal, guide, option, kcal …": "لم أجد سطر العناوين. يجب أن يبدأ بـ: meal, guide, option, kcal …",
    "The file has a header row but no meals under it.": "في الملف سطر عناوين لكن لا وجبات تحته.",
    "This file isn't a meal plan I can read.": "هذا الملف ليس خطة غذائية يمكنني قراءتها.",
    "That file couldn't be read.": "تعذّرت قراءة هذا الملف.",
    "That file is too large to open here.": "هذا الملف أكبر من أن يُفتح هنا.",
    "That doesn't look like a plan page. Try the file exactly as I sent it.": "لا يبدو هذا ملف خطة. جرّب الملف كما أرسلته لك تماماً.",
    "Opened — but this browser won't let me save it, so you'll need to upload it again next time.": "فُتحت الخطة — لكن هذا المتصفح لا يسمح بحفظها، لذا ستحتاج إلى تحميلها مجدداً في المرة القادمة.",
    "Target {x} kcal": "الهدف {x} سعرة حرارية",
    "{x} g protein": "{x} غ بروتين",
    "Tap to choose": "اضغط للاختيار",
    "in your kitchen": "متوفّر في مطبخك",
    "kcal": "سعرة",
    "Pick a {x} to start.": "اختر وجبة «{x}» للبدء.",
    "{n} meal left to choose.": "بقيت وجبة واحدة للاختيار.",
    "{n} meals left to choose.": "بقيت {n} وجبات للاختيار.",
    "The day's full, but protein is {x}g short — try a higher-protein snack.": "اكتمل اليوم، لكن البروتين ينقصه {x} غ — جرّب وجبة خفيفة غنية بالبروتين.",
    "{x} kcal over — try a lighter option or drop a snack.": "زيادة {x} سعرة — جرّب خياراً أخفّ أو احذف وجبة خفيفة.",
    "The day's balanced. Nice one.": "اليوم متوازن. أحسنت.",
    "{k} kcal · {p}g protein": "{k} سعرة · {p} غ بروتين",
    "Nothing planned yet.": "لا شيء مخطّط بعد.",
    "{n} meals planned this week. Tick what you already have — those meals get marked “in your kitchen”.": "{n} وجبات مخطّطة هذا الأسبوع. ضع علامة على ما لديك — وستُعلَّم تلك الوجبات بـ«متوفّر في مطبخك».",
    "Plan some meals first and this list fills itself.": "خطّط لبعض الوجبات أولاً وستمتلئ هذه القائمة وحدها.",
    "Nothing here you can make with what's ticked in your shopping list. Untick the filter to see every option.": "لا شيء هنا يمكنك تحضيره بما هو معلَّم في قائمة التسوّق. ألغِ الفلتر لرؤية كل الخيارات.",
    "Load a different plan? Your picks for this plan will be cleared from this device.": "تحميل خطة مختلفة؟ ستُمحى اختياراتك لهذه الخطة من هذا الجهاز."
  };
  function tr(str, vars) {
    var out = AR && UI_AR[str] != null ? UI_AR[str] : str;
    if (vars) Object.keys(vars).forEach(function (k) { out = out.split("{" + k + "}").join(vars[k]); });
    return out;
  }
  var COLORS = ["#4FC3D6", "#8E82E3", "#BB8ABD", "#96B3DD"];

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function num(v) { var n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : 0; }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "meal"; }

  /* ---------------------------------------------------------- state ----- */
  var state = null;   // { plan, picks: { Mon: { slotId: optionIndex } }, have: { item: true } }
  var cur = DAYS[(new Date().getDay() + 6) % 7];
  var view = "day";
  var openSlot = null;

  function load() {
    try { state = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { state = null; }
    if (state && !validPlan(state.plan)) state = null;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function freshState(plan) {
    var picks = {};
    DAYS.forEach(function (d) { picks[d] = {}; });
    return { plan: plan, picks: picks, have: {} };
  }

  /* --------------------------------------------------------- parsing ---- */
  function validPlan(p) {
    return p && Array.isArray(p.slots) && p.slots.length &&
      p.slots.every(function (s) { return s && s.id && Array.isArray(s.options) && s.options.length; });
  }

  /* A small, forgiving CSV reader: quoted fields, commas or semicolons
     (Excel in some languages saves with ";"), CRLF or LF. */
  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    var firstLines = text.split(/\r?\n/).slice(0, 12).join("\n");
    var delim = (firstLines.match(/;/g) || []).length > (firstLines.match(/,/g) || []).length ? ";" : ",";
    var rows = [], row = [], f = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(f); f = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(f); rows.push(row); row = []; f = "";
      } else f += ch;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return { rows: rows, delim: delim };
  }

  function planFromCSV(text) {
    var parsed = parseCSV(text), rows = parsed.rows;
    var plan = { format: "dietontherun-plan", version: 1, title: tr("My meal plan"), note: "", target: {}, slots: [] };
    var header = null, bySlot = {};
    var ingSplit = parsed.delim === ";" ? /\s*\|\s*/ : /\s*[;|]\s*/;
    rows.forEach(function (r) {
      var cells = r.map(function (c) { return String(c).trim(); });
      if (!cells.some(Boolean)) return;
      var k = cells[0].toLowerCase();
      if (!header) {
        if (k === "title" || k === "name") { plan.title = cells[1] || plan.title; return; }
        if (k === "note") { plan.note = cells[1] || ""; return; }
        if (k === "target_kcal" || k === "calories" || k === "target") { plan.target.kcal = num(cells[1]); return; }
        if (k === "protein_min") { plan.target.proteinMin = num(cells[1]); return; }
        if (k === "protein_max") { plan.target.proteinMax = num(cells[1]); return; }
        if (k === "meal") {
          header = {};
          cells.forEach(function (h, i) { header[h.toLowerCase()] = i; });
          return;
        }
        return;
      }
      function col() {
        for (var i = 0; i < arguments.length; i++) {
          var at = header[arguments[i]];
          if (at != null && cells[at] != null) return cells[at];
        }
        return "";
      }
      var meal = col("meal"), name = col("option", "name", "food");
      if (!meal || !name) return;
      var id = slug(meal);
      if (!bySlot[id]) {
        bySlot[id] = { id: id, label: meal, guide: "", options: [] };
        plan.slots.push(bySlot[id]);
      }
      var g = col("guide", "aim");
      if (g && !bySlot[id].guide) bySlot[id].guide = g;
      var ing = col("ingredients", "items");
      bySlot[id].options.push({
        n: name,
        k: Math.round(num(col("kcal", "calories"))),
        c: Math.round(num(col("carbs", "c"))),
        p: Math.round(num(col("protein", "p"))),
        f: Math.round(num(col("fat", "f"))),
        i: ing ? ing.split(ingSplit).filter(Boolean).map(function (x) { return x.toLowerCase(); }) : []
      });
    });
    if (!header) throw new Error(tr("I couldn't find the header row. It should start with: meal, guide, option, kcal …"));
    if (!plan.slots.length) throw new Error(tr("The file has a header row but no meals under it."));
    return plan;
  }

  function planFromJSON(text) {
    var d = JSON.parse(text);
    if (d && d.plan && validPlan(d.plan)) return d;          // a saved tracker (plan + picks)
    if (validPlan(d)) return d;
    throw new Error(tr("This file isn't a meal plan I can read."));
  }

  function accept(result) {
    if (result.plan) {                                   // restored copy, picks included
      state = { plan: result.plan, picks: result.picks || {}, have: result.have || {} };
      DAYS.forEach(function (d) { if (!state.picks[d]) state.picks[d] = {}; });
    } else state = freshState(result);
    htmlPlan = null;
    [KEY_HTML, KEY_STORE].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    save(); view = "day"; render();
    var top = $("[data-tr-top]"); if (top) top.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function readFile(file) {
    var msg = $("[data-tr-msg]");
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var text = String(reader.result || "");
        if (/\.html?$/i.test(file.name) || /^\s*</.test(text)) openHTML(text, file.name);
        else {
          var isJSON = /\.json$/i.test(file.name) || /^\s*\{/.test(text);
          accept(isJSON ? planFromJSON(text) : planFromCSV(text));
        }
        if (msg) msg.textContent = "";
      } catch (err) {
        if (msg) msg.textContent = (err && err.message) || tr("That file couldn't be read.");
      }
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------- a plan made in Claude ---- */
  /* The page runs in a sandboxed frame (scripts only, no access to this
     site). Claude's window.storage is replaced by a small stand-in that
     starts with what was saved last time and posts every save back here. */
  var htmlPlan = null;
  var frame = $("[data-tr-iframe]");

  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }
  function saveJSON(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  function openHTML(html, name) {
    if (html.length > MAX_HTML) throw new Error(tr("That file is too large to open here."));
    if (!/<script|<body|<div/i.test(html)) throw new Error(tr("That doesn't look like a plan page. Try the file exactly as I sent it."));
    var t = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1];
    var tmp = document.createElement("textarea");
    tmp.innerHTML = t || "";
    var sameFile = htmlPlan && htmlPlan.html === html;
    htmlPlan = { name: name || "plan.html", title: tmp.value.trim() || tr("Your meal plan"), html: html };
    if (!sameFile) saveJSON(KEY_STORE, {});            // a new plan starts fresh
    if (!saveJSON(KEY_HTML, htmlPlan)) {
      var msg = $("[data-tr-msg]");
      if (msg) msg.textContent = tr("Opened — but this browser won't let me save it, so you'll need to upload it again next time.");
    }
    state = null; try { localStorage.removeItem(KEY); } catch (e) {}
    render();
    var top = $("[data-tr-top]"); if (top) top.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function storageShim() {
    var saved = loadJSON(KEY_STORE) || {};
    var init = JSON.stringify(saved).replace(/</g, "\\u003c");
    return "<script>(function(){var c=" + init + ";" +
      "function tell(k,v){try{parent.postMessage({dotrPlanStore:1,key:k,value:v},'*')}catch(e){}}" +
      "window.storage={" +
        "get:function(k){return Promise.resolve(Object.prototype.hasOwnProperty.call(c,k)?{key:k,value:c[k]}:null)}," +
        "set:function(k,v){c[k]=String(v);tell(k,c[k]);return Promise.resolve({key:k,value:c[k]})}," +
        "delete:function(k){delete c[k];tell(k,null);return Promise.resolve({key:k,deleted:true})}," +
        "list:function(p){p=p||'';return Promise.resolve({keys:Object.keys(c).filter(function(k){return k.indexOf(p)===0})})}" +
      "};})();<\/script>";
  }

  function mountFrame() {
    if (!frame || !htmlPlan) return;
    frame.srcdoc = storageShim() + htmlPlan.html;
  }

  window.addEventListener("message", function (e) {
    if (!frame || e.source !== frame.contentWindow) return;
    var d = e.data;
    if (!d || d.dotrPlanStore !== 1 || typeof d.key !== "string") return;
    var store = loadJSON(KEY_STORE) || {};
    if (d.value === null) delete store[d.key]; else store[d.key] = String(d.value).slice(0, 500000);
    saveJSON(KEY_STORE, store);
  });

  var box = $("[data-tr-framebox]");
  function setFull(on) {
    if (!box) return;
    box.classList.toggle("full", on);
    document.body.classList.toggle("locked", on);
    var exit = $(".tr-exit", box); if (exit) exit.hidden = !on;
    if (on && exit) exit.focus();
  }

  /* -------------------------------------------------------- helpers ----- */
  function slotById(id) { return state.plan.slots.filter(function (s) { return s.id === id; })[0]; }
  function pick(d, id) {
    var i = (state.picks[d] || {})[id], s = slotById(id);
    return (i === undefined || i === null || !s) ? null : s.options[i] || null;
  }
  function totals(d) {
    var t = { k: 0, p: 0, c: 0, f: 0 };
    state.plan.slots.forEach(function (s) {
      var m = pick(d, s.id);
      if (m) { t.k += m.k || 0; t.p += m.p || 0; t.c += m.c || 0; t.f += m.f || 0; }
    });
    return t;
  }
  function canCook(m) {
    return (m.i || []).length > 0 && m.i.every(function (x) { return state.have[x]; });
  }
  function macros(m) { return (m.c || 0) + "C · " + (m.p || 0) + "P · " + (m.f || 0) + "F"; }

  /* --------------------------------------------------------- render ----- */
  function render() {
    var empty = $("[data-tr-empty]"), main = $("[data-tr-app]"), web = $("[data-tr-html]");
    if (web) web.hidden = !htmlPlan;
    if (htmlPlan) {
      empty.hidden = true; main.hidden = true;
      $("[data-tr-htitle]").textContent = htmlPlan.title;
      if (frame && frame.getAttribute("data-for") !== htmlPlan.title + htmlPlan.html.length) {
        frame.setAttribute("data-for", htmlPlan.title + htmlPlan.html.length);
        mountFrame();
      }
      return;
    }
    if (frame && frame.getAttribute("data-for")) { frame.removeAttribute("data-for"); frame.removeAttribute("srcdoc"); }
    if (!state) { empty.hidden = false; main.hidden = true; return; }
    empty.hidden = true; main.hidden = false;

    var P = state.plan, T = P.target || {};
    $("[data-tr-title]").textContent = P.title || tr("My meal plan");
    var bits = [];
    if (T.kcal) bits.push(tr("Target {x} kcal", { x: T.kcal }));
    if (T.proteinMin) bits.push(tr("{x} g protein", { x: T.proteinMin + (T.proteinMax ? "–" + T.proteinMax : "+") }));
    if (P.note) bits.push(P.note);
    $("[data-tr-sub]").textContent = bits.join(" · ");

    $$("[data-tr-view]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-tr-view") === view)); });
    $$("[data-tr-pane]").forEach(function (p) { p.hidden = p.getAttribute("data-tr-pane") !== view; });

    renderDays(); renderSlots(); renderTrack(); renderWeek(); renderShop();
  }

  function renderDays() {
    $("[data-tr-days]").innerHTML = DAYS.map(function (d) {
      var filled = Object.keys(state.picks[d] || {}).length > 0;
      return '<button type="button" class="tr-day' + (filled ? " filled" : "") + '" data-day="' + d +
        '" aria-pressed="' + (d === cur) + '">' + (AR ? DAY_AR_SHORT[d] : d) + '<i aria-hidden="true"></i></button>';
    }).join("");
  }

  function renderSlots() {
    $("[data-tr-slots]").innerHTML = state.plan.slots.map(function (s, i) {
      var m = pick(cur, s.id);
      return '<button type="button" class="tr-slot' + (m ? "" : " empty") + '" data-slot="' + esc(s.id) + '">' +
        '<span class="tr-meta">' +
          '<span class="tr-label"><i style="background:' + COLORS[i % COLORS.length] + '"></i>' + esc(s.label) + "</span>" +
          '<span class="tr-name">' + (m ? esc(m.n) : tr("Tap to choose")) + "</span>" +
          '<span class="tr-macro">' + (m ? esc(macros(m)) + (canCook(m) ? ' · <b class="tr-have">' + tr("in your kitchen") + "</b>" : "") : esc(s.guide || "")) + "</span>" +
        "</span>" +
        '<span class="tr-kcal">' + (m ? m.k : "–") + "<small>" + tr("kcal") + "</small></span>" +
      "</button>";
    }).join("");
  }

  function renderTrack() {
    var T = state.plan.target || {}, t = totals(cur);
    var kT = T.kcal || 0, pMin = T.proteinMin || 0, pMax = T.proteinMax || pMin;
    $("[data-tr-cal]").textContent = t.k + (kT ? " / " + kT : "");
    $("[data-tr-pro]").textContent = t.p + "g" + (pMin ? " / " + pMin + (pMax && pMax !== pMin ? "–" + pMax : "") + "g" : "");
    var cf = $("[data-tr-calfill]"), pf = $("[data-tr-profill]");
    cf.style.width = (kT ? Math.min(100, t.k / kT * 100) : 0) + "%";
    pf.style.width = (pMax ? Math.min(100, t.p / pMax * 100) : 0) + "%";
    cf.classList.toggle("over", kT && t.k > kT * 1.06);
    var slots = state.plan.slots.length;
    var n = state.plan.slots.filter(function (s) { return pick(cur, s.id); }).length;
    var h;
    if (n === 0) h = tr("Pick a {x} to start.", { x: AR ? state.plan.slots[0].label : state.plan.slots[0].label.toLowerCase() });
    else if (n < slots) h = tr(slots - n > 1 ? "{n} meals left to choose." : "{n} meal left to choose.", { n: slots - n });
    else if (pMin && t.p < pMin) h = tr("The day's full, but protein is {x}g short — try a higher-protein snack.", { x: pMin - t.p });
    else if (kT && t.k > kT * 1.06) h = tr("{x} kcal over — try a lighter option or drop a snack.", { x: t.k - kT });
    else h = tr("The day's balanced. Nice one.");
    $("[data-tr-hint]").textContent = h;
  }

  function renderWeek() {
    $("[data-tr-week]").innerHTML = DAYS.map(function (d) {
      var t = totals(d);
      var rows = state.plan.slots.map(function (s) {
        var m = pick(d, s.id);
        return m ? '<li><span>' + esc(s.label) + "</span>" + esc(m.n) + "</li>" : "";
      }).join("");
      return '<div class="tr-wk"><h3>' + (AR ? DAY_AR[d] : d) + (t.k ? " <small>" + tr("{k} kcal · {p}g protein", { k: t.k, p: t.p }) + "</small>" : "") + "</h3>" +
        (rows ? "<ul>" + rows + "</ul>" : '<p class="tr-note">' + tr("Nothing planned yet.") + "</p>") + "</div>";
    }).join("");
  }

  function renderShop() {
    var need = {}, meals = 0;
    DAYS.forEach(function (d) {
      state.plan.slots.forEach(function (s) {
        var m = pick(d, s.id);
        if (!m) return;
        meals++;
        (m.i || []).forEach(function (x) { need[x] = (need[x] || 0) + 1; });
      });
    });
    var items = Object.keys(need).sort(function (a, b) { return need[b] - need[a] || a.localeCompare(b); });
    $("[data-tr-shopintro]").textContent = meals
      ? tr("{n} meals planned this week. Tick what you already have — those meals get marked “in your kitchen”.", { n: meals })
      : tr("Plan some meals first and this list fills itself.");
    $("[data-tr-shop]").innerHTML = items.length
      ? '<div class="tr-shoplist">' + items.map(function (x) {
          return '<label><input type="checkbox" data-item="' + esc(x) + '"' + (state.have[x] ? " checked" : "") + ">" +
            "<span>" + esc(x) + (need[x] > 1 ? " <small>· " + need[x] + " meals</small>" : "") + "</span></label>";
        }).join("") + "</div>"
      : "";
  }

  /* --------------------------------------------------------- picker ----- */
  var sheet = $("[data-tr-sheet]");
  var lastFocus = null;

  function openPicker(id) {
    openSlot = id;
    var s = slotById(id);
    $("[data-tr-sheet-title]").textContent = s.label;
    $("[data-tr-sheet-note]").textContent = s.guide || "";
    var onlyHave = $("[data-tr-onlyhave]").checked;
    var chosen = (state.picks[cur] || {})[id];
    var list = s.options.map(function (m, i) { return { m: m, i: i }; })
      .filter(function (o) { return !onlyHave || canCook(o.m); });
    $("[data-tr-options]").innerHTML = list.length ? list.map(function (o) {
      return '<button type="button" class="tr-opt" data-idx="' + o.i + '" aria-pressed="' + (chosen === o.i) + '">' +
        '<span><span class="tr-oname">' + esc(o.m.n) + "</span>" +
        '<span class="tr-osub">' + esc(macros(o.m)) + (canCook(o.m) ? ' · <b class="tr-have">' + tr("in your kitchen") + "</b>" : "") + "</span></span>" +
        '<span class="tr-ocal">' + o.m.k + "</span></button>";
    }).join("") : '<p class="tr-note">' + tr("Nothing here you can make with what's ticked in your shopping list. Untick the filter to see every option.") + "</p>";
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.body.classList.add("locked");
    $("[data-tr-options]").scrollTop = 0;
    var c = $("[data-tr-close]"); if (c) c.focus();
  }
  function closePicker() {
    sheet.hidden = true; openSlot = null;
    document.body.classList.remove("locked");
    if (lastFocus) lastFocus.focus();
  }

  /* --------------------------------------------------------- events ----- */
  app.addEventListener("click", function (e) {
    var t = e.target;
    var day = t.closest("[data-day]");
    if (day) { cur = day.getAttribute("data-day"); render(); return; }
    var slot = t.closest("[data-slot]");
    if (slot) { openPicker(slot.getAttribute("data-slot")); return; }
    var v = t.closest("[data-tr-view]");
    if (v) { view = v.getAttribute("data-tr-view"); render(); return; }
    if (t.closest("[data-tr-clear]")) { state.picks[cur] = {}; save(); render(); return; }
    if (t.closest("[data-tr-surprise]")) {
      /* Fill the day at random — never the same dish twice in one day. */
      var onlyHave = $("[data-tr-onlyhave]").checked;
      var used = {};
      state.picks[cur] = {};
      state.plan.slots.forEach(function (s) {
        var cand = s.options.map(function (m, i) { return { m: m, i: i }; })
          .filter(function (o) { return !o.m.light && !used[o.m.n] && (!onlyHave || canCook(o.m)); });
        if (!cand.length) return;
        var o = cand[Math.floor(Math.random() * cand.length)];
        state.picks[cur][s.id] = o.i;
        used[o.m.n] = true;
      });
      save(); render(); return;
    }
    if (t.closest("[data-tr-sample]")) {
      /* The sample is a real plan page from data/plans/ (the admin panel's Meal
         plans screen chooses which one). If it can't be fetched (the site opened
         straight from disk), fall back to the built-in version. */
      var sample = String((window.SITE_PLAN || {}).sample || "");
      if (!/^[a-z0-9][a-z0-9-]{0,60}\.html$/.test(sample)) sample = "fatimas-plate.html";
      fetch(ROOT + "data/plans/" + sample)
        .then(function (r) { if (!r.ok) throw new Error(); return r.text(); })
        .then(function (html) { openHTML(html, sample); })
        .catch(function () { accept(window.SAMPLE_PLAN); });
      return;
    }
    if (t.closest("[data-tr-full]")) { setFull(!(box && box.classList.contains("full"))); return; }
    if (t.closest("[data-tr-reset]")) {
      if (window.confirm(tr("Load a different plan? Your picks for this plan will be cleared from this device."))) {
        setFull(false);
        state = null; htmlPlan = null;
        ["dotr_tracker_v1", KEY_HTML, KEY_STORE].forEach(function (k) { try { localStorage.removeItem(k); } catch (err) {} });
        render();
      }
      return;
    }
    if (t.closest("[data-tr-export]")) {
      var blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = slug(state.plan.title || "meal-plan") + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
  });

  sheet.addEventListener("click", function (e) {
    if (e.target === sheet || e.target.closest("[data-tr-close]")) { closePicker(); return; }
    if (e.target.closest("[data-tr-remove]")) {
      if (openSlot) { delete state.picks[cur][openSlot]; save(); render(); }
      closePicker(); return;
    }
    var o = e.target.closest(".tr-opt");
    if (o && openSlot) {
      state.picks[cur][openSlot] = +o.getAttribute("data-idx");
      save(); render(); closePicker();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!sheet.hidden) closePicker();
    else if (box && box.classList.contains("full")) setFull(false);
  });
  $("[data-tr-onlyhave]").addEventListener("change", function () { if (openSlot) openPicker(openSlot); });

  app.addEventListener("change", function (e) {
    var it = e.target.getAttribute && e.target.getAttribute("data-item");
    if (it) { state.have[it] = e.target.checked; save(); renderSlots(); }
  });

  /* Upload: the file picker, or a file dropped on the box. */
  var input = $("[data-tr-file]");
  if (input) input.addEventListener("change", function () { readFile(input.files && input.files[0]); input.value = ""; });
  var drop = $("[data-tr-drop]");
  if (drop) {
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
    });
    drop.addEventListener("drop", function (e) { readFile(e.dataTransfer.files && e.dataTransfer.files[0]); });
  }

  load();
  htmlPlan = loadJSON(KEY_HTML);
  if (htmlPlan && typeof htmlPlan.html !== "string") htmlPlan = null;
  render();
})();
