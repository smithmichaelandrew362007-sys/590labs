/**
 * 590 LABS® — API Client Engine
 * Handles REST communication with backend services, authentication sessions, and secure payment triggers.
 */

const API = (function() {
  const BASE_URL = '/api';

  // Helper for requests
  async function request(endpoint, options = {}) {
    const token = localStorage.getItem('590labs_token');
    const sessionId = localStorage.getItem('590labs_session_id') || generateSessionId();

    const headers = {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId,
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'same-origin'
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Server request failed with status ${res.status}`);
      }

      return data;
    } catch (err) {
      console.error(`[590 API Error] ${endpoint}:`, err.message);
      throw err;
    }
  }

  function generateSessionId() {
    const id = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('590labs_session_id', id);
    return id;
  }

  return {
    auth: {
      async me() {
        return request('/auth/me');
      },
      async login(email, password) {
        const res = await request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        if (res.token) {
          localStorage.setItem('590labs_token', res.token);
          localStorage.setItem('590labs_user', JSON.stringify(res.user));
        }
        return res;
      },
      async register(userData) {
        const res = await request('/auth/register', {
          method: 'POST',
          body: JSON.stringify(userData)
        });
        if (res.token) {
          localStorage.setItem('590labs_token', res.token);
          localStorage.setItem('590labs_user', JSON.stringify(res.user));
        }
        return res;
      },
      async google(credential) {
        const res = await request('/auth/google', {
          method: 'POST',
          body: JSON.stringify({ credential })
        });
        if (res.token) {
          localStorage.setItem('590labs_token', res.token);
          localStorage.setItem('590labs_user', JSON.stringify(res.user));
        }
        return res;
      },
      async forgotPassword(email) {
        return request('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
        });
      },
      async resetPassword(token, newPassword, confirmPassword) {
        return request('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, newPassword, confirmPassword })
        });
      },
      async updateProfile(name, phone) {
        return request('/auth/profile', {
          method: 'PUT',
          body: JSON.stringify({ name, phone })
        });
      },
      async changePassword(currentPassword, newPassword) {
        return request('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword })
        });
      },
      async getAddresses() {
        return request('/auth/addresses');
      },
      async addAddress(address) {
        return request('/auth/addresses', {
          method: 'POST',
          body: JSON.stringify(address)
        });
      },
      async deleteAddress(id) {
        return request(`/auth/addresses/${id}`, {
          method: 'DELETE'
        });
      },
      async logout() {
        try {
          await request('/auth/logout', { method: 'POST' });
        } catch (e) {}
        localStorage.removeItem('590labs_token');
        localStorage.removeItem('590labs_user');
      },
      getCurrentUser() {
        const str = localStorage.getItem('590labs_user');
        try { return str ? JSON.parse(str) : null; } catch (e) { return null; }
      },
      isLoggedIn() {
        return Boolean(localStorage.getItem('590labs_token'));
      },
      isAdmin() {
        const user = this.getCurrentUser();
        return Boolean(user && user.role === 'admin');
      }
    },

    products: {
      async list(params = {}) {
        const query = new URLSearchParams(params).toString();
        return request(`/products${query ? '?' + query : ''}`);
      },
      async get(id) {
        return request(`/products/${id}`);
      },
      async getCategories() {
        return request('/products/meta/categories');
      }
    },

    cart: {
      async get() {
        return request('/cart');
      },
      async add(productId, size, color, quantity = 1) {
        return request('/cart/add', {
          method: 'POST',
          body: JSON.stringify({ productId, size, color, quantity })
        });
      },
      async update(id, quantity) {
        return request(`/cart/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ quantity })
        });
      },
      async remove(id) {
        return request(`/cart/${id}`, { method: 'DELETE' });
      },
      async sync(guestItems) {
        return request('/cart/sync', {
          method: 'POST',
          body: JSON.stringify({ guestItems })
        });
      },
      async clear() {
        return request('/cart/clear', { method: 'POST' });
      }
    },

    wishlist: {
      async get() {
        return request('/wishlist');
      },
      async toggle(productId) {
        return request('/wishlist/toggle', {
          method: 'POST',
          body: JSON.stringify({ productId })
        });
      },
      async moveToCart(productId, size, color) {
        return request('/wishlist/move-to-cart', {
          method: 'POST',
          body: JSON.stringify({ productId, size, color })
        });
      }
    },

    coupons: {
      async validate(code, subtotal) {
        return request('/coupons/validate', {
          method: 'POST',
          body: JSON.stringify({ code, subtotal })
        });
      }
    },

    orders: {
      async create(orderData) {
        return request('/orders/create', {
          method: 'POST',
          body: JSON.stringify(orderData)
        });
      },
      async verifyPayment(verificationData) {
        return request('/orders/verify-payment', {
          method: 'POST',
          body: JSON.stringify(verificationData)
        });
      },
      async myOrders() {
        return request('/orders/my-orders');
      },
      async get(id) {
        return request(`/orders/${id}`);
      },
      async cancel(id) {
        return request(`/orders/${id}/cancel`, { method: 'POST' });
      }
    },

    reviews: {
      async list(productId) {
        return request(`/reviews/product/${productId}`);
      },
      async submit(reviewData) {
        return request('/reviews', {
          method: 'POST',
          body: JSON.stringify(reviewData)
        });
      }
    },

    admin: {
      async getStats() {
        return request('/admin/stats');
      },
      async getOrders(params = {}) {
        const query = new URLSearchParams(params).toString();
        return request(`/admin/orders${query ? '?' + query : ''}`);
      },
      async updateOrderStatus(orderId, updateData) {
        return request(`/admin/orders/${orderId}/status`, {
          method: 'PATCH',
          body: JSON.stringify(updateData)
        });
      },
      async getProducts() {
        return request('/admin/products');
      },
      async createProduct(productData) {
        return request('/admin/products', {
          method: 'POST',
          body: JSON.stringify(productData)
        });
      },
      async updateStock(productId, variantId, stockQuantity) {
        return request(`/admin/products/${productId}/stock`, {
          method: 'PATCH',
          body: JSON.stringify({ variantId, stockQuantity })
        });
      },
      async getCustomers() {
        return request('/admin/customers');
      },
      async getCoupons() {
        return request('/admin/coupons');
      },
      async createCoupon(couponData) {
        return request('/admin/coupons', {
          method: 'POST',
          body: JSON.stringify(couponData)
        });
      },
      async getReviews() {
        return request('/admin/reviews');
      },
      async moderateReview(id, isApproved) {
        return request(`/admin/reviews/${id}/moderate`, {
          method: 'PATCH',
          body: JSON.stringify({ isApproved })
        });
      }
    }
  };
})();
