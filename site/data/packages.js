/* =============================================================================
   SERVICES & PACKAGES  —  the DietOnTheRun page
   -----------------------------------------------------------------------------
   Prices are numbers in US dollars. Write 40, not "40$".

   "modes" controls where a service appears when someone flips the
   In person / Online switch:
       ["in-person", "online"]   shows in both
       ["in-person"]             in-person only (e.g. body composition)

   "omitOnline" lists any bullet points that should disappear in Online mode —
   useful for anything that needs you and the client in the same room. Write the
   bullet exactly as it appears in "includes".
   ========================================================================== */

window.SITE_OFFER = {

  /* ---------------------------------------------------------------- SERVICES */
  services: [
    {
      id: "initial-consultation",
      number: "01",
      title: "Initial Nutrition Consultation",
      bestFor: "Anyone looking to understand their nutrition, lose or gain weight, improve their eating habits, support their health, or get started with a personalised nutrition plan.",
      includes: [
        "Comprehensive nutrition & lifestyle assessment",
        "Discussion of your goals, habits, challenges and preferences",
        "Review of relevant health history",
        "Personalised nutrition recommendations",
        "Practical guidance tailored to your lifestyle",
        "Personalised nutrition plan, where appropriate",
        "Follow-up recommendations"
      ],
      duration: "50–60 minutes",
      price: 40,
      modes: ["in-person", "online"],
      cta: "Book your consultation"
    },
    {
      id: "follow-up",
      number: "02",
      title: "Follow-Up Consultation",
      tagline: "Because nutrition isn't a one-and-done thing.",
      bestFor: "Existing clients who want to review progress, troubleshoot challenges and adjust their plan.",
      includes: [
        "Progress review",
        "What's working / what isn't",
        "Nutrition plan adjustments",
        "Goal setting",
        "Questions & guidance",
        "Accountability and support"
      ],
      duration: "30–45 minutes",
      price: 25,
      modes: ["in-person", "online"],
      cta: "Book a follow-up"
    },
    {
      id: "body-composition",
      number: "03",
      title: "Body Composition Assessment",
      bestFor: "Anyone who wants to look past the number on the scale and understand what their weight is actually made of.",
      includes: [
        "Body weight & BMI",
        "Body fat percentage",
        "Muscle mass",
        "Visceral fat",
        "Metabolic age",
        "Body composition analysis",
        "A brief explanation of your results and what they mean"
      ],
      duration: "20 minutes",
      price: 15,
      modes: ["in-person"],
      cta: "Book a body composition assessment"
    }
  ],

  /* ---------------------------------------------------------------- PACKAGES */
  packages: [
    {
      id: "the-start",
      name: "The Start",
      length: "1 month / 4 weeks",
      line: "For when you're ready to begin.",
      includes: [
        "1 initial consultation",
        "Personalised nutrition assessment, including a body composition test in person",
        "Personalised nutrition plan",
        "1 follow-up",
        "Email / WhatsApp support between sessions"
      ],
      omitOnline: [
        "Personalised nutrition assessment, including a body composition test in person"
      ],
      addOnline: [
        "Personalised nutrition assessment"
      ],
      price: 50,
      featured: false
    },
    {
      id: "the-reset",
      name: "The Reset",
      length: "6 weeks",
      line: "For when you want more structure and support.",
      includes: [
        "1 initial comprehensive consultation",
        "3 follow-up consultations with body composition tests",
        "Personalised nutrition plan",
        "Adjustments throughout the programme",
        "Habit & goal setting",
        "Between-session support"
      ],
      omitOnline: [
        "3 follow-up consultations with body composition tests"
      ],
      addOnline: [
        "3 follow-up consultations"
      ],
      price: 100,
      featured: true,
      badge: "Most chosen"
    },
    {
      id: "the-journey",
      name: "The Journey",
      length: "10 weeks",
      line: "For meaningful, long-term change.",
      includes: [
        "1 initial consultation",
        "5–6 follow-up consultations with body composition tests",
        "Personalised nutrition plan",
        "Ongoing adjustments",
        "Habit & lifestyle coaching",
        "Regular progress reviews",
        "Between-session support"
      ],
      omitOnline: [
        "5–6 follow-up consultations with body composition tests"
      ],
      addOnline: [
        "5–6 follow-up consultations"
      ],
      price: 150,
      featured: false
    }
  ],

  /* --------------------------------------------------------- GROUP CHALLENGE */
  challenge: {
    id: "backontherun",
    name: "BackOnTheRun",
    kicker: "6-week group nutrition challenge",
    dates: "14 September – 25 October",
    line: "Ready to get back on track?",
    body: "A 6-week group challenge to help you build healthier habits, stay accountable, and feel better — with support along the way.",
    includes: [
      "Online nutrition & lifestyle assessment",
      "Personalised nutrition plan",
      "Meal guides & easy recipes",
      "Weekly check-ins & accountability",
      "Group support & motivation"
    ],
    price: 40,
    priceNote: "for 6 weeks",
    cta: "Join BackOnTheRun"
  },

  /* ------------------------------------------------------------ HOW IT WORKS */
  steps: [
    {
      n: "01",
      title: "Say hello",
      body: "Message me on WhatsApp, or book a free 15-minute call if you're not sure what you need yet."
    },
    {
      n: "02",
      title: "We meet",
      body: "In my clinic in Beirut or on a video call. We go through your health, your routine, your food, your training and what you actually want."
    },
    {
      n: "03",
      title: "You get a plan that fits",
      body: "Personalised, evidence-based, and built around the way you already live — not around a diet you'll abandon in three weeks."
    },
    {
      n: "04",
      title: "We adjust as you go",
      body: "Follow-ups, check-ins and support between sessions. Real life changes, so the plan changes with it."
    }
  ]

};
