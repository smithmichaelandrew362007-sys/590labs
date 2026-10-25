/**
 * 590 LABS® — Cart, Wishlist, Currency & Promo State Engine
 */

const Store = (function() {
  const CART_KEY = "590labs_cart_v1";
  const WISHLIST_KEY = "590labs_wishlist_v1";
  const CURRENCY_KEY = "590labs_currency_v1";
  const FREE_SHIPPING_THRESHOLD = 1999;

  let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  let wishlist = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
  let currentCurrency = localStorage.getItem(CURRENCY_KEY) || "INR";
  let appliedPromo = null; // { code: 'DROP10', discountType: 'percent', value: 10 }

  const RATES = {
    INR: { symbol: "₹", rate: 1, prefix: true },
    USD: { symbol: "$", rate: 0.012, prefix: true },
    EUR: { symbol: "€", rate: 0.011, prefix: true }
  };

  const PROMO_CODES = {
    "DROP10": { type: "percent", value: 10, label: "10% Off Limited Drop Launch" },
    "LABS590": { type: "fixed", value: 590, minOrder: 2500, label: "₹590 Off Orders Over ₹2,500" },
    "VIPMEMBER": { type: "percent", value: 15, label: "15% Off VIP Member Access" }
  };

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: getCartSummary() }));
  }

  function saveWishlist() {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
    window.dispatchEvent(new CustomEvent("wishlist-updated", { detail: wishlist }));
  }

  function formatPrice(inrAmount) {
    const config = RATES[currentCurrency] || RATES.INR;
    const converted = inrAmount * config.rate;
    if (currentCurrency === "INR") {
      return `₹${Math.round(converted).toLocaleString("en-IN")}`;
    } else {
      return `${config.symbol}${converted.toFixed(2)}`;
    }
  }

  function setCurrency(currency) {
    if (RATES[currency]) {
      currentCurrency = currency;
      localStorage.setItem(CURRENCY_KEY, currency);
      window.dispatchEvent(new CustomEvent("currency-changed", { detail: currency }));
      saveCart(); // triggers re-render with new currency
    }
  }

  function addToCart(product, size, colorHex, quantity = 1) {
    if (!product || !size) return false;
    
    // Find matching color name
    const colorObj = product.colors.find(c => c.hex === colorHex) || product.colors[0];
    const colorName = colorObj ? colorObj.name : "Default";

    const existingIndex = cart.findIndex(item => 
      item.productId === product.id && 
      item.size === size && 
      item.colorName === colorName
    );

    if (existingIndex > -1) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push({
        id: `${product.id}-${size}-${colorName}`.toLowerCase().replace(/\s+/g, '-'),
        productId: product.id,
        title: product.title,
        price: product.price,
        size: size,
        colorName: colorName,
        colorHex: colorObj ? colorObj.hex : "#0b0b0b",
        image: product.images[0],
        quantity: quantity,
        gsm: product.gsm
      });
    }

    saveCart();
    SoundEngine.addCart();
    return true;
  }

  function updateQuantity(cartItemId, newQty) {
    const itemIndex = cart.findIndex(item => item.id === cartItemId);
    if (itemIndex === -1) return;

    if (newQty <= 0) {
      cart.splice(itemIndex, 1);
    } else {
      cart[itemIndex].quantity = newQty;
    }
    saveCart();
    SoundEngine.click();
  }

  function removeFromCart(cartItemId) {
    cart = cart.filter(item => item.id !== cartItemId);
    saveCart();
    SoundEngine.click();
  }

  function clearCart() {
    cart = [];
    appliedPromo = null;
    saveCart();
  }

  function applyPromo(code) {
    const cleanCode = (code || "").trim().toUpperCase();
    const promo = PROMO_CODES[cleanCode];
    if (!promo) {
      return { success: false, message: "Invalid promo code. Try DROP10 or LABS590" };
    }

    const subtotal = getSubtotal();
    if (promo.minOrder && subtotal < promo.minOrder) {
      return { 
        success: false, 
        message: `Code requires minimum order of ${formatPrice(promo.minOrder)}` 
      };
    }

    appliedPromo = { code: cleanCode, ...promo };
    saveCart();
    SoundEngine.success();
    return { success: true, message: `Promo applied: ${promo.label}` };
  }

  function removePromo() {
    appliedPromo = null;
    saveCart();
  }

  function getSubtotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  function getCartSummary() {
    const subtotal = getSubtotal();
    let discount = 0;

    if (appliedPromo) {
      if (appliedPromo.type === "percent") {
        discount = Math.round((subtotal * appliedPromo.value) / 100);
      } else if (appliedPromo.type === "fixed") {
        discount = Math.min(appliedPromo.value, subtotal);
      }
    }

    const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
    const shipping = subtotal === 0 ? 0 : (isFreeShipping ? 0 : 149);
    const total = Math.max(0, subtotal - discount + shipping);
    const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const amountNeededForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
    const shippingProgressPercent = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

    return {
      items: cart,
      itemsCount,
      subtotal,
      discount,
      shipping,
      total,
      appliedPromo,
      isFreeShipping,
      amountNeededForFreeShipping,
      shippingProgressPercent,
      formattedSubtotal: formatPrice(subtotal),
      formattedDiscount: formatPrice(discount),
      formattedShipping: shipping === 0 ? "FREE" : formatPrice(shipping),
      formattedTotal: formatPrice(total),
      currency: currentCurrency
    };
  }

  // Wishlist Logic
  function toggleWishlist(productId) {
    const idx = wishlist.indexOf(productId);
    let added = false;
    if (idx > -1) {
      wishlist.splice(idx, 1);
      added = false;
    } else {
      wishlist.push(productId);
      added = true;
    }
    saveWishlist();
    SoundEngine.click();
    return added;
  }

  function isInWishlist(productId) {
    return wishlist.includes(productId);
  }

  function getWishlistItems() {
    return (window.PRODUCTS || PRODUCTS || []).filter(p => wishlist.includes(p.id));
  }

  return {
    getCart: () => cart,
    getCartSummary,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyPromo,
    removePromo,
    getCurrency: () => currentCurrency,
    setCurrency,
    formatPrice,
    toggleWishlist,
    isInWishlist,
    getWishlistItems,
    getWishlistCount: () => wishlist.length
  };
})();
