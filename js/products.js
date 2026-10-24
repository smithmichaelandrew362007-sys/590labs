/**
 * 590 LABS® — Product Catalog Data
 * Brand: 590 LABS (Independent Streetwear)
 * Currency: INR (₹) with USD/EUR conversion support
 */

const PRODUCTS = [
  {
    id: "core-graphic-tee",
    title: "CORE GRAPHIC TEE // 001",
    subtitle: "Heavyweight Boxy Cut · Unisex",
    category: "tops",
    type: "T-Shirts",
    price: 1299,
    comparePrice: 1699,
    badges: ["DROP 01", "BESTSELLER"],
    gsm: "280 GSM",
    fabric: "100% Combed Heavyweight Jersey Cotton",
    fit: "Boxy Oversized Fit with dropped shoulders",
    colors: [
      { name: "Obsidian Black", hex: "#0b0b0b", code: "obsidian" },
      { name: "Concrete Stone", hex: "#a8a59e", code: "stone" },
      { name: "Washed Charcoal", hex: "#2b2b2b", code: "charcoal" }
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    images: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=900&auto=format&fit=crop&q=80"
    ],
    description: "The definitive 590 LABS silhouette. Crafted from dense 280 GSM luxury combed cotton with custom archival typography silkscreened across the back and subtle coordinate branding on the left chest. Reinforced 1.25-inch ribbed collar that retains its shape wear after wear.",
    specs: [
      "280 GSM luxury combed cotton",
      "Custom double-silkscreen archival graphic",
      "Pre-shrunk fabric for consistent post-wash fit",
      "Reinforced coverstitch along neck and hem",
      "Handcrafted in Tirupur, India"
    ],
    care: "Machine wash cold inside-out. Do not iron directly on print. Hang dry in shade.",
    stock: { XS: 3, S: 8, M: 12, L: 5, XL: 4, XXL: 2 },
    rating: 4.9,
    reviewsCount: 48,
    isNewDrop: true,
    isBestseller: true
  },
  {
    id: "modular-utility-cargo",
    title: "MODULAR UTILITY CARGO PANT",
    subtitle: "Tactical Ripstop · 8 Pockets",
    category: "bottoms",
    type: "Cargos",
    price: 2499,
    comparePrice: 3299,
    badges: ["LIMITED DROP"],
    gsm: "310 GSM",
    fabric: "Heavyweight Cotton-Nylon Tactical Ripstop",
    fit: "Relaxed Tapered with Bungee Ankle Cinch",
    colors: [
      { name: "Obsidian Black", hex: "#0b0b0b", code: "obsidian" },
      { name: "Olive Drab", hex: "#3e4235", code: "olive" },
      { name: "Cement Grey", hex: "#5a5a58", code: "cement" }
    ],
    sizes: ["28", "30", "32", "34", "36"],
    images: [
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=900&auto=format&fit=crop&q=80"
    ],
    description: "Built for urban terrain. Engineered from high-density 310 GSM tear-resistant ripstop with 8 strategically placed 3D bellows pockets. Features custom matte black YKK hardware, knee articulation darts, and dual bungee cord adjusters at the leg openings to toggle between a straight stacking drape or tapered sneaker-friendly cuff.",
    specs: [
      "310 GSM micro-ripstop weave",
      "8 functional storage compartments",
      "Matte black anodized D-ring carabiner attachment",
      "Ankle pull-toggles for adjustable silhouette",
      "Triple-needle reinforced seat and inseam"
    ],
    care: "Machine wash cold with similar colors. Close all zips and velcros prior to washing. Do not tumble dry.",
    stock: { 28: 4, 30: 9, 32: 3, 34: 6, 36: 1 },
    rating: 4.8,
    reviewsCount: 34,
    isNewDrop: true,
    isBestseller: true
  },
  {
    id: "cyberpunk-acid-hoodie",
    title: "HEAVYWEIGHT ACID WASH HOODIE",
    subtitle: "450 GSM French Terry · Mineral Wash",
    category: "tops",
    type: "Hoodies",
    price: 2999,
    comparePrice: 3899,
    badges: ["NEW DROP", "HEAVYWEIGHT"],
    gsm: "450 GSM",
    fabric: "450 GSM 100% Cotton Loopback French Terry",
    fit: "Oversized Slouch Fit · Drop Shoulder",
    colors: [
      { name: "Mineral Obsidian", hex: "#1f2022", code: "mineral" },
      { name: "Acid Dust Grey", hex: "#44464a", code: "dust" }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    images: [
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&auto=format&fit=crop&q=80"
    ],
    description: "An armored staple for the colder months. Hand-mineral washed to produce a subtle, weathered patina unique to each garment. Features a generous double-layered hood without drawstrings for an uncompromising minimal drape, kangaroo pocket with hidden internal phone pouch, and heavy 2x2 ribbing.",
    specs: [
      "Substantial 450 GSM loopback cotton fleece",
      "Individual artisanal mineral acid wash",
      "Seamless clean hood architecture (no drawstrings)",
      "Hidden secondary zipper stash pocket inside pouch",
      "Pre-shrunk heavyweight feel"
    ],
    care: "Cold gentle machine wash. Lay flat to dry to preserve silhouette.",
    stock: { S: 5, M: 7, L: 2, XL: 4, XXL: 3 },
    rating: 5.0,
    reviewsCount: 29,
    isNewDrop: true,
    isBestseller: false
  },
  {
    id: "technical-parachute-pant",
    title: "TECHNICAL PARACHUTE PANT",
    subtitle: "Matte Technical Weave · Adjustable Bungee",
    category: "bottoms",
    type: "Pants",
    price: 2199,
    comparePrice: 2799,
    badges: ["VIRAL FIT"],
    gsm: "210 GSM",
    fabric: "Matte Crisp Performance Weave",
    fit: "Voluminous Balloon Fit · Wide Leg",
    colors: [
      { name: "Obsidian Black", hex: "#0b0b0b", code: "obsidian" },
      { name: "Off-White Chalk", hex: "#e5e3dd", code: "chalk" }
    ],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=900&auto=format&fit=crop&q=80"
    ],
    description: "The quintessential modern streetwear silhouette. Features dramatic pleated knees for kinetic movement, wide fluid drape, elasticized waistband with high-tensile shock cords, and deep slash pockets with security snap closures.",
    specs: [
      "Weather-resistant matte finish fabric",
      "Double knee articulation pleats",
      "Elastic waistband fitting 28 to 36 inch waists effortlessly",
      "Adjustable bungee hem for customized ankle stacking"
    ],
    care: "Machine wash cold. Low spin. Do not bleach.",
    stock: { S: 4, M: 11, L: 6, XL: 3 },
    rating: 4.8,
    reviewsCount: 19,
    isNewDrop: false,
    isBestseller: true
  },
  {
    id: "raw-edge-box-tee",
    title: "RAW EDGE OVERSIZED TEE",
    subtitle: "300 GSM Compact Cotton · Distress Detailing",
    category: "tops",
    type: "T-Shirts",
    price: 1499,
    comparePrice: 1899,
    badges: ["LOW STOCK - 4 LEFT"],
    gsm: "300 GSM",
    fabric: "300 GSM Ultra-Compact Ring-Spun Cotton",
    fit: "Box Cut · Drop Shoulder · Raw Hem",
    colors: [
      { name: "Concrete Stone", hex: "#9b978f", code: "stone" },
      { name: "Obsidian Black", hex: "#0b0b0b", code: "obsidian" },
      { name: "Acid Lime Accent", hex: "#b8ff3b", code: "acid" }
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    images: [
      "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80"
    ],
    description: "Raw edge cut hem anchored with high-density lockstitching so it rolls organically without unraveling. Features minimal industrial lab coordinates stamped at the nape of the neck and tonal front chest embroidery.",
    specs: [
      "300 GSM ultra-compact heavyweight knit",
      "Laser-clean raw edge hemline",
      "Drop-shoulder boxy pattern engineered in Tokyo",
      "Enzyme washed for soft handfeel despite heavyweight body"
    ],
    care: "Hand wash or gentle cycle cold. Reshape while damp.",
    stock: { XS: 1, S: 3, M: 2, L: 1, XL: 2, XXL: 1 },
    rating: 4.9,
    reviewsCount: 22,
    isNewDrop: false,
    isBestseller: true
  },
  {
    id: "stealth-flight-bomber",
    title: "STEALTH FLIGHT BOMBER JACKET",
    subtitle: "Quilted Flight Satin · Water-Resistant",
    category: "tops",
    type: "Outerwear",
    price: 3899,
    comparePrice: 4999,
    badges: ["LIMITED DROP", "OUTERWEAR"],
    gsm: "Heavyweight",
    fabric: "Military-Spec Technical Flight Satin with Poly Fill",
    fit: "Cropped Boxy Silhouette",
    colors: [
      { name: "Obsidian Black", hex: "#0b0b0b", code: "obsidian" },
      { name: "Sage Olive", hex: "#41483d", code: "olive" }
    ],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&auto=format&fit=crop&q=80"
    ],
    description: "An homage to timeless military aviation wear, reimagined through 590 LABS brutalist lens. Features high-luster heavy satin shell, diamond-quilted orange-accented lining, zippered utility sleeve sleeve compartment, and double storm-flap closure.",
    specs: [
      "Water-repellent 200D military satin shell",
      "120g thermal insulation quilting",
      "Two-way chunky front zipper with extended pull cord",
      "Hidden interior chest pocket with magnet snap"
    ],
    care: "Dry clean only or wipe clean with damp cloth.",
    stock: { S: 3, M: 5, L: 4, XL: 2 },
    rating: 4.9,
    reviewsCount: 15,
    isNewDrop: true,
    isBestseller: false
  },
  {
    id: "reconstructed-carpenter-denim",
    title: "RECONSTRUCTED CARPENTER DENIM",
    subtitle: "14oz Raw Rigid Denim · Distressed Wash",
    category: "bottoms",
    type: "Denim",
    price: 2799,
    comparePrice: 3499,
    badges: ["EXCLUSIVE"],
    gsm: "14 oz Denim",
    fabric: "100% Rigid Ring-Spun Cotton Denim",
    fit: "Straight Leg Loose Cut · Stacked Hem",
    colors: [
      { name: "Washed Charcoal", hex: "#262628", code: "charcoal" },
      { name: "Vintage Bleach Grey", hex: "#636468", code: "grey" }
    ],
    sizes: ["30", "32", "34", "36"],
    images: [
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=900&auto=format&fit=crop&q=80"
    ],
    description: "Constructed from heavy 14oz ring-spun denim that softens with wear while maintaining its structural stack over bulky sneakers. Detailed with reinforced front knee panels, authentic tool loops, and precision abrasive hand-distressing.",
    specs: [
      "14oz heavyweight non-stretch cotton denim",
      "Double-panel utility knees with rivet reinforcements",
      "Traditional carpenter hammer loop on left thigh",
      "Custom branded matte shank buttons and rivets"
    ],
    care: "Wash inside-out in cold water. Hang to air dry to prolong denim integrity.",
    stock: { 30: 3, 32: 6, 34: 4, 36: 2 },
    rating: 4.7,
    reviewsCount: 18,
    isNewDrop: false,
    isBestseller: true
  },
  {
    id: "shadow-plaid-overshirt",
    title: "SHADOW PLAID OVERSIZED OVERSHIRT",
    subtitle: "Brushed Flannel · Matte Metal Snaps",
    category: "tops",
    type: "Shirts",
    price: 2299,
    comparePrice: 2999,
    badges: ["NEW DROP"],
    gsm: "260 GSM",
    fabric: "100% Brushed Double-Face Cotton Flannel",
    fit: "Oversized Boxy Fit",
    colors: [
      { name: "Obsidian / Acid Plaid", hex: "#1a1c18", code: "plaid-acid" },
      { name: "Charcoal / Off-White", hex: "#353535", code: "plaid-charcoal" }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    images: [
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80"
    ],
    description: "A streetwear staple built for layering. Heavy 260 GSM custom yarn-dyed brushed cotton flannel with subtle acid green accent lines running through deep shadow charcoal checks. Features twin bellows chest pockets and durable black oxidized snap buttons.",
    specs: [
      "260 GSM brushed double-face cotton",
      "Drop-shoulder boxy silhouette with flat hem",
      "Two flap pockets with snap closures",
      "Industrial back yoke detailing"
    ],
    care: "Machine wash cold. Warm iron if desired.",
    stock: { S: 4, M: 7, L: 8, XL: 3, XXL: 2 },
    rating: 4.8,
    reviewsCount: 14,
    isNewDrop: true,
    isBestseller: false
  },
  {
    id: "tactical-modular-sling-bag",
    title: "TACTICAL MODULAR SLING BAG",
    subtitle: "Cordura® 1000D · Fidlock Magnetic Clasp",
    category: "accessories",
    type: "Bags",
    price: 1199,
    comparePrice: 1599,
    badges: ["BESTSELLER"],
    gsm: "Technical",
    fabric: "Cordura 1000D Ballistic Nylon",
    fit: "One Size · Crossbody / Chest Bag",
    colors: [
      { name: "Obsidian Black", hex: "#0b0b0b", code: "obsidian" },
      { name: "Acid Lime Trim", hex: "#b8ff3b", code: "lime-trim" }
    ],
    sizes: ["ONE SIZE"],
    images: [
      "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=900&auto=format&fit=crop&q=80"
    ],
    description: "Engineered for hands-free daily carry. Crafted from bombproof 1000D Cordura nylon with polyurethane waterproof backing. Equipped with instant-release magnetic buckle, taped waterproof reverse zippers, padded breathable spacer mesh back panel, and modular webbing loops.",
    specs: [
      "Authentic Cordura 1000D ballistic grade nylon",
      "Fidlock-style magnetic quick-snap buckle",
      "YKK AquaGuard weather-resistant zippers",
      "Internal padded compartment fits up to 11-inch tablet"
    ],
    care: "Wipe with damp cloth and mild soap. Air dry.",
    stock: { "ONE SIZE": 14 },
    rating: 4.9,
    reviewsCount: 31,
    isNewDrop: false,
    isBestseller: true
  },
  {
    id: "french-terry-box-shorts",
    title: "FRENCH TERRY BOX SHORTS",
    subtitle: "360 GSM Loopback · Raw Cut Hem",
    category: "bottoms",
    type: "Shorts",
    price: 1599,
    comparePrice: 1999,
    badges: ["NEW DROP"],
    gsm: "360 GSM",
    fabric: "360 GSM Heavyweight Loopback French Terry",
    fit: "Above Knee Relaxed Fit",
    colors: [
      { name: "Obsidian Black", hex: "#0b0b0b", code: "obsidian" },
      { name: "Concrete Grey", hex: "#7a7976", code: "concrete" }
    ],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=900&auto=format&fit=crop&q=80"
    ],
    description: "Summer comfort without sacrificing streetwear weight. Deep 360 GSM loopback cotton cut at an exact 6-inch inseam to sit above the knee. Extended off-white flat tubular drawstrings, hidden zip phone pocket, and organic rolled raw cut hem.",
    specs: [
      "360 GSM dense loopback cotton",
      "6-inch inseam above-knee cut",
      "Deep front welt pockets with hidden zipper compartment",
      "Heavy ribbed waistband with thick drawcord"
    ],
    care: "Machine wash cold. Do not tumble dry.",
    stock: { S: 5, M: 8, L: 6, XL: 4 },
    rating: 4.8,
    reviewsCount: 17,
    isNewDrop: true,
    isBestseller: false
  },
  {
    id: "subversive-unstructured-cap",
    title: "SUBVERSIVE UNSTRUCTURED CAP",
    subtitle: "Heavy Washed Chino Twill · Metal Slider",
    category: "accessories",
    type: "Headwear",
    price: 899,
    comparePrice: 1199,
    badges: ["ESSENTIAL"],
    gsm: "Twill",
    fabric: "100% Cotton Washed Chino Twill",
    fit: "Low Profile · Adjustable Strap",
    colors: [
      { name: "Washed Obsidian", hex: "#1a1a1a", code: "obsidian" },
      { name: "Stone Dust", hex: "#99968f", code: "stone" }
    ],
    sizes: ["ONE SIZE"],
    images: [
      "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=900&auto=format&fit=crop&q=80"
    ],
    description: "Low-profile 6-panel silhouette featuring distressed garment wash for an authentic lived-in feel. Detailed with tonal matte black 3D embroidery of the 590 LABS insignia and an antique brass adjustable clasp at back.",
    specs: [
      "Unstructured soft crown with curved pre-bent brim",
      "Enzyme-washed cotton for vintage fade",
      "Tonal embroidered eyelets for ventilation",
      "Custom embossed metal slider buckle"
    ],
    care: "Spot clean with damp cloth.",
    stock: { "ONE SIZE": 19 },
    rating: 4.9,
    reviewsCount: 26,
    isNewDrop: false,
    isBestseller: true
  },
  {
    id: "lab-identifier-beanie",
    title: "LAB IDENTIFIER RIBBED BEANIE",
    subtitle: "Heavy Gauge Knit · Rubberized Patch",
    category: "accessories",
    type: "Headwear",
    price: 699,
    comparePrice: 999,
    badges: ["ACCESSORY"],
    gsm: "Heavy Knit",
    fabric: "Ultra-Soft Anti-Pilling Acrylic Rib",
    fit: "Shallow Fisherman Fit",
    colors: [
      { name: "Obsidian Black", hex: "#0b0b0b", code: "obsidian" },
      { name: "Acid Lime", hex: "#b8ff3b", code: "acid" },
      { name: "Concrete Grey", hex: "#5a5957", code: "grey" }
    ],
    sizes: ["ONE SIZE"],
    images: [
      "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900&auto=format&fit=crop&q=80"
    ],
    description: "Classic fisherman shallow cuff beanie knit in a dense 1x1 rib that never loses elasticity. Finished with a high-definition matte silicone 590 LABS barcode logo patch heat-pressed on the cuff.",
    specs: [
      "Heavy gauge tight rib structure",
      "Anti-pilling thermal yarn",
      "Tactile matte silicone badge",
      "Can be worn rolled shallow or slouchy"
    ],
    care: "Hand wash in cool water. Lay flat to dry.",
    stock: { "ONE SIZE": 25 },
    rating: 4.8,
    reviewsCount: 16,
    isNewDrop: false,
    isBestseller: false
  }
];

// Helper functions for products
function getProductById(id) {
  return PRODUCTS.find(p => p.id === id);
}

function getProductsByCategory(category) {
  if (!category || category === "all") return PRODUCTS;
  return PRODUCTS.filter(p => p.category === category);
}

function getFeaturedDrops() {
  return PRODUCTS.filter(p => p.isNewDrop || p.isBestseller);
}
