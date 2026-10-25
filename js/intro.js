/**
 * 590 LABS® — Cinematic Introduction Controller
 * Handles first-visit detection, new-tab store launch with popup-blocker fallback,
 * and direct route preservation.
 */

(function() {
  "use strict";

  const STORAGE_KEY = "590labs_store_entered_v1";

  // Cache elements
  let introEl = null;
  let enterBtn = null;
  let noticeSuccess = null;
  let noticeBlocked = null;
  let fallbackBtn = null;
  let continueHereLink = null;

  /**
   * Safe localStorage helper (handles privacy mode or storage restrictions)
   */
  function isStoreEntered() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch (e) {
      return false;
    }
  }

  function setStoreEntered() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (e) {
      // Graceful fallback for strict privacy browsers
    }
  }

  /**
   * Determine if the user arrived via a direct link / deep route
   * (e.g. #shop, #tops, #account, #admin, or URL query parameters)
   */
  function hasDirectRoute() {
    const hash = window.location.hash || "";
    const search = window.location.search || "";

    // If explicitly asking for intro via ?intro=true or #intro, do not bypass
    if (search.includes("intro=true") || hash === "#intro") {
      return false;
    }

    // Explicit bypass query
    if (search.includes("entered=true")) {
      return true;
    }

    // Direct section hashes
    if (hash && hash !== "#home" && hash !== "#intro" && hash !== "#") {
      return true;
    }

    return false;
  }

  /**
   * Dismiss the intro screen and enter the storefront in the current tab
   */
  function dismissIntroCurrentTab() {
    setStoreEntered();
    if (!introEl) introEl = document.getElementById("cinematicIntro");
    if (!introEl) return;

    introEl.classList.add("fading-out");
    setTimeout(() => {
      introEl.style.display = "none";
      document.documentElement.classList.add("store-entered");
      document.body.classList.add("store-entered");
    }, 750);
  }

  /**
   * Build the target storefront URL preserving original destination
   */
  function getStorefrontUrl() {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const hash = window.location.hash || "#home";
    // Append entered=true to ensure the new tab opens directly into the shopping catalog
    return `${origin}${pathname}?entered=true${hash}`;
  }

  /**
   * Handle "ENTER STORE ↗" button click
   */
  function handleEnterStoreClick(e) {
    if (e) e.preventDefault();

    if (enterBtn && enterBtn.dataset.busy === "true") {
      return;
    }
    if (enterBtn) enterBtn.dataset.busy = "true";

    const targetUrl = getStorefrontUrl();
    let newTab = null;

    try {
      // Directly invoke window.open within trusted user gesture to maximize popup acceptance
      newTab = window.open(targetUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      newTab = null;
    }

    // Check whether the new tab opened or was blocked
    const isOpened = Boolean(newTab && !newTab.closed && typeof newTab.closed !== "undefined");

    if (isOpened) {
      // Successfully opened in a new tab!
      setStoreEntered();

      // Show confirmation message on the original tab
      if (noticeBlocked) noticeBlocked.classList.remove("active");
      if (noticeSuccess) noticeSuccess.classList.add("active");

      if (enterBtn) {
        enterBtn.innerHTML = `<span>ENTER STORE AGAIN ↗</span>`;
        enterBtn.dataset.busy = "false";
      }
    } else {
      // Browser blocked the popup window or user has strict popup blocker enabled
      setStoreEntered();

      if (noticeSuccess) noticeSuccess.classList.remove("active");
      if (noticeBlocked) noticeBlocked.classList.add("active");

      if (enterBtn) {
        enterBtn.style.display = "none";
      }
    }
  }

  /**
   * Initialize Cinematic Intro
   */
  function init() {
    introEl = document.getElementById("cinematicIntro");
    if (!introEl) return;

    enterBtn = document.getElementById("cinematicEnterBtn");
    noticeSuccess = document.getElementById("introNoticeSuccess");
    noticeBlocked = document.getElementById("introNoticeBlocked");
    fallbackBtn = document.getElementById("introFallbackBtn");
    continueHereLink = document.getElementById("introContinueHereLink");

    // Check if returning visitor or arriving through direct link
    if (isStoreEntered() || hasDirectRoute()) {
      document.documentElement.classList.add("store-entered");
      document.body.classList.add("store-entered");
      introEl.style.display = "none";
      return;
    }

    // First-time visitor: Ensure intro is visible and active
    introEl.style.display = "flex";

    // Bind event listeners
    if (enterBtn) {
      enterBtn.addEventListener("click", handleEnterStoreClick);
    }

    if (fallbackBtn) {
      fallbackBtn.addEventListener("click", dismissIntroCurrentTab);
    }

    if (continueHereLink) {
      continueHereLink.addEventListener("click", dismissIntroCurrentTab);
    }
  }

  // Developer / Testing helper: allow resetting intro anytime in console via window.resetIntro()
  window.resetIntro = function() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log("[590 LABS] Intro reset successfully. Reloading...");
      window.location.href = window.location.origin + window.location.pathname + "?intro=true";
    } catch (e) {
      window.location.reload();
    }
  };

  // Expose dismiss method
  window.dismissIntro = dismissIntroCurrentTab;

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
