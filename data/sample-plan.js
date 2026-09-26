/* =============================================================================
   SAMPLE MEAL PLAN — the "Try the sample plan" button on tracker.html
   -----------------------------------------------------------------------------
   Fatima's own week ("Fatima's plate"). It shows clients what a plan looks
   like once it's loaded. Client plans are NOT stored here: each client
   uploads the plan file you send them, and it stays on their own phone.
   ========================================================================== */
window.SAMPLE_PLAN = {
 "format": "dietontherun-plan",
 "version": 1,
 "title": "Fatima's plate",
 "note": "One pick per meal · 6 starch, 2 milk, 7 protein, 2 snack",
 "target": {
  "kcal": 1700,
  "proteinMin": 110,
  "proteinMax": 126
 },
 "slots": [
  {
   "id": "breakfast",
   "label": "Breakfast",
   "guide": "300 kcal · 1 starch + 2 protein + 1 milk for coffee",
   "options": [
    {
     "n": "Eggs & mushroom scramble + tannour",
     "k": 300,
     "c": 26,
     "p": 22,
     "f": 13,
     "i": [
      "eggs",
      "mushrooms",
      "tannour bread",
      "onion"
     ]
    },
    {
     "n": "Boiled eggs + bread choice",
     "k": 300,
     "c": 27,
     "p": 21,
     "f": 12,
     "i": [
      "eggs",
      "tannour bread",
      "cucumber",
      "tomato"
     ]
    },
    {
     "n": "Eggs with kale & garlic + pita",
     "k": 300,
     "c": 24,
     "p": 21,
     "f": 14,
     "i": [
      "eggs",
      "kale",
      "garlic",
      "pita bread"
     ]
    },
    {
     "n": "Greek yogurt protein pancakes",
     "k": 300,
     "c": 28,
     "p": 24,
     "f": 9,
     "i": [
      "greek yogurt",
      "eggs",
      "oats"
     ]
    },
    {
     "n": "Protein overnight oats",
     "k": 300,
     "c": 30,
     "p": 23,
     "f": 8,
     "i": [
      "oats",
      "greek yogurt",
      "milk",
      "chia seeds"
     ]
    },
    {
     "n": "Za'atar labneh wrap",
     "k": 300,
     "c": 26,
     "p": 20,
     "f": 13,
     "i": [
      "pita bread",
      "labneh",
      "cucumber",
      "tomato"
     ]
    },
    {
     "n": "Feta, tomato & egg skillet",
     "k": 300,
     "c": 22,
     "p": 21,
     "f": 15,
     "i": [
      "eggs",
      "feta",
      "tomato",
      "tannour bread"
     ]
    },
    {
     "n": "Halloumi pesto wrap",
     "k": 300,
     "c": 25,
     "p": 22,
     "f": 14,
     "i": [
      "pita bread",
      "halloumi",
      "pesto",
      "lettuce",
      "tomato"
     ]
    },
    {
     "n": "Cottage cheese & honey toast with walnuts",
     "k": 300,
     "c": 29,
     "p": 22,
     "f": 10,
     "i": [
      "toast bread",
      "cottage cheese",
      "honey",
      "walnuts"
     ]
    },
    {
     "n": "Turkey & cheese breakfast wrap",
     "k": 300,
     "c": 24,
     "p": 23,
     "f": 13,
     "i": [
      "pita bread",
      "turkey breast",
      "light cheese",
      "lettuce"
     ]
    },
    {
     "n": "Mini man'oushe (akkawi & za'atar)",
     "k": 300,
     "c": 26,
     "p": 20,
     "f": 14,
     "i": [
      "pita bread",
      "akkawi cheese"
     ]
    },
    {
     "n": "Eggs & avocado sourdough toast",
     "k": 300,
     "c": 24,
     "p": 20,
     "f": 15,
     "i": [
      "sourdough",
      "eggs",
      "avocado"
     ]
    }
   ]
  },
  {
   "id": "coffee",
   "label": "Snack 1 / coffee",
   "guide": "100 kcal · 1 milk exchange",
   "options": [
    {
     "n": "1 cup skimmed milk + coffee",
     "k": 100,
     "c": 12,
     "p": 8,
     "f": 1,
     "i": [
      "milk"
     ]
    },
    {
     "n": "1 cup low-fat Greek yogurt",
     "k": 100,
     "c": 10,
     "p": 14,
     "f": 2,
     "i": [
      "greek yogurt"
     ]
    },
    {
     "n": "1 cup low-fat yogurt (laban)",
     "k": 100,
     "c": 12,
     "p": 8,
     "f": 2,
     "i": [
      "laban"
     ]
    },
    {
     "n": "Cappuccino with skimmed milk",
     "k": 100,
     "c": 11,
     "p": 7,
     "f": 2,
     "i": [
      "milk"
     ]
    },
    {
     "n": "Nescafé 2-in-1 (2 cups)",
     "k": 100,
     "c": 14,
     "p": 2,
     "f": 4,
     "i": [
      "nescafé sachets"
     ]
    },
    {
     "n": "Skip — black coffee or tea",
     "k": 0,
     "c": 0,
     "p": 0,
     "f": 0,
     "i": []
    }
   ]
  },
  {
   "id": "lunch",
   "label": "Lunch",
   "guide": "500 kcal · 2 starch + 3 protein, or 2 mixed dishes + 1 protein",
   "options": [
    {
     "n": "Tawook skewers with pita & grilled veg",
     "k": 500,
     "c": 45,
     "p": 38,
     "f": 16,
     "i": [
      "chicken breast",
      "pita bread",
      "bell peppers",
      "onion",
      "laban"
     ]
    },
    {
     "n": "One-pan chicken fajita bowl",
     "k": 500,
     "c": 43,
     "p": 35,
     "f": 15,
     "i": [
      "chicken breast",
      "jasmine rice",
      "bell peppers",
      "onion"
     ]
    },
    {
     "n": "Chicken fajita wraps",
     "k": 500,
     "c": 44,
     "p": 34,
     "f": 16,
     "i": [
      "chicken breast",
      "pita bread",
      "bell peppers",
      "onion"
     ]
    },
    {
     "n": "Chicken stir-fry with rice",
     "k": 500,
     "c": 48,
     "p": 34,
     "f": 14,
     "i": [
      "chicken breast",
      "jasmine rice",
      "mushrooms",
      "bell peppers",
      "onion"
     ]
    },
    {
     "n": "Beef kafta with rice & grilled veg",
     "k": 500,
     "c": 44,
     "p": 34,
     "f": 18,
     "i": [
      "minced beef",
      "jasmine rice",
      "onion",
      "bell peppers"
     ]
    },
    {
     "n": "Lemon herb baked chicken & potato",
     "k": 500,
     "c": 42,
     "p": 36,
     "f": 17,
     "i": [
      "chicken legs",
      "potato",
      "garlic"
     ]
    },
    {
     "n": "Sweet potato & chicken leg tray",
     "k": 500,
     "c": 45,
     "p": 35,
     "f": 17,
     "i": [
      "chicken legs",
      "sweet potato",
      "onion",
      "garlic"
     ]
    },
    {
     "n": "Shrimp & garlic rice with peppers",
     "k": 500,
     "c": 50,
     "p": 33,
     "f": 16,
     "i": [
      "shrimp",
      "jasmine rice",
      "bell peppers",
      "garlic"
     ]
    },
    {
     "n": "Tuna & baked potato bowl",
     "k": 460,
     "c": 44,
     "p": 33,
     "f": 14,
     "i": [
      "tuna",
      "potato",
      "bell peppers"
     ]
    },
    {
     "n": "Tuna melt on tannour with mushrooms",
     "k": 420,
     "c": 40,
     "p": 30,
     "f": 12,
     "i": [
      "tuna",
      "tannour bread",
      "mushrooms",
      "onion"
     ]
    },
    {
     "n": "Potato with minced meat & yogurt",
     "k": 500,
     "c": 46,
     "p": 28,
     "f": 18,
     "i": [
      "potato",
      "minced beef",
      "onion",
      "laban"
     ]
    },
    {
     "n": "Burger plate with sweet potato wedges",
     "k": 500,
     "c": 42,
     "p": 32,
     "f": 20,
     "i": [
      "hamburger",
      "sweet potato",
      "kale",
      "onion"
     ]
    },
    {
     "n": "Kale & cauliflower chicken tray",
     "k": 450,
     "c": 30,
     "p": 40,
     "f": 16,
     "i": [
      "chicken breast",
      "cauliflower",
      "kale",
      "onion"
     ]
    },
    {
     "n": "Mushroom, kale & egg rice skillet",
     "k": 480,
     "c": 52,
     "p": 24,
     "f": 16,
     "i": [
      "jasmine rice",
      "mushrooms",
      "kale",
      "eggs",
      "onion"
     ]
    },
    {
     "n": "Chicken shawarma power bowl",
     "k": 500,
     "c": 46,
     "p": 36,
     "f": 15,
     "i": [
      "chicken breast",
      "jasmine rice",
      "salad greens",
      "pickles"
     ]
    },
    {
     "n": "Grilled chicken fattoush bowl",
     "k": 500,
     "c": 40,
     "p": 36,
     "f": 16,
     "i": [
      "chicken breast",
      "salad greens",
      "cucumber",
      "tomato",
      "radish",
      "pita bread"
     ]
    },
    {
     "n": "Loubieh w rez",
     "k": 500,
     "c": 52,
     "p": 32,
     "f": 16,
     "i": [
      "green beans",
      "minced beef",
      "jasmine rice",
      "laban"
     ]
    },
    {
     "n": "Fasoulya (white beans) with rice",
     "k": 500,
     "c": 58,
     "p": 26,
     "f": 12,
     "i": [
      "white beans",
      "minced beef",
      "jasmine rice"
     ]
    },
    {
     "n": "Mujadara with salad & yogurt",
     "k": 500,
     "c": 62,
     "p": 22,
     "f": 14,
     "i": [
      "lentils",
      "jasmine rice",
      "onion",
      "laban"
     ]
    },
    {
     "n": "Lentil soup with grilled cheese side",
     "k": 500,
     "c": 50,
     "p": 24,
     "f": 16,
     "i": [
      "lentils",
      "toast bread",
      "light cheese"
     ]
    },
    {
     "n": "Coussa mehchi (3 pcs) with yogurt",
     "k": 500,
     "c": 48,
     "p": 30,
     "f": 17,
     "i": [
      "zucchini",
      "jasmine rice",
      "minced beef",
      "tomato sauce",
      "laban"
     ]
    },
    {
     "n": "Baked kibbeh with yogurt side",
     "k": 500,
     "c": 46,
     "p": 30,
     "f": 18,
     "i": [
      "kibbeh",
      "laban",
      "salad greens"
     ]
    },
    {
     "n": "Grilled fish with rice & roasted veg",
     "k": 500,
     "c": 44,
     "p": 34,
     "f": 15,
     "i": [
      "white fish",
      "jasmine rice",
      "mixed vegetables"
     ]
    },
    {
     "n": "Shrimp pasta with red sauce",
     "k": 500,
     "c": 55,
     "p": 28,
     "f": 12,
     "i": [
      "shrimp",
      "whole wheat pasta",
      "tomato sauce"
     ]
    },
    {
     "n": "Tuna pasta salad",
     "k": 500,
     "c": 50,
     "p": 32,
     "f": 14,
     "i": [
      "tuna",
      "whole wheat pasta",
      "cherry tomato",
      "cucumber",
      "olives"
     ]
    },
    {
     "n": "Quinoa tabbouleh with grilled chicken",
     "k": 500,
     "c": 42,
     "p": 35,
     "f": 15,
     "i": [
      "chicken breast",
      "quinoa",
      "parsley",
      "mint",
      "tomato"
     ]
    },
    {
     "n": "Chicken caesar salad with WW croutons",
     "k": 500,
     "c": 34,
     "p": 38,
     "f": 18,
     "i": [
      "chicken breast",
      "romaine",
      "croutons",
      "parmesan"
     ]
    },
    {
     "n": "Turkey & hummus wrap with side salad",
     "k": 500,
     "c": 46,
     "p": 30,
     "f": 15,
     "i": [
      "pita bread",
      "turkey breast",
      "hommos",
      "salad greens"
     ]
    },
    {
     "n": "Baked falafel & salad bowl with tahini",
     "k": 500,
     "c": 52,
     "p": 22,
     "f": 16,
     "i": [
      "falafel",
      "tahini",
      "pita bread",
      "salad greens"
     ]
    }
   ]
  },
  {
   "id": "snack2",
   "label": "Snack 2",
   "guide": "100–150 kcal · 1 fruit or a snack from the list",
   "options": [
    {
     "n": "Hard-boiled egg & fruit",
     "k": 150,
     "c": 15,
     "p": 9,
     "f": 6,
     "i": [
      "eggs",
      "apples"
     ]
    },
    {
     "n": "Kale chips",
     "k": 100,
     "c": 10,
     "p": 4,
     "f": 5,
     "i": [
      "kale"
     ]
    },
    {
     "n": "Roasted cauliflower bites",
     "k": 90,
     "c": 14,
     "p": 4,
     "f": 3,
     "i": [
      "cauliflower"
     ]
    },
    {
     "n": "Pepper strips & yogurt-garlic dip",
     "k": 110,
     "c": 12,
     "p": 8,
     "f": 3,
     "i": [
      "bell peppers",
      "laban",
      "garlic"
     ]
    },
    {
     "n": "Yogurt & cucumber with mint",
     "k": 110,
     "c": 10,
     "p": 8,
     "f": 3,
     "i": [
      "laban",
      "cucumber",
      "mint"
     ]
    },
    {
     "n": "1 medium apple or banana",
     "k": 100,
     "c": 25,
     "p": 0,
     "f": 0,
     "i": [
      "fruit"
     ]
    },
    {
     "n": "12 almonds",
     "k": 100,
     "c": 4,
     "p": 4,
     "f": 9,
     "i": [
      "almonds"
     ]
    },
    {
     "n": "Labneh & cucumber za'atar bites",
     "k": 110,
     "c": 6,
     "p": 8,
     "f": 6,
     "i": [
      "labneh",
      "cucumber"
     ]
    },
    {
     "n": "Veggie sticks with hommos",
     "k": 130,
     "c": 14,
     "p": 5,
     "f": 6,
     "i": [
      "carrots",
      "cucumber",
      "bell peppers",
      "hommos"
     ]
    },
    {
     "n": "Spiced roasted chickpeas",
     "k": 120,
     "c": 18,
     "p": 6,
     "f": 3,
     "i": [
      "chickpeas"
     ]
    },
    {
     "n": "Termos (lupini beans)",
     "k": 119,
     "c": 10,
     "p": 16,
     "f": 3,
     "i": [
      "termos"
     ]
    },
    {
     "n": "Unshelled edamame",
     "k": 100,
     "c": 10,
     "p": 11,
     "f": 5,
     "i": [
      "edamame"
     ]
    },
    {
     "n": "Popcorn (3 cups)",
     "k": 100,
     "c": 17,
     "p": 2,
     "f": 3,
     "i": [
      "popcorn kernels"
     ]
    },
    {
     "n": "Jazar w hamod (carrot with lemon)",
     "k": 94,
     "c": 24,
     "p": 3,
     "f": 1,
     "i": [
      "carrots"
     ]
    },
    {
     "n": "Rice cake + labneh",
     "k": 140,
     "c": 16,
     "p": 7,
     "f": 5,
     "i": [
      "rice cakes",
      "labneh"
     ]
    },
    {
     "n": "Dark chocolate square & almonds",
     "k": 140,
     "c": 12,
     "p": 3,
     "f": 9,
     "i": [
      "dark chocolate",
      "almonds"
     ]
    },
    {
     "n": "2 fingers mini KitKat",
     "k": 100,
     "c": 12,
     "p": 1,
     "f": 5,
     "i": [
      "kitkat"
     ]
    },
    {
     "n": "Unica dark chocolate",
     "k": 100,
     "c": 12,
     "p": 1,
     "f": 5,
     "i": [
      "unica"
     ]
    },
    {
     "n": "Scoop of sorbet",
     "k": 100,
     "c": 22,
     "p": 0,
     "f": 1,
     "i": [
      "sorbet"
     ]
    }
   ]
  },
  {
   "id": "snack3",
   "label": "Snack 3 / post-workout",
   "guide": "100–150 kcal · 1 milk exchange or protein shake",
   "options": [
    {
     "n": "1 cup low-fat Greek yogurt",
     "k": 100,
     "c": 10,
     "p": 14,
     "f": 2,
     "i": [
      "greek yogurt"
     ]
    },
    {
     "n": "1 cup low-fat yogurt (laban)",
     "k": 100,
     "c": 12,
     "p": 8,
     "f": 2,
     "i": [
      "laban"
     ]
    },
    {
     "n": "2 boiled eggs",
     "k": 140,
     "c": 1,
     "p": 12,
     "f": 10,
     "i": [
      "eggs"
     ]
    },
    {
     "n": "Yogurt & cucumber with mint",
     "k": 110,
     "c": 10,
     "p": 8,
     "f": 3,
     "i": [
      "laban",
      "cucumber",
      "mint"
     ]
    },
    {
     "n": "Protein shake",
     "k": 130,
     "c": 6,
     "p": 22,
     "f": 2,
     "i": [
      "protein powder",
      "milk"
     ]
    },
    {
     "n": "Protein bar (≤200 kcal)",
     "k": 180,
     "c": 12,
     "p": 20,
     "f": 5,
     "i": [
      "protein bars"
     ]
    },
    {
     "n": "Taanayel Greek yogurt drink",
     "k": 110,
     "c": 12,
     "p": 10,
     "f": 2,
     "i": [
      "taanayel yogurt drink"
     ]
    },
    {
     "n": "Skip this one",
     "k": 0,
     "c": 0,
     "p": 0,
     "f": 0,
     "i": []
    }
   ]
  },
  {
   "id": "dinner",
   "label": "Dinner",
   "guide": "500 kcal · 3 starch + 2 protein, or 2 mixed dishes + 1 protein",
   "options": [
    {
     "n": "Tawook skewers with pita & grilled veg",
     "k": 500,
     "c": 45,
     "p": 38,
     "f": 16,
     "i": [
      "chicken breast",
      "pita bread",
      "bell peppers",
      "onion",
      "laban"
     ]
    },
    {
     "n": "One-pan chicken fajita bowl",
     "k": 500,
     "c": 43,
     "p": 35,
     "f": 15,
     "i": [
      "chicken breast",
      "jasmine rice",
      "bell peppers",
      "onion"
     ]
    },
    {
     "n": "Chicken fajita wraps",
     "k": 500,
     "c": 44,
     "p": 34,
     "f": 16,
     "i": [
      "chicken breast",
      "pita bread",
      "bell peppers",
      "onion"
     ]
    },
    {
     "n": "Chicken stir-fry with rice",
     "k": 500,
     "c": 48,
     "p": 34,
     "f": 14,
     "i": [
      "chicken breast",
      "jasmine rice",
      "mushrooms",
      "bell peppers",
      "onion"
     ]
    },
    {
     "n": "Beef kafta with rice & grilled veg",
     "k": 500,
     "c": 44,
     "p": 34,
     "f": 18,
     "i": [
      "minced beef",
      "jasmine rice",
      "onion",
      "bell peppers"
     ]
    },
    {
     "n": "Lemon herb baked chicken & potato",
     "k": 500,
     "c": 42,
     "p": 36,
     "f": 17,
     "i": [
      "chicken legs",
      "potato",
      "garlic"
     ]
    },
    {
     "n": "Sweet potato & chicken leg tray",
     "k": 500,
     "c": 45,
     "p": 35,
     "f": 17,
     "i": [
      "chicken legs",
      "sweet potato",
      "onion",
      "garlic"
     ]
    },
    {
     "n": "Shrimp & garlic rice with peppers",
     "k": 500,
     "c": 50,
     "p": 33,
     "f": 16,
     "i": [
      "shrimp",
      "jasmine rice",
      "bell peppers",
      "garlic"
     ]
    },
    {
     "n": "Tuna & baked potato bowl",
     "k": 460,
     "c": 44,
     "p": 33,
     "f": 14,
     "i": [
      "tuna",
      "potato",
      "bell peppers"
     ]
    },
    {
     "n": "Tuna melt on tannour with mushrooms",
     "k": 420,
     "c": 40,
     "p": 30,
     "f": 12,
     "i": [
      "tuna",
      "tannour bread",
      "mushrooms",
      "onion"
     ]
    },
    {
     "n": "Potato with minced meat & yogurt",
     "k": 500,
     "c": 46,
     "p": 28,
     "f": 18,
     "i": [
      "potato",
      "minced beef",
      "onion",
      "laban"
     ]
    },
    {
     "n": "Burger plate with sweet potato wedges",
     "k": 500,
     "c": 42,
     "p": 32,
     "f": 20,
     "i": [
      "hamburger",
      "sweet potato",
      "kale",
      "onion"
     ]
    },
    {
     "n": "Kale & cauliflower chicken tray",
     "k": 450,
     "c": 30,
     "p": 40,
     "f": 16,
     "i": [
      "chicken breast",
      "cauliflower",
      "kale",
      "onion"
     ]
    },
    {
     "n": "Mushroom, kale & egg rice skillet",
     "k": 480,
     "c": 52,
     "p": 24,
     "f": 16,
     "i": [
      "jasmine rice",
      "mushrooms",
      "kale",
      "eggs",
      "onion"
     ]
    },
    {
     "n": "Chicken shawarma power bowl",
     "k": 500,
     "c": 46,
     "p": 36,
     "f": 15,
     "i": [
      "chicken breast",
      "jasmine rice",
      "salad greens",
      "pickles"
     ]
    },
    {
     "n": "Grilled chicken fattoush bowl",
     "k": 500,
     "c": 40,
     "p": 36,
     "f": 16,
     "i": [
      "chicken breast",
      "salad greens",
      "cucumber",
      "tomato",
      "radish",
      "pita bread"
     ]
    },
    {
     "n": "Loubieh w rez",
     "k": 500,
     "c": 52,
     "p": 32,
     "f": 16,
     "i": [
      "green beans",
      "minced beef",
      "jasmine rice",
      "laban"
     ]
    },
    {
     "n": "Fasoulya (white beans) with rice",
     "k": 500,
     "c": 58,
     "p": 26,
     "f": 12,
     "i": [
      "white beans",
      "minced beef",
      "jasmine rice"
     ]
    },
    {
     "n": "Mujadara with salad & yogurt",
     "k": 500,
     "c": 62,
     "p": 22,
     "f": 14,
     "i": [
      "lentils",
      "jasmine rice",
      "onion",
      "laban"
     ]
    },
    {
     "n": "Lentil soup with grilled cheese side",
     "k": 500,
     "c": 50,
     "p": 24,
     "f": 16,
     "i": [
      "lentils",
      "toast bread",
      "light cheese"
     ]
    },
    {
     "n": "Coussa mehchi (3 pcs) with yogurt",
     "k": 500,
     "c": 48,
     "p": 30,
     "f": 17,
     "i": [
      "zucchini",
      "jasmine rice",
      "minced beef",
      "tomato sauce",
      "laban"
     ]
    },
    {
     "n": "Baked kibbeh with yogurt side",
     "k": 500,
     "c": 46,
     "p": 30,
     "f": 18,
     "i": [
      "kibbeh",
      "laban",
      "salad greens"
     ]
    },
    {
     "n": "Grilled fish with rice & roasted veg",
     "k": 500,
     "c": 44,
     "p": 34,
     "f": 15,
     "i": [
      "white fish",
      "jasmine rice",
      "mixed vegetables"
     ]
    },
    {
     "n": "Shrimp pasta with red sauce",
     "k": 500,
     "c": 55,
     "p": 28,
     "f": 12,
     "i": [
      "shrimp",
      "whole wheat pasta",
      "tomato sauce"
     ]
    },
    {
     "n": "Tuna pasta salad",
     "k": 500,
     "c": 50,
     "p": 32,
     "f": 14,
     "i": [
      "tuna",
      "whole wheat pasta",
      "cherry tomato",
      "cucumber",
      "olives"
     ]
    },
    {
     "n": "Quinoa tabbouleh with grilled chicken",
     "k": 500,
     "c": 42,
     "p": 35,
     "f": 15,
     "i": [
      "chicken breast",
      "quinoa",
      "parsley",
      "mint",
      "tomato"
     ]
    },
    {
     "n": "Chicken caesar salad with WW croutons",
     "k": 500,
     "c": 34,
     "p": 38,
     "f": 18,
     "i": [
      "chicken breast",
      "romaine",
      "croutons",
      "parmesan"
     ]
    },
    {
     "n": "Turkey & hummus wrap with side salad",
     "k": 500,
     "c": 46,
     "p": 30,
     "f": 15,
     "i": [
      "pita bread",
      "turkey breast",
      "hommos",
      "salad greens"
     ]
    },
    {
     "n": "Baked falafel & salad bowl with tahini",
     "k": 500,
     "c": 52,
     "p": 22,
     "f": 16,
     "i": [
      "falafel",
      "tahini",
      "pita bread",
      "salad greens"
     ]
    },
    {
     "n": "Light dinner — yogurt, cucumber & herbs",
     "k": 120,
     "c": 12,
     "p": 9,
     "f": 3,
     "i": [
      "laban",
      "cucumber"
     ],
     "light": 1
    },
    {
     "n": "Light dinner — tannour + 50g cheese",
     "k": 200,
     "c": 15,
     "p": 12,
     "f": 10,
     "i": [
      "tannour bread",
      "feta"
     ],
     "light": 1
    },
    {
     "n": "Light dinner — rice cakes & tuna",
     "k": 250,
     "c": 33,
     "p": 28,
     "f": 3,
     "i": [
      "rice cakes",
      "tuna"
     ],
     "light": 1
    }
   ]
  }
 ]
};
