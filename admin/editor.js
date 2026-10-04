/* =============================================================================
   SheOnTheRun admin — the content editor.
   One generic editor driven by the schema the server sends (server/app/Schema.php):
   lists with reorder/add/duplicate/delete, nested pages (category → product),
   English | العربية side by side, stock boxes that follow the sizes, and
   server-side errors shown beside the exact field.
   Saving stores a draft; the Publish page puts drafts live.
   ========================================================================== */
(function () {
  "use strict";
  var S = window.SOTR, h = S.h;

  var schemaCache = null;   // { areas, images }
  var cur = null;           // { area, schema, doc, rev, dirty, errors }
  var fresh = new WeakSet(); // items created this session: their reference follows their name

  S.invalidateSchema = function () { schemaCache = null; };
  S.loadSchema = function () {
    return schemaCache ? Promise.resolve(schemaCache)
      : S.api("GET", "/admin/schema").then(function (r) { schemaCache = r; return r; });
  };
  S.editorDirty = function () { return !!(cur && cur.dirty); };
  S.editorArea = function () { return cur ? cur.area : null; };
  S.resetEditor = function () { cur = null; };
  S.saveEditor = function () { return cur && cur.dirty ? save() : Promise.resolve(); };

  window.addEventListener("beforeunload", function (e) {
    if (S.editorDirty()) { e.preventDefault(); e.returnValue = ""; }
  });
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && cur) { e.preventDefault(); if (cur.dirty) save(); }
  });

  var page, viewPath;

  S.editor = function (host, area, pathStr) {
    page = host;
    viewPath = pathStr || "";
    return S.loadSchema().then(function (sc) {
      var schema = sc.areas[area];
      if (!schema) { S.put(host, h("p", {}, "That section doesn’t exist.")); return; }
      var ready = cur && cur.area === area ? Promise.resolve()
        : S.api("GET", "/admin/content/" + area).then(function (r) {
            cur = { area: area, schema: schema, doc: r.doc, rev: r.rev, dirty: false, errors: [] };
          });
      return ready.then(render);
    });
  };

  /* ------------------------------------------------------------ walking */

  /** Follow "categories.0.items.2" through schema and document. */
  function resolve(pathStr) {
    var fields = cur.schema.fields, obj = cur.doc, base = "";
    var crumbs = [{ label: cur.schema.label, path: "" }];
    var parent = null, field = null, index = -1;
    var segs = pathStr ? pathStr.split(".") : [];
    for (var i = 0; i + 1 < segs.length; i += 2) {
      var f = fields.filter(function (x) { return x.key === segs[i] && x.type === "collection"; })[0];
      var list = f && obj[f.key];
      var idx = +segs[i + 1];
      if (!f || !Array.isArray(list) || !list[idx]) return resolve("");
      parent = list; field = f; index = idx;
      obj = list[idx]; fields = f.item;
      base = (base ? base + "." : "") + f.key + "." + idx;
      crumbs.push({ label: titleOf(f, obj), path: base });
    }
    return { fields: fields, obj: obj, base: base, crumbs: crumbs, parent: parent, field: field, index: index };
  }

  function titleOf(f, item) {
    var t = item && item[f.title];
    return t ? String(t) : "New " + (f.noun || "entry");
  }

  /** The page an error belongs to: the deepest list item on its path. */
  function pageFor(errPath) {
    var fields = cur.schema.fields, segs = errPath.split("."), out = "", built = "";
    for (var i = 0; i + 1 < segs.length; i += 2) {
      var f = fields.filter(function (x) { return x.key === segs[i]; })[0];
      if (!f) break;
      if (f.type === "group") { fields = f.item; i -= 1; continue; }
      if (f.type !== "collection" || !/^\d+$/.test(segs[i + 1])) break;
      built = (built ? built + "." : "") + segs[i] + "." + segs[i + 1];
      out = built;
      fields = f.item;
    }
    return out;
  }

  /* ------------------------------------------------------------- render */

  var shown; // error paths rendered beside a field in this view

  function render() {
    var r = resolve(viewPath);
    shown = {};
    stockHosts = [];
    var isRoot = r.base === "";
    var crumbs = h("nav", { class: "crumbs", "aria-label": "You are here" },
      r.crumbs.map(function (c, i) {
        var last = i === r.crumbs.length - 1;
        return [i ? h("span", { class: "sep", "aria-hidden": "true" }, "›") : null,
          last ? h("span", { "aria-current": "page" }, c.label)
               : h("a", { href: "#edit/" + cur.area + (c.path ? "/" + c.path : "") }, c.label)];
      }));

    var body = h("div", { class: "fields" }, r.fields.map(function (f) { return renderField(f, r.obj, r.base); }));
    var summary = h("div", {});

    var actions = null;
    if (!isRoot) {
      var noun = r.field.noun || "entry";
      actions = h("div", { class: "item-actions" },
        h("button", { class: "btn ghost small", type: "button", onclick: function () { duplicate(r); } }, "Duplicate this " + noun),
        h("button", { class: "btn danger small", type: "button", onclick: function () { remove(r); } }, "Delete this " + noun));
    }

    S.put(page, 
      crumbs,
      h("h1", {}, isRoot ? cur.schema.label : titleOf(r.field, r.obj)),
      isRoot && cur.schema.intro ? h("p", { class: "muted" }, cur.schema.intro) : null,
      summary,
      body,
      actions,
      saveBar());

    // Errors that live on another page: list them with a link.
    var elsewhere = cur.errors.filter(function (e) { return !shown[e.path]; });
    if (elsewhere.length) {
      summary.appendChild(h("div", { class: "alert error" },
        h("p", {}, "Some fields need fixing before this can be saved:"),
        h("ul", {}, elsewhere.map(function (e) {
          var target = pageFor(e.path);
          return h("li", {}, h("a", { href: "#edit/" + cur.area + (target ? "/" + target : "") }, describe(e.path)), " — " + e.message);
        }))));
    }
    S.refreshNav && S.refreshNav();
  }

  /** "categories.0.items.2.price" → "SheOnTheRun › Cap › Price (USD)" */
  function describe(path) {
    var fields = cur.schema.fields, obj = cur.doc, segs = path.split("."), parts = [];
    for (var i = 0; i < segs.length; i++) {
      var key = segs[i];
      if (key === "ar") { parts.push("Arabic"); continue; }
      var f = fields && fields.filter(function (x) { return x.key === key; })[0];
      if (!f) break;
      if (f.type === "collection" && /^\d+$/.test(segs[i + 1] || "")) {
        var item = (obj[key] || [])[+segs[i + 1]];
        parts.push(titleOf(f, item)); obj = item || {}; fields = f.item; i++;
      } else if (f.type === "group") {
        parts.push(f.label); obj = obj[key] || {}; fields = f.item;
      } else {
        parts.push(f.label); break;
      }
    }
    return parts.join(" › ") || "This page";
  }

  function errorsFor(path, prefix) {
    return cur.errors.filter(function (e) {
      return e.path === path || (prefix && e.path.indexOf(path + ".") === 0);
    });
  }

  function errNodes(path, prefix) {
    var list = errorsFor(path, prefix);
    list.forEach(function (e) { shown[e.path] = true; });
    return list.length ? h("p", { class: "field-error" }, list.map(function (e) { return e.message; }).join(" ")) : null;
  }

  function clearErr(path) {
    var before = cur.errors.length;
    cur.errors = cur.errors.filter(function (e) { return e.path !== path && e.path.indexOf(path + ".") !== 0; });
    return before !== cur.errors.length;
  }

  function changed(path) {
    var had = clearErr(path);
    if (!cur.dirty) { cur.dirty = true; updateSaveBar(); S.refreshNav && S.refreshNav(); }
    if (had) {
      var box = page.querySelector('[data-err-for="' + CSS.escape(path) + '"]');
      if (box) S.put(box);
    }
  }

  function idFor(path) { return "f-" + path.replace(/[^a-zA-Z0-9]/g, "-"); }

  /* ------------------------------------------------------------- fields */

  function renderField(f, obj, base) {
    var path = (base ? base + "." : "") + f.key;
    switch (f.type) {
      case "collection": return renderCollection(f, obj, path);
      case "group":
        if (!obj[f.key] || typeof obj[f.key] !== "object") obj[f.key] = {};
        return h("fieldset", { class: "group" }, h("legend", {}, f.label),
          f.item.map(function (sub) { return renderField(sub, obj[f.key], path); }));
      case "id": return renderId(f, obj, path);
      case "stock": return renderStock(f, obj, path);
    }
    var wrap = h("div", { class: "field" + (f.ar ? " has-ar" : "") });
    var en = control(f, obj, f.key, path, false);
    var label = h("label", { for: idFor(path) }, f.label, f.required ? h("span", { class: "req", "aria-hidden": "true" }, " *") : null);
    if (f.type === "bool") {
      wrap.className = "field check-field";
      wrap.append(h("label", { class: "toggle", for: idFor(path) }, en, h("span", {}, f.label)));
    } else if (f.ar) {
      if (!obj.ar || typeof obj.ar !== "object" || Array.isArray(obj.ar)) obj.ar = {};
      var arPath = (base ? base + "." : "") + "ar." + f.key;
      wrap.append(
        h("div", { class: "pair" },
          h("div", { class: "side" }, h("span", { class: "lang" }, "English"), label, en,
            h("div", { "data-err-for": path }, errNodes(path, f.type === "list"))),
          h("div", { class: "side ar", lang: "ar", dir: "rtl" },
            h("span", { class: "lang" }, "العربية"),
            h("label", { for: idFor(arPath), class: "vh-label" }, f.label + " (Arabic)"),
            control(f, obj.ar, f.key, arPath, true),
            h("div", { "data-err-for": arPath }, errNodes(arPath, f.type === "list")))));
    } else {
      wrap.append(label, en);
    }
    if (f.hint) wrap.append(h("p", { class: "hint" }, f.hint));
    if (!f.ar) wrap.append(h("div", { "data-err-for": path }, errNodes(path, f.type === "list" || f.type === "multi")));
    return wrap;
  }

  /** The input element for one value (English, or its Arabic twin). */
  function control(f, obj, key, path, isAr) {
    var id = idFor(path);
    var v = obj[key];
    var set = function (val) { obj[key] = val; changed(path); };
    var common = { id: id, name: id };
    switch (f.type) {
      case "textarea":
        return h("textarea", Object.assign({ rows: 3, maxlength: f.max || null, oninput: function (e) { set(e.target.value); } }, common), v == null ? "" : String(v));
      case "list":
        return h("textarea", Object.assign({ rows: Math.min(8, Math.max(3, (v || []).length + 1)), class: "list-input",
          oninput: function (e) { set(e.target.value.split("\n")); if (key === "options" && !isAr) refreshStock(); } }, common),
          Array.isArray(v) ? v.join("\n") : "");
      case "money":
        return h("input", Object.assign({ type: "number", min: 0, step: "0.01", inputmode: "decimal", placeholder: "On request",
          value: v == null ? "" : v, oninput: function (e) { set(e.target.value === "" ? null : e.target.value); } }, common));
      case "int":
        return h("input", Object.assign({ type: "number", min: f.min || 0, step: 1, inputmode: "numeric",
          value: v == null ? "" : v, oninput: function (e) { set(e.target.value === "" ? null : e.target.value); } }, common));
      case "bool":
        return h("input", Object.assign({ type: "checkbox", checked: !!v, onchange: function (e) { set(e.target.checked); } }, common));
      case "date":
        return h("input", Object.assign({ type: "date", value: v || "", oninput: function (e) { set(e.target.value); } }, common));
      case "richtext":
        return richText(obj, key, path, common);
      case "datetime":
        return h("input", Object.assign({ type: "datetime-local", step: 60, value: v || "", oninput: function (e) { set(e.target.value); if (!isAr) autoId(obj, key); } }, common));
      case "select":
        return h("select", Object.assign({ onchange: function (e) { set(e.target.value); } }, common),
          f.required ? null : h("option", { value: "" }, "—"),
          f.options.map(function (o) { return h("option", { value: o[0], selected: v === o[0] }, o[1]); }));
      case "multi":
        if (!Array.isArray(v)) obj[key] = v = [];
        return h("div", { class: "multi", id: id, role: "group" }, f.options.map(function (o) {
          return h("label", { class: "toggle" }, h("input", { type: "checkbox", checked: v.indexOf(o[0]) !== -1, onchange: function (e) {
            var cur2 = (obj[key] || []).filter(function (x) { return x !== o[0]; });
            if (e.target.checked) cur2.push(o[0]);
            set(f.options.map(function (p) { return p[0]; }).filter(function (x) { return cur2.indexOf(x) !== -1; }));
          } }), h("span", {}, o[1]));
        }));
      case "image":
        return imagePicker(f, obj, key, path, common);
    }
    var type = { email: "email", url: "url", digits: "text" }[f.type] || "text";
    return h("input", Object.assign({ type: type, value: v == null ? "" : String(v), maxlength: f.max || null,
      inputmode: f.type === "digits" ? "numeric" : null, autocomplete: "off",
      oninput: function (e) {
        set(e.target.value);
        if (!isAr) autoId(obj, key);
      } }, common));
  }

  /* ---------------------------------------------------------- rich text */

  var RT_TAGS = { P: 1, H2: 1, H3: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, STRONG: 1, EM: 1, A: 1, BR: 1 };
  var RT_RENAME = { B: "strong", I: "em", H1: "h2", H4: "h3", H5: "h3", H6: "h3", DIV: "p" };
  var RT_DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, FORM: 1, SVG: 1, NOSCRIPT: 1, TEMPLATE: 1 };

  /** Copy only allowed markup into the editing box (the server cleans again on save). */
  function rtCopy(srcNode, into) {
    Array.prototype.forEach.call(srcNode.childNodes, function (n) {
      if (n.nodeType === 3) { into.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1 || RT_DROP[n.tagName]) return;
      var tag = RT_RENAME[n.tagName] || n.tagName.toLowerCase();
      if (!RT_TAGS[tag.toUpperCase()]) { rtCopy(n, into); return; }
      var el = document.createElement(tag);
      if (tag === "a") {
        var href = n.getAttribute("href") || "";
        if (/^(https?:|mailto:|tel:|\/|#|[\w.-]+\.html)/i.test(href)) el.setAttribute("href", href);
      }
      if (tag === "p" && n.getAttribute("class") === "measured mt-l") el.className = "measured mt-l";
      rtCopy(n, el);
      into.appendChild(el);
    });
  }

  function richText(obj, key, path, common) {
    var area = h("div", { class: "rt-area prose", contenteditable: "true", role: "textbox", "aria-multiline": "true", "aria-label": "Article text", id: common.id });
    rtCopy(new DOMParser().parseFromString("<body>" + (obj[key] || "") + "</body>", "text/html").body, area);
    function changedText() { obj[key] = area.innerHTML; changed(path); }
    function cmd(name, arg) {
      area.focus();
      document.execCommand(name, false, arg || null);
      changedText();
    }
    function btn(label, title, fn, extra) {
      return h("button", { type: "button", class: "rt-btn " + (extra || ""), title: title, "aria-label": title,
        onmousedown: function (e) { e.preventDefault(); }, onclick: fn }, label);
    }
    var bar = h("div", { class: "rt-bar", role: "toolbar", "aria-label": "Formatting" },
      btn("B", "Bold", function () { cmd("bold"); }, "b"),
      btn("I", "Italic", function () { cmd("italic"); }, "i"),
      btn("Heading", "Heading", function () { cmd("formatBlock", "h2"); }),
      btn("Subheading", "Subheading", function () { cmd("formatBlock", "h3"); }),
      btn("Paragraph", "Normal paragraph", function () { cmd("formatBlock", "p"); }),
      btn("• List", "Bulleted list", function () { cmd("insertUnorderedList"); }),
      btn("1. List", "Numbered list", function () { cmd("insertOrderedList"); }),
      btn("“ Quote", "Quote", function () { cmd("formatBlock", "blockquote"); }),
      btn("Link", "Add a link", function () {
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed) { S.toast("Select the words you want to link first.", "warn"); return; }
        var url = window.prompt("Link address (starting with https://)", "https://");
        if (url && /^(https?:\/\/|mailto:|tel:)/i.test(url.trim())) cmd("createLink", url.trim());
      }),
      btn("Remove link", "Remove link", function () { cmd("unlink"); }),
      btn("Clear", "Clear formatting", function () { cmd("removeFormat"); cmd("formatBlock", "p"); }));
    area.addEventListener("input", changedText);
    // Pasted text arrives as plain words, so nothing from Word or a web page sneaks in.
    area.addEventListener("paste", function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, text);
    });
    area.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !area.firstChild) document.execCommand("formatBlock", false, "p");
    });
    return h("div", { class: "rt" }, bar, area);
  }

  function imagePicker(f, obj, key, path, common) {
    var imgs = (schemaCache && schemaCache.images) || [];
    var thumb = h("img", { class: "thumb", alt: "", hidden: true });
    function show(name) {
      var hit = imgs.filter(function (i) { return i.name === name; })[0];
      if (!name || !hit) { thumb.hidden = true; return; }
      thumb.hidden = false;
      thumb.src = "/public/images/" + name + "-" + hit.w[0] + ".jpg";
    }
    thumb.addEventListener("error", function () { thumb.hidden = true; });
    var known = imgs.some(function (i) { return i.name === obj[key]; });
    var sel = h("select", Object.assign({ onchange: function (e) { obj[key] = e.target.value; changed(path); show(e.target.value); } }, common),
      h("option", { value: "" }, "No photo (designed placeholder)"),
      obj[key] && !known ? h("option", { value: obj[key], selected: true }, obj[key] + " (photo not uploaded yet)") : null,
      imgs.map(function (i) { return h("option", { value: i.name, selected: obj[key] === i.name }, i.name + (i.alt ? " — " + i.alt.slice(0, 50) : "")); }));
    show(known ? obj[key] : "");
    return h("div", { class: "image-pick" }, sel, thumb);
  }

  /* References (ids): generated from the name for new items, fixed afterwards. */
  function renderId(f, obj, path) {
    var box = h("p", { class: "ref muted" });
    function paint() { S.put(box, (f.key === "slug" ? "Web address: " : "Reference: "), h("code", {}, obj[f.key] || "(made from the " + (f.from === "title" ? "title" : "name") + ")")); }
    paint();
    obj.__paintId = paint;
    return h("div", { class: "field" }, box, h("div", { "data-err-for": path }, errNodes(path)));
  }

  function autoId(obj, key) {
    if (!fresh.has(obj)) return;
    var r = resolve(viewPath);
    var idField = r.fields.filter(function (x) { return x.type === "id"; })[0];
    if (!idField || idField.from !== key && idField.withDate !== key) return;
    var base = S.slug(obj[idField.from]);
    if (idField.withDate && obj[idField.withDate]) base += "-" + String(obj[idField.withDate]).slice(0, 10);
    obj[idField.key] = unique(base || "item", obj, r, idField.key);
    if (obj.__paintId) obj.__paintId();
  }

  function unique(base, self, r, idKey) {
    idKey = idKey || "id";
    var taken = {};
    // Products must be unique across every category; everything else within its own list.
    var lists = cur.area === "shop" && r.field && r.field.key === "items"
      ? (cur.doc.categories || []).map(function (c) { return c.items || []; })
      : cur.area === "offer" ? [cur.doc.services || [], cur.doc.packages || []] : [r.parent || []];
    lists.forEach(function (l) { l.forEach(function (x) { if (x !== self && x[idKey]) taken[x[idKey]] = true; }); });
    var id = base, n = 2;
    while (taken[id]) id = base + "-" + n++;
    return id;
  }

  /* Stock: one box per size, or one box for one-size products. */
  var stockHosts = [];
  function renderStock(f, obj, path) {
    var host = h("div", { class: "field stock" });
    var paint = function () {
      var opts = (Array.isArray(obj.options) ? obj.options : []).map(function (o) { return String(o).trim(); }).filter(Boolean);
      var inputs;
      if (opts.length) {
        if (obj.stock == null || typeof obj.stock !== "object") obj.stock = null;
        inputs = h("div", { class: "stock-grid" }, opts.map(function (o, i) {
          var p = path + "." + i, id = idFor(p);
          return h("label", { for: id, class: "stock-cell" }, h("span", {}, o),
            h("input", { id: id, type: "number", min: 0, step: 1, inputmode: "numeric", placeholder: "—",
              value: obj.stock && obj.stock[o] != null ? obj.stock[o] : "",
              oninput: function (e) {
                if (!obj.stock || typeof obj.stock !== "object") obj.stock = {};
                obj.stock[o] = e.target.value === "" ? null : e.target.value;
                changed(path);
              } }));
        }));
      } else {
        if (obj.stock != null && typeof obj.stock === "object") obj.stock = null;
        inputs = h("input", { id: idFor(path), type: "number", min: 0, step: 1, inputmode: "numeric", placeholder: "Not tracked", class: "stock-one",
          value: obj.stock == null ? "" : obj.stock,
          oninput: function (e) { obj.stock = e.target.value === "" ? null : e.target.value; changed(path); } });
      }
      S.put(host, h("label", { for: opts.length ? null : idFor(path) }, f.label), inputs,
        f.hint ? h("p", { class: "hint" }, f.hint) : null,
        h("div", { "data-err-for": path }, errNodes(path, true)));
    };
    paint();
    stockHosts.push(paint);
    return host;
  }
  function refreshStock() { stockHosts.forEach(function (p) { p(); }); }

  /* ---------------------------------------------------------- collections */

  function renderCollection(f, obj, path) {
    if (!Array.isArray(obj[f.key])) obj[f.key] = [];
    var list = obj[f.key];
    var ul = h("ul", { class: "rows" }, list.map(function (item, i) {
      var itemPath = path + "." + i;
      var flags = flagsFor(f, item);
      var hasErr = cur.errors.some(function (e) { return e.path.indexOf(itemPath + ".") === 0 || e.path === itemPath; });
      if (hasErr) cur.errors.forEach(function (e) { if (e.path.indexOf(itemPath + ".") === 0) shown[e.path] = true; });
      return h("li", { class: "row" + (hasErr ? " has-err" : "") },
        h("a", { class: "row-main", href: "#edit/" + cur.area + "/" + itemPath },
          h("span", { class: "row-title" }, titleOf(f, item)),
          h("span", { class: "row-sub" }, subtitle(f, item)),
          h("span", { class: "row-flags" }, flags.map(function (x) { return h("span", { class: "flag " + x[1] }, x[0]); }),
            hasErr ? h("span", { class: "flag bad" }, "Needs fixing") : null)),
        h("span", { class: "row-move" },
          h("button", { type: "button", class: "icon", "aria-label": "Move " + titleOf(f, item) + " up", disabled: i === 0,
            onclick: function () { move(list, i, -1, path); } }, "↑"),
          h("button", { type: "button", class: "icon", "aria-label": "Move " + titleOf(f, item) + " down", disabled: i === list.length - 1,
            onclick: function () { move(list, i, 1, path); } }, "↓")));
    }));
    return h("section", { class: "collection" },
      h("div", { class: "collection-head" },
        h("h2", {}, f.label, h("span", { class: "count" }, " " + list.length)),
        h("button", { class: "btn small", type: "button", onclick: function () { add(f, list, path); } }, "+ Add " + (f.noun || "entry"))),
      list.length ? ul : h("p", { class: "muted empty" }, "Nothing here yet."),
      h("div", { "data-err-for": path }, errNodes(path)));
  }

  function subtitle(f, item) {
    var k = f.subtitle;
    if (k === "price") return item.price == null || item.price === "" ? "Price on request" : "$" + item.price;
    if (k === "items") { var n = (item.items || []).length; return n + (n === 1 ? " product" : " products"); }
    if (k === "starts") return S.fmtLocal(item.starts) + (item.place ? " · " + item.place : "");
    return item[k] ? String(item[k]) : "";
  }

  function flagsFor(f, item) {
    var out = [];
    if (item.comingSoon) out.push(["Coming soon", "info"]);
    if ("soldOut" in item || "stock" in item) {
      var opts = (item.options || []).filter(Boolean);
      var st = item.stock;
      var allZero = st != null && (opts.length
        ? opts.every(function (o) { return st[o] != null && +st[o] <= 0; })
        : +st <= 0);
      if (item.soldOut || allZero) out.push(["Sold out", "warn"]);
      else if (st != null) {
        var total = opts.length ? opts.reduce(function (n, o) { return n + (st[o] != null ? +st[o] : 0); }, 0) : +st;
        out.push([total + " in stock", "muted"]);
      }
    }
    if (item.sample) out.push(["Hidden", "muted"]);
    if ("draft" in item && item.draft) out.push(["Draft", "warn"]);
    if (item.featured) out.push(["Featured", "info"]);
    if (item.ends && item.ends < S.nowBeirut()) out.push(["Ended", "muted"]);
    if (arMissing(f.item, item)) out.push(["Arabic missing", "warn"]);
    return out;
  }

  function arMissing(fields, item) {
    var ar = item.ar || {};
    return fields.some(function (x) {
      if (!x.ar) return false;
      var en = item[x.key], a = ar[x.key];
      var has = Array.isArray(en) ? en.filter(Boolean).length : String(en || "").trim() !== "";
      var hasAr = Array.isArray(a) ? a.filter(Boolean).length : String(a || "").trim() !== "";
      return has && !hasAr;
    });
  }

  function defaults(fields) {
    var o = {};
    fields.forEach(function (f) {
      switch (f.type) {
        case "bool": o[f.key] = false; break;
        case "money": o[f.key] = null; break;
        case "int": case "stock": break;
        case "list": case "collection": o[f.key] = []; break;
        case "multi": o[f.key] = f.options.map(function (x) { return x[0]; }); break;
        case "select": o[f.key] = f.required ? f.options[0][0] : ""; break;
        case "group": o[f.key] = defaults(f.item); break;
        default: o[f.key] = "";
      }
    });
    return o;
  }

  function add(f, list, path) {
    var item = defaults(f.item);
    fresh.add(item);
    list.push(item);
    changed(path);
    location.hash = "#edit/" + cur.area + "/" + path + "." + (list.length - 1);
  }

  function move(list, i, d, path) {
    var t = list[i]; list[i] = list[i + d]; list[i + d] = t;
    // Errors point at positions; they'd point at the wrong item now, so clear them for this list.
    clearErr(path);
    changed(path);
    render();
  }

  function duplicate(r) {
    var copy = JSON.parse(JSON.stringify(r.obj, function (k, v) { return k === "__paintId" ? undefined : v; }));
    var tk = r.field.title;
    if (copy[tk]) copy[tk] = copy[tk] + " (copy)";
    var dupKey = (r.fields.filter(function (x) { return x.type === "id"; })[0] || { key: "id" }).key;
    copy[dupKey] = "";
    fresh.add(copy);
    r.parent.splice(r.index + 1, 0, copy);
    var parentPath = r.base.replace(/\.\d+$/, "");
    clearErr(parentPath);
    var idField = r.fields.filter(function (x) { return x.type === "id"; })[0];
    if (idField) {
      var base = S.slug(copy[idField.from]);
      if (idField.withDate && copy[idField.withDate]) base += "-" + String(copy[idField.withDate]).slice(0, 10);
      copy[idField.key] = unique(base || "item", copy, r, idField.key);
    }
    changed(parentPath);
    location.hash = "#edit/" + cur.area + "/" + parentPath + "." + (r.index + 1);
  }

  function remove(r) {
    var name = titleOf(r.field, r.obj);
    if (!window.confirm("Delete “" + name + "”?\n\nIt stays on the live site until you publish.")) return;
    r.parent.splice(r.index, 1);
    var parentPath = r.base.replace(/\.\d+$/, "");
    clearErr(parentPath);
    changed(parentPath);
    var up = parentPath.replace(/\.?[^.]+$/, ""); // the page that holds the list
    location.hash = "#edit/" + cur.area + (up ? "/" + up : "");
  }

  /* ----------------------------------------------------------------- save */

  var bar;
  function saveBar() {
    bar = h("div", { class: "savebar", role: "region", "aria-label": "Save" });
    updateSaveBar();
    return bar;
  }
  function updateSaveBar() {
    if (!bar) return;
    var preview = h("a", { class: "btn ghost small", href: S.previewHref(cur.area), target: "_blank", rel: "noopener",
      title: "Opens the website with your saved drafts — only you see it." }, "Preview");
    if (cur.dirty) {
      bar.className = "savebar dirty";
      S.put(bar, 
        h("span", {}, "You have unsaved changes"),
        h("span", { class: "savebar-actions" },
          preview,
          h("button", { class: "btn ghost small", type: "button", onclick: undo }, "Undo"),
          h("button", { class: "btn small", type: "button", onclick: function () { save(); } }, "Save draft")));
    } else {
      bar.className = "savebar";
      S.put(bar, h("span", { class: "muted" }, "All changes saved as a draft. Publish puts them live."),
        h("span", { class: "savebar-actions" }, preview, h("a", { class: "btn ghost small", href: "#publish" }, "Go to Publish")));
    }
  }

  function undo() {
    if (!window.confirm("Throw away the changes you haven’t saved?")) return;
    var area = cur.area;
    cur = null;
    S.editor(page, area, "");
    location.hash = "#edit/" + area;
  }

  function strip(doc) {
    return JSON.parse(JSON.stringify(doc, function (k, v) { return k === "__paintId" ? undefined : v; }));
  }

  function save() {
    var btns = bar ? bar.querySelectorAll("button") : [];
    Array.prototype.forEach.call(btns, function (b) { b.disabled = true; });
    return S.api("PUT", "/admin/content/" + cur.area, { doc: strip(cur.doc), rev: cur.rev }).then(function (r) {
      cur.doc = r.doc; cur.rev = r.rev; cur.dirty = false; cur.errors = [];
      fresh = new WeakSet();
      S.toast("Saved as a draft. Publish when you’re ready to put it live.");
      S.refreshStatus && S.refreshStatus();
      render();
    }, function (err) {
      if (err.code === "invalid") {
        cur.errors = (err.data && err.data.errors) || [];
        S.toast("Some fields need fixing — they’re marked in red.", "bad");
        render();
        var first = page.querySelector(".field-error, .alert.error");
        if (first) first.scrollIntoView({ block: "center", behavior: "smooth" });
      } else {
        S.toast(err.message, "bad");
        updateSaveBar();
      }
    });
  }
})();
