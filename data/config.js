/* =============================================================================
   SITE CONFIG  —  edit this file first
   -----------------------------------------------------------------------------
   Fill in the two placeholders below and every booking button, every
   "Order on WhatsApp" button and every email link on the site starts working.
   Nothing else needs to change.

   whatsapp : your number in full international format, digits only.
              Lebanon example: 96170123456   (961 = country code, no + and no 0)
   email    : the address you want professional enquiries to arrive at.
   ========================================================================== */

window.SITE = {

  whatsapp: "[[WHATSAPP NUMBER]]",
  email: "[[EMAIL]]",

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

  /* Phase 1 checkout. Set to "payments" later when you add a payment provider
     and the shop buttons switch from WhatsApp to a real checkout. */
  checkoutMode: "whatsapp"

};
