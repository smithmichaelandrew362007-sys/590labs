const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Format a database product row into clean API response format
 */
function formatProduct(row, variants = []) {
  let images = [];
  let badges = [];
  let specs = [];
  let colors = [];

  try { images = JSON.parse(row.images || '[]'); } catch (e) {}
  try { badges = JSON.parse(row.badges || '[]'); } catch (e) {}
  try { specs = JSON.parse(row.specs || '[]'); } catch (e) {}
  try { colors = JSON.parse(row.colors || '[]'); } catch (e) {}

  // Aggregate stock by size
  const stockBySize = {};
  const availableSizes = new Set();
  let totalStock = 0;

  for (const v of variants) {
    stockBySize[v.size] = (stockBySize[v.size] || 0) + v.stock_quantity;
    totalStock += v.stock_quantity;
    if (v.stock_quantity > 0) {
      availableSizes.add(v.size);
    }
  }

  // If variants weren't explicitly provided with call, query sizes from distinct sizes
  const sizesList = Object.keys(stockBySize).length > 0
    ? Object.keys(stockBySize)
    : ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    type: row.type,
    price: row.price,
    comparePrice: row.compare_price,
    gsm: row.gsm,
    fabric: row.fabric,
    fit: row.fit,
    description: row.description,
    care: row.care,
    images,
    badges,
    specs,
    colors,
    sizes: sizesList,
    availableSizes: Array.from(availableSizes),
    stock: stockBySize,
    totalStock,
    isNewDrop: Boolean(row.is_new_drop),
    isBestseller: Boolean(row.is_bestseller),
    status: row.status,
    rating: row.avg_rating ? Math.round(row.avg_rating * 10) / 10 : 4.9,
    reviewsCount: row.reviews_count || 0
  };
}

/**
 * GET /api/products
 * List products with search, filtering, and sorting
 */
router.get('/', (req, res) => {
  try {
    const { category, type, search, sort, size, minPrice, maxPrice, inStockOnly, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT p.*,
        COALESCE(AVG(r.rating), 4.9) as avg_rating,
        COUNT(DISTINCT r.id) as reviews_count
      FROM products p
      LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = 1
      WHERE p.status = 'published'
    `;
    const params = [];

    if (category && category !== 'all') {
      query += ` AND LOWER(p.category) = LOWER(?)`;
      params.push(category);
    }

    if (type && type !== 'all') {
      query += ` AND LOWER(p.type) = LOWER(?)`;
      params.push(type);
    }

    if (minPrice) {
      query += ` AND p.price >= ?`;
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      query += ` AND p.price <= ?`;
      params.push(Number(maxPrice));
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(p.title) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.category) LIKE ?)`;
      params.push(term, term, term);
    }

    query += ` GROUP BY p.id`;

    // Sorting
    switch (sort) {
      case 'price-asc':
        query += ` ORDER BY p.price ASC`;
        break;
      case 'price-desc':
        query += ` ORDER BY p.price DESC`;
        break;
      case 'newest':
        query += ` ORDER BY p.is_new_drop DESC, p.created_at DESC`;
        break;
      case 'rating':
        query += ` ORDER BY avg_rating DESC`;
        break;
      default:
        query += ` ORDER BY p.is_bestseller DESC, p.created_at DESC`;
    }

    const rows = db.prepare(query).all(...params);

    // Fetch variants for all matching products
    const variantsStmt = db.prepare(`
      SELECT * FROM product_variants WHERE product_id = ?
    `);

    let products = rows.map(row => {
      const variants = variantsStmt.all(row.id);
      return formatProduct(row, variants);
    });

    // In-memory filter for size or inStockOnly if requested
    if (size) {
      products = products.filter(p => p.availableSizes.includes(size.toUpperCase()));
    }

    if (inStockOnly === 'true' || inStockOnly === '1') {
      products = products.filter(p => p.totalStock > 0);
    }

    res.json({
      success: true,
      total: products.length,
      products
    });
  } catch (err) {
    console.error('Products list error:', err);
    res.status(500).json({ success: false, error: 'Could not load products catalogue.' });
  }
});

/**
 * GET /api/products/meta/categories
 */
router.get('/meta/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM products
      WHERE status = 'published'
      GROUP BY category
    `).all();

    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load categories.' });
  }
});

/**
 * GET /api/products/:id
 * Get single product with full variant details, real inventory, and reviews
 */
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT p.*,
        COALESCE(AVG(r.rating), 4.9) as avg_rating,
        COUNT(DISTINCT r.id) as reviews_count
      FROM products p
      LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = 1
      WHERE p.id = ?
      GROUP BY p.id
    `).get(req.params.id);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Product not found.' });
    }

    const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(row.id);
    const reviews = db.prepare(`
      SELECT id, author_name, rating, title, comment, verified_purchase, created_at
      FROM reviews
      WHERE product_id = ? AND is_approved = 1
      ORDER BY created_at DESC
    `).all(row.id);

    const product = formatProduct(row, variants);

    // Include detailed variant list with specific SKUs
    product.variants = variants;
    product.reviews = reviews;

    // Get 3 related products from same category
    const relatedRows = db.prepare(`
      SELECT p.*, COALESCE(AVG(r.rating), 4.9) as avg_rating, COUNT(DISTINCT r.id) as reviews_count
      FROM products p
      LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = 1
      WHERE p.category = ? AND p.id != ? AND p.status = 'published'
      GROUP BY p.id
      LIMIT 3
    `).all(row.category, row.id);

    product.related = relatedRows.map(r => {
      const vars = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(r.id);
      return formatProduct(r, vars);
    });

    res.json({ success: true, product });
  } catch (err) {
    console.error('Product details error:', err);
    res.status(500).json({ success: false, error: 'Could not load product details.' });
  }
});

module.exports = router;
