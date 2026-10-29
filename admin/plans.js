/* =============================================================================
   SheOnTheRun admin — the meal-plan library.
   The plan files Fatima sends clients live in data/plans/ (the tracker reads the
   sample from there). Upload, choose the sample the "Try the sample plan" button
   opens, delete files. The sample choice goes live with Publish, like everything
   else; the files themselves are on the server the moment they're uploaded.
   ========================================================================== */
(function () {
  "use strict";
  var S = window.SOTR, h = S.h;

  function size(bytes) {
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function send(fields, file) {
    var fd = new FormData();
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });
    if (file) fd.append("file", file);
    return fetch("/api/admin/plans/upload", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": S.csrf }, body: fd })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (res.ok) return data;
          var err = new Error(data.error || "The upload didn’t work. Please try again.");
          err.code = data.code;
          throw err;
        });
      }, function () { throw new Error("Can’t reach the server. Check your connection."); });
  }

  function what(kind) {
    return kind === "html" ? "plan page" : kind === "csv" ? "spreadsheet plan" : "saved copy";
  }

  S.plansView = function (page) {
    return S.api("GET", "/admin/plans").then(function (r) {
      var files = r.files;
      var list = h("ul", { class: "admins plans" });

      files.forEach(function (f) {
        var flags = h("span", { class: "row-flags" },
          f.sample ? h("span", { class: "flag ok" }, "Sample") : null,
          f.protected ? h("span", { class: "flag muted" }, "Template") : null);
        var actions = h("span", { class: "plan-actions" });
        if (f.kind === "html" && !f.sample) {
          actions.appendChild(h("button", { type: "button", class: "btn ghost small", onclick: function () {
            S.api("POST", "/admin/plans/sample", { name: f.name }).then(function () {
              S.toast("“" + f.name + "” is the sample now. Publish to put it live.");
              S.refreshStatus && S.refreshStatus();
              return S.plansView(page);
            }, function (e) { S.toast(e.message, "bad"); });
          } }, "Make it the sample"));
        }
        if (f.canDelete) {
          actions.appendChild(h("button", { type: "button", class: "btn danger small", onclick: function () {
            if (!window.confirm("Delete “" + f.name + "”? The file is removed from the server.")) return;
            S.api("DELETE", "/admin/plans/" + f.name).then(function () {
              S.toast("Deleted " + f.name + ".");
              return S.plansView(page);
            }, function (e) { S.toast(e.message, "bad"); });
          } }, "Delete"));
        }
        list.appendChild(h("li", {},
          h("div", {}, h("strong", {}, f.name), flags,
            h("div", { class: "muted small" }, what(f.kind) + " · " + size(f.size) + " · added " + S.fmtUtc(f.modified))),
          actions));
      });

      var fileInput = h("input", { type: "file", id: "plan-file", accept: ".html,.csv,.json,.pdf", required: true });
      var uploadForm = S.form([
        h("div", { class: "field" }, h("label", { for: "plan-file" }, "Plan file"), fileInput,
          h("p", { class: "hint" }, "A plan page (.html), a spreadsheet plan (.csv) or a saved copy (.json) — up to 3 MB. A PDF needs converting first (see above).")),
        S.field("plan-name", "Name (optional)", { type: "text", maxlength: 60, autocomplete: "off" },
          "Short, lowercase, e.g. may-plan-rania. Without it, the file’s own name is used."),
        h("p", { class: "hint" }, "Only the sample and the template are linked from the website. Anything in this library can be opened by whoever has its web address, so keep private client plans elsewhere, or use a name only you know.")
      ], "Upload plan file", function (f) {
        var file = fileInput.files[0];
        if (!file) throw new Error("Choose a file first.");
        if (/\.pdf$/i.test(file.name)) throw new Error("A PDF can’t be used as a tracker — the tracker needs each meal as a separate choice with its calories and protein. Turn it into a .csv (or an .html plan page) first: see “Have a PDF?” on this page.");
        return send({ name: S.val(f, "plan-name") }, file).then(function (p) {
          S.toast("Uploaded “" + p.name + "”.");
          return S.plansView(page);
        });
      }, null, { inline: true });

      var MESSAGE = "I'm a dietitian. I'm attaching a client's meal plan as a PDF, and my website's meal-plan template (meal-plan-template.csv). " +
        "Please turn the PDF into a .csv file in exactly the template's format: the title, target_kcal, protein_min, protein_max and note lines at the top, " +
        "a blank line, then the columns meal,guide,option,kcal,carbs,protein,fat,ingredients. " +
        "Use one row per choice. The meal's name goes in 'meal' (the same wording on every row of that meal; if the PDF is in Arabic, keep it in Arabic). " +
        "Its time or aim goes in 'guide' on the meal's first row. Each numbered option, with its portions and any '+' combination, is one row in 'option', in my own wording. " +
        "Put the ingredients in one cell separated by semicolons. " +
        "Work out kcal, carbs, protein and fat for each option from its portions; if the PDF doesn't give a number, estimate it, and list every estimated option at the end so I can check it. " +
        "Save the file as UTF-8 so Arabic opens correctly, and give it to me to download.";
      var copyBtn = h("button", { type: "button", class: "btn small", onclick: function () {
        (navigator.clipboard ? navigator.clipboard.writeText(MESSAGE) : Promise.reject()).then(
          function () { copyBtn.textContent = "Copied"; setTimeout(function () { copyBtn.textContent = "Copy the message"; }, 1800); },
          function () { copyBtn.textContent = "Select the text and copy it"; });
      } }, "Copy the message");
      var pdfHelp = h("section", { class: "panel" },
        h("h2", {}, "Have a PDF?"),
        h("p", {}, "The tracker can’t read a PDF: it needs every meal as a separate choice, with its calories and protein. The quickest fix is to ask Claude to convert it — it takes a minute."),
        h("ol", { class: "steps" },
          h("li", {}, "Download the template below, then open Claude."),
          h("li", {}, "Attach your PDF and the template, and paste the message below."),
          h("li", {}, "Download the .csv Claude gives you. Upload it here, or send it straight to your client.")),
        h("pre", { class: "prompt" }, MESSAGE),
        h("div", { class: "row mt" },
          copyBtn,
          h("a", { class: "btn ghost small", href: "/data/plans/meal-plan-template.csv", download: "meal-plan-template.csv" }, "Download the template"),
          h("a", { class: "btn ghost small", href: "/data/plans/fatimas-plate.html", download: "fatimas-plate.html" }, "Download the sample plan page")),
        h("p", { class: "muted small" }, "Want an interactive page like the sample instead of a spreadsheet? Attach the sample plan page and ask Claude to build your client’s plan in the same style — then upload the .html file."));

      S.put(page,
        h("h1", {}, "Meal plans"),
        h("p", { class: "muted" }, "The plan files the tracker and your clients use. The sample is what “Try the sample plan” opens on the DietOnTheRun page."),
        h("section", { class: "panel" }, h("h2", {}, "Files"), list.length ? list : h("p", { class: "muted" }, "No plan files yet.")),
        pdfHelp,
        h("section", { class: "panel" }, h("h2", {}, "Add a plan file"), uploadForm));
    });
  };
})();
