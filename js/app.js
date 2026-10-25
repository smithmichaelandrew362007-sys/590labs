/**
 * 590 LABS® — Main Application Controller
 * Handles SPA Views, Product Grids, PDP Modal, Cart Drawer, Checkout Flow, Wishlist & Search.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Sound Engine
  SoundEngine.init();

  // App State
  let currentCategory = "all";
  let currentSort = "featured";
  let searchQuery = "";
  let activePdpProduct = null;
  let activePdpSize = null;
  let activePdpColorHex = null;

  // Cache DOM Elements
  const productsGridHome = document.getElementById("productsGridHome");
  const shopCatalogGrid = document.getElementById("shopCatalogGrid");
  const cartDrawer = document.getElementById("cartDrawer");
  const cartBackdrop = document.getElementById("cartBackdrop");
  const cartItemsList = document.getElementById("cartItemsList");
  const cartBadgeCounts = document.querySelectorAll(".cart-count-badge");
  const wishlistBadgeCounts = document.querySelectorAll(".wishlist-count-badge");
  const pdpModal = document.getElementById("pdpModal");
  const sizeGuideModal = document.getElementById("sizeGuideModal");
  const checkoutModal = document.getElementById("checkoutModal");
  const searchModal = document.getElementById("searchModal");
  const mobileMenuDrawer = document.getElementById("mobileMenuDrawer");
  const toastContainer = document.getElementById("toastContainer");
  const currencySelects = document.querySelectorAll(".currency-select");
  const soundToggleBtns = document.querySelectorAll(".sound-toggle-btn");

  // --------------------------------------------------------------------------
  // TOAST NOTIFICATIONS
  // --------------------------------------------------------------------------
  function showToast(message, type = "info") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <span style="color: var(--accent-lime); font-size: 0.65rem;">●</span>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
  window.showToast = showToast;

  // --------------------------------------------------------------------------
  // WEB PERFORMANCE OPTIMIZATION HELPERS
  // --------------------------------------------------------------------------
  function optimizeImageUrl(url, width = 500, quality = 75) {
    if (!url || typeof url !== "string") return url;
    if (url.includes("images.unsplash.com")) {
      const cleanUrl = url.split("?")[0];
      return `${cleanUrl}?w=${width}&auto=format&fit=crop&q=${quality}&fm=webp`;
    }
    return url;
  }

  function debounce(fn, wait = 160) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  let _razorpayLoaderPromise = null;
  function loadRazorpaySdk() {
    if (typeof window.Razorpay === "function") {
      return Promise.resolve(window.Razorpay);
    }
    if (_razorpayLoaderPromise) return _razorpayLoaderPromise;
    _razorpayLoaderPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(window.Razorpay);
      script.onerror = () => {
        console.warn("Razorpay SDK could not be loaded from CDN.");
        resolve(null);
      };
      document.head.appendChild(script);
    });
    return _razorpayLoaderPromise;
  }

  // --------------------------------------------------------------------------
  // PRODUCT CARD GENERATOR (HIGH EFFICIENCY)
  // --------------------------------------------------------------------------
  function createProductCardHTML(product) {
    const isWishlisted = Store.isInWishlist(product.id);
    const primaryImg = optimizeImageUrl(product.images[0], 500, 75);
    const secondaryImg = optimizeImageUrl(product.images[1] || product.images[0], 500, 75);

    const badgesHTML = product.badges.map(badge => {
      const isLime = badge.includes("DROP") || badge.includes("VIRAL") || badge.includes("LOW");
      return `<span class="badge ${isLime ? 'badge-lime' : ''}">${badge}</span>`;
    }).join("");

    const colorsHTML = product.colors.map((c, i) => `
      <span class="color-dot ${i === 0 ? 'active' : ''}" 
            style="background-color: ${c.hex};" 
            title="${c.name}"
            data-color-hex="${c.hex}"></span>
    `).join("");

    const sizesHTML = product.sizes.map(size => {
      const stockQty = product.stock ? product.stock[size] : 5;
      const isOutOfStock = stockQty === 0;
      return `
        <button class="quick-size-chip" 
                data-product-id="${product.id}" 
                data-size="${size}" 
                ${isOutOfStock ? 'disabled title="Out of Stock"' : ''}>
          ${size}
        </button>
      `;
    }).join("");

    return `
      <article class="product-card" data-product-id="${product.id}">
        <div class="product-media-wrap" data-action="open-pdp">
          <img class="product-img product-img-primary" src="${primaryImg}" alt="${product.title}" loading="lazy" decoding="async" width="400" height="533" />
          <img class="product-img product-img-secondary" src="${secondaryImg}" alt="${product.title} alternative" loading="lazy" decoding="async" width="400" height="533" />
          
          <div class="product-badges-stack">
            ${badgesHTML}
          </div>

          <button class="product-wishlist-btn ${isWishlisted ? 'active' : ''}" 
                  data-action="toggle-wishlist" 
                  aria-label="Save to Wishlist">
            <svg viewBox="0 0 24 24" fill="${isWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>

          <!-- Quick Add Size Drawer on Card -->
          <div class="quick-add-overlay" onclick="event.stopPropagation()">
            <div class="quick-add-title">
              <span>Quick Add Size</span>
              <span>${product.gsm}</span>
            </div>
            <div class="quick-add-sizes">
              ${sizesHTML}
            </div>
          </div>
        </div>

        <div class="product-info">
          <div class="product-colors-preview">
            ${colorsHTML}
          </div>
          <h3 class="product-title" data-action="open-pdp">${product.title}</h3>
          <p class="product-specs-line">${product.subtitle}</p>
          
          <div class="product-price-row">
            <span class="product-price">${Store.formatPrice(product.price)}</span>
            ${product.comparePrice ? `<span class="product-compare-price">${Store.formatPrice(product.comparePrice)}</span>` : ''}
          </div>
        </div>
      </article>
    `;
  }

  // --------------------------------------------------------------------------
  // RENDER GRIDS
  // --------------------------------------------------------------------------
  function renderHomeProducts() {
    if (!productsGridHome) return;
    const featured = getFeaturedDrops().slice(0, 8);
    if (featured.length === 0) {
      productsGridHome.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
          <div class="font-display" style="font-size: 1.5rem; letter-spacing: 0.1em; color: var(--off-white); margin-bottom: 0.5rem;">OUR COLLECTION IS COMING SOON.</div>
          <p class="font-mono" style="color: var(--off-white-muted); font-size: 0.85rem;">CHECK BACK SOON FOR THE NEXT 590 LABS ARCHIVAL DROP.</p>
        </div>
      `;
      return;
    }
    productsGridHome.innerHTML = featured.map(createProductCardHTML).join("");
  }

  function renderShopCatalog() {
    if (!shopCatalogGrid) return;
    let list = [...(window.PRODUCTS || PRODUCTS)];

    // Filter by Category
    if (currentCategory && currentCategory !== "all") {
      list = list.filter(p => p.category === currentCategory || (p.type && p.type.toLowerCase().includes(currentCategory.toLowerCase())));
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        (p.title && p.title.toLowerCase().includes(q)) || 
        (p.subtitle && p.subtitle.toLowerCase().includes(q)) || 
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.gsm && p.gsm.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (currentSort === "price-low") {
      list.sort((a, b) => a.price - b.price);
    } else if (currentSort === "price-high") {
      list.sort((a, b) => b.price - a.price);
    } else if (currentSort === "newest") {
      list.sort((a, b) => (b.isNewDrop ? 1 : 0) - (a.isNewDrop ? 1 : 0));
    }

    if (list.length === 0) {
      const isCatalogEmpty = !window.PRODUCTS || window.PRODUCTS.length === 0;
      shopCatalogGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
          <div class="font-display" style="font-size: 1.35rem; letter-spacing: 0.08em; color: var(--off-white); margin-bottom: 0.5rem;">${isCatalogEmpty ? 'COLLECTION COMING SOON.' : 'NO PIECES FOUND MATCHING CRITERIA.'}</div>
          <p class="font-mono" style="color: var(--off-white-muted); margin-bottom: 1.25rem; font-size: 0.85rem;">${isCatalogEmpty ? 'Check back soon for the latest collection.' : 'Try clearing your filters or search terms.'}</p>
          ${isCatalogEmpty ? '' : '<button class="btn btn-outline-lime btn-sm" onclick="window.resetShopFilters()">RESET ALL FILTERS</button>'}
        </div>
      `;
      const catalogCountEl = document.getElementById("catalogCount");
      if (catalogCountEl) catalogCountEl.innerText = `0 PIECES`;
      return;
    }

    shopCatalogGrid.innerHTML = list.map(createProductCardHTML).join("");
    const catalogCountEl = document.getElementById("catalogCount");
    if (catalogCountEl) catalogCountEl.innerText = `${list.length} PIECES`;
  }

  window.resetShopFilters = () => {
    currentCategory = "all";
    searchQuery = "";
    currentSort = "featured";
    document.querySelectorAll(".filter-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.category === "all");
    });
    renderShopCatalog();
  };

  // --------------------------------------------------------------------------
  // PRODUCT DETAILS MODAL (PDP)
  // --------------------------------------------------------------------------
  function openPdp(productId) {
    const product = getProductById(productId);
    if (!product) return;

    activePdpProduct = product;
    activePdpSize = product.sizes[0];
    activePdpColorHex = product.colors[0].hex;

    // Populate Modal Content
    document.getElementById("pdpBreadcrumb").innerText = `590 LABS / ${product.category.toUpperCase()} / ${product.type.toUpperCase()}`;
    document.getElementById("pdpTitle").innerText = product.title;
    document.getElementById("pdpPrice").innerText = Store.formatPrice(product.price);
    document.getElementById("pdpComparePrice").innerText = product.comparePrice ? Store.formatPrice(product.comparePrice) : "";
    document.getElementById("pdpFitSubtitle").innerText = `${product.fit} · ${product.gsm}`;
    document.getElementById("pdpDescription").innerText = product.description;

    // Gallery
    const mainImgEl = document.getElementById("pdpMainImg");
    mainImgEl.src = optimizeImageUrl(product.images[0], 1000, 80);
    mainImgEl.alt = product.title;
    mainImgEl.decoding = "async";

    const thumbsContainer = document.getElementById("pdpThumbs");
    thumbsContainer.innerHTML = product.images.map((imgUrl, i) => `
      <img class="pdp-thumb-img ${i === 0 ? 'active' : ''}" 
           src="${optimizeImageUrl(imgUrl, 160, 75)}" 
           data-index="${i}" 
           alt="Thumbnail ${i + 1}"
           loading="lazy"
           decoding="async"
           width="60"
           height="75" />
    `).join("");

    // Colors
    const colorsContainer = document.getElementById("pdpColors");
    colorsContainer.innerHTML = product.colors.map((c, i) => `
      <span class="pdp-color-swatch ${i === 0 ? 'active' : ''}" 
            style="background-color: ${c.hex};" 
            data-hex="${c.hex}" 
            data-name="${c.name}" 
            title="${c.name}"></span>
    `).join("");
    document.getElementById("pdpSelectedColorName").innerText = product.colors[0].name;

    // Sizes
    renderPdpSizes();

    // Specs List
    const specsList = document.getElementById("pdpSpecsList");
    if (specsList && product.specs) {
      specsList.innerHTML = product.specs.map(spec => `<li>• ${spec}</li>`).join("");
    }
    const careText = document.getElementById("pdpCareText");
    if (careText) careText.innerText = product.care || "";

    // Reset Pincode
    const pincodeRes = document.getElementById("pdpPincodeResult");
    if (pincodeRes) pincodeRes.style.display = "none";
    const pincodeInput = document.getElementById("pdpPincodeInput");
    if (pincodeInput) pincodeInput.value = "";

    // Open Modal
    pdpModal.classList.add("active");
    document.body.style.overflow = "hidden";
    SoundEngine.click();
  }

  function renderPdpSizes() {
    if (!activePdpProduct) return;
    const sizesContainer = document.getElementById("pdpSizes");
    sizesContainer.innerHTML = activePdpProduct.sizes.map(size => {
      const stockQty = activePdpProduct.stock ? activePdpProduct.stock[size] : 5;
      const isOutOfStock = stockQty === 0;
      const isActive = size === activePdpSize;
      return `
        <button class="pdp-size-btn ${isActive ? 'active' : ''}" 
                data-size="${size}" 
                ${isOutOfStock ? 'disabled' : ''}>
          ${size}
        </button>
      `;
    }).join("");

    const stockIndicator = document.getElementById("pdpStockIndicator");
    const stockQty = activePdpProduct.stock ? activePdpProduct.stock[activePdpSize] : 5;
    if (stockIndicator) {
      if (stockQty <= 3) {
        stockIndicator.innerHTML = `⚡ High Demand: Only ${stockQty} pieces left in size ${activePdpSize}`;
        stockIndicator.style.display = "inline-flex";
      } else {
        stockIndicator.innerHTML = `✓ In Stock: Ready for instant dispatch in size ${activePdpSize}`;
        stockIndicator.style.display = "inline-flex";
      }
    }
  }

  function closePdp() {
    pdpModal.classList.remove("active");
    document.body.style.overflow = "";
    activePdpProduct = null;
    SoundEngine.click();
  }

  // --------------------------------------------------------------------------
  // CART DRAWER SYSTEM
  // --------------------------------------------------------------------------
  function openCart() {
    renderCart();
    cartDrawer.classList.add("active");
    cartBackdrop.classList.add("active");
    document.body.style.overflow = "hidden";
    SoundEngine.click();
  }

  function closeCart() {
    cartDrawer.classList.remove("active");
    cartBackdrop.classList.remove("active");
    document.body.style.overflow = "";
    SoundEngine.click();
  }

  function renderCart() {
    const summary = Store.getCartSummary();
    
    // Update badge counts
    cartBadgeCounts.forEach(el => {
      el.innerText = summary.itemsCount;
      el.style.display = summary.itemsCount > 0 ? "flex" : "none";
    });

    if (!cartItemsList) return;

    // Free shipping meter
    const meterFill = document.getElementById("shippingProgressFill");
    const meterText = document.getElementById("shippingMeterText");
    if (meterFill && meterText) {
      meterFill.style.width = `${summary.shippingProgressPercent}%`;
      if (summary.isFreeShipping) {
        meterText.innerHTML = `<span><strong>FREE EXPRESS SHIPPING UNLOCKED!</strong></span> <span>✓</span>`;
      } else {
        meterText.innerHTML = `<span>ADD <strong>${Store.formatPrice(summary.amountNeededForFreeShipping)}</strong> FOR FREE SHIPPING</span> <span>${summary.shippingProgressPercent}%</span>`;
      }
    }

    if (summary.items.length === 0) {
      cartItemsList.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <svg style="width: 48px; height: 48px; color: var(--off-white-muted); margin: 0 auto 1rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <p class="font-mono" style="color: var(--off-white); font-weight: 700; margin-bottom: 0.5rem;">YOUR BAG IS EMPTY</p>
          <p style="font-size: 0.85rem; color: var(--off-white-muted); margin-bottom: 1.5rem;">Discover our latest limited releases and unisex silhouettes.</p>
          <button class="btn btn-outline-lime btn-sm" onclick="window.closeCart(); window.location.hash='#shop';">EXPLORE NEW DROPS</button>
        </div>
      `;
      document.getElementById("cartSubtotal").innerText = Store.formatPrice(0);
      document.getElementById("cartTotal").innerText = Store.formatPrice(0);
      document.getElementById("cartCheckoutBtn").disabled = true;
      document.getElementById("cartDiscountRow").style.display = "none";
      return;
    }

    document.getElementById("cartCheckoutBtn").disabled = false;

    // Render items
    cartItemsList.innerHTML = summary.items.map(item => `
      <div class="cart-item-row" data-cart-id="${item.id}">
        <img class="cart-item-img" src="${optimizeImageUrl(item.image, 140, 75)}" alt="${item.title}" loading="lazy" decoding="async" width="60" height="75" />
        <div class="cart-item-details">
          <div>
            <h4 class="cart-item-title">${item.title}</h4>
            <div class="cart-item-meta">
              <span>SIZE: ${item.size}</span>
              <span>•</span>
              <span style="display:inline-flex; align-items:center; gap:3px;">
                <span style="width:8px; height:8px; border-radius:50%; background:${item.colorHex}; display:inline-block; border:1px solid #444;"></span>
                ${item.colorName}
              </span>
            </div>
            <div class="cart-item-price">${Store.formatPrice(item.price * item.quantity)}</div>
          </div>

          <div class="cart-item-controls">
            <div class="qty-stepper">
              <button class="qty-btn" data-action="qty-minus" data-id="${item.id}">−</button>
              <span class="qty-value">${item.quantity}</span>
              <button class="qty-btn" data-action="qty-plus" data-id="${item.id}">+</button>
            </div>
            <button class="cart-item-remove-btn" data-action="remove-item" data-id="${item.id}">REMOVE</button>
          </div>
        </div>
      </div>
    `).join("");

    // Totals
    document.getElementById("cartSubtotal").innerText = summary.formattedSubtotal;
    document.getElementById("cartShipping").innerText = summary.formattedShipping;
    document.getElementById("cartTotal").innerText = summary.formattedTotal;

    const discountRow = document.getElementById("cartDiscountRow");
    if (summary.discount > 0) {
      discountRow.style.display = "flex";
      document.getElementById("cartDiscount").innerText = `-${summary.formattedDiscount}`;
    } else {
      discountRow.style.display = "none";
    }
  }

  window.closeCart = closeCart;

  // --------------------------------------------------------------------------
  // CHECKOUT FLOW
  // --------------------------------------------------------------------------
  function openCheckout() {
    const summary = Store.getCartSummary();
    if (summary.itemsCount === 0) return;

    closeCart();
    // Render summary in checkout
    document.getElementById("checkoutItemsSummary").innerHTML = summary.items.map(item => `
      <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-family:var(--font-mono); margin-bottom:0.4rem;">
        <span>${item.title} (x${item.quantity}) [${item.size}]</span>
        <strong>${Store.formatPrice(item.price * item.quantity)}</strong>
      </div>
    `).join("");

    document.getElementById("checkoutFinalTotal").innerText = summary.formattedTotal;
    document.getElementById("checkoutScreenForm").style.display = "block";
    document.getElementById("checkoutScreenSuccess").style.display = "none";

    checkoutModal.classList.add("active");
    document.body.style.overflow = "hidden";
    SoundEngine.click();
  }

  async function completeOrder() {
    const nameInput = document.getElementById("chkName");
    const phoneInput = document.getElementById("chkPhone");
    const emailInput = document.getElementById("chkEmail");
    const addressInput = document.getElementById("chkAddress");
    const cityInput = document.getElementById("chkCity");
    const pincodeInput = document.getElementById("chkPincode");
    const submitBtn = document.getElementById("checkoutSubmitBtn");

    const recipientName = (nameInput.value || "").trim();
    const recipientPhone = (phoneInput.value || "").trim();
    const recipientEmail = (emailInput.value || "").trim();
    const recipientAddress = (addressInput.value || "").trim();
    const recipientCity = (cityInput.value || "").trim();
    const recipientPincode = (pincodeInput.value || "").trim();

    if (!recipientName || !recipientPhone || !recipientEmail || !recipientAddress || !recipientCity || !recipientPincode) {
      showToast("Please fill in all required shipping and contact details.", "warning");
      return;
    }

    if (!/^\d{6}$/.test(recipientPincode)) {
      showToast("Please enter a valid 6-digit Indian PIN code.", "warning");
      return;
    }

    const cartSummary = Store.getCartSummary();
    if (cartSummary.itemsCount === 0) {
      showToast("Your shopping bag is empty.", "warning");
      return;
    }

    // Determine payment method from active tab
    const activeTab = document.querySelector("#chkPaymentTabs .payment-tab.active");
    const paymentMethod = activeTab ? (activeTab.dataset.method || "razorpay") : "razorpay";

    submitBtn.disabled = true;
    submitBtn.innerText = "PROCESSING ORDER...";

    try {
      const orderPayload = {
        customerName: recipientName,
        customerEmail: recipientEmail,
        customerPhone: recipientPhone,
        shippingAddress: {
          fullName: recipientName,
          phone: recipientPhone,
          addressLine1: recipientAddress,
          city: recipientCity,
          state: "Karnataka",
          pincode: recipientPincode
        },
        paymentMethod,
        couponCode: cartSummary.appliedPromo ? cartSummary.appliedPromo.code : null,
        items: cartSummary.items.map(item => ({
          productId: item.productId,
          title: item.title,
          size: item.size,
          color: item.colorName,
          quantity: item.quantity
        }))
      };

      const res = await API.orders.create(orderPayload);

      if (paymentMethod === "razorpay") {
        await loadRazorpaySdk();
        // If official Razorpay checkout script is available
        if (typeof window.Razorpay === "function" && res.razorpayOrder) {
          const options = {
            key: res.gatewayConfig.keyId,
            amount: res.razorpayOrder.amount,
            currency: "INR",
            name: "590 LABS®",
            description: `Order ${res.orderId} // Unisex Streetwear`,
            image: "assets/logo-black.png",
            order_id: res.razorpayOrder.id.startsWith("order_test") || res.razorpayOrder.id.startsWith("order_sandbox") ? undefined : res.razorpayOrder.id,
            handler: async function (response) {
              try {
                await API.orders.verifyPayment({
                  orderId: res.orderId,
                  razorpayOrderId: response.razorpay_order_id || res.razorpayOrder.id,
                  razorpayPaymentId: response.razorpay_payment_id || `pay_${Date.now()}`,
                  razorpaySignature: response.razorpay_signature
                });
                displayOrderSuccess(res.orderId, recipientName, recipientPhone, "PAID (RAZORPAY)");
              } catch (verifyErr) {
                showToast("Payment verification failed: " + verifyErr.message, "danger");
              }
            },
            prefill: {
              name: recipientName,
              email: recipientEmail,
              contact: recipientPhone
            },
            theme: { color: "#111111" }
          };

          try {
            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", function (failResp) {
              showToast("Payment unsuccessful: " + failResp.error.description, "danger");
            });
            rzp.open();
            submitBtn.disabled = false;
            submitBtn.innerText = "AUTHORIZE & PLACE ORDER ↗";
            return;
          } catch (rzpOpenErr) {
            console.warn("Direct Razorpay popup note, verifying test mode order directly.");
          }
        }

        // Developer test mode fallback verification
        await API.orders.verifyPayment({
          orderId: res.orderId,
          razorpayPaymentId: `pay_test_${Date.now()}`
        });
        displayOrderSuccess(res.orderId, recipientName, recipientPhone, "PAID (TEST MODE)");
      } else {
        // Cash on delivery
        displayOrderSuccess(res.orderId, recipientName, recipientPhone, "CASH ON DELIVERY (PENDING UPON RECEIPT)");
      }
    } catch (err) {
      console.error("Order completion failed:", err);
      showToast(err.message || "Failed to place order. Please try again.", "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "AUTHORIZE & PLACE ORDER ↗";
    }
  }

  function displayOrderSuccess(orderId, name, phone, paymentStatusText) {
    document.getElementById("confirmedOrderId").innerText = `#${orderId}`;
    document.getElementById("confirmedRecipient").innerText = `${name} • ${phone}`;
    
    // Switch screens
    document.getElementById("checkoutScreenForm").style.display = "none";
    document.getElementById("checkoutScreenSuccess").style.display = "block";

    Store.clearCart();
    SoundEngine.success();
    showToast(`Order #${orderId} Confirmed!`, "success");
  }

  // --------------------------------------------------------------------------
  // WISHLIST DRAWER
  // --------------------------------------------------------------------------
  const wishlistDrawer = document.getElementById("wishlistDrawer");
  const wishlistBackdrop = document.getElementById("wishlistBackdrop");
  const wishlistItemsList = document.getElementById("wishlistItemsList");

  function openWishlist() {
    renderWishlist();
    wishlistDrawer.classList.add("active");
    wishlistBackdrop.classList.add("active");
    document.body.style.overflow = "hidden";
    SoundEngine.click();
  }

  function closeWishlist() {
    wishlistDrawer.classList.remove("active");
    wishlistBackdrop.classList.remove("active");
    document.body.style.overflow = "";
    SoundEngine.click();
  }

  function renderWishlist() {
    const count = Store.getWishlistCount();
    wishlistBadgeCounts.forEach(el => {
      el.innerText = count;
      el.style.display = count > 0 ? "flex" : "none";
    });

    if (!wishlistItemsList) return;
    const items = Store.getWishlistItems();

    if (items.length === 0) {
      wishlistItemsList.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <p class="font-mono" style="color: var(--off-white-muted); margin-bottom: 1rem;">NO SAVED PIECES YET</p>
          <p style="font-size: 0.85rem; color: var(--off-white-muted); margin-bottom: 1.5rem;">Click the heart icon on any piece to save it for later.</p>
          <button class="btn btn-outline-lime btn-sm" onclick="window.closeWishlist(); window.location.hash='#shop';">BROWSE CATALOG</button>
        </div>
      `;
      return;
    }

    wishlistItemsList.innerHTML = items.map(p => `
      <div class="cart-item-row">
        <img class="cart-item-img" src="${optimizeImageUrl(p.images[0], 140, 75)}" alt="${p.title}" loading="lazy" decoding="async" width="60" height="75" />
        <div class="cart-item-details">
          <div>
            <h4 class="cart-item-title">${p.title}</h4>
            <div class="cart-item-meta">${p.gsm} • ${p.subtitle}</div>
            <div class="cart-item-price">${Store.formatPrice(p.price)}</div>
          </div>
          <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
            <button class="btn btn-lime btn-sm" onclick="window.openPdp('${p.id}'); window.closeWishlist();">VIEW / BUY</button>
            <button class="btn btn-outline btn-sm" onclick="window.toggleWishlist('${p.id}')">REMOVE</button>
          </div>
        </div>
      </div>
    `).join("");
  }

  window.closeWishlist = closeWishlist;
  window.openPdp = openPdp;
  window.toggleWishlist = (id) => {
    Store.toggleWishlist(id);
    renderWishlist();
    renderHomeProducts();
    renderShopCatalog();
  };

  // --------------------------------------------------------------------------
  // LIVE SEARCH OVERLAY
  // --------------------------------------------------------------------------
  function openSearch() {
    searchModal.classList.add("active");
    const input = document.getElementById("searchModalInput");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 100);
    }
    renderSearchResults("");
    document.body.style.overflow = "hidden";
    SoundEngine.click();
  }

  function closeSearch() {
    searchModal.classList.remove("active");
    document.body.style.overflow = "";
    SoundEngine.click();
  }

  function renderSearchResults(query) {
    const resultsContainer = document.getElementById("searchResultsGrid");
    if (!resultsContainer) return;

    const q = (query || "").toLowerCase().trim();
    const matches = q ? PRODUCTS.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q) || 
      p.type.toLowerCase().includes(q) ||
      p.gsm.toLowerCase().includes(q)
    ) : PRODUCTS.slice(0, 4); // show trending if empty

    if (matches.length === 0) {
      resultsContainer.innerHTML = `<p class="font-mono" style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">NO PIECES MATCHING "${query.toUpperCase()}"</p>`;
      return;
    }

    resultsContainer.innerHTML = matches.map(p => `
      <div style="display:flex; gap:1rem; padding:0.75rem; background:var(--bg-subtle); border:1px solid var(--border-light); border-radius:var(--radius-xs); cursor:pointer;" onclick="window.openPdp('${p.id}'); window.closeSearch();">
        <img src="${optimizeImageUrl(p.images[0], 120, 75)}" alt="${p.title}" loading="lazy" decoding="async" width="60" height="75" style="width:60px; height:75px; object-fit:cover; border-radius:2px;" />
        <div>
          <h4 style="font-size:0.85rem; font-family:var(--font-heading); color:var(--text-primary); margin-bottom:3px;">${p.title}</h4>
          <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-secondary);">${p.gsm}</span>
          <div style="font-weight:700; color:var(--text-primary); margin-top:4px;">${Store.formatPrice(p.price)}</div>
        </div>
      </div>
    `).join("");
  }

  window.closeSearch = closeSearch;

  // --------------------------------------------------------------------------
  // DROP COUNTDOWN TIMER
  // --------------------------------------------------------------------------
  function initDropCountdown() {
    const timerEl = document.getElementById("dropTimer");
    if (!timerEl) return;

    // Target date: 4 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 4);
    targetDate.setHours(targetDate.getHours() + 18);

    function update() {
      const now = new Date();
      const diff = targetDate - now;

      if (diff <= 0) {
        timerEl.innerText = "DROP LIVE NOW";
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      timerEl.innerText = `${String(days).padStart(2, '0')}D ${String(hours).padStart(2, '0')}H ${String(mins).padStart(2, '0')}M ${String(secs).padStart(2, '0')}S`;
    }

    update();
    setInterval(update, 1000);
  }

  // --------------------------------------------------------------------------
  // SPA ROUTING / SECTION VIEWS
  // --------------------------------------------------------------------------
  function navigateTo(hash) {
    const cleanHash = (hash || "#home").replace("#", "");
    const views = ["homeView", "shopView", "lookbookView", "storyView", "accountView", "adminView"];
    
    let targetView = "homeView";
    if (cleanHash === "shop" || cleanHash === "tops" || cleanHash === "bottoms" || cleanHash === "accessories") {
      targetView = "shopView";
      if (cleanHash !== "shop") {
        currentCategory = cleanHash;
      } else {
        currentCategory = "all";
      }
    } else if (cleanHash === "faq") {
      targetView = "homeView";
      setTimeout(() => {
        const faqEl = document.getElementById("faqSection");
        if (faqEl) {
          faqEl.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
    } else if (cleanHash === "lookbook") {
      targetView = "lookbookView";
    } else if (cleanHash === "story" || cleanHash === "our-story") {
      targetView = "storyView";
    } else if (cleanHash === "account" || cleanHash === "orders") {
      targetView = "accountView";
    } else if (cleanHash === "admin") {
      if (!API.auth.isAdmin()) {
        showToast("Access Denied: Administrative privileges required.", "warning");
        window.location.hash = "#account";
        return;
      }
      targetView = "adminView";
    }

    // Toggle view visibility
    views.forEach(v => {
      const el = document.getElementById(v);
      if (el) el.style.display = v === targetView ? "block" : "none";
    });

    // Update Nav Link Active States
    document.querySelectorAll(".nav-link").forEach(link => {
      const href = link.getAttribute("href") || "";
      link.classList.toggle("active", href.includes(cleanHash) || (cleanHash === "" && href === "#home"));
    });

    if (targetView === "shopView") {
      // Sync filter tabs
      document.querySelectorAll(".filter-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.category === currentCategory);
      });
      renderShopCatalog();
    } else if (targetView === "accountView") {
      loadCustomerAccount();
    } else if (targetView === "adminView") {
      loadAdminDashboard();
    }

    if (cleanHash !== "faq") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  window.navigateTo = navigateTo;
  window.addEventListener("hashchange", () => navigateTo(window.location.hash));

  // --------------------------------------------------------------------------
  // FAQ ACCORDION ENGINE (Monochrome Black Section)
  // --------------------------------------------------------------------------
  document.addEventListener("click", function(e) {
    const faqBtn = e.target.closest(".faq-question");
    if (!faqBtn) return;

    const item = faqBtn.closest(".faq-item");
    if (!item) return;

    const isExpanded = item.classList.contains("active");
    const accordionList = item.closest(".faq-accordion-list");

    // Close sibling FAQ items for clean single-accordion focus
    if (accordionList) {
      accordionList.querySelectorAll(".faq-item").forEach(other => {
        if (other !== item) {
          other.classList.remove("active");
          const otherBtn = other.querySelector(".faq-question");
          if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
        }
      });
    }

    item.classList.toggle("active", !isExpanded);
    faqBtn.setAttribute("aria-expanded", String(!isExpanded));
    if (typeof SoundEngine !== "undefined" && SoundEngine.click) {
      SoundEngine.click();
    }
  });

  // --------------------------------------------------------------------------
  // GLOBAL EVENT LISTENERS & DELEGATION
  // --------------------------------------------------------------------------
  
  // Delegated Clicks on Product Cards
  document.addEventListener("click", (e) => {
    // 1. Wishlist toggle
    const wishlistBtn = e.target.closest("[data-action='toggle-wishlist']");
    if (wishlistBtn) {
      e.stopPropagation();
      const card = wishlistBtn.closest(".product-card");
      if (card) {
        const id = card.dataset.productId;
        const added = Store.toggleWishlist(id);
        wishlistBtn.classList.toggle("active", added);
        showToast(added ? "Piece added to wishlist" : "Piece removed from wishlist");
        renderWishlist();
      }
      return;
    }

    // 2. Quick Add size button on card
    const quickSizeBtn = e.target.closest(".quick-size-chip");
    if (quickSizeBtn) {
      e.stopPropagation();
      const id = quickSizeBtn.dataset.productId;
      const size = quickSizeBtn.dataset.size;
      const product = getProductById(id);
      if (product) {
        Store.addToCart(product, size, product.colors[0].hex, 1);
        showToast(`Added ${product.title} [${size}] to bag`, "success");
        openCart();
      }
      return;
    }

    // 3. Open PDP Modal from card
    const pdpTrigger = e.target.closest("[data-action='open-pdp']");
    if (pdpTrigger) {
      const card = pdpTrigger.closest(".product-card");
      if (card) openPdp(card.dataset.productId);
      return;
    }

    // 4. Cart Qty controls
    const qtyBtn = e.target.closest(".qty-btn");
    if (qtyBtn) {
      const id = qtyBtn.dataset.id;
      const action = qtyBtn.dataset.action;
      const item = Store.getCart().find(i => i.id === id);
      if (item) {
        const newQty = action === "qty-plus" ? item.quantity + 1 : item.quantity - 1;
        Store.updateQuantity(id, newQty);
        renderCart();
      }
      return;
    }

    // 5. Cart Remove item
    const removeBtn = e.target.closest("[data-action='remove-item']");
    if (removeBtn) {
      Store.removeFromCart(removeBtn.dataset.id);
      renderCart();
      showToast("Item removed from bag");
      return;
    }
  });

  // PDP Modal interactions
  if (pdpModal) {
    pdpModal.addEventListener("click", (e) => {
      // Close button
      if (e.target.closest(".pdp-close-btn") || e.target === pdpModal) {
        closePdp();
        return;
      }

      // Thumbnail click
      const thumb = e.target.closest(".pdp-thumb-img");
      if (thumb && activePdpProduct) {
        const idx = parseInt(thumb.dataset.index, 10);
        document.getElementById("pdpMainImg").src = optimizeImageUrl(activePdpProduct.images[idx], 1000, 80);
        document.querySelectorAll(".pdp-thumb-img").forEach((t, i) => t.classList.toggle("active", i === idx));
        SoundEngine.click();
        return;
      }

      // Color swatch click
      const swatch = e.target.closest(".pdp-color-swatch");
      if (swatch) {
        activePdpColorHex = swatch.dataset.hex;
        document.getElementById("pdpSelectedColorName").innerText = swatch.dataset.name;
        document.querySelectorAll(".pdp-color-swatch").forEach(s => s.classList.toggle("active", s === swatch));
        SoundEngine.click();
        return;
      }

      // Size button click
      const sizeBtn = e.target.closest(".pdp-size-btn");
      if (sizeBtn && !sizeBtn.disabled) {
        activePdpSize = sizeBtn.dataset.size;
        renderPdpSizes();
        SoundEngine.click();
        return;
      }

      // Accordion toggle
      const accHeader = e.target.closest(".pdp-accordion-header");
      if (accHeader) {
        const item = accHeader.closest(".pdp-accordion-item");
        item.classList.toggle("active");
        SoundEngine.click();
        return;
      }
    });

    // PDP Add to Cart Button
    const pdpAddBtn = document.getElementById("pdpAddToCartBtn");
    if (pdpAddBtn) {
      pdpAddBtn.addEventListener("click", () => {
        if (!activePdpProduct || !activePdpSize) return;
        Store.addToCart(activePdpProduct, activePdpSize, activePdpColorHex, 1);
        showToast(`Added ${activePdpProduct.title} [${activePdpSize}] to bag!`, "success");
        closePdp();
        openCart();
      });
    }

    // Pincode Estimator
    const checkPincodeBtn = document.getElementById("pdpCheckPincodeBtn");
    if (checkPincodeBtn) {
      checkPincodeBtn.addEventListener("click", () => {
        const input = document.getElementById("pdpPincodeInput");
        const res = document.getElementById("pdpPincodeResult");
        const val = (input.value || "").trim();
        if (val.length === 6 && /^\d+$/.test(val)) {
          res.innerHTML = `✓ Delivery available to <strong>${val}</strong> in 2-3 business days. Free shipping eligible.`;
          res.classList.add("valid");
          res.style.display = "block";
          SoundEngine.success();
        } else {
          res.innerHTML = `<span style="color:var(--danger)">Please enter a valid 6-digit Indian PIN code.</span>`;
          res.classList.remove("valid");
          res.style.display = "block";
          SoundEngine.click();
        }
      });
    }
  }

  // Size Guide Modal Triggers
  document.addEventListener("click", (e) => {
    if (e.target.closest(".pdp-size-guide-trigger")) {
      sizeGuideModal.classList.add("active");
      SoundEngine.click();
    }
    if (e.target.closest("#sizeGuideCloseBtn") || e.target === sizeGuideModal) {
      sizeGuideModal.classList.remove("active");
      SoundEngine.click();
    }
  });

  // Cart Promo Code submission
  const applyPromoBtn = document.getElementById("cartApplyPromoBtn");
  if (applyPromoBtn) {
    applyPromoBtn.addEventListener("click", () => {
      const codeInput = document.getElementById("cartPromoInput");
      const res = Store.applyPromo(codeInput.value);
      showToast(res.message, res.success ? "success" : "warning");
      renderCart();
    });
  }

  // Header Trigger Buttons
  document.getElementById("openCartBtn")?.addEventListener("click", openCart);
  document.getElementById("cartCloseBtn")?.addEventListener("click", closeCart);
  cartBackdrop?.addEventListener("click", closeCart);

  document.getElementById("openWishlistBtn")?.addEventListener("click", openWishlist);
  document.getElementById("wishlistCloseBtn")?.addEventListener("click", closeWishlist);
  wishlistBackdrop?.addEventListener("click", closeWishlist);

  document.getElementById("openSearchBtn")?.addEventListener("click", openSearch);
  document.getElementById("searchCloseBtn")?.addEventListener("click", closeSearch);
  searchModal?.addEventListener("click", (e) => {
    if (e.target === searchModal) closeSearch();
  });

  document.getElementById("searchModalInput")?.addEventListener("input", debounce((e) => {
    renderSearchResults(e.target.value);
  }, 160));

  // Checkout Triggers
  document.getElementById("cartCheckoutBtn")?.addEventListener("click", openCheckout);
  document.getElementById("checkoutCloseBtn")?.addEventListener("click", () => {
    checkoutModal.classList.remove("active");
    document.body.style.overflow = "";
    SoundEngine.click();
  });
  checkoutModal?.addEventListener("click", (e) => {
    if (e.target === checkoutModal) {
      checkoutModal.classList.remove("active");
      document.body.style.overflow = "";
    }
  });
  document.getElementById("checkoutSubmitBtn")?.addEventListener("click", completeOrder);
  document.getElementById("orderContinueShoppingBtn")?.addEventListener("click", () => {
    checkoutModal.classList.remove("active");
    document.body.style.overflow = "";
    navigateTo("#shop");
  });

  // Payment Tabs
  document.querySelectorAll(".payment-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".payment-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      SoundEngine.click();
    });
  });

  // Filter Tabs on Shop Page
  document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentCategory = tab.dataset.category || "all";
      renderShopCatalog();
      SoundEngine.click();
    });
  });

  // Sort Select on Shop Page
  document.getElementById("shopSortSelect")?.addEventListener("change", (e) => {
    currentSort = e.target.value;
    renderShopCatalog();
    SoundEngine.click();
  });

  // Mobile Menu
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileMenuCloseBtn = document.getElementById("mobileMenuCloseBtn");
  const mobileMenuBackdrop = document.getElementById("mobileMenuBackdrop");

  function toggleMobileMenu(open) {
    mobileMenuDrawer.classList.toggle("active", open);
    mobileMenuBackdrop.classList.toggle("active", open);
    document.body.style.overflow = open ? "hidden" : "";
    SoundEngine.click();
  }

  mobileMenuBtn?.addEventListener("click", () => toggleMobileMenu(true));
  mobileMenuCloseBtn?.addEventListener("click", () => toggleMobileMenu(false));
  mobileMenuBackdrop?.addEventListener("click", () => toggleMobileMenu(false));

  document.querySelectorAll(".mobile-nav-link").forEach(link => {
    link.addEventListener("click", () => toggleMobileMenu(false));
  });

  // Currency select change
  currencySelects.forEach(select => {
    select.value = Store.getCurrency();
    select.addEventListener("change", (e) => {
      Store.setCurrency(e.target.value);
      renderHomeProducts();
      renderShopCatalog();
      renderCart();
      showToast(`Currency changed to ${e.target.value}`);
    });
  });

  // Sound Engine toggle
  soundToggleBtns.forEach(btn => {
    btn.classList.toggle("sound-on", SoundEngine.isEnabled());
    btn.addEventListener("click", () => {
      const enabled = SoundEngine.toggle();
      btn.classList.toggle("sound-on", enabled);
      btn.querySelector(".sound-status-text").innerText = enabled ? "SOUND: ON" : "SOUND: OFF";
      showToast(enabled ? "Tactile sound effects enabled" : "Sound effects muted");
    });
  });

  // Newsletter Radar Form
  const radarForm = document.getElementById("dropRadarForm");
  if (radarForm) {
    radarForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("radarEmailInput");
      if (input && input.value) {
        showToast("VIP Drop Access Granted. Watch your inbox.", "success");
        input.value = "";
        SoundEngine.success();
      }
    });
  }

  // ==========================================================================
  // AUTHENTICATION & SESSION UI CONTROLLER
  // ==========================================================================
  function updateAuthUI() {
    const user = API.auth.getCurrentUser();
    const isLoggedIn = API.auth.isLoggedIn();
    const isAdmin = API.auth.isAdmin();

    const userDot = document.getElementById("headerUserDot");
    if (userDot) userDot.style.display = isLoggedIn ? "block" : "none";

    const navAccountLink = document.getElementById("navAccountLink");
    if (navAccountLink) {
      navAccountLink.innerText = (isLoggedIn && user && user.name)
        ? user.name.split(" ")[0].toUpperCase()
        : "ACCOUNT";
    }

    const navAdminLink = document.getElementById("navAdminLink");
    if (navAdminLink) {
      navAdminLink.style.display = isAdmin ? "inline-block" : "none";
    }

    const mobileAdminLink = document.getElementById("mobileAdminLink");
    if (mobileAdminLink) {
      mobileAdminLink.style.display = isAdmin ? "block" : "none";
    }
  }

  // Auth Modal
  const authModal = document.getElementById("authModal");
  const authCloseBtn = document.getElementById("authCloseBtn");
  const tabBtnLogin = document.getElementById("tabBtnLogin");
  const tabBtnRegister = document.getElementById("tabBtnRegister");
  const authFormLogin = document.getElementById("authFormLogin");
  const authFormRegister = document.getElementById("authFormRegister");
  const authFormForgot = document.getElementById("authFormForgot");

  function openAuthModal(defaultTab = "login") {
    if (!authModal) return;
    switchAuthTab(defaultTab);
    authModal.classList.add("open");
    document.body.style.overflow = "hidden";
    SoundEngine.click();
  }

  function closeAuthModal() {
    if (!authModal) return;
    authModal.classList.remove("open");
    document.body.style.overflow = "";
    SoundEngine.click();
  }

  function switchAuthTab(tab) {
    if (tab === "login") {
      tabBtnLogin.classList.add("active");
      tabBtnRegister.classList.remove("active");
      authFormLogin.style.display = "block";
      authFormRegister.style.display = "none";
      authFormForgot.style.display = "none";
    } else if (tab === "register") {
      tabBtnRegister.classList.add("active");
      tabBtnLogin.classList.remove("active");
      authFormLogin.style.display = "none";
      authFormRegister.style.display = "block";
      authFormForgot.style.display = "none";
    } else if (tab === "forgot") {
      authFormLogin.style.display = "none";
      authFormRegister.style.display = "none";
      authFormForgot.style.display = "block";
    }
  }

  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;

  document.getElementById("openAccountBtn")?.addEventListener("click", () => {
    if (API.auth.isLoggedIn()) {
      navigateTo("#account");
    } else {
      openAuthModal("login");
    }
  });

  authCloseBtn?.addEventListener("click", closeAuthModal);
  authModal?.addEventListener("click", (e) => {
    if (e.target === authModal) closeAuthModal();
  });

  tabBtnLogin?.addEventListener("click", () => switchAuthTab("login"));
  tabBtnRegister?.addEventListener("click", () => switchAuthTab("register"));
  document.getElementById("authForgotPwdLink")?.addEventListener("click", () => switchAuthTab("forgot"));
  document.getElementById("forgotBackToLoginLink")?.addEventListener("click", () => switchAuthTab("login"));

  // Login Submit
  authFormLogin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("loginSubmitBtn");

    btn.disabled = true;
    btn.innerText = "VERIFYING CREDENTIALS...";

    try {
      const res = await API.auth.login(email, password);
      showToast(`Welcome back, ${res.user.name.split(" ")[0]}!`, "success");
      updateAuthUI();
      closeAuthModal();

      // Sync local cart with account
      const cartItems = Store.getCart();
      if (cartItems.length > 0) {
        API.cart.sync(cartItems).catch(() => {});
      }

      if (res.user.role === "admin") {
        navigateTo("#admin");
      } else {
        navigateTo("#account");
      }
    } catch (err) {
      showToast(err.message || "Invalid email or password.", "danger");
    } finally {
      btn.disabled = false;
      btn.innerText = "SIGN IN TO ARCHIVE ↗";
    }
  });

  // Register Submit
  authFormRegister?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("regName").value;
    const email = document.getElementById("regEmail").value;
    const phone = document.getElementById("regPhone").value;
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;
    const btn = document.getElementById("regSubmitBtn");

    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "warning");
      return;
    }

    btn.disabled = true;
    btn.innerText = "CREATING ACCOUNT...";

    try {
      const res = await API.auth.register({ name, email, phone, password, confirmPassword });
      showToast(`Welcome to 590 LABS, ${res.user.name.split(" ")[0]}!`, "success");
      updateAuthUI();
      closeAuthModal();
      navigateTo("#account");
    } catch (err) {
      showToast(err.message || "Registration failed.", "danger");
    } finally {
      btn.disabled = false;
      btn.innerText = "JOIN 590 LABS ARCHIVE ↗";
    }
  });

  // Forgot Password Submit
  authFormForgot?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("forgotEmail").value;
    const btn = document.getElementById("forgotSubmitBtn");

    btn.disabled = true;
    btn.innerText = "SENDING LINK...";

    try {
      const res = await API.auth.forgotPassword(email);
      showToast(res.message || "Password recovery initiated.", "success");
      if (res.resetToken) {
        showToast(`[DEV MODE] Token: ${res.resetToken.substring(0, 8)}...`, "info");
      }
      switchAuthTab("login");
    } catch (err) {
      showToast(err.message || "Could not process request.", "danger");
    } finally {
      btn.disabled = false;
      btn.innerText = "SEND RECOVERY LINK ↗";
    }
  });

  // Google Login Trigger
  document.getElementById("googleLoginBtn")?.addEventListener("click", () => {
    showToast("Authenticating via Google Sign-In...", "info");
    // Standard OAuth token request
    API.auth.google("demo_google_token").then(res => {
      showToast("Signed in with Google!", "success");
      updateAuthUI();
      closeAuthModal();
      navigateTo("#account");
    }).catch(err => {
      showToast("Google OAuth: Set GOOGLE_CLIENT_ID in .env for production.", "info");
    });
  });

  // ==========================================================================
  // CUSTOMER ACCOUNT DASHBOARD CONTROLLER
  // ==========================================================================
  async function loadCustomerAccount() {
    const loggedOutEl = document.getElementById("accountLoggedOutState");
    const loggedInEl = document.getElementById("accountLoggedInState");

    if (!API.auth.isLoggedIn()) {
      if (loggedOutEl) loggedOutEl.style.display = "block";
      if (loggedInEl) loggedInEl.style.display = "none";
      return;
    }

    if (loggedOutEl) loggedOutEl.style.display = "none";
    if (loggedInEl) loggedInEl.style.display = "block";

    try {
      const res = await API.auth.me();
      if (!res.authenticated || !res.user) {
        API.auth.logout();
        updateAuthUI();
        loadCustomerAccount();
        return;
      }

      const user = res.user;
      document.getElementById("accUserName").innerText = user.name ? user.name.toUpperCase() : "MY ACCOUNT";
      document.getElementById("accUserMeta").innerText = `${user.email} · Collector Member`;
      document.getElementById("accUserRoleBadge").innerText = user.role === "admin" ? "SUPERADMIN" : "VERIFIED COLLECTOR";

      // Render Orders
      await renderAccountOrders();
      // Render Addresses
      renderAccountAddresses(user.addresses || []);
    } catch (err) {
      console.error("Account load error:", err);
    }
  }

  async function renderAccountOrders() {
    const listEl = document.getElementById("accOrdersList");
    if (!listEl) return;

    try {
      const res = await API.orders.myOrders();
      const orders = res.orders || [];

      if (orders.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 3.5rem 1rem; background: #FFFFFF; border: 1px solid var(--border-light); border-radius: var(--radius-xs);">
            <p class="font-mono" style="color: var(--text-secondary); margin-bottom: 1rem;">NO ORDERS FOUND IN YOUR ARCHIVE.</p>
            <button class="btn btn-lime btn-sm" onclick="window.navigateTo('shop')">DISCOVER LATEST DROPS ↗</button>
          </div>
        `;
        return;
      }

      listEl.innerHTML = orders.map(order => {
        const canCancel = ["confirmed", "packing"].includes(order.fulfillmentStatus);
        const statusClass = `badge-status-${order.fulfillmentStatus}`;
        const items = order.items || [];

        return `
          <div class="order-card" data-order-id="${order.id}">
            <div class="order-card-header">
              <div>
                <span class="font-mono" style="font-size:0.75rem; color:var(--text-secondary);">ORDER REFERENCE:</span>
                <strong style="font-size:1.05rem; margin-left:0.4rem; color:var(--text-primary);">${order.id}</strong>
                <span style="margin-left:0.75rem; font-size:0.75rem; color:var(--text-muted);">${new Date(order.createdAt).toLocaleDateString("en-IN", { day:'numeric', month:'short', year:'numeric' })}</span>
              </div>
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <span class="badge-status ${statusClass}">${order.fulfillmentStatus.replace(/_/g, " ")}</span>
                <span style="font-weight:700; font-size:1.05rem;">${Store.formatPrice(order.totalAmount)}</span>
              </div>
            </div>

            <!-- Items in order -->
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:1rem; margin-bottom:1.25rem;">
              ${items.map(item => `
                <div style="display:flex; gap:0.75rem; align-items:center; background:var(--bg-subtle); padding:0.6rem; border-radius:var(--radius-xs);">
                  <img src="${item.image_url || 'assets/logo-black.png'}" alt="${item.product_title}" style="width:45px; height:55px; object-fit:cover; border-radius:2px;" />
                  <div>
                    <h5 style="font-size:0.8rem; margin-bottom:2px;">${item.product_title}</h5>
                    <div class="font-mono" style="font-size:0.68rem; color:var(--text-secondary);">SIZE: ${item.size} · QTY: ${item.quantity} · ${Store.formatPrice(item.price)}</div>
                  </div>
                </div>
              `).join("")}
            </div>

            <!-- Tracking Timeline -->
            <div class="tracking-timeline">
              <div class="timeline-step completed">
                <div class="timeline-step-dot">✓</div>
                <div class="timeline-step-label">ORDER PLACED</div>
              </div>
              <div class="timeline-step ${["confirmed", "packing", "in_transit", "out_for_delivery", "delivered"].includes(order.fulfillmentStatus) ? "completed" : ""}">
                <div class="timeline-step-dot">✓</div>
                <div class="timeline-step-label">CONFIRMED</div>
              </div>
              <div class="timeline-step ${["packing", "in_transit", "out_for_delivery", "delivered"].includes(order.fulfillmentStatus) ? "completed" : ""}">
                <div class="timeline-step-dot">✓</div>
                <div class="timeline-step-label">PACKING</div>
              </div>
              <div class="timeline-step ${["in_transit", "out_for_delivery", "delivered"].includes(order.fulfillmentStatus) ? "completed" : ""}">
                <div class="timeline-step-dot">✓</div>
                <div class="timeline-step-label">IN TRANSIT</div>
              </div>
              <div class="timeline-step ${order.fulfillmentStatus === "delivered" ? "completed" : ""}">
                <div class="timeline-step-dot">✓</div>
                <div class="timeline-step-label">DELIVERED</div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border-light); font-size:0.78rem; font-family:var(--font-mono);">
              <span style="color:var(--text-secondary);">
                ${order.trackingNumber ? `CARRIER: ${order.carrier || 'Express'} · TRK: ${order.trackingNumber}` : `PAYMENT: ${order.paymentMethod.toUpperCase()} (${order.paymentStatus.toUpperCase()})`}
              </span>
              ${canCancel ? `
                <button class="btn btn-outline btn-sm cancel-order-btn" data-order-id="${order.id}">
                  CANCEL ORDER
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join("");

      // Wire cancel buttons with inline two-step confirmation (no intrusive browser confirm)
      document.querySelectorAll(".cancel-order-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.orderId;
          if (!btn.dataset.confirming) {
            btn.dataset.confirming = "true";
            const originalText = btn.textContent;
            btn.textContent = "CONFIRM CANCEL? (TAP AGAIN)";
            btn.style.borderColor = "var(--danger)";
            btn.style.color = "var(--danger)";
            showToast(`Tap 'CONFIRM CANCEL' again to confirm cancelling order #${id}.`, "info");
            setTimeout(() => {
              if (btn && btn.dataset.confirming) {
                delete btn.dataset.confirming;
                btn.textContent = originalText;
                btn.style.borderColor = "";
                btn.style.color = "";
              }
            }, 4000);
            return;
          }

          delete btn.dataset.confirming;
          btn.disabled = true;
          btn.textContent = "CANCELLING...";
          try {
            await API.orders.cancel(id);
            showToast(`Order #${id} has been cancelled. Inventory restored.`, "success");
            renderAccountOrders();
          } catch (err) {
            showToast(err.message || "Could not cancel order.", "danger");
            btn.disabled = false;
            btn.textContent = "CANCEL ORDER";
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<p style="color:var(--danger); padding:2rem;">Failed to load order history: ${err.message}</p>`;
    }
  }

  function renderAccountAddresses(addresses) {
    const grid = document.getElementById("accAddressesGrid");
    if (!grid) return;

    if (addresses.length === 0) {
      grid.innerHTML = `<p class="font-mono" style="grid-column:1/-1; color:var(--text-secondary); padding:1.5rem; background:#FFFFFF; border:1px solid var(--border-light);">No saved addresses yet.</p>`;
      return;
    }

    grid.innerHTML = addresses.map(addr => `
      <div style="background:#FFFFFF; border:1px solid var(--border-light); padding:1.25rem; border-radius:var(--radius-xs); position:relative;">
        ${addr.is_default ? `<span class="badge badge-lime font-mono" style="margin-bottom:0.5rem; display:inline-block;">DEFAULT</span>` : ''}
        <h4 style="font-size:0.95rem; margin-bottom:0.25rem;">${addr.full_name}</h4>
        <p style="font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">
          ${addr.address_line1}<br />
          ${addr.address_line2 ? addr.address_line2 + '<br />' : ''}
          ${addr.city}, ${addr.state} — <strong>${addr.pincode}</strong><br />
          Phone: ${addr.phone}
        </p>
        <button class="btn btn-outline btn-sm delete-address-btn" data-id="${addr.id}" style="margin-top:1rem; font-size:0.7rem; padding:0.3rem 0.6rem;">DELETE</button>
      </div>
    `).join("");

    document.querySelectorAll(".delete-address-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          await API.auth.deleteAddress(btn.dataset.id);
          showToast("Address deleted.", "info");
          loadCustomerAccount();
        } catch (e) {
          showToast("Could not delete address.", "danger");
        }
      });
    });
  }

  // Account Tabs switching
  document.querySelectorAll("#accountView .dash-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#accountView .dash-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.tab;
      document.getElementById("accTabOrdersContent").style.display = target === "accOrders" ? "block" : "none";
      document.getElementById("accTabAddressesContent").style.display = target === "accAddresses" ? "block" : "none";
      document.getElementById("accTabSecurityContent").style.display = target === "accSecurity" ? "block" : "none";
    });
  });

  // Toggle Add Address Form
  document.getElementById("toggleAddAddressBtn")?.addEventListener("click", () => {
    const wrap = document.getElementById("newAddressFormWrap");
    wrap.style.display = wrap.style.display === "none" ? "block" : "none";
  });
  document.getElementById("cancelAddressBtn")?.addEventListener("click", () => {
    document.getElementById("newAddressFormWrap").style.display = "none";
  });

  document.getElementById("saveAddressBtn")?.addEventListener("click", async () => {
    const fullName = document.getElementById("addrFullName").value;
    const phone = document.getElementById("addrPhone").value;
    const addressLine1 = document.getElementById("addrLine1").value;
    const addressLine2 = document.getElementById("addrLine2").value;
    const city = document.getElementById("addrCity").value;
    const state = document.getElementById("addrState").value;
    const pincode = document.getElementById("addrPincode").value;
    const isDefault = document.getElementById("addrIsDefault").checked;

    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      showToast("Please fill all required address fields.", "warning");
      return;
    }

    try {
      await API.auth.addAddress({ fullName, phone, addressLine1, addressLine2, city, state, pincode, isDefault });
      showToast("Address saved.", "success");
      document.getElementById("newAddressFormWrap").style.display = "none";
      loadCustomerAccount();
    } catch (err) {
      showToast(err.message, "danger");
    }
  });

  // Security password change
  document.getElementById("secChangePasswordBtn")?.addEventListener("click", async () => {
    const currentPassword = document.getElementById("secCurrentPassword").value;
    const newPassword = document.getElementById("secNewPassword").value;
    const confirmPassword = document.getElementById("secConfirmPassword").value;

    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match.", "warning");
      return;
    }

    try {
      await API.auth.changePassword(currentPassword, newPassword);
      showToast("Password updated successfully.", "success");
      document.getElementById("secCurrentPassword").value = "";
      document.getElementById("secNewPassword").value = "";
      document.getElementById("secConfirmPassword").value = "";
    } catch (err) {
      showToast(err.message, "danger");
    }
  });

  // Account Sign Out
  document.getElementById("accSignOutBtn")?.addEventListener("click", async () => {
    await API.auth.logout();
    updateAuthUI();
    showToast("Signed out safely.", "info");
    navigateTo("#home");
  });

  // ==========================================================================
  // ADMINISTRATOR DASHBOARD CONTROLLER
  // ==========================================================================
  async function loadAdminDashboard() {
    if (!API.auth.isAdmin()) {
      navigateTo("#account");
      return;
    }

    try {
      // Load Stats
      const statsRes = await API.admin.getStats();
      if (statsRes.success) {
        const s = statsRes.stats;
        document.getElementById("admStatRevenue").innerText = Store.formatPrice(s.totalRevenue);
        document.getElementById("admStatOrders").innerText = s.totalOrders;
        document.getElementById("admStatPending").innerText = s.pendingFulfillment;
        document.getElementById("admStatCustomers").innerText = s.totalCustomers;

        // Low stock alerts
        document.getElementById("admLowStockBadge").innerText = `${s.lowStockCount} ALERTS`;
        const lowBody = document.getElementById("admLowStockTableBody");
        if (lowBody) {
          lowBody.innerHTML = s.lowStockVariants.map(v => `
            <tr>
              <td><code>${v.sku}</code></td>
              <td><strong>${v.product_title}</strong></td>
              <td><span class="badge">${v.size}</span></td>
              <td>${v.color_code.toUpperCase()}</td>
              <td><strong style="color:var(--danger);">${v.stock_quantity} LEFT</strong></td>
              <td>
                <div style="display:flex; gap:0.3rem; align-items:center;">
                  <input type="number" value="${v.stock_quantity}" id="stockInput_${v.id}" style="width:60px; padding:0.2rem; border:1px solid var(--border-medium);" />
                  <button class="btn btn-outline btn-sm quick-stock-btn" data-prod-id="${v.product_id}" data-var-id="${v.id}" style="padding:0.2rem 0.5rem; font-size:0.7rem;">SET</button>
                </div>
              </td>
            </tr>
          `).join("");

          document.querySelectorAll(".quick-stock-btn").forEach(b => {
            b.addEventListener("click", async () => {
              const varId = b.dataset.varId;
              const prodId = b.dataset.prodId;
              const qty = document.getElementById(`stockInput_${varId}`).value;
              try {
                await API.admin.updateStock(prodId, varId, qty);
                showToast("Stock quantity updated.", "success");
                loadAdminDashboard();
              } catch (e) {
                showToast("Failed to update stock.", "danger");
              }
            });
          });
        }

        // Recent orders
        const recBody = document.getElementById("admRecentOrdersTableBody");
        if (recBody) {
          recBody.innerHTML = s.recentOrders.map(o => `
            <tr>
              <td><strong>${o.id}</strong></td>
              <td>${o.customer_name}<br /><span style="color:var(--text-secondary); font-size:0.75rem;">${o.customer_email}</span></td>
              <td>${new Date(o.created_at).toLocaleDateString()}</td>
              <td>${Store.formatPrice(o.total_amount)}</td>
              <td><span class="badge-status badge-status-${o.payment_status}">${o.payment_status}</span></td>
              <td><span class="badge-status badge-status-${o.fulfillment_status}">${o.fulfillment_status}</span></td>
            </tr>
          `).join("");
        }
      }

      // Load Orders tab
      renderAdminOrders();
      // Load Products tab
      renderAdminProducts();
      // Load Coupons tab
      renderAdminCoupons();
      // Load Customers tab
      renderAdminCustomers();
    } catch (err) {
      console.error("Admin dashboard error:", err);
    }
  }

  async function renderAdminOrders() {
    const body = document.getElementById("admFullOrdersTableBody");
    if (!body) return;

    try {
      const search = document.getElementById("admOrderSearchInput")?.value || "";
      const status = document.getElementById("admOrderFilterStatus")?.value || "all";
      const res = await API.admin.getOrders({ search, fulfillmentStatus: status });

      body.innerHTML = res.orders.map(o => `
        <tr>
          <td><strong>${o.id}</strong></td>
          <td>${o.customer_name}<br /><span class="font-mono" style="font-size:0.7rem; color:var(--text-secondary);">${o.customer_email}</span></td>
          <td class="font-mono" style="font-size:0.75rem;">${o.customer_phone}</td>
          <td>${o.items.length} piece(s)</td>
          <td><strong>${Store.formatPrice(o.total_amount)}</strong></td>
          <td><span class="badge-status badge-status-${o.payment_status}">${o.payment_status.toUpperCase()}</span></td>
          <td>
            <select class="form-input adm-status-select" data-order-id="${o.id}" style="padding:0.25rem 0.5rem; font-size:0.78rem;">
              <option value="confirmed" ${o.fulfillment_status === "confirmed" ? "selected" : ""}>CONFIRMED</option>
              <option value="packing" ${o.fulfillment_status === "packing" ? "selected" : ""}>PACKING</option>
              <option value="in_transit" ${o.fulfillment_status === "in_transit" ? "selected" : ""}>IN TRANSIT</option>
              <option value="out_for_delivery" ${o.fulfillment_status === "out_for_delivery" ? "selected" : ""}>OUT FOR DELIVERY</option>
              <option value="delivered" ${o.fulfillment_status === "delivered" ? "selected" : ""}>DELIVERED</option>
              <option value="cancelled" ${o.fulfillment_status === "cancelled" ? "selected" : ""}>CANCELLED</option>
            </select>
          </td>
          <td>
            <button class="btn btn-outline btn-sm adm-order-details-btn" data-order-id="${o.id}" style="padding:0.25rem 0.5rem; font-size:0.72rem;">DETAILS</button>
          </td>
        </tr>
      `).join("");

      document.querySelectorAll(".adm-status-select").forEach(sel => {
        sel.addEventListener("change", async () => {
          const id = sel.dataset.orderId;
          const fulfillmentStatus = sel.value;
          try {
            await API.admin.updateOrderStatus(id, { fulfillmentStatus });
            showToast(`Order #${id} status updated to ${fulfillmentStatus.toUpperCase()}`, "success");
          } catch (err) {
            showToast(err.message, "danger");
          }
        });
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function renderAdminProducts() {
    const body = document.getElementById("admProductsTableBody");
    if (!body) return;

    try {
      const res = await API.admin.getProducts();
      body.innerHTML = res.products.map(p => `
        <tr>
          <td>
            <div style="display:flex; gap:0.75rem; align-items:center;">
              <img src="${p.images[0] || 'assets/logo-black.png'}" style="width:40px; height:50px; object-fit:cover; border-radius:2px;" />
              <div>
                <strong>${p.title}</strong>
                <div class="font-mono" style="font-size:0.7rem; color:var(--text-secondary);">${p.id}</div>
              </div>
            </div>
          </td>
          <td><span class="badge">${p.category.toUpperCase()}</span></td>
          <td><strong>${Store.formatPrice(p.price)}</strong></td>
          <td>
            <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
              ${p.variants.map(v => `
                <span class="font-mono" style="background:var(--bg-subtle); padding:0.15rem 0.4rem; border-radius:2px; font-size:0.68rem; border:1px solid var(--border-light);">
                  ${v.size} (${v.color_code}): <strong>${v.stock_quantity}</strong>
                </span>
              `).join("")}
            </div>
          </td>
          <td><strong>${p.totalStock} UNITS</strong></td>
        </tr>
      `).join("");
    } catch (e) {
      console.error(e);
    }
  }

  async function renderAdminCoupons() {
    const body = document.getElementById("admCouponsTableBody");
    if (!body) return;

    try {
      const res = await API.admin.getCoupons();
      body.innerHTML = res.coupons.map(c => `
        <tr>
          <td><code>${c.code}</code></td>
          <td><strong>${c.discount_type === 'percent' ? c.discount_value + '%' : '₹' + c.discount_value} OFF</strong></td>
          <td>${Store.formatPrice(c.min_order_value)}</td>
          <td>${c.max_discount ? Store.formatPrice(c.max_discount) : 'None'}</td>
          <td>${c.times_used} times</td>
          <td><span class="badge badge-lime">ACTIVE</span></td>
        </tr>
      `).join("");
    } catch (e) {
      console.error(e);
    }
  }

  async function renderAdminCustomers() {
    const body = document.getElementById("admCustomersTableBody");
    if (!body) return;

    try {
      const res = await API.admin.getCustomers();
      body.innerHTML = res.customers.map(c => `
        <tr>
          <td>#${c.id}</td>
          <td><strong>${c.name}</strong></td>
          <td>${c.email}</td>
          <td>${c.phone || 'N/A'}</td>
          <td>${c.orderCount} orders</td>
          <td><strong>${Store.formatPrice(c.totalSpent)}</strong></td>
          <td>${new Date(c.created_at).toLocaleDateString()}</td>
        </tr>
      `).join("");
    } catch (e) {
      console.error(e);
    }
  }

  // Admin Tab Switching
  document.querySelectorAll("#adminView .dash-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#adminView .dash-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.tab;
      document.getElementById("admOverviewContent").style.display = target === "admOverview" ? "block" : "none";
      document.getElementById("admOrdersContent").style.display = target === "admOrders" ? "block" : "none";
      document.getElementById("admProductsContent").style.display = target === "admProducts" ? "block" : "none";
      document.getElementById("admCouponsContent").style.display = target === "admCoupons" ? "block" : "none";
      document.getElementById("admCustomersContent").style.display = target === "admCustomers" ? "block" : "none";
    });
  });

  // Admin Search & Filter
  document.getElementById("admOrderSearchInput")?.addEventListener("input", debounce(renderAdminOrders, 180));
  document.getElementById("admOrderFilterStatus")?.addEventListener("change", renderAdminOrders);

  // Admin Add Product Toggle & Submit
  document.getElementById("toggleAddProductBtn")?.addEventListener("click", () => {
    const wrap = document.getElementById("newProductFormWrap");
    wrap.style.display = wrap.style.display === "none" ? "block" : "none";
  });
  document.getElementById("cancelNewProductBtn")?.addEventListener("click", () => {
    document.getElementById("newProductFormWrap").style.display = "none";
  });
  document.getElementById("submitNewProductBtn")?.addEventListener("click", async () => {
    const id = document.getElementById("npId").value;
    const title = document.getElementById("npTitle").value;
    const category = document.getElementById("npCategory").value;
    const price = document.getElementById("npPrice").value;
    const gsm = document.getElementById("npGsm").value;
    const stockQuantity = document.getElementById("npStock").value;
    const image = document.getElementById("npImage").value;
    const description = document.getElementById("npDesc").value;

    if (!id || !title || !price) {
      showToast("ID, Title, and Price are required.", "warning");
      return;
    }

    try {
      await API.admin.createProduct({
        id, title, category, price, gsm, stockQuantity,
        images: image ? [image] : ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80"],
        description
      });
      showToast("New product drop published!", "success");
      document.getElementById("newProductFormWrap").style.display = "none";
      renderAdminProducts();
    } catch (err) {
      showToast(err.message, "danger");
    }
  });

  // Admin Add Coupon Toggle & Submit
  document.getElementById("toggleAddCouponBtn")?.addEventListener("click", () => {
    const wrap = document.getElementById("newCouponFormWrap");
    wrap.style.display = wrap.style.display === "none" ? "block" : "none";
  });
  document.getElementById("cancelNewCouponBtn")?.addEventListener("click", () => {
    document.getElementById("newCouponFormWrap").style.display = "none";
  });
  document.getElementById("submitNewCouponBtn")?.addEventListener("click", async () => {
    const code = document.getElementById("ncCode").value;
    const discountType = document.getElementById("ncType").value;
    const discountValue = document.getElementById("ncValue").value;
    const minOrderValue = document.getElementById("ncMinOrder").value;
    const maxDiscount = document.getElementById("ncMaxDiscount").value;
    const usageLimit = document.getElementById("ncLimit").value;

    if (!code || !discountValue) {
      showToast("Coupon Code and Value are required.", "warning");
      return;
    }

    try {
      await API.admin.createCoupon({ code, discountType, discountValue, minOrderValue, maxDiscount, usageLimit });
      showToast(`Coupon ${code.toUpperCase()} created!`, "success");
      document.getElementById("newCouponFormWrap").style.display = "none";
      renderAdminCoupons();
    } catch (err) {
      showToast(err.message, "danger");
    }
  });

  // ==========================================================================
  // PDP VERIFIED REVIEWS CONTROLLER
  // ==========================================================================
  async function loadPdpReviews(productId) {
    const container = document.getElementById("pdpReviewsList");
    if (!container) return;

    try {
      const res = await API.reviews.list(productId);
      const reviews = res.reviews || [];

      document.getElementById("pdpAvgRating").innerText = res.avgRating || "4.9";
      document.getElementById("pdpReviewCountHeader").innerText = `(${res.totalReviews} reviews)`;

      if (reviews.length === 0) {
        container.innerHTML = `
          <p style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-secondary); padding:1rem 0;">
            No customer reviews yet. Be the first collector to review this drop!
          </p>
        `;
        return;
      }

      container.innerHTML = reviews.map(r => `
        <div class="review-item">
          <div class="review-header">
            <div>
              <strong style="font-size:0.85rem;">${r.author_name}</strong>
              ${r.verified_purchase ? `<span class="badge badge-lime font-mono" style="font-size:0.6rem; margin-left:0.4rem;">VERIFIED BUYER</span>` : ''}
            </div>
            <span class="review-rating-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          </div>
          ${r.title ? `<div style="font-weight:700; font-size:0.85rem; margin-bottom:0.25rem;">${r.title}</div>` : ''}
          <p style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">${r.comment}</p>
        </div>
      `).join("");
    } catch (e) {
      container.innerHTML = `<p style="color:var(--text-secondary); font-size:0.75rem;">Could not load reviews.</p>`;
    }
  }

  // Toggle Write Review Form
  document.getElementById("toggleWriteReviewBtn")?.addEventListener("click", () => {
    const form = document.getElementById("writeReviewForm");
    form.style.display = form.style.display === "none" ? "block" : "none";
  });
  document.getElementById("cancelReviewBtn")?.addEventListener("click", () => {
    document.getElementById("writeReviewForm").style.display = "none";
  });

  document.getElementById("writeReviewForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activePdpProduct) return;

    const authorName = document.getElementById("revAuthorName").value;
    const rating = document.getElementById("revRating").value;
    const title = document.getElementById("revTitle").value;
    const comment = document.getElementById("revComment").value;

    try {
      await API.reviews.submit({
        productId: activePdpProduct.id,
        authorName,
        rating,
        title,
        comment
      });
      showToast("Thank you for your feedback! Review published.", "success");
      document.getElementById("writeReviewForm").reset();
      document.getElementById("writeReviewForm").style.display = "none";
      loadPdpReviews(activePdpProduct.id);
    } catch (err) {
      showToast(err.message, "danger");
    }
  });

  // Hook PDP review loader into openPdp
  const originalOpenPdp = openPdp;
  openPdp = function(productId) {
    originalOpenPdp(productId);
    loadPdpReviews(productId);
  };
  window.openPdp = openPdp;

  // Global Escape Key Handler to dismiss open modals/drawers cleanly without stuck overlays
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.keyCode === 27) {
      if (authModal && authModal.classList.contains("open")) {
        closeAuthModal();
      } else if (pdpModal && pdpModal.classList.contains("active")) {
        closePdp();
      } else if (sizeGuideModal && sizeGuideModal.classList.contains("active")) {
        sizeGuideModal.classList.remove("active");
        SoundEngine.click();
      } else if (checkoutModal && checkoutModal.classList.contains("active")) {
        checkoutModal.classList.remove("active");
        document.body.style.overflow = "";
        SoundEngine.click();
      } else if (searchModal && searchModal.classList.contains("active")) {
        closeSearch();
      } else if (cartDrawer && cartDrawer.classList.contains("active")) {
        closeCart();
      } else if (wishlistDrawer && wishlistDrawer.classList.contains("active")) {
        closeWishlist();
      } else if (mobileMenuDrawer && mobileMenuDrawer.classList.contains("active")) {
        toggleMobileMenu(false);
      }
    }
  });

  // ==========================================================================
  // INITIAL APPLICATION BOOT & LIVE DATABASE SYNC
  // ==========================================================================
  async function syncProductsFromBackend() {
    try {
      if (window.API && window.API.products) {
        const data = await window.API.products.list({ limit: 100 });
        if (data && Array.isArray(data.products)) {
          if (typeof window.setProducts === 'function') {
            window.setProducts(data.products);
          }
          renderHomeProducts();
          renderShopCatalog();
          renderWishlist();
        }
      }
    } catch (e) {
      console.warn('[590] Storefront using offline catalog snapshot:', e.message);
    }
  }

  initDropCountdown();
  renderHomeProducts();
  renderWishlist();
  renderCart();
  updateAuthUI();
  navigateTo(window.location.hash || "#home");
  syncProductsFromBackend();

  // Re-sync when switching back to storefront tab
  window.addEventListener("focus", () => {
    syncProductsFromBackend();
  });
});

