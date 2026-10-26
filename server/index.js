require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const db = require('./db');
const compression = require('./middleware/compression');
const { authenticateToken } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const couponsRoutes = require('./routes/coupons');
const ordersRoutes = require('./routes/orders');
const reviewsRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Production Reverse Proxy Support (enables secure cookies and HTTPS detection behind Cloudflare, Nginx, Render)
app.enable('trust proxy');

// High-Performance Native HTTP Compression (Brotli & Gzip)
app.use(compression);

// Security & Parsing Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global authentication extractor (attaches req.user if token present)
app.use(authenticateToken);

// Safe Caching Policy: NEVER cache private API endpoints (cart, user, orders, auth)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    brand: '590 LABS®',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/admin', adminRoutes);

const staticDir = path.resolve(__dirname, '..');

// Dedicated Admin Interface Routes (handles /admin, /admin/login, /admin/products, /admin/orders, etc.)
// Placed before static files to guarantee clean execution without static caching conflicts
app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && (req.path === '/admin' || req.path.startsWith('/admin/'))) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(path.join(staticDir, 'admin.html'));
  }
  next();
});

// Serverless temporary uploads fallback (allows serving newly uploaded images in ephemeral environments)
app.use('/assets/uploads', (req, res, next) => {
  const tmpFilePath = path.join('/tmp', 'uploads', req.path);
  if (fs.existsSync(tmpFilePath)) {
    return res.sendFile(tmpFilePath);
  }
  next();
});

// Serve static frontend files with intelligent asset caching
app.use(express.static(staticDir, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
      // HTML documents and scripts should revalidate immediately
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (/\.(css|svg|png|jpg|jpeg|webp|woff2?|ico)$/i.test(filePath)) {
      // Static design assets, fonts, stylesheets and icons can be safely cached
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    }
  }
}));

// Fallback to index.html for Single-Page Application client routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found.' });
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.sendFile(path.join(staticDir, 'index.html'));
  }
  next();
});


// Centralized safe error handler
app.use(errorHandler);

// Start server if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    const liveUrl = process.env.APP_URL 
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`);
    console.log(`=======================================================`);
    console.log(`  590 LABS® — Independent Unisex Streetwear Storefront`);
    console.log(`  Server running live at: ${liveUrl}`);
    console.log(`  API Ready at:           ${liveUrl}/api`);
    console.log(`=======================================================`);
  });
}

module.exports = app;

