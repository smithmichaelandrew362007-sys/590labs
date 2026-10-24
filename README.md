# 590 LABS® — Independent Unisex Streetwear Storefront

> **Not made to blend in.**  
> Minimalist premium streetwear fashion label. Unisex oversized fits, heavyweights, and everyday rebellion.

[![Node.js](https://img.shields.io/badge/Node.js-v22+-green.svg)](https://nodejs.org/)
[![Express 5](https://img.shields.io/badge/Express-5.3.0-blue.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20WAL-lightgrey.svg)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-Proprietary-black.svg)]()

---

## ⚡ Overview

590 LABS is a full-stack e-commerce web platform built specifically for high-end streetwear. The platform features an editorial minimalist aesthetic paired with an enterprise-grade backend architecture, variant inventory management, multi-gateway payments (Razorpay & Cash on Delivery), live order tracking, and an administrative control suite.

### Key Capabilities

- **Minimalist Aesthetic:** 70% Swiss minimalism, 20% high-fashion editorial, 10% subtle streetwear personality.
- **Variant Matrix & Concurrency Safety:** Real database-backed sizing (`XS`–`XXL`), color variations, distinct SKUs, and atomic stock decrements that prevent overselling under high concurrency.
- **Customer Accounts & Security:**
  - Registration, password hashing via `bcryptjs`, and stateless JWT authentication.
  - Google OAuth 2.0 / OpenID Connect backend integration.
  - Time-limited crypto-random password recovery tokens.
  - Customer Account Dashboard with saved Indian addresses, order history, and cancellation workflow.
- **Indian Checkout & Payments:**
  - Automated server-side subtotal, discount, shipping, and tax recalculation.
  - Razorpay checkout SDK integration with server-side HMAC SHA256 signature verification.
  - Cash on Delivery (COD) mode with safety caps and pending fulfillment state.
- **Order Lifecycle & Tracking:** 6-stage order status progression (`confirmed` → `processing` → `packed` → `shipped` → `out_for_delivery` → `delivered`) with real-time visual progress timeline.
- **Store Administration:**
  - Role-Based Access Control (`requireAdmin`).
  - Real-time revenue metrics, order fulfillment updater, stock inventory editor, and coupon generator.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML5, Vanilla CSS3 (Custom Design Tokens, Grid, Flexbox), Vanilla ES6+ JavaScript.
- **Backend:** Node.js (v24), Express 5.
- **Database:** Native `node:sqlite` (Node 24 zero-dependency SQLite driver) with Write-Ahead Logging (`WAL`).
- **Security:** `bcryptjs`, `jsonwebtoken`, `crypto`.
- **Payment Processing:** Official `razorpay` Node SDK.

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/smithmichaelandrew362007-sys/590labs.com.git
cd 590labs.com
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Configure your `.env` variables:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your_secret_jwt_key
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
GOOGLE_CLIENT_ID=your_google_client_id
```

### 3. Initialize & Seed Database

```bash
npm run seed
```

This provisions 12 streetwear drops, 105 variants, default discounts (`DROP10`, `LABS590`, `VIPMEMBER`), sample reviews, and default accounts:
- **Admin Portal:** `admin@590labs.com` / `Admin@590Labs2026`
- **Customer Demo:** `karan@example.com` / `Streetwear@2026`

### 4. Run the Platform

```bash
npm start
```
Access the storefront live at `http://localhost:3000`.

---

## 🧪 Testing

Run the full automated integration test suite:

```bash
npm test
```

Run the concurrent checkout & overselling protection test:

```bash
node test/concurrency.test.js
```

---

## 📄 License & Attribution

© 2026 590 LABS®. All rights reserved.
Unisex Streetwear Brand.
