/* =============================================================================
   WHICH PLAN THE SAMPLE BUTTON OPENS
   -----------------------------------------------------------------------------
   The "Try the sample plan" button on dietontherun.html opens this page from
   data/plans/. The admin panel's Meal plans screen chooses it; Publish rewrites
   this file. Until then it opens Fatima's own plan.
   ========================================================================== */
window.SITE_PLAN = {
 "sample": "fatimas-plate.html",
 "template": "meal-plan-template.csv"
};
