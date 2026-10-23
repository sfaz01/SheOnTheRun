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

   HIDING A PRODUCT: set hidden: true. It stays here (and in the admin) with all
   its details, but it is not on the shop and can't be ordered. Take the line
   out, or set it to false, to bring it back. A category whose products are all
   hidden disappears from the filter buttons by itself.

   PHOTOS: "image" is the main photo. "gallery" is an optional list of extra
   photos shown as small pictures underneath. For products that come in colours
   (or sizes), "optionPhotos" lists the photos to show for each option — they
   change when the customer picks one. Photo names come from data/images.js.

   HOW TO ADD A PRODUCT — copy a block into the "items" list of a category:

     {
       id:    "sotr-tee-white",
       name:  "SheOnTheRun Tee",
       blurb: "Soft cotton, oversized fit.",
       price: 25,              // a number in USD, or null for "Price on request"
       image: "shop-tee",      // a name from data/images.js, or "" for a placeholder
       gallery: [],            // more photo names (optional)
       options: ["S", "M", "L", "XL"],               // sizes or colours, or [] for none
       optionPhotos: { "S": ["shop-tee"] },          // photos per option (optional)
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
          price: 30,
          image: "shop-tee",
          options: ["S", "M", "L", "XL"],
          soldOut: false
        },
        {
          id: "sotr-bag",
          name: "Run Bag",
          blurb: "Holds a change of clothes, a water bottle and everything you tell yourself you don't need.",
          price: null,
          image: "shop-bag",
          options: [],
          soldOut: false,
          hidden: true
        },
        {
          id: "socks-grip-white",
          name: "White Grip Socks",
          blurb: "Ankle-height socks with a grippy sole — the cheapest upgrade to how a Pilates or yoga session feels.",
          price: 3,
          image: "shop-socks-grip-heel",
          gallery: ["shop-socks-grip-sole"],
          options: [],
          soldOut: false
        },
        {
          id: "socks-striped",
          name: "Striped Crew Socks",
          blurb: "Classic ribbed crew socks with two navy stripes. Simple, clean, and easy to wear every day.",
          price: 3,
          image: "shop-socks-striped-flat",
          gallery: ["shop-socks-striped-worn", "shop-socks-striped-label", "shop-socks-striped-rib"],
          options: [],
          soldOut: false
        },
        {
          id: "socks-corgi",
          name: "Corgi Grip Socks",
          blurb: "Crew socks with a tiny embroidered corgi and a grippy sole for Pilates and yoga days.",
          price: 5,
          image: "shop-socks-corgi-front",
          gallery: ["shop-socks-corgi-detail", "shop-socks-corgi-back", "shop-socks-corgi-sole"],
          options: [],
          soldOut: false
        },
        {
          id: "socks-cherry",
          name: "Cherry Grip Socks",
          blurb: "Ruffle-cuff socks with an embroidered cherry and little pink heart grips on the sole.",
          price: 5,
          image: "shop-socks-cherry-front",
          gallery: ["shop-socks-cherry-detail"],
          options: [],
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
          soldOut: false,
          hidden: true
        },
        {
          id: "measuring-cups",
          name: "Measuring Cups & Spoons",
          blurb: "For recipes, for oil, and for the moment you realise how much tahini you've been using.",
          price: null,
          image: "shop-cups",
          options: [],
          soldOut: false,
          hidden: true
        },
        {
          id: "portion-set",
          name: "Portion Guide Set",
          blurb: "A simple visual system for building a plate without counting anything.",
          price: null,
          image: "shop-portion",
          options: [],
          soldOut: false,
          hidden: true
        },
        {
          id: "journal",
          name: "Habit & Food Journal",
          blurb: "Pen and paper, on purpose. Writing it down changes it more than any app I've tried.",
          price: null,
          image: "shop-journal",
          options: [],
          soldOut: false,
          hidden: true
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
          name: "Running Belt Bag",
          blurb: "Running · Wear it across the body or around the waist. Carries a phone and a key without bouncing — that's the whole review.",
          price: 12,
          image: "shop-belt-burgundy-front",
          options: ["Burgundy", "Black", "Navy"],
          optionPhotos: {
            "Burgundy": ["shop-belt-burgundy-front", "shop-belt", "shop-belt-burgundy-back"],
            "Black": ["shop-belt-black-front", "shop-belt-black-worn", "shop-belt-black-back", "shop-belt-black-zip"],
            "Navy": ["shop-belt-navy-front", "shop-belt-navy-back"]
          },
          soldOut: false
        },
        {
          id: "pick-wrist-pouch",
          name: "Wrist Pouch",
          blurb: "Running · Straps to your wrist so your cards and a few coins stay with you. Hands free, nothing bouncing.",
          price: 12,
          image: "shop-pouch-cream-front",
          options: ["Cream", "Pink"],
          optionPhotos: {
            "Cream": ["shop-pouch-cream-front", "shop-pouch-cream-worn", "shop-pouch-cream-back"],
            "Pink": ["shop-pouch-pink-front", "shop-pouch-pink-worn", "shop-pouch-pink-back"]
          },
          soldOut: false
        },
        {
          id: "pick-bottle",
          name: "Insulated Bottle",
          blurb: "Wellness · Cold water in a Beirut summer is a habit-changer, not a luxury.",
          price: null,
          image: "shop-bottle",
          options: [],
          soldOut: false,
          hidden: true
        },
        {
          id: "pick-shaker",
          name: "Shaker & Snack Set",
          blurb: "Nutrition · For fuelling around training when you're going straight from work to the track.",
          price: null,
          image: "shop-shaker",
          options: [],
          soldOut: false,
          hidden: true
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
