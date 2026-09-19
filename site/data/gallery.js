/* =============================================================================
   PHOTO SETS
   -----------------------------------------------------------------------------
   Each list below is a run of photographs used somewhere on the site. The names
   are slots from data/images.js — change the order, add a name, remove one, and
   the page follows. Captions are optional; leave "" for none.
   ========================================================================== */

window.SITE_GALLERY = {

  /* The moving strip on the home page. Keep 8–14 for a good rhythm.
     A photo only gets in here if it still reads at 150–300px tall and moving.
     That rules out the certificate and banner shots (the LAU step-and-repeat,
     the Water Diplomacy word wall, the Shanghai and graduation backdrops) and
     the big group photos: at this size the subject disappears and you are left
     with a coloured rectangle of unreadable type, which is also where the
     palette clashes came from. Those photographs are not weak — they are shown
     large and captioned on the Public Health page, which is where they mean
     something. What is left is one register: daylight, running, faces you can
     actually see. */
  marquee: [
    "track-race", "sotr-girls-wide", "run-road-detail", "ph-unicef-pair",
    "sotr-yoga", "track-duo", "sotr-jackets-wide", "sotr-unicef-run",
    "journey-2022", "sotr-pair", "track-relay", "sotr-runlikeagirl"
  ],

  /* The pinned horizontal run on the SheOnTheRun page. */
  community: [
    { img: "sotr-girls",        caption: "Race day, together" },
    { img: "sotr-runlikeagirl", caption: "Run like a girl" },
    { img: "sotr-yoga-tall",    caption: "Yoga above the valley" },
    { img: "sotr-jackets",      caption: "The club jackets" },
    { img: "sotr-tote",         caption: "In full bloom" },
    { img: "sotr-pair",         caption: "Nobody runs alone" },
    { img: "track-bib",         caption: "Number on, nerves in" },
    { img: "sotr-unicef-run",   caption: "Running for something" }
  ],

  /* The grid lower down the SheOnTheRun page. Opens in a lightbox. */
  moments: [
    "sotr-bloom", "sotr-track-duo", "run-crosswalk", "sotr-girls",
    "sotr-yoga", "sotr-jackets", "sotr-pair", "sotr-runlikeagirl"
  ],

  /* Public health — the work, in pictures. */
  fieldwork: [
    { img: "ph-unicef-tent",     caption: "UNICEF — for every child" },
    { img: "ph-qudwa",           caption: "QUDWA programme workshop" },
    { img: "ph-water",           caption: "Water diplomacy programme" },
    { img: "ph-unv-training",    caption: "UNV–UNICEF Youth Advocates" },
    { img: "ph-training-room",   caption: "Training delivery" },
    { img: "ph-wids",            caption: "Women in Data Science, AUB" },
    { img: "ph-unicef-team",     caption: "The volunteers team" },
    { img: "ph-water-cert",      caption: "Closing ceremony, Water Governance" }
  ],

  /* Traditional wisdom — China and the natural world. */
  china: [
    "china-summer-school", "china-garden", "nature-lotus",
    "china-pavilion", "nature-lilies", "china-flags"
  ]

};
