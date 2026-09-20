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

  /* Phase 1 checkout. Set to "payments" later when you add a payment provider
     and the shop buttons switch from WhatsApp to a real checkout. */
  checkoutMode: "whatsapp"

};
