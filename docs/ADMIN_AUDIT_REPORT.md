# 590 LABS — COMPREHENSIVE ARCHITECTURAL AUDIT REPORT
**Admin Dashboard & Store Management System**
**Date:** October 25, 2026  
**Auditor:** Antigravity Senior Full-Stack & Security Engineering

---

## 1. EXECUTIVE SUMMARY

The existing **590 Labs** application is an independent streetwear e-commerce platform built on a lean, high-performance technology stack:
- **Backend:** Node.js v24 + Express 5.3.0 + native `node:sqlite` (`DatabaseSync`) in Write-Ahead Logging (WAL) mode.
- **Frontend:** Semantic HTML5, CSS3 with luxury minimalist streetwear design tokens (`#FAF9F6`, `#111111`, `#8CE005`), and modular Vanilla JavaScript (`js/api.js`, `js/app.js`, `js/cart.js`, `js/products.js`, `js/intro.js`).
- **Data Persistence:** Local SQLite database (`database.sqlite`) with foreign key constraints, Brotli/Gzip HTTP compression, and JWT-based session security.

The existing system provides a solid foundation with working customer authentication, catalog browsing, shopping cart, atomic checkout with inventory decrement, Razorpay/COD payment handling, and responsive layouts. However, administrative management is currently limited to basic embedded endpoints and an incomplete tabbed view in the customer SPA.

This audit specifies the architecture required to deliver a **production-grade, role-based, multi-admin management dashboard** at `/admin` and `/admin/login`, without disrupting existing customer flows or deleting historical transaction records.

---

## 2. AUDIT FINDINGS

### 2.1 What Already Exists
1. **Database Schema (`server/db.js`):**
   - `users`: Stores customer and superadmin credentials (`id`, `name`, `email`, `password_hash`, `role`, `google_id`, `avatar`, `phone`).
   - `products`: Catalog items with pricing, fabrics, specs, and status (`status = 'published'`).
   - `product_variants`: Size and color SKU inventory tracking (`stock_quantity`, `sku`).
   - `orders` & `order_items`: Full transactional records with immutable snapshot fields (`product_title`, `size`, `color`, `price`, `sku`).
   - `cart_items` & `wishlist_items`: Persistent shopping cart and wishlist records.
   - `coupons`: Promotional discount rules (`percent`, `fixed`, `min_order_value`, `max_discount`, `usage_limit`).
   - `reviews`: Customer reviews with moderation flags.
   - `addresses`: Multi-address customer delivery management.
2. **Backend Services & Routes (`server/routes/`):**
   - `auth.js`: Customer registration, password login, Google Sign-in, forgot password token issuance, and password reset.
   - `products.js`: Public catalog API with category, price, size, search filtering, and variant aggregation. Note: strictly queries `WHERE status = 'published'`.
   - `orders.js`: Atomic checkout transactions with inventory verification and restoration on cancellation.
   - `admin.js`: Initial administrative endpoints (`/stats`, `/orders`, `/orders/:id/status`, `/products`, `/products/:id/stock`, `/customers`, `/coupons`, `/reviews`).
3. **Public Storefront Features:**
   - Cinematic entry experience (`intro.html`, `js/intro.js`).
   - Full responsive storefront (`index.html`, `css/main.css`, `js/app.js`).
   - Existing automated test suite (22 passing unit/integration tests).

---

### 2.2 What Can Be Reused
- **Database Engine (`node:sqlite DatabaseSync`):** Fast, zero-dependency, transactional, and natively supported in Node 24. It handles concurrent reads and atomic writes efficiently without requiring external database servers or cloud dependencies like Supabase.
- **JWT & Password Security (`bcryptjs` & `jsonwebtoken`):** Solid password hashing (cost factor 10) and signed JWT tokens with 7-day expiration.
- **Atomic Order Processing (`server/routes/orders.js`):** Transactions and stock reservation logic are already resilient against overselling.
- **Design Tokens & Typography:** The typography (Cinzel, Syne, Space Grotesk, JetBrains Mono) and color palette (`--bg-primary`, `--accent-lime`, `--border-medium`) will be carried into the admin console for brand consistency.

---

### 2.3 What Is Missing
1. **Dedicated Admin Routing:**
   - No standalone `/admin` dashboard or `/admin/login` page; currently an embedded `#admin` view exists inside `index.html`.
