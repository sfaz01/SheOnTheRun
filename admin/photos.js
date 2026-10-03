/* =============================================================================
   SheOnTheRun admin — the photo library.
   Upload (the server resizes it into the site's sizes), describe it in English and
   Arabic, replace it, delete it. Photos built into the website's pages can be described
   and replaced but not deleted. Descriptions go live with Publish like everything else.
   ========================================================================== */
(function () {
  "use strict";
  var S = window.SOTR, h = S.h;

  function thumb(p) {
    return h("img", { class: "ph-thumb", loading: "lazy", decoding: "async", alt: p.alt || p.name,
      src: "/public/images/" + p.name + "-" + p.w[0] + ".jpg?v=" + p.w.join("-") });
  }

  function send(fields, file) {
    var fd = new FormData();
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });
    if (file) fd.append("file", file);
    return fetch("/api/admin/photos", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": S.csrf }, body: fd })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (res.ok) return data;
          var err = new Error(data.error || "The upload didn’t work. Please try again.");
          err.code = data.code;
          throw err;
        });
      }, function () { throw new Error("Can’t reach the server. Check your connection."); });
  }

  S.photosView = function (page) {
    return S.api("GET", "/admin/photos").then(function (r) {
      var photos = r.photos;
      var grid = h("div", { class: "photo-grid" });
      var count = h("span", { class: "count" });
      var search = h("input", { type: "search", placeholder: "Search photos by name or description", "aria-label": "Search photos", class: "photo-search",
        oninput: function () { paint(); } });
      var openName = null;

      function reload() { S.invalidateSchema(); return S.photosView(page); }

      /* ---- upload form */
      var fileInput = h("input", { type: "file", id: "up-file", accept: "image/jpeg,image/png,image/webp", required: true });
      var preview = h("img", { class: "up-preview", alt: "", hidden: true });
      fileInput.addEventListener("change", function () {
        var f = fileInput.files[0];
        if (!f) { preview.hidden = true; return; }
        preview.src = URL.createObjectURL(f);
        preview.hidden = false;
        var nameBox = document.getElementById("up-name");
        if (nameBox && !nameBox.value) nameBox.placeholder = S.slug(f.name.replace(/\.[^.]+$/, "")) || "photo-name";
      });
      var uploadForm = S.form([
        h("div", { class: "field" }, h("label", { for: "up-file" }, "Photo"), fileInput,
          h("p", { class: "hint" }, "JPEG, PNG or WebP. A phone photo is fine — it’s resized and turned the right way up automatically."), preview),
        S.field("up-name", "Name (optional)", { type: "text", maxlength: 60, autocomplete: "off" }, "Short, lowercase, e.g. sunset-run-oct. Used only inside the admin and in file names."),
        h("div", { class: "pair" },
          h("div", { class: "side" }, h("span", { class: "lang" }, "English"),
            h("label", { for: "up-alt" }, "Describe the photo ", h("span", { class: "req" }, "*")),
            h("input", { id: "up-alt", type: "text", maxlength: 200, required: true, placeholder: "e.g. Women stretching on the corniche at sunset" })),
          h("div", { class: "side ar", lang: "ar", dir: "rtl" }, h("span", { class: "lang" }, "العربية"),
            h("label", { for: "up-alt-ar", class: "vh-label" }, "Description in Arabic"),
            h("input", { id: "up-alt-ar", type: "text", maxlength: 200 }))),
        h("p", { class: "hint" }, "The description is read aloud to people who can’t see the photo, and helps Google understand it.")
      ], "Upload photo", function (f) {
        var file = fileInput.files[0];
        if (!file) throw new Error("Choose a photo first.");
        if (file.size > 16 * 1024 * 1024) throw new Error("That file is over 16 MB. Export a smaller version from your photo app.");
        return send({ name: S.val(f, "up-name"), alt: S.val(f, "up-alt"), alt_ar: S.val(f, "up-alt-ar") }, file).then(function (p) {
          S.toast("Uploaded “" + p.name + "”. It goes live with Publish.");
          S.refreshStatus && S.refreshStatus();
          return reload();
        });
      }, null, { inline: true });

      /* ---- one photo's editor */
      function card(p) {
        var open = openName === p.name;
        var flags = h("span", { class: "row-flags" },
          p.canDelete ? null : h("span", { class: "flag muted" }, "Built in"),
          p.used.length ? h("span", { class: "flag info" }, "In use") : null,
          p.altAr ? null : h("span", { class: "flag warn" }, "Arabic missing"));
        var main = h("button", { type: "button", class: "photo-card" + (open ? " open" : ""), "aria-expanded": open ? "true" : "false",
          onclick: function () { openName = open ? null : p.name; paint(); } },
          thumb(p), h("span", { class: "photo-name" }, p.name), flags);
        var li = h("div", { class: "photo-item" }, main);
        if (open) li.appendChild(editor(p));
        return li;
      }

      function editor(p) {
        var replaceInput = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", id: "rp-file" });
        var form = S.form([
          h("div", { class: "pair" },
            h("div", { class: "side" }, h("span", { class: "lang" }, "English"),
              h("label", { for: "ed-alt" }, "Description"),
              h("input", { id: "ed-alt", type: "text", maxlength: 200, value: p.alt, required: true })),
            h("div", { class: "side ar", lang: "ar", dir: "rtl" }, h("span", { class: "lang" }, "العربية"),
              h("label", { for: "ed-alt-ar", class: "vh-label" }, "Description in Arabic"),
              h("input", { id: "ed-alt-ar", type: "text", maxlength: 200, value: p.altAr })))
        ], "Save description", function (f) {
          return S.api("PUT", "/admin/photos/" + p.name, { alt: S.val(f, "ed-alt"), alt_ar: S.val(f, "ed-alt-ar") }).then(function () {
            S.toast("Saved. It goes live with Publish.");
            S.refreshStatus && S.refreshStatus();
            return reload();
          });
        }, null, { inline: true });

        var replaceForm = S.form([
          h("div", { class: "field" }, h("label", { for: "rp-file" }, "Replace with a new photo"), replaceInput,
            h("p", { class: "hint" }, "Same name, new picture, everywhere it’s used. The new photo may have a different shape."))
        ], "Replace photo", function () {
          var file = replaceInput.files[0];
          if (!file) throw new Error("Choose a photo first.");
          if (!window.confirm("Replace “" + p.name + "” with this photo? The old file is overwritten.")) return;
          return send({ replace: p.name, alt: p.alt, alt_ar: p.altAr || "" }, file).then(function () {
            S.toast("Replaced.");
            S.refreshStatus && S.refreshStatus();
            return reload();
          });
        }, null, { inline: true });

        var del = p.canDelete ? h("button", { type: "button", class: "btn danger small", onclick: function () {
          if (!window.confirm("Delete “" + p.name + "”? This can’t be undone.")) return;
          S.api("DELETE", "/admin/photos/" + p.name).then(function () { S.toast("Deleted."); S.refreshStatus && S.refreshStatus(); return reload(); },
            function (e) { S.toast(e.message, "bad"); });
        } }, "Delete photo") : h("p", { class: "hint" }, "This photo is part of the website’s pages, so it can be described and replaced but not deleted.");

        return h("div", { class: "photo-edit" },
          h("p", { class: "hint" }, p.w.join(" · ") + " px wide versions · shape " + p.r + (p.used.length ? " · used by " + p.used.join(", ") : "")),
          form, replaceForm, del);
      }

      function paint() {
        var q = search.value.trim().toLowerCase();
        var shown = photos.filter(function (p) { return !q || p.name.indexOf(q) !== -1 || (p.alt || "").toLowerCase().indexOf(q) !== -1; });
        S.put(count, " " + shown.length);
        S.put(grid, shown.length ? shown.map(card) : h("p", { class: "muted" }, "No photos match."));
      }

      S.put(page,
        h("h1", {}, "Photos"),
        h("p", { class: "muted" }, "Every photo on the website. Choose them for products, articles and the galleries from the pickers in those sections."),
        h("section", { class: "panel" }, h("h2", {}, "Add a photo"), uploadForm),
        h("section", { class: "panel" }, h("h2", {}, "Library", count), search, grid));
      paint();
    });
  };
})();
