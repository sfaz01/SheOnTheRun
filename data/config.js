/* =============================================================================
   SITE CONFIG  —  edit this file first
   -----------------------------------------------------------------------------
   Fill in the two placeholders below and every booking button, every
   "Order on WhatsApp" button and every email link on the site starts working.
   Nothing else needs to change.

   whatsapp : your number in full international format, digits only.
              Lebanon example: 96170123456   (961 = country code, no + and no 0)
   email    : your main (professional) address. General and research
              enquiries, and shop orders, arrive here.
   emails   : the inbox each Connect-form subject goes to. A subject that
              isn't listed goes to the main address above.
   ========================================================================== */

window.SITE = {

  whatsapp: "[[WHATSAPP NUMBER]]",
  email: "fatimahmouzahem08@gmail.com",

  emails: {
    nutrition:   "dietontherun@gmail.com",   // Nutrition consultations
    sheontherun: "sheonzrun@gmail.com",      // SheOnTheRun
    events:      "sheonzrun@gmail.com",      // Events / partnerships
    research:    "fatimahmouzahem08@gmail.com",
    general:     "fatimahmouzahem08@gmail.com"
  },

  /* Where she is — shown on the Connect page with a map. */
  address: "Gemmayze, Accaoui Street, next to Belbol Ameublement, Blue Building, Beirut, Lebanon",
  mapsUrl: "https://maps.app.goo.gl/m3EG91gCSahm8Har7",

  /* Social — leave a value empty ("") to hide that link everywhere. */
  instagram: "https://www.instagram.com/sheontherun.lb/",
  instagramHandle: "@sheontherun.lb",
  linkedin: "",

  /* Shown in the footer and used for local SEO. */
  location: "Beirut, Lebanon",

  /* Contact form delivery. Leave "" and the form opens the visitor's own email
     app (it works, but loses people on phones with no mail app set up).
     For real delivery, create a free form at https://formspree.io, copy its
     endpoint and paste it here, e.g. "https://formspree.io/f/abcdwxyz".
     Messages then arrive in your inbox and the visitor sees a thank-you note. */
  formEndpoint: "",

  /* Online booking. Paste a Cal.com or Calendly link (e.g.
     "https://cal.com/fatima-mouzahem") and every "Book" button opens a real
     calendar instead of WhatsApp. Leave "" to keep booking on WhatsApp. */
  bookingUrl: "",

  /* Newsletter. Paste the form-action URL from Buttondown, MailerLite or
     Substack. Leave "" and the sign-up box stays hidden. */
  newsletterEndpoint: "",

  /* Visitor statistics — privacy-friendly, no cookies, no banner needed.
     Fill ONE of these to switch it on; leave both "" for none.
       plausibleDomain  : your site as registered at plausible.io, e.g. "sheontherun.com"
       cloudflareToken  : the token from Cloudflare Web Analytics (free)          */
  plausibleDomain: "",
  cloudflareToken: "",

  /* Shop orders (cash on delivery). Paste a Formspree endpoint here (it can be
     the same one as formEndpoint) and orders arrive straight in your inbox.
     Left "", the order opens in WhatsApp once the number above is set — or,
     until then, in the customer's email app addressed to you. */
  orderEndpoint: ""

};
