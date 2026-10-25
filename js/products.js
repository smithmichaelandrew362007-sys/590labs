/**
 * 590 LABS® — Product Catalog Engine
 * Stores real active database products populated dynamically from /api/products.
 * Zero demo, placeholder, or hardcoded products.
 */

let PRODUCTS = [];

// Helper functions for products
function getProductById(id) {
  const list = window.PRODUCTS || PRODUCTS;
  return list.find(p => p.id === id);
}

function getProductsByCategory(category) {
  const list = window.PRODUCTS || PRODUCTS;
  if (!category || category === "all") return list;
  return list.filter(p => p.category === category);
}

function getFeaturedDrops() {
  const list = window.PRODUCTS || PRODUCTS;
  return list.filter(p => p.isNewDrop || p.isBestseller);
}

// Global reference & dynamic setter for live database synchronization
window.PRODUCTS = PRODUCTS;
window.setProducts = function(newProducts) {
  if (Array.isArray(newProducts)) {
    PRODUCTS = newProducts;
    window.PRODUCTS = newProducts;
  }
};
