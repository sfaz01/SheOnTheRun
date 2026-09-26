/* =============================================================================
   SHOP
   -----------------------------------------------------------------------------
   All products show together in one grid; the categories below become the
   filter buttons above it ("Everything" is selected by default).
   Payment is cash on delivery. Checkout asks for name, phone, governorate
   (from the list at the bottom of this file) and a detailed address.

   PRICES: give each product a price (a number in USD) so the cart can show a
   total. Leave price: null and the product shows "Price confirmed with your
   order" instead.

   Categories appear in the order listed here. A category with
   comingSoon: true shows as a "Coming soon" panel; the moment you add
   products to it and set comingSoon: false, it becomes a normal category.

   HOW TO ADD A PRODUCT — copy a block into the "items" list of a category:

     {
       id:    "sotr-tee-white",
       name:  "SheOnTheRun Tee",
       blurb: "Soft cotton, oversized fit.",
       price: 25,              // a number in USD, or null for "Price on request"
       image: "shop-tee",      // a name from data/images.js, or "" for a placeholder
       options: ["S", "M", "L", "XL"],               // or [] for none
       soldOut: false
     },
   ========================================================================== */

window.SITE_SHOP = {

  categories: [

    {
      id: "sheontherun",
      name: "SheOnTheRun",
      blurb: "Club kit for the women who show up. Worn on the corniche, at Biel, and on the days you nearly didn't come.",
      comingSoon: false,
      items: [
        {
          id: "sotr-tee",
          name: "SheOnTheRun Tee",
          blurb: "The club tee. Soft cotton, relaxed fit, wears in rather than out.",
          price: null,
          image: "shop-tee",
          options: ["S", "M", "L", "XL"],
          soldOut: false
        },
        {
          id: "sotr-cap",
          name: "SheOnTheRun Cap",
          blurb: "Light, packable, and good for sunset runs when the light comes in sideways.",
          price: null,
          image: "shop-cap",
          options: [],
          soldOut: false
        },
        {
          id: "sotr-bag",
          name: "Run Bag",
          blurb: "Holds a change of clothes, a water bottle and everything you tell yourself you don't need.",
          price: null,
          image: "shop-bag",
          options: [],
          soldOut: false
        },
        {
          id: "sotr-socks",
          name: "Sports Socks",
          blurb: "Cushioned crew socks and grip socks for Pilates — the cheapest upgrade to how a session feels.",
          price: null,
          image: "shop-socks",
          options: ["36–39", "40–43"],
          soldOut: false
        }
      ]
    },

    {
      id: "wellness-tools",
      name: "Wellness Tools",
      blurb: "The practical things I actually ask clients to own. Nothing here is a supplement, and nothing here is magic — they just make eating well easier to do.",
      comingSoon: false,
      items: [
        {
          id: "food-scale",
          name: "Digital Food Scale",
          blurb: "Not for weighing everything forever — for two weeks of learning what a portion really looks like.",
          price: null,
          image: "shop-scale",
          options: [],
          soldOut: false
        },
        {
          id: "measuring-cups",
          name: "Measuring Cups & Spoons",
          blurb: "For recipes, for oil, and for the moment you realise how much tahini you've been using.",
          price: null,
          image: "shop-cups",
          options: [],
          soldOut: false
        },
        {
          id: "portion-set",
          name: "Portion Guide Set",
          blurb: "A simple visual system for building a plate without counting anything.",
          price: null,
          image: "shop-portion",
          options: [],
          soldOut: false
        },
        {
          id: "journal",
          name: "Habit & Food Journal",
          blurb: "Pen and paper, on purpose. Writing it down changes it more than any app I've tried.",
          price: null,
          image: "shop-journal",
          options: [],
          soldOut: false
        }
      ]
    },

    {
      id: "my-picks",
      name: "My Picks",
      blurb: "Things I personally use, like or recommend — across running, nutrition, wellness and learning. If it's here, it's in my own bag or on my own shelf.",
      comingSoon: false,
      items: [
        {
          id: "pick-belt",
          name: "Running Belt",
          blurb: "Running · Carries a phone and a key without bouncing. That's the whole review.",
          price: null,
          image: "shop-belt",
          options: [],
          soldOut: false
        },
        {
          id: "pick-bottle",
          name: "Insulated Bottle",
          blurb: "Wellness · Cold water in a Beirut summer is a habit-changer, not a luxury.",
          price: null,
          image: "shop-bottle",
          options: [],
          soldOut: false
        },
        {
          id: "pick-shaker",
          name: "Shaker & Snack Set",
          blurb: "Nutrition · For fuelling around training when you're going straight from work to the track.",
          price: null,
          image: "shop-shaker",
          options: [],
          soldOut: false
        }
      ]
    },

    {
      id: "modest-activewear",
      name: "Modest Activewear",
      blurb: "Kit designed for women who cover, made for actually moving in — breathable, long-line, and cut for running rather than adapted for it. In development now.",
      comingSoon: true,
      items: []
    }

  ],

  /* Checkout: the governorates a customer can choose from. */
  governorates: [
    "Beirut",
    "Mount Lebanon",
    "North Lebanon",
    "Akkar",
    "Baalbek-Hermel",
    "Beqaa",
    "South Lebanon",
    "Nabatieh"
  ]

};