2. **Multi-Role Authorization:**
   - Only a flat binary role (`customer` vs `admin`) exists. The system needs fine-grained roles (`owner`, `admin`, `staff`) with distinct permission boundaries.
3. **Controlled Initial Owner Setup:**
   - Seed script currently creates `admin@590labs.com` with a default password. There is no controlled, secure one-time owner initialization workflow for production deployments.
4. **Administrator Management:**
   - No UI or API for an owner to invite, authorize, or revoke secondary administrator accounts.
5. **Activity Audit Logging (`activity_logs`):**
   - No audit trail table exists to record product updates, price edits, order status modifications, or role changes.
6. **Category Management (`categories`):**
   - Categories are currently free-text fields in `products` rather than managed entities with slugs, descriptions, and banner images.
7. **Product Image Upload Handler:**
   - Only URL strings are accepted; no secure multipart/base64 file upload endpoint exists.
8. **Product Status Lifecycle (`draft`, `published`, `archived`):**
   - The UI does not allow saving drafts or archiving products.
9. **Sales Reports & Real Analytics:**
   - Missing deep analytics: revenue over time, average order value, top-selling items by revenue, category breakdown, and date filtering.

---

### 2.4 What Needs To Change
1. **Database Schema Enhancements (`server/db.js`):**
   - Add `activity_logs` table.
   - Add `categories` table.
   - Add `status` support (`draft`, `published`, `archived`) in `products`.
   - Update `users` table check or validation to accommodate `owner`, `admin`, `staff`.
2. **Authentication Middleware (`server/middleware/auth.js`):**
   - Add `requireRole(allowedRoles)` and `requireOwner` guards.
3. **Routing in Express (`server/index.js`):**
   - Serve dedicated, secure admin views for `/admin` and `/admin/login`.
4. **Admin UI Architecture:**
   - Create a dedicated admin interface (`admin.html` + `css/admin.css` + `js/admin.js`) ensuring complete separation from public storefront assets.

---

## 3. SECURITY & MIGRATION RISKS

| Risk Area | Concern | Mitigation Strategy |
|---|---|---|
| **Role Escalation** | Client submits malicious role payload | Strictly ignore client-supplied role parameters in registration/updates. Only verified `owner` can modify roles via dedicated server endpoints. |
| **Sole Owner Lockout** | Owner accidentally deletes or demotes their own account | Prevent owner self-demotion or self-deletion at the API and database levels. |
| **Data Loss on Sample Product Removal** | Deleting sample products breaks historical orders referencing those product IDs | Use database foreign keys with immutable snapshots (`order_items`). Provide soft-archival for products linked to existing orders. |
| **Image Upload Vulnerabilities** | Executable scripts or oversized files uploaded | Enforce MIME type validation (image/png, image/jpeg, image/webp), 5MB file limit, and sanitize generated storage paths. |
| **Account Enumeration** | Login/Forgot password endpoints disclose valid administrator emails | Return uniform error messages: "Invalid email or password" and "If an account exists, instructions have been prepared." |

---

## 4. IMPLEMENTATION PHASES

- **Phase 1: Architecture & Audit (Completed)**
- **Phase 2: Authentication & Role-Based Authorization** (Dedicated `/admin/login`, one-time owner setup, `owner`/`admin`/`staff` role guards).
- **Phase 3: Admin Layout & Dashboard Shell** (Dedicated `/admin` interface, sidebar navigation, metrics overview, empty/loading states).
- **Phase 4: Product & Image Management** (Product CRUD, draft/published/archived lifecycle, variant generator, image uploader).
- **Phase 5: Categories & Live Inventory** (Category CRUD, stock management per variant, low-stock alerts, concurrency protection).
- **Phase 6: Order Fulfillment & Customer Management** (Order inspection, status transitions, timeline tracking, customer directory with privacy controls).
- **Phase 7: Discounts & Sales Analytics** (Promotional coupon engine, revenue/AOV reports, top-seller analytics with date filters).
- **Phase 8: Administrator Management & Activity Audit Logging** (Invite/manage admins, audit log of all administrative actions).
- **Phase 9: Sample Products Audit & Clean Catalog Handling** (Audit existing sample products, safe archival/removal, storefront empty state).
- **Phase 10: Verification, Automated Testing & Documentation** (Automated test suite covering all 32 required security scenarios).
