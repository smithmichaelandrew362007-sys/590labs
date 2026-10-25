# 590 LABS® — STORE MANAGEMENT & ADMINISTRATION SYSTEM GUIDE

Welcome to the **590 Labs** Administration Dashboard documentation. This guide details the security architecture, routing, setup procedures, and routine operational workflows.

---

## 1. ADMIN ROUTES

| Route | Purpose | Access Control |
|---|---|---|
| `/admin` | Main Store Management Dashboard (Overview, Products, Orders, Inventory, etc.) | Restricted to authorized roles (`owner`, `admin`, `staff`) |
| `/admin/login` | Dedicated Administrator Sign-In Console | Publicly accessible login form |
| `/api/admin/*` | Administrative REST APIs | Protected by JWT authentication and RBAC middleware |
| `/` | Public Streetwear Storefront | Publicly accessible to customers and visitors |

---

## 2. ARCHITECTURE & DATA FLOW

```
                          ┌─────────────────────────┐
                          │   Browser Client (SPA)  │
                          └────────────┬────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
   Public Storefront (`/`)                             Admin Console (`/admin`)
   - index.html                                        - admin.html
   - css/main.css                                      - css/admin.css
   - js/app.js                                         - js/admin.js
            │                                                     │
            └──────────────────────────┬──────────────────────────┘
                                       │ HTTP / REST API (with Cookie / Bearer JWT)
                                       ▼
                        ┌─────────────────────────────┐
                        │   Express 5 Backend Server  │
                        │   (Node.js 24 + Compression)│
                        └──────────────┬──────────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           ▼                           ▼                           ▼
  `/api/auth` (JWT Auth)     `/api/admin` (RBAC Protected)  `/api/orders` (Atomic Tx)
           │                           │                           │
           └───────────────────────────┼───────────────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │   SQLite Database (DatabaseSync)  │
                     │   - WAL Mode & Foreign Keys       │
                     │   - Immutable Order Snapshots     │
                     │   - Activity Audit Logs           │
                     └───────────────────────────────────┘
```

---

## 3. REQUIRED ENVIRONMENT VARIABLES

Create a `.env` file in the project root with the following configuration:

```ini
# Environment
NODE_ENV=production
PORT=3000

# Authentication (Generate a strong 64+ char random secret)
JWT_SECRET=your_production_super_secret_jwt_key_2026

# Razorpay Payment Gateway (Test or Live credentials)
RAZORPAY_KEY_ID=rzp_live_your_actual_key_id
RAZORPAY_KEY_SECRET=your_actual_razorpay_secret

# Google OAuth 2.0 Web Client (Optional for customer Google login)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

> [!IMPORTANT]
> Never commit actual secrets or production keys to version control. Always use environment configuration or your hosting provider's secrets vault.

---

## 4. INITIAL OWNER-ACCOUNT SETUP

Public registration of administrators is strictly prohibited. To initialize or update your initial store Owner account, use the controlled command-line setup utility:

```bash
# Run one-time Owner account setup
node server/setup-owner.js <email> <password> "<name>" "<phone>"

# Example
node server/setup-owner.js owner@590labs.com MySuperSecretPass2026! "Store Founder" "+91 98765 43210"
```

### Security Safeguards
- **Permanent Lockout:** Once an account with role `owner` is established, the setup endpoint (`/api/admin/setup-owner`) and setup script permanently lock and will reject any unauthorized attempts with `403 Forbidden`.
- **Sole Owner Protection:** The system forbids deleting or demoting the last remaining active store Owner account.

---

## 5. MULTI-ADMINISTRATOR ROLES & PERMISSIONS

The 590 Labs system enforces three distinct administrative tiers:

1. **Owner (`owner`):**
   - Full store management capabilities.
   - Exclusive access to the **Administrators Management** suite (`/admin` -> Administrators tab).
   - Can authorize new administrators, assign roles (`admin` or `staff`), update roles, or revoke access.
2. **Administrator (`admin`):**
   - Product catalog creation, editing, pricing updates, and publishing/unpublishing.
   - Live variant stock adjustment and low-stock alerts.
   - Category management (creating, ordering, safe removal).
   - Order fulfillment processing, carrier updates, and tracking number assignment.
   - Promotional discount code creation and activation.
   - Sales analytics and financial report access.
3. **Staff (`staff`):**
   - Order fulfillment inspection and tracking status updates.
   - Live variant inventory reading and stock updating.
   - Strictly prohibited from creating administrators, modifying pricing, or deleting categories.

### Authorizing a New Team Member
1. Log in to the Admin Console as the **Owner**.
2. Select the **Administrators** tab in the sidebar.
3. Click **+ AUTHORIZE ADMINISTRATOR**.
4. Enter their full name, email, role (`admin` or `staff`), and a temporary password (min 8 chars).
5. Share the login URL (`https://yourdomain.com/admin/login`) with your team member.

---

## 6. PRODUCT MANAGEMENT & LIFECYCLE

### Status Workflow
Products follow a strict 3-stage lifecycle:
- **`draft`:** Invisible to the public storefront, search results, and categories. Allows administrators to draft upcoming drops, refine specs, and prepare photography before launch.
- **`published`:** Live and actively purchasable across the storefront.
- **`archived`:** Retired from public sale. If a product has historical orders, it is automatically soft-archived rather than deleted, guaranteeing transactional integrity.

### Product Image Management
- Upload high-resolution streetwear photography via the drag-and-drop dropzone or direct file picker.
- Images are validated for MIME type (`image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/svg+xml`) and enforced to a 5MB maximum limit.
- Images are saved to `/assets/uploads/` with sanitized, cryptographically random names.

---

## 7. SAMPLE DATA AUDIT & REMOVAL

During initial development, sample demo products (`core-graphic-tee`, `modular-utility-cargo`, etc.) were created. When you are ready to feature your own catalog:

1. Navigate to `/admin` -> **Settings & Setup**.
2. Click **AUDIT & CLEAN SAMPLE DATA**.
3. The system checks each development product against historical orders:
   - Any sample product referenced by historical customer orders is safely **archived** so customer order history and receipt items remain 100% intact.
   - Any unreferenced sample products and their variant records are cleanly deleted.
4. If your catalog contains no published products yet, the storefront automatically renders an editorial empty state:
   *"OUR COLLECTION IS COMING SOON // THE VAULT IS CURRENTLY BEING CURATED."*

---

## 8. AUTOMATED TESTING

To execute the test suites and verify all 32 security scenarios:

```bash
# Run the complete Master Security Test Suite (32 tests)
npm run test:admin

# Run public API tests (22 tests)
npm test

# Run all test suites (API, Admin Security, Concurrency, Intro, Responsive)
npm run test:all
```
