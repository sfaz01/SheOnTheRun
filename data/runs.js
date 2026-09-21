/* =============================================================================
   RUNS, CLASSES & EVENTS
   -----------------------------------------------------------------------------
   Anything whose "ends" date/time has passed disappears from the site by
   itself, using Beirut time. You never have to delete old runs — though you
   can, to keep this file tidy.

   HOW TO ADD ONE — copy a block, change the values, keep the comma:

     {
       id:    "a-short-unique-name",
       kind:  "run",              // run | class | event | challenge | retreat
       title: "Sunset Run",
       starts: "2026-10-07T18:30", // Beirut local time, 24h clock
       ends:   "2026-10-07T19:30", // when it finishes (used to hide it)
       place: "Biel, Beirut",
       detail: "30 minutes, easy pace. All paces welcome.",
       note:  "",                 // optional small line, e.g. "Limited places"
       spots: 12,                 // optional: places left. 0 = "Fully booked".
                                  // Leave the line out to show no count.
       featured: false            // true = shown large at the top
     },

   "recurring" below is the regular weekly rhythm. It is always shown and is
   never hidden by date — edit the text if your usual days or time change.
   ========================================================================== */

window.SITE_RUNS = {

  recurring: {
    title: "Sunset runs",
    days: "Tuesdays & Thursdays",
    time: "6:30 PM",
    place: "Biel, Beirut",
    detail: "30 minutes at an easy, talking pace. No one gets left behind, and no one is too slow to come."
  },

  events: [

    {
      id: "sunset-22-sep",
      kind: "run",
      title: "Sunset Run",
      starts: "2026-09-22T18:30",
      ends: "2026-09-22T19:30",
      place: "Biel, Beirut",
      detail: "30 minutes, easy conversation pace. We regroup at every turn.",
      note: "All paces welcome",
      featured: false
    },

    {
      id: "sunset-24-sep",
      kind: "run",
      title: "Sunset Run",
      starts: "2026-09-24T18:30",
      ends: "2026-09-24T19:30",
      place: "Biel, Beirut",
      detail: "30 minutes along the seafront. Free to join.",
      note: "All paces welcome",
      featured: false
    },

    {
      id: "sunset-29-sep",
      kind: "run",
      title: "Sunset Run",
      starts: "2026-09-29T18:30",
      ends: "2026-09-29T19:30",
      place: "Biel, Beirut",
      detail: "30 minutes, easy pace. Nobody runs alone.",
      note: "",
      featured: false
    },

    {
      id: "yoga-mountain",
      kind: "class",
      title: "Morning Yoga & Movement",
      starts: "2026-10-03T09:00",
      ends: "2026-10-03T10:30",
      place: "Broumana, Mount Lebanon",
      detail: "Gentle mobility, breathwork and recovery session overlooking the valley.",
      note: "Limited to 15 women",
      featured: false
    },

    {
      id: "backontherun",
      kind: "challenge",
      title: "BackOnTheRun",
      starts: "2026-09-14T00:00",
      ends: "2026-10-25T23:59",
      place: "Online — join from anywhere",
      detail: "A 6-week group nutrition challenge to help you build healthier habits, stay accountable, and feel better — with support along the way.",
      note: "$40 for 6 weeks",
      featured: true,
      link: "dietontherun.html#backontherun"
    }

  ]

};
