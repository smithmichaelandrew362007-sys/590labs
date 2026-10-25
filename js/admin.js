/**
 * 590 LABS® — ADMINISTRATIVE CONSOLE & STORE MANAGEMENT CLIENT
 * Architecture: Modular Vanilla JavaScript Client
 */

(function () {
  'use strict';

  // --- State ---
  const state = {
    user: null,
    currentSection: 'overview',
    products: [],
    categories: [],
    orders: [],
    customers: [],
    coupons: [],
    administrators: [],
    activityLogs: [],
    uploadedImages: []
  };

  // --- Helper: Format Currency ---
  function formatPrice(val) {
    if (val === undefined || val === null) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN');
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'success') {
    const container = document.getElementById('adminToastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `admin-toast ${type === 'danger' ? 'toast-danger' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- Fetch API Wrapper with Credentials ---
  async function api(path, options = {}) {
    const url = path.startsWith('/api') ? path : `/api${path}`;
    const opts = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    };
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Server request failed.');
    }
    return data;
  }

  // --- ROUTER & SESSION CHECK ---
  async function initRouter() {
    const path = window.location.pathname.toLowerCase();

    // Check current session
    try {
      const authRes = await api('/auth/me');
      if (authRes.authenticated && authRes.user && ['owner', 'admin', 'staff'].includes(authRes.user.role)) {
        state.user = authRes.user;
      } else {
        state.user = null;
      }
    } catch (e) {
      state.user = null;
    }

    if (path === '/admin/login') {
      if (state.user) {
        window.location.href = '/admin';
        return;
      }
      renderLoginScreen();
    } else {
      // Any other /admin route
      if (!state.user) {
        window.location.href = '/admin/login';
        return;
      }
      renderDashboardScreen();
    }
  }

  // --- SCREEN 1: LOGIN ---
  function renderLoginScreen() {
    document.getElementById('adminLoginContainer').style.display = 'flex';
    document.getElementById('adminDashboardContainer').style.display = 'none';

    const loginForm = document.getElementById('adminLoginForm');
    const alertBox = document.getElementById('loginAlertBox');
    const togglePassBtn = document.getElementById('togglePasswordBtn');
    const passInput = document.getElementById('admLoginPassword');

    // Toggle password visibility
    togglePassBtn.onclick = () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        togglePassBtn.textContent = 'HIDE';
      } else {
        passInput.type = 'password';
        togglePassBtn.textContent = 'SHOW';
      }
    };

    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      alertBox.className = 'alert-box';
      alertBox.style.display = 'none';

      const email = document.getElementById('admLoginEmail').value.trim();
      const password = passInput.value;
      const submitBtn = document.getElementById('admLoginSubmitBtn');

      submitBtn.disabled = true;
      submitBtn.textContent = 'AUTHENTICATING...';

      try {
        const res = await api('/auth/admin-login', {
          method: 'POST',
          body: { email, password }
        });

        alertBox.className = 'alert-box alert-success';
        alertBox.textContent = res.message || 'Authenticated successfully. Entering console...';
        alertBox.style.display = 'block';

        setTimeout(() => {
          window.location.href = '/admin';
        }, 400);
      } catch (err) {
        alertBox.className = 'alert-box alert-danger';
        alertBox.textContent = err.message || 'Invalid email or password.';
        alertBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'SIGN IN TO DASHBOARD →';
      }
    };

    // Forgot password link
    document.getElementById('forgotPasswordLink').onclick = async () => {
      const email = document.getElementById('admLoginEmail').value.trim();
      if (!email) {
        alert('Please enter your administrator email address above to request password recovery.');
        return;
      }
      try {
        const res = await api('/auth/forgot-password', {
          method: 'POST',
          body: { email }
        });
        alert(res.message);
      } catch (e) {
        alert(e.message);
      }
    };
  }

  // --- SCREEN 2: DASHBOARD ---
  function renderDashboardScreen() {
    document.getElementById('adminLoginContainer').style.display = 'none';
    document.getElementById('adminDashboardContainer').style.display = 'flex';

    // Update Header Profile Badge
    const u = state.user;
    document.getElementById('adminUserName').textContent = u.name;
    document.getElementById('adminUserAvatar').textContent = (u.name || 'A')[0].toUpperCase();
    const roleBadge = document.getElementById('adminUserRoleBadge');
    roleBadge.textContent = u.role.toUpperCase();
    roleBadge.className = `badge badge-${u.role}`;

    // If Owner, show Administrators nav item
    if (u.role === 'owner') {
      const navAdmins = document.getElementById('navItemAdmins');
      if (navAdmins) navAdmins.style.display = 'block';
    }

    // Attach Sidebar Navigation
    document.querySelectorAll('.admin-nav-link').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const sec = link.dataset.section;
        if (sec) switchSection(sec);
      };
    });

    // Mobile Menu Controls
    const sidebar = document.getElementById('adminSidebar');
    document.getElementById('adminMobileMenuToggle').onclick = () => {
      sidebar.classList.toggle('open');
    };
    document.getElementById('adminSidebarCloseBtn').onclick = () => {
      sidebar.classList.remove('open');
    };

    // Logout actions
    const doLogout = async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch (e) {}
      window.location.href = '/admin/login';
    };
    document.getElementById('sidebarLogoutBtn').onclick = doLogout;
    document.getElementById('headerLogoutBtn').onclick = doLogout;

    // Load initial section
    switchSection('overview');
  }

  // --- SECTION SWITCHER ---
  function switchSection(sectionId) {
    state.currentSection = sectionId;

    // Close mobile sidebar if open
    document.getElementById('adminSidebar')?.classList.remove('open');

    // Update nav links
    document.querySelectorAll('.admin-nav-link').forEach(link => {
      if (link.dataset.section === sectionId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update section visibility
    document.querySelectorAll('.admin-section').forEach(sec => {
      if (sec.id === `sec-${sectionId}`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    // Update Header Label
    const headerLabel = document.getElementById('adminHeaderSectionLabel');
    if (headerLabel) {
      headerLabel.textContent = sectionId.toUpperCase().replace('-', ' ');
    }

    // Fetch Section-Specific Data
    switch (sectionId) {
      case 'overview':
        loadOverviewData();
        break;
      case 'products':
        loadProductsData();
        loadCategoriesSelect();
        break;
      case 'categories':
        loadCategoriesData();
        break;
      case 'inventory':
        loadInventoryData();
        break;
      case 'orders':
        loadOrdersData();
        break;
      case 'customers':
        loadCustomersData();
        break;
      case 'discounts':
        loadCouponsData();
        break;
      case 'analytics':
        loadAnalyticsData();
        break;
      case 'merchandising':
        loadMerchandisingData();
        break;
      case 'administrators':
        loadAdministratorsData();
        break;
      case 'activity':
        loadActivityLogsData();
        break;
    }
  }

  // ==========================================================================
  // SECTION 1: OVERVIEW CONTROLLER
  // ==========================================================================
  async function loadOverviewData() {
    try {
      const res = await api('/admin/stats');
      if (!res.success) return;
      const s = res.stats;

      document.getElementById('statRevenue').textContent = formatPrice(s.totalRevenue);
      document.getElementById('statOrders').textContent = s.totalOrders;
      document.getElementById('statPending').textContent = s.pendingFulfillment;
      document.getElementById('statCustomers').textContent = s.totalCustomers;

      // Low stock badge
      const lowBadge = document.getElementById('lowStockCountBadge');
      if (lowBadge) lowBadge.textContent = `${s.lowStockCount} ALERTS`;
      const sideLowBadge = document.getElementById('sidebarLowStockBadge');
      if (sideLowBadge) {
        sideLowBadge.textContent = s.lowStockCount;
        sideLowBadge.style.display = s.lowStockCount > 0 ? 'inline-block' : 'none';
      }

      // Render Low Stock Table
      const lowBody = document.getElementById('overviewLowStockBody');
      if (lowBody) {
        if (!s.lowStockVariants || s.lowStockVariants.length === 0) {
          lowBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">All variant inventories are healthy (> 3 units).</td></tr>`;
        } else {
          lowBody.innerHTML = s.lowStockVariants.map(v => `
            <tr>
              <td><code>${v.sku}</code></td>
              <td><strong>${v.product_title}</strong></td>
              <td><span class="badge">${v.size}</span></td>
              <td>${v.color_code.toUpperCase()}</td>
              <td><strong style="color:var(--danger);">${v.stock_quantity} LEFT</strong></td>
              <td>
                <div style="display:flex; gap:0.4rem; align-items:center;">
                  <input type="number" id="quickStock_${v.id}" value="${v.stock_quantity}" min="0" style="width:65px; padding:0.25rem 0.4rem;" class="form-input" />
                  <button class="btn btn-outline btn-sm" onclick="window.adminApp.quickUpdateStock('${v.product_id}', ${v.id})">SAVE</button>
                </div>
              </td>
            </tr>
          `).join('');
        }
      }

      // Render Recent Orders Table
      const ordersBody = document.getElementById('overviewRecentOrdersBody');
      if (ordersBody) {
        if (!s.recentOrders || s.recentOrders.length === 0) {
          ordersBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No orders recorded yet.</td></tr>`;
        } else {
          ordersBody.innerHTML = s.recentOrders.map(o => `
            <tr>
              <td><strong>${o.id}</strong></td>
              <td>${o.customer_name}<br /><span class="font-mono" style="font-size:0.7rem; color:var(--text-secondary);">${o.customer_email}</span></td>
              <td class="font-mono" style="font-size:0.75rem;">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
              <td><strong>${formatPrice(o.total_amount)}</strong></td>
              <td><span class="badge-status badge-status-${o.payment_status}">${o.payment_status.toUpperCase()}</span></td>
              <td><span class="badge-status badge-status-${o.fulfillment_status}">${o.fulfillment_status.toUpperCase()}</span></td>
              <td>
                <button class="btn btn-outline btn-sm" onclick="window.adminApp.openOrderDetails('${o.id}')">DETAILS</button>
              </td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }

  // Quick Stock Updater
  async function quickUpdateStock(productId, variantId) {
    const input = document.getElementById(`quickStock_${variantId}`);
    if (!input) return;
    const qty = input.value;
    try {
      await api(`/admin/products/${productId}/stock`, {
        method: 'PATCH',
        body: { variantId, stockQuantity: qty }
      });
      showToast('Inventory updated successfully.');
      loadOverviewData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  // ==========================================================================
  // SECTION 2: PRODUCTS CONTROLLER
  // ==========================================================================
  async function loadProductsData() {
    const search = document.getElementById('prodSearchInput')?.value || '';
    const status = document.getElementById('prodStatusFilter')?.value || 'all';
    const category = document.getElementById('prodCategoryFilter')?.value || 'all';

    try {
      const res = await api(`/admin/products?search=${encodeURIComponent(search)}&status=${status}&category=${category}`);
      state.products = res.products || [];
      renderProductsTable();
    } catch (err) {
      console.error('Error loading products:', err);
    }
  }

  function renderProductsTable() {
    const tbody = document.getElementById('adminProductsTableBody');
    if (!tbody) return;

    if (state.products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 3rem;">
            <div class="font-heading" style="font-size: 1.1rem; margin-bottom: 0.5rem;">NO PRODUCTS FOUND</div>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1.25rem;">Create a new streetwear drop or adjust your active search filters.</p>
            <button class="btn btn-lime btn-sm" onclick="window.adminApp.openProductModal()">+ CREATE NEW DROP</button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.products.map(p => {
      const img = (p.images && p.images[0]) || '/assets/logo-black.svg';
      const statusClass = `badge-status-${p.status}`;
      return `
        <tr>
          <td>
            <div style="display:flex; gap:0.75rem; align-items:center;">
              <img src="${img}" alt="${p.title}" style="width:44px; height:56px; object-fit:cover; border-radius:2px; border:1px solid var(--border-medium); background:#FFFFFF;" />
              <div>
                <strong>${p.title}</strong>
                <div class="font-mono" style="font-size:0.7rem; color:var(--text-secondary);">${p.id}</div>
              </div>
            </div>
          </td>
          <td><span class="badge">${(p.category || '').toUpperCase()}</span></td>
          <td>
            <strong>${formatPrice(p.price)}</strong>
            ${p.compare_price ? `<div style="text-decoration:line-through; font-size:0.72rem; color:var(--text-muted);">${formatPrice(p.compare_price)}</div>` : ''}
          </td>
          <td>
            <select class="form-input" style="padding:0.2rem 0.4rem; font-size:0.75rem; width:115px;" onchange="window.adminApp.updateProductStatus('${p.id}', this.value)">
              <option value="published" ${p.status === 'published' ? 'selected' : ''}>PUBLISHED</option>
              <option value="draft" ${p.status === 'draft' ? 'selected' : ''}>DRAFT</option>
              <option value="archived" ${p.status === 'archived' ? 'selected' : ''}>ARCHIVED</option>
            </select>
          </td>
          <td>
            <div style="display:flex; flex-wrap:wrap; gap:0.3rem; max-width:280px;">
              ${(p.variants || []).map(v => `
                <span class="font-mono" style="background:var(--bg-subtle); padding:0.15rem 0.35rem; font-size:0.68rem; border:1px solid var(--border-light); border-radius:2px;">
                  ${v.size}: <strong style="${v.stock_quantity <= 3 ? 'color:var(--danger);' : ''}">${v.stock_quantity}</strong>
                </span>
              `).join('')}
            </div>
          </td>
          <td><strong>${p.totalStock} UNITS</strong></td>
          <td>
            <div style="display:flex; gap:0.4rem;">
              <button class="btn btn-outline btn-sm" onclick="window.adminApp.editProduct('${p.id}')">EDIT</button>
              <button class="btn btn-sm" style="background:#FFF5F5; color:var(--danger); border:1px solid #FFC9C9;" onclick="window.adminApp.deleteProduct('${p.id}')">DELETE</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function updateProductStatus(id, newStatus) {
    try {
      await api(`/admin/products/${id}/status`, {
        method: 'PATCH',
        body: { status: newStatus }
      });
      showToast(`Product status updated to ${newStatus.toUpperCase()}.`);
      loadProductsData();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }

  async function deleteProduct(id) {
    if (!confirm(`Are you sure you want to remove product ${id}? If customers have purchased it, it will be safely archived instead of corrupting historical orders.`)) {
      return;
    }
    try {
      const res = await api(`/admin/products/${id}`, { method: 'DELETE' });
      showToast(res.message);
      loadProductsData();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }

  // Product Add / Edit Modal Controls
  function openProductModal(prod = null) {
    const modal = document.getElementById('productModal');
    const isEdit = Boolean(prod);
    document.getElementById('pmIsEdit').value = isEdit ? 'true' : 'false';
    document.getElementById('productModalTitle').textContent = isEdit ? `EDIT DROP: ${prod.title}` : 'CREATE NEW PRODUCT DROP';

    const slugInput = document.getElementById('pmSlug');
    slugInput.value = prod ? prod.id : '';
    slugInput.disabled = isEdit; // slug cannot be changed when editing to preserve keys

    document.getElementById('pmTitle').value = prod ? prod.title : '';
    document.getElementById('pmCategory').value = prod ? prod.category : (state.categories[0]?.slug || 'tops');
    document.getElementById('pmStatus').value = prod ? prod.status : 'published';
    document.getElementById('pmPrice').value = prod ? prod.price : '';
    document.getElementById('pmComparePrice').value = prod && prod.compare_price ? prod.compare_price : '';
    document.getElementById('pmGsm').value = prod && prod.gsm ? prod.gsm : '280 GSM';
    document.getElementById('pmStock').value = '10';
    document.getElementById('pmDescription').value = prod && prod.description ? prod.description : '';

    state.uploadedImages = prod && prod.images ? [...prod.images] : [];
    renderImagePreviews();

    modal.classList.add('active');
  }

  async function editProduct(id) {
    try {
      const res = await api(`/admin/products/${id}`);
      if (res.product) {
        openProductModal(res.product);
      }
    } catch (e) {
      showToast('Could not load product for editing.', 'danger');
    }
  }

  function renderImagePreviews() {
    const container = document.getElementById('imagePreviewContainer');
    if (!container) return;
    container.innerHTML = state.uploadedImages.map((url, idx) => `
      <div style="position:relative; display:inline-block;">
        <img src="${url}" class="image-preview-item" alt="preview" />
        <button type="button" onclick="window.adminApp.removeUploadedImage(${idx})" style="position:absolute; top:-6px; right:-6px; background:var(--danger); color:#fff; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer;">✕</button>
      </div>
    `).join('');
  }

  function removeUploadedImage(idx) {
    state.uploadedImages.splice(idx, 1);
    renderImagePreviews();
  }

  // Image Upload File Handler
  async function handleImageUpload(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be under 5MB.', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      try {
        showToast('Uploading high-res photography...');
        const res = await api('/admin/upload-image', {
          method: 'POST',
          body: { data: base64Data, filename: file.name }
        });
        if (res.url) {
          state.uploadedImages.push(res.url);
          renderImagePreviews();
          showToast('Image uploaded successfully.');
        }
      } catch (err) {
        showToast(err.message, 'danger');
      }
    };
    reader.readAsDataURL(file);
  }

  // ==========================================================================
  // SECTION 3: CATEGORIES CONTROLLER
  // ==========================================================================
  async function loadCategoriesData() {
    try {
      const res = await api('/admin/categories');
      state.categories = res.categories || [];
      renderCategoriesTable();
      loadCategoriesSelect();
    } catch (e) {
      console.error(e);
    }
  }

  function renderCategoriesTable() {
    const tbody = document.getElementById('adminCategoriesTableBody');
    if (!tbody) return;

    tbody.innerHTML = state.categories.map(c => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td><code>${c.slug}</code></td>
        <td style="color:var(--text-secondary);">${c.description || '—'}</td>
        <td><span class="badge badge-lime">${c.product_count || 0} DROPS</span></td>
        <td>${c.display_order}</td>
        <td><span class="badge ${c.is_active ? 'badge-admin' : ''}">${c.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-outline btn-sm" onclick="window.adminApp.editCategory(${c.id})">EDIT</button>
            <button class="btn btn-sm" style="background:#FFF5F5; color:var(--danger); border:1px solid #FFC9C9;" onclick="window.adminApp.deleteCategory(${c.id})">DELETE</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function loadCategoriesSelect() {
    const selects = [document.getElementById('pmCategory'), document.getElementById('prodCategoryFilter')];
    selects.forEach(sel => {
      if (!sel) return;
      const isFilter = sel.id === 'prodCategoryFilter';
      sel.innerHTML = (isFilter ? '<option value="all">ALL CATEGORIES</option>' : '') +
        state.categories.map(c => `<option value="${c.slug}">${c.name.toUpperCase()}</option>`).join('');
    });
  }

  function openCategoryModal(cat = null) {
    const modal = document.getElementById('categoryModal');
    document.getElementById('cmId').value = cat ? cat.id : '';
    document.getElementById('cmName').value = cat ? cat.name : '';
    document.getElementById('cmSlug').value = cat ? cat.slug : '';
    document.getElementById('cmDesc').value = cat && cat.description ? cat.description : '';
    document.getElementById('cmOrder').value = cat ? cat.display_order : 1;
    modal.classList.add('active');
  }

  async function editCategory(id) {
    const cat = state.categories.find(c => c.id === id);
    if (cat) openCategoryModal(cat);
  }

  async function deleteCategory(id) {
    if (!confirm('Are you sure you want to delete this category? It will be blocked if products are assigned.')) return;
    try {
      const res = await api(`/admin/categories/${id}`, { method: 'DELETE' });
      showToast(res.message);
      loadCategoriesData();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }

  // ==========================================================================
  // SECTION 4: INVENTORY CONTROLLER
  // ==========================================================================
  async function loadInventoryData() {
    const term = (document.getElementById('inventorySearchInput')?.value || '').toLowerCase();
    try {
      const res = await api('/admin/products');
      const products = res.products || [];
      const tbody = document.getElementById('adminInventoryTableBody');
      if (!tbody) return;

      const rows = [];
      products.forEach(p => {
        (p.variants || []).forEach(v => {
          if (!term || v.sku.toLowerCase().includes(term) || p.title.toLowerCase().includes(term)) {
            rows.push({ ...v, productTitle: p.title });
          }
        });
      });

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">No SKUs match your query.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map(v => `
        <tr>
          <td><code>${v.sku}</code></td>
          <td><strong>${v.productTitle}</strong></td>
          <td><span class="badge">${v.size}</span></td>
          <td>${(v.color_code || '').toUpperCase()}</td>
          <td><strong style="${v.stock_quantity <= 3 ? 'color:var(--danger);' : ''}">${v.stock_quantity} UNITS</strong></td>
          <td>
            <div style="display:flex; gap:0.4rem; align-items:center;">
              <input type="number" id="invQty_${v.id}" value="${v.stock_quantity}" min="0" style="width:70px; padding:0.25rem 0.4rem;" class="form-input" />
              <button class="btn btn-outline btn-sm" onclick="window.adminApp.updateInventoryDirect('${v.product_id}', ${v.id})">UPDATE</button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  }

  async function updateInventoryDirect(productId, variantId) {
    const input = document.getElementById(`invQty_${variantId}`);
    if (!input) return;
    const qty = input.value;
    try {
      await api(`/admin/products/${productId}/stock`, {
        method: 'PATCH',
        body: { variantId, stockQuantity: qty }
      });
      showToast('Inventory updated.');
      loadInventoryData();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }

  // ==========================================================================
  // SECTION 5: ORDERS CONTROLLER
  // ==========================================================================
  async function loadOrdersData() {
    const search = document.getElementById('orderSearchInput')?.value || '';
    const fulfillmentStatus = document.getElementById('orderFulfillmentFilter')?.value || 'all';
    const paymentStatus = document.getElementById('orderPaymentFilter')?.value || 'all';

    try {
      const res = await api(`/admin/orders?search=${encodeURIComponent(search)}&fulfillmentStatus=${fulfillmentStatus}&paymentStatus=${paymentStatus}`);
      state.orders = res.orders || [];
      renderOrdersTable();
    } catch (e) {
      console.error(e);
    }
  }

  function renderOrdersTable() {
    const tbody = document.getElementById('adminOrdersTableBody');
    if (!tbody) return;

    if (state.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2.5rem; color: var(--text-muted);">No orders match the current criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.orders.map(o => `
      <tr>
        <td><strong>${o.id}</strong></td>
        <td>${o.customer_name}<br /><span class="font-mono" style="font-size:0.7rem; color:var(--text-secondary);">${o.customer_email}</span></td>
        <td class="font-mono" style="font-size:0.75rem;">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
        <td>${(o.items || []).length} piece(s)</td>
        <td><strong>${formatPrice(o.total_amount)}</strong></td>
        <td><span class="badge-status badge-status-${o.payment_status}">${o.payment_status.toUpperCase()}</span></td>
        <td>
          <select class="form-input" style="padding:0.2rem 0.4rem; font-size:0.75rem; width:135px;" onchange="window.adminApp.updateFulfillmentStatus('${o.id}', this.value)">
            <option value="confirmed" ${o.fulfillment_status === 'confirmed' ? 'selected' : ''}>CONFIRMED</option>
            <option value="packing" ${o.fulfillment_status === 'packing' ? 'selected' : ''}>PACKING</option>
            <option value="in_transit" ${o.fulfillment_status === 'in_transit' ? 'selected' : ''}>IN TRANSIT</option>
            <option value="out_for_delivery" ${o.fulfillment_status === 'out_for_delivery' ? 'selected' : ''}>OUT FOR DELIVERY</option>
            <option value="delivered" ${o.fulfillment_status === 'delivered' ? 'selected' : ''}>DELIVERED</option>
            <option value="cancelled" ${o.fulfillment_status === 'cancelled' ? 'selected' : ''}>CANCELLED</option>
          </select>
        </td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="window.adminApp.openOrderDetails('${o.id}')">DETAILS</button>
        </td>
      </tr>
    `).join('');
  }

  async function updateFulfillmentStatus(orderId, status) {
    try {
      await api(`/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { fulfillmentStatus: status }
      });
      showToast(`Order #${orderId} marked as ${status.toUpperCase()}.`);
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }

  async function openOrderDetails(orderId) {
    const modal = document.getElementById('orderModal');
    const body = document.getElementById('orderModalBody');

    try {
      const res = await api(`/admin/orders/${orderId}`);
      const o = res.order;
      if (!o) return;

      const addr = o.shippingAddress || {};

      body.innerHTML = `
        <div class="grid-2col" style="margin-bottom: 1.5rem;">
          <div>
            <h4 class="font-heading" style="font-size:0.9rem; margin-bottom:0.4rem;">CUSTOMER RECIPIENT</h4>
            <div style="font-size:0.85rem; line-height:1.6;">
              <strong>${o.customer_name}</strong><br />
              Email: ${o.customer_email}<br />
              Phone: ${o.customer_phone}
            </div>
          </div>
          <div>
            <h4 class="font-heading" style="font-size:0.9rem; margin-bottom:0.4rem;">SHIPPING ADDRESS</h4>
            <div style="font-size:0.85rem; line-height:1.6; color:var(--text-secondary);">
              ${addr.addressLine1 || ''} ${addr.addressLine2 || ''}<br />
              ${addr.locality ? addr.locality + ', ' : ''}${addr.city || ''}, ${addr.state || ''} - <strong>${addr.pincode || ''}</strong>
            </div>
          </div>
        </div>

        <h4 class="font-heading" style="font-size:0.9rem; margin-bottom:0.75rem;">PURCHASED PIECES (IMMUTABLE SNAPSHOT)</h4>
        <div class="admin-table-wrap" style="margin-bottom:1.5rem;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>PIECE</th>
                <th>SIZE</th>
                <th>COLOR</th>
                <th>UNIT PRICE</th>
                <th>QTY</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${(o.items || []).map(i => `
                <tr>
                  <td>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                      ${i.image_url ? `<img src="${i.image_url}" style="width:32px; height:40px; object-fit:cover; border-radius:2px;" />` : ''}
                      <div><strong>${i.product_title}</strong><br /><code style="font-size:0.7rem;">${i.sku || ''}</code></div>
                    </div>
                  </td>
                  <td><span class="badge">${i.size}</span></td>
                  <td>${i.color || 'Standard'}</td>
                  <td>${formatPrice(i.price)}</td>
                  <td><strong>${i.quantity}</strong></td>
                  <td><strong>${formatPrice(i.price * i.quantity)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Carrier & Tracking Info Form -->
        <div style="background:var(--bg-subtle); padding:1.25rem; border-radius:var(--radius-xs); border:1px solid var(--border-light);">
          <h4 class="font-heading" style="font-size:0.9rem; margin-bottom:0.75rem;">FULFILLMENT DISPATCH METRICS</h4>
          <div class="grid-2col">
            <div class="form-group">
              <label class="form-label" for="odCarrier">SHIPPING CARRIER</label>
              <input type="text" id="odCarrier" class="form-input" value="${o.carrier || 'Bluedart Express'}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="odTracking">AWB / TRACKING NUMBER</label>
              <input type="text" id="odTracking" class="form-input" value="${o.tracking_number || ''}" placeholder="e.g. 590DEL-9843210-BLR" />
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.adminApp.saveTrackingDetails('${o.id}')">UPDATE DISPATCH METRICS</button>
        </div>
      `;

      modal.classList.add('active');
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }

  async function saveTrackingDetails(orderId) {
    const carrier = document.getElementById('odCarrier').value;
    const trackingNumber = document.getElementById('odTracking').value;

    try {
      await api(`/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { carrier, trackingNumber, fulfillmentStatus: 'in_transit' }
      });
      showToast('Dispatch metrics updated. Order marked In Transit.');
      loadOrdersData();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }

  // ==========================================================================
  // SECTION 6: CUSTOMERS CONTROLLER
  // ==========================================================================
  async function loadCustomersData() {
    try {
      const res = await api('/admin/customers');
      state.customers = res.customers || [];
      const tbody = document.getElementById('adminCustomersTableBody');
      if (!tbody) return;

      if (state.customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No registered customers yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = state.customers.map(c => `
        <tr>
          <td>#${c.id}</td>
          <td><strong>${c.name}</strong></td>
          <td>${c.email}</td>
          <td>${c.phone || '—'}</td>
          <td>${c.orderCount} order(s)</td>
          <td><strong>${formatPrice(c.totalSpent)}</strong></td>
          <td>${new Date(c.created_at).toLocaleDateString('en-IN')}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  }

  // ==========================================================================
  // SECTION 7: DISCOUNTS CONTROLLER
  // ==========================================================================
  async function loadCouponsData() {
    try {
      const res = await api('/admin/coupons');
      state.coupons = res.coupons || [];
      const tbody = document.getElementById('adminCouponsTableBody');
      if (!tbody) return;

      if (state.coupons.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No active coupons. Create one to run a drop promotion.</td></tr>`;
        return;
      }

      tbody.innerHTML = state.coupons.map(c => `
        <tr>
          <td><code>${c.code}</code></td>
          <td><strong>${c.discount_type === 'percent' ? c.discount_value + '% OFF' : '₹' + c.discount_value + ' FLAT'}</strong></td>
          <td>${formatPrice(c.min_order_value)}</td>
          <td>${c.max_discount ? formatPrice(c.max_discount) : 'Unlimited'}</td>
          <td>${c.times_used} times</td>
          <td><span class="badge ${c.is_active ? 'badge-lime' : ''}">${c.is_active ? 'ACTIVE' : 'DISABLED'}</span></td>
          <td>
            <div style="display:flex; gap:0.4rem;">
              <button class="btn btn-outline btn-sm" onclick="window.adminApp.toggleCoupon(${c.id})">${c.is_active ? 'DEACTIVATE' : 'ACTIVATE'}</button>
              <button class="btn btn-sm" style="background:#FFF5F5; color:var(--danger); border:1px solid #FFC9C9;" onclick="window.adminApp.deleteCoupon(${c.id})">DELETE</button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleCoupon(id) {
    try {
      const res = await api(`/admin/coupons/${id}/toggle`, { method: 'PATCH' });
      showToast(res.message);
      loadCouponsData();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }

  async function deleteCoupon(id) {
    if (!confirm('Are you sure you want to remove this coupon code?')) return;
    try {
      const res = await api(`/admin/coupons/${id}`, { method: 'DELETE' });
      showToast(res.message);
      loadCouponsData();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }

  // ==========================================================================
  // SECTION 8: ANALYTICS CONTROLLER
  // ==========================================================================
  async function loadAnalyticsData() {
    try {
      const res = await api('/admin/analytics');
      if (!res.success) return;
      const a = res.analytics;

      document.getElementById('anGrossRevenue').textContent = formatPrice(a.grossRevenue);
      document.getElementById('anAov').textContent = formatPrice(a.aov);
      document.getElementById('anTotalDiscounts').textContent = formatPrice(a.totalDiscounts);
      document.getElementById('anPaidOrders').textContent = a.totalPaidOrders;

      // Top Selling Products
      const topBody = document.getElementById('anTopProductsBody');
      if (topBody) {
        if (!a.topProducts || a.topProducts.length === 0) {
          topBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No sales data recorded yet.</td></tr>`;
        } else {
          topBody.innerHTML = a.topProducts.map(p => `
            <tr>
              <td><strong>${p.product_title}</strong></td>
              <td>${p.totalUnitsSold} units</td>
              <td><strong>${formatPrice(p.totalRevenue)}</strong></td>
            </tr>
          `).join('');
        }
      }

      // Category Revenue
      const catBody = document.getElementById('anCategoryRevenueBody');
      if (catBody) {
        if (!a.categoryBreakdown || a.categoryBreakdown.length === 0) {
          catBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No category data yet.</td></tr>`;
        } else {
          catBody.innerHTML = a.categoryBreakdown.map(c => `
            <tr>
              <td><strong>${(c.category || '').toUpperCase()}</strong></td>
              <td>${c.unitsSold} units</td>
              <td><strong>${formatPrice(c.revenue)}</strong></td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ==========================================================================
  // SECTION 9: MERCHANDISING CONTROLLER
  // ==========================================================================
  async function loadMerchandisingData() {
    try {
      const res = await api('/admin/merchandising');
      const m = res.merchandising || {};
      if (m.merch_banner) {
        document.getElementById('merchBannerText').value = m.merch_banner.text || '';
      }
      if (m.merch_hero_headline) {
        document.getElementById('merchHeroHeadline').value = m.merch_hero_headline || '';
      }
      if (m.merch_featured) {
        document.getElementById('merchFeaturedSlugs').value = Array.isArray(m.merch_featured) ? m.merch_featured.join(', ') : m.merch_featured;
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function saveMerchandisingSettings() {
    const bannerText = document.getElementById('merchBannerText').value.trim();
    const heroHeadline = document.getElementById('merchHeroHeadline').value.trim();
    const featuredInput = document.getElementById('merchFeaturedSlugs').value.trim();
    const featuredProductIds = featuredInput.split(',').map(s => s.trim()).filter(Boolean);

    try {
      await api('/admin/merchandising', {
        method: 'POST',
        body: {
          banner: { enabled: Boolean(bannerText), text: bannerText },
          heroHeadline,
          featuredProductIds
        }
      });
      showToast('Storefront merchandising settings saved.');
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }

  // ==========================================================================
  // SECTION 10: ADMINISTRATORS CONTROLLER (OWNER-ONLY)
  // ==========================================================================
  async function loadAdministratorsData() {
    if (state.user?.role !== 'owner') return;

    try {
      const res = await api('/admin/administrators');
      state.administrators = res.administrators || [];
      const tbody = document.getElementById('adminAdministratorsTableBody');
      if (!tbody) return;

      tbody.innerHTML = state.administrators.map(a => `
        <tr>
          <td><strong>${a.name}</strong></td>
          <td>${a.email}</td>
          <td>
            <select class="form-input" style="padding:0.2rem 0.4rem; font-size:0.75rem; width:110px;" onchange="window.adminApp.changeAdminRole(${a.id}, this.value)" ${a.role === 'owner' ? 'disabled' : ''}>
              <option value="owner" ${a.role === 'owner' ? 'selected' : ''}>OWNER</option>
              <option value="admin" ${a.role === 'admin' ? 'selected' : ''}>ADMIN</option>
              <option value="staff" ${a.role === 'staff' ? 'selected' : ''}>STAFF</option>
            </select>
          </td>
          <td>${new Date(a.created_at).toLocaleDateString('en-IN')}</td>
          <td>
            ${a.role !== 'owner' ? `
              <button class="btn btn-sm" style="background:#FFF5F5; color:var(--danger); border:1px solid #FFC9C9;" onclick="window.adminApp.revokeAdmin(${a.id})">REVOKE</button>
            ` : '<span class="badge badge-owner">PRIMARY OWNER</span>'}
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  }

  async function changeAdminRole(id, role) {
    try {
      const res = await api(`/admin/administrators/${id}/role`, {
        method: 'PATCH',
        body: { role }
      });
      showToast(res.message);
      loadAdministratorsData();
    } catch (e) {
      showToast(e.message, 'danger');
      loadAdministratorsData();
    }
  }

  async function revokeAdmin(id) {
    if (!confirm('Are you sure you want to revoke administrative permissions from this account?')) return;
    try {
      const res = await api(`/admin/administrators/${id}`, { method: 'DELETE' });
      showToast(res.message);
      loadAdministratorsData();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }

  // ==========================================================================
  // SECTION 11: ACTIVITY LOG CONTROLLER
  // ==========================================================================
  async function loadActivityLogsData() {
    const search = document.getElementById('activitySearchInput')?.value || '';
    try {
      const res = await api(`/admin/activity-logs?search=${encodeURIComponent(search)}`);
      state.activityLogs = res.logs || [];
      const tbody = document.getElementById('adminActivityTableBody');
      if (!tbody) return;

      if (state.activityLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No activity logs found.</td></tr>`;
        return;
      }

      tbody.innerHTML = state.activityLogs.map(l => {
        let detailsDisplay = l.details || '';
        try {
          const parsed = JSON.parse(l.details);
          detailsDisplay = Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(' | ');
        } catch (e) {}

        return `
          <tr>
            <td class="font-mono" style="font-size:0.75rem; white-space:nowrap;">${new Date(l.created_at).toLocaleString('en-IN')}</td>
            <td><strong>${l.admin_name}</strong></td>
            <td><span class="badge badge-lime">${l.action}</span></td>
            <td><code>${l.entity_type} ${l.entity_id ? '#' + l.entity_id : ''}</code></td>
            <td style="font-size:0.75rem; color:var(--text-secondary);">${detailsDisplay}</td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  }

  // ==========================================================================
  // DOM EVENT ATTACHMENTS & MODAL HANDLERS
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initRouter();

    // Top CTA Overview
    document.getElementById('btnOverviewNewDrop')?.addEventListener('click', () => {
      switchSection('products');
      openProductModal();
    });

    // Product Modals
    document.getElementById('btnOpenNewProductModal')?.addEventListener('click', () => openProductModal());
    document.getElementById('closeProductModalBtn')?.addEventListener('click', () => {
      document.getElementById('productModal').classList.remove('active');
    });
    document.getElementById('btnCancelProductModal')?.addEventListener('click', () => {
      document.getElementById('productModal').classList.remove('active');
    });

    // Product Image Upload Dropzone
    const dropzone = document.getElementById('imageUploadDropzone');
    const fileInput = document.getElementById('imageFileInput');

    if (dropzone && fileInput) {
      dropzone.onclick = () => fileInput.click();
      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          handleImageUpload(e.target.files[0]);
        }
      };

      dropzone.ondragover = (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--accent-lime)'; };
      dropzone.ondragleave = () => { dropzone.style.borderColor = 'var(--border-medium)'; };
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-medium)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleImageUpload(e.dataTransfer.files[0]);
        }
      };
    }

    // External URL image input
    const urlInput = document.getElementById('pmImageUrlInput');
    if (urlInput) {
      urlInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = urlInput.value.trim();
          if (val) {
            state.uploadedImages.push(val);
            renderImagePreviews();
            urlInput.value = '';
          }
        }
      };
    }

    // Save Product Drop
    document.getElementById('btnSaveProductModal')?.addEventListener('click', async () => {
      const isEdit = document.getElementById('pmIsEdit').value === 'true';
      const slug = document.getElementById('pmSlug').value.trim();
      const title = document.getElementById('pmTitle').value.trim();
      const category = document.getElementById('pmCategory').value;
      const status = document.getElementById('pmStatus').value;
      const price = document.getElementById('pmPrice').value;
      const comparePrice = document.getElementById('pmComparePrice').value;
      const gsm = document.getElementById('pmGsm').value.trim();
      const stock = document.getElementById('pmStock').value;
      const description = document.getElementById('pmDescription').value.trim();
      const colorName = document.getElementById('pmColorName').value.trim() || 'Obsidian Black';

      const selectedSizes = [];
      document.querySelectorAll('#sizeCheckboxes input:checked').forEach(cb => selectedSizes.push(cb.value));

      if (!slug || !title || !price) {
        showToast('Slug, Title, and Price are mandatory fields.', 'danger');
        return;
      }

      const payload = {
        id: slug,
        title,
        category,
        status,
        price: Number(price),
        comparePrice: comparePrice ? Number(comparePrice) : null,
        gsm,
        stockQuantity: Number(stock) || 10,
        description,
        images: state.uploadedImages,
        sizes: selectedSizes,
        colors: [{ name: colorName, code: colorName.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 8) }]
      };

      try {
        if (isEdit) {
          await api(`/admin/products/${slug}`, { method: 'PUT', body: payload });
          showToast('Product updated successfully.');
        } else {
          await api('/admin/products', { method: 'POST', body: payload });
          showToast('New drop created and published.');
        }
        document.getElementById('productModal').classList.remove('active');
        loadProductsData();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });

    // Category Modal
    document.getElementById('btnOpenCategoryModal')?.addEventListener('click', () => openCategoryModal());
    document.getElementById('closeCategoryModalBtn')?.addEventListener('click', () => {
      document.getElementById('categoryModal').classList.remove('active');
    });
    document.getElementById('btnCancelCategoryModal')?.addEventListener('click', () => {
      document.getElementById('categoryModal').classList.remove('active');
    });

    document.getElementById('btnSaveCategoryModal')?.addEventListener('click', async () => {
      const id = document.getElementById('cmId').value;
      const name = document.getElementById('cmName').value.trim();
      const slug = document.getElementById('cmSlug').value.trim();
      const description = document.getElementById('cmDesc').value.trim();
      const displayOrder = document.getElementById('cmOrder').value;

      if (!name || !slug) {
        showToast('Name and Slug are required.', 'danger');
        return;
      }

      try {
        if (id) {
          await api(`/admin/categories/${id}`, {
            method: 'PUT',
            body: { name, slug, description, displayOrder }
          });
          showToast('Category updated.');
        } else {
          await api('/admin/categories', {
            method: 'POST',
            body: { name, slug, description, displayOrder }
          });
          showToast('Category created.');
        }
        document.getElementById('categoryModal').classList.remove('active');
        loadCategoriesData();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });

    // Coupon Modal
    document.getElementById('btnOpenCouponModal')?.addEventListener('click', () => {
      document.getElementById('couponModal').classList.add('active');
    });
    document.getElementById('closeCouponModalBtn')?.addEventListener('click', () => {
      document.getElementById('couponModal').classList.remove('active');
    });
    document.getElementById('btnCancelCouponModal')?.addEventListener('click', () => {
      document.getElementById('couponModal').classList.remove('active');
    });
    document.getElementById('btnSaveCouponModal')?.addEventListener('click', async () => {
      const code = document.getElementById('cpmCode').value.trim();
      const discountType = document.getElementById('cpmType').value;
      const discountValue = document.getElementById('cpmValue').value;
      const minOrderValue = document.getElementById('cpmMinOrder').value;
      const maxDiscount = document.getElementById('cpmMaxDiscount').value;

      try {
        await api('/admin/coupons', {
          method: 'POST',
          body: { code, discountType, discountValue, minOrderValue, maxDiscount }
        });
        showToast(`Coupon ${code} activated.`);
        document.getElementById('couponModal').classList.remove('active');
        loadCouponsData();
      } catch (e) {
        showToast(e.message, 'danger');
      }
    });

    // Authorize Admin Modal
    document.getElementById('btnOpenInviteAdminModal')?.addEventListener('click', () => {
      document.getElementById('adminModal').classList.add('active');
    });
    document.getElementById('closeAdminModalBtn')?.addEventListener('click', () => {
      document.getElementById('adminModal').classList.remove('active');
    });
    document.getElementById('btnCancelAdminModal')?.addEventListener('click', () => {
      document.getElementById('adminModal').classList.remove('active');
    });
    document.getElementById('btnSaveAdminModal')?.addEventListener('click', async () => {
      const name = document.getElementById('amName').value.trim();
      const email = document.getElementById('amEmail').value.trim();
      const password = document.getElementById('amPassword').value;
      const role = document.getElementById('amRole').value;

      try {
        const res = await api('/admin/administrators', {
          method: 'POST',
          body: { name, email, password, role }
        });
        showToast(res.message);
        document.getElementById('adminModal').classList.remove('active');
        loadAdministratorsData();
      } catch (e) {
        showToast(e.message, 'danger');
      }
    });

    // Order Details Modal Close
    document.getElementById('closeOrderModalBtn')?.addEventListener('click', () => {
      document.getElementById('orderModal').classList.remove('active');
    });
    document.getElementById('btnCloseOrderModal')?.addEventListener('click', () => {
      document.getElementById('orderModal').classList.remove('active');
    });

    // Merchandising Save
    document.getElementById('btnSaveMerchandising')?.addEventListener('click', saveMerchandisingSettings);

    // Product Filters
    document.getElementById('prodSearchInput')?.addEventListener('input', debounce(loadProductsData, 250));
    document.getElementById('prodStatusFilter')?.addEventListener('change', loadProductsData);
    document.getElementById('prodCategoryFilter')?.addEventListener('change', loadProductsData);

    // Inventory & Activity Search
    document.getElementById('inventorySearchInput')?.addEventListener('input', debounce(loadInventoryData, 250));
    document.getElementById('activitySearchInput')?.addEventListener('input', debounce(loadActivityLogsData, 250));

    // Order Filters
    document.getElementById('orderSearchInput')?.addEventListener('input', debounce(loadOrdersData, 250));
    document.getElementById('orderFulfillmentFilter')?.addEventListener('change', loadOrdersData);
    document.getElementById('orderPaymentFilter')?.addEventListener('change', loadOrdersData);

    // Sample Data Cleanup Button
    document.getElementById('btnAuditSampleProducts')?.addEventListener('click', async () => {
      if (confirm('Audit and clean sample products? Any sample product linked to existing orders will be safely archived to protect order records, while unreferenced sample items will be safely removed.')) {
        try {
          const res = await api('/admin/products');
          const products = res.products || [];
          let archivedCount = 0;
          let deletedCount = 0;

          for (const p of products) {
            // Check if it's one of the original 12 development catalog items
            const sampleIds = [
              'core-graphic-tee', 'oversized-heavyweight-hoodie', 'modular-utility-cargo',
              'acid-wash-longsleeve', 'tactical-vest-bag', 'distressed-denim-jacket',
              'cyberpunk-acid-hoodie', 'heavy-terry-sweatpant', 'minimal-box-tee',
              'nylon-parachute-trackpant', 'raw-edge-knit-sweater', 'crossbody-rig-bag'
            ];
            if (sampleIds.includes(p.id)) {
              const delRes = await api(`/admin/products/${p.id}`, { method: 'DELETE' });
              if (delRes.archived) archivedCount++;
              else if (delRes.deleted) deletedCount++;
            }
          }

          showToast(`Cleanup complete: ${deletedCount} unreferenced samples deleted, ${archivedCount} ordered samples archived.`);
          loadOverviewData();
        } catch (e) {
          showToast(e.message, 'danger');
        }
      }
    });
  });

  // Debounce helper
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Expose global methods for inline HTML onclick handlers
  window.adminApp = {
    switchSection,
    quickUpdateStock,
    openOrderDetails,
    updateFulfillmentStatus,
    saveTrackingDetails,
    openProductModal,
    editProduct,
    updateProductStatus,
    deleteProduct,
    removeUploadedImage,
    editCategory,
    deleteCategory,
    updateInventoryDirect,
    toggleCoupon,
    deleteCoupon,
    changeAdminRole,
    revokeAdmin
  };
})();
