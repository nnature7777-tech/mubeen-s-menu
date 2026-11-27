// =========================================================================
// MUBEEN'S - CUSTOMER EDITORIAL APP & QR ORDERING CONTROLLER
// Creator: n.nature7777@gmail.com
// =========================================================================

import { getFallbackIllustration } from "./menu-data.js";
import {
  bootstrapDatabase,
  getConnectionMode,
  subscribeMenu,
  subscribeSettings,
  subscribeOrders,
  placeCustomerOrder,
  triggerWaiterCall
} from "./db-service.js";

const TOTAL_TABLES = 15;
let lockedTable = null;
let allMenu = [];
let currentDailyPin = "7860";
let selectedCategory = "All";
let searchQuery = "";
let cart = [];
let waiterCooldown = false;

function resolveLockedTable() {
  const params = new URLSearchParams(window.location.search);
  const t = parseInt(params.get("table"), 10);
  if (t >= 1 && t <= TOTAL_TABLES) {
    lockedTable = t;
    sessionStorage.setItem("mubeens_locked_table", String(t));
    return t;
  }
  const saved = parseInt(sessionStorage.getItem("mubeens_locked_table"), 10);
  if (saved >= 1 && saved <= TOTAL_TABLES) {
    lockedTable = saved;
    return saved;
  }
  return null;
}

function showToast(msg) {
  const el = document.getElementById("toastBanner");
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    el.style.display = "none";
  }, 2600);
}

function switchTab(tabKey) {
  const homeSec = document.getElementById("viewHome");
  const cartSec = document.getElementById("viewCart");
  const trackSec = document.getElementById("viewTrack");

  homeSec.classList.add("hidden");
  cartSec.classList.add("hidden");
  trackSec.classList.add("hidden");

  if (tabKey === "viewCart") {
    cartSec.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (tabKey === "viewTrack") {
    trackSec.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    homeSec.classList.remove("hidden");
    if (tabKey === "viewMenuJump") {
      document.getElementById("fullMenuContainer").scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  document.querySelectorAll(".dock-tab[data-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabKey);
  });
}

// Circular Category Icons matching the reference screenshot
function renderCircularCategories() {
  const catMeta = [
    {
      key: "All",
      label: "All Menu",
      svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 7v3M10 7h4"/></svg>`
    },
    {
      key: "Nehari & Paya",
      label: "Nehari & Paya",
      svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 11h16a1 1 0 0 1 1 1v1a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7v-1a1 1 0 0 1 1-1z"/><path d="M8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3"/></svg>`
    },
    {
      key: "Kababs & Tikka",
      label: "Kababs",
      svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><line x1="4" y1="20" x2="20" y2="4"/><circle cx="9" cy="15" r="2.5"/><circle cx="14" cy="10" r="2.5"/></svg>`
    },
    {
      key: "Biryani, Korma & Handi",
      label: "Biryani & Handi",
      svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 10h12l1 7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3l1-7z"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/></svg>`
    },
    {
      key: "Breads, Dessert & Drinks",
      label: "Breads & Sweet",
      svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8"/><circle cx="10" cy="10" r="1"/><circle cx="14" cy="13" r="1"/><circle cx="11" cy="15" r="1"/></svg>`
    }
  ];

  const strip = document.getElementById("circleCategoryStrip");
  strip.innerHTML = catMeta
    .map(
      (c) => `
      <button class="circle-cat-item ${selectedCategory === c.key ? "active" : ""}" data-cat="${c.key}">
        <div class="circle-cat-orb">${c.svg}</div>
        <span class="circle-cat-label">${c.label}</span>
      </button>
    `
    )
    .join("");

  strip.querySelectorAll("[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCategory = btn.dataset.cat;
      renderCircularCategories();
      renderMenuSections();
    });
  });
}

function getCardImage(item) {
  if (item.image && item.image.trim().startsWith("http")) {
    return item.image.trim();
  }
  return getFallbackIllustration(item.category);
}

// Horizontal "Popular Dishes" Carousel (Matches Reference Screenshot)
function renderPopularCarousel() {
  const wrap = document.getElementById("popularSectionWrap");
  const scroller = document.getElementById("popularScroller");

  if (searchQuery || selectedCategory !== "All") {
    wrap.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");
  const popularItems = allMenu.filter((m) => m.popular && m.available);

  scroller.innerHTML = popularItems
    .map((item) => {
      const imgUrl = getCardImage(item);
      const fallback = getFallbackIllustration(item.category);
      const startPrice = item.halfPrice !== null ? item.halfPrice : item.singlePrice;
      const portionTag = item.halfPrice !== null ? ` (${item.halfLabel || "Half"})` : "";

      return `
        <article class="food-card">
          <div class="food-photo-box">
            <img src="${imgUrl}" alt="${item.name}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'" />
            ${item.badge ? `<span class="food-pill-badge">${item.badge}</span>` : ""}
          </div>
          <div class="food-info">
            <h3 class="food-title">${item.name}</h3>
            <p class="food-sub">${item.subtitle || ""}</p>
            <div class="food-rating-row">
              <span class="star-gold">★</span>
              <span>${item.rating || "4.8"}</span>
              <span style="color:var(--ink-muted); font-weight:500;">(${item.reviews || "500+"})</span>
            </div>
            <div class="food-price-footer">
              <div>
                <div class="price-tag-main">₹${startPrice}</div>
                <div style="font-size:0.65rem; color:var(--ink-muted);">${portionTag}</div>
              </div>
              <button class="glass-btn glass-plus-circle" data-quickadd="${item.id}" title="Add ${item.name}">+</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  scroller.querySelectorAll("[data-quickadd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = allMenu.find((m) => m.id === btn.dataset.quickadd);
      if (!item) return;
      if (item.halfPrice !== null) {
        addToCart(item.id, item.name, item.halfLabel || "Half", Number(item.halfPrice));
      } else {
        addToCart(item.id, item.name, item.halfLabel || "1 Pc", Number(item.singlePrice));
      }
    });
  });
}

// Full Menu Grid with Real Dish Photography & Half/Full Selectors
function renderMenuSections() {
  renderPopularCarousel();

  const container = document.getElementById("fullMenuContainer");
  const filtered = allMenu.filter((item) => {
    const matchCat = selectedCategory === "All" || item.category === selectedCategory;
    const matchSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(searchQuery));
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="editorial-panel" style="text-align:center; color:var(--ink-muted);">No dishes found matching "${searchQuery}".</div>`;
    return;
  }

  const grouped = {};
  filtered.forEach((item) => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  container.innerHTML = Object.entries(grouped)
    .map(([cat, items]) => {
      const cards = items
        .map((item) => {
          const imgUrl = getCardImage(item);
          const fallback = getFallbackIllustration(item.category);

          let buttonsHtml = "";
          if (!item.available) {
            buttonsHtml = `<span style="color:#B92B27; font-size:0.8rem; font-weight:800;">Sold Out Today</span>`;
          } else if (item.halfPrice !== null && item.fullPrice !== null) {
            buttonsHtml = `
              <button class="glass-btn glass-btn-outline glass-btn-sm" style="flex:1;" data-add="${item.id}" data-portion="half">
                <span>+ ${item.halfLabel || "Half"}</span>
                <strong>₹${item.halfPrice}</strong>
              </button>
              <button class="glass-btn glass-btn-sm" style="flex:1;" data-add="${item.id}" data-portion="full">
                <span>+ ${item.fullLabel || "Full"}</span>
                <strong>₹${item.fullPrice}</strong>
              </button>
            `;
          } else {
            buttonsHtml = `
              <button class="glass-btn glass-btn-sm" style="width:100%;" data-add="${item.id}" data-portion="single">
                <span>+ Add (${item.halfLabel || "1 Pc"})</span>
                <strong>₹${item.singlePrice}</strong>
              </button>
            `;
          }

          return `
            <article class="food-card ${item.available ? "" : "sold-out"}">
              <div class="food-photo-box">
                <img src="${imgUrl}" alt="${item.name}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'" />
                ${item.badge ? `<span class="food-pill-badge">${item.badge}</span>` : ""}
              </div>
              <div class="food-info">
                <h3 class="food-title">${item.name}</h3>
                <p class="food-sub">${item.subtitle || ""}</p>
                <div class="food-rating-row">
                  <span class="star-gold">★</span>
                  <span>${item.rating || "4.8"}</span>
                  <span style="color:var(--ink-muted); font-weight:500;">(${item.reviews || "400+"})</span>
                </div>
                <div class="food-price-footer" style="gap:8px;">
                  ${buttonsHtml}
                </div>
              </div>
            </article>
          `;
        })
        .join("");

      return `
        <div class="sec-row-header" style="margin-top:20px;">
          <h2 class="sec-row-title">${cat}</h2>
          <span style="font-size:0.76rem; color:var(--ink-muted); font-weight:700;">${items.length} items</span>
        </div>
        <div class="menu-cards-grid">${cards}</div>
      `;
    })
    .join("");

  container.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = allMenu.find((m) => m.id === btn.dataset.add);
      if (!item) return;
      const pType = btn.dataset.portion;
      let price = item.singlePrice;
      let label = item.halfLabel || "1 Pc";
      if (pType === "half") {
        price = item.halfPrice;
        label = item.halfLabel || "Half";
      } else if (pType === "full") {
        price = item.fullPrice;
        label = item.fullLabel || "Full";
      }
      addToCart(item.id, item.name, label, Number(price));
    });
  });
}

function addToCart(id, name, portionLabel, price) {
  const key = `${id}_${portionLabel}`;
  const existing = cart.find((c) => c.key === key);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ key, id, name, portionLabel, price, qty: 1 });
  }
  updateCartUI();
  showToast(`Added ${name} (${portionLabel})`);
}

function updateCartUI() {
  const totalQty = cart.reduce((sum, c) => sum + c.qty, 0);
  const dockBadge = document.getElementById("cartCountBadge");
  const topBadge = document.getElementById("topCartCount");

  if (totalQty > 0) {
    dockBadge.textContent = totalQty;
    dockBadge.classList.remove("hidden");
    topBadge.textContent = totalQty;
    topBadge.classList.remove("hidden");
  } else {
    dockBadge.classList.add("hidden");
    topBadge.classList.add("hidden");
  }

  const listEl = document.getElementById("cartList");
  const summaryBox = document.getElementById("cartSummaryBox");

  if (cart.length === 0) {
    listEl.innerHTML = `<p style="text-align:center; color:var(--ink-muted); padding:18px 0;">Your cart is empty. Add Nehari, Kababs, or Biryani from the menu!</p>`;
    summaryBox.classList.add("hidden");
    return;
  }

  summaryBox.classList.remove("hidden");
  let grandTotal = 0;

  listEl.innerHTML = cart
    .map((c, idx) => {
      const sub = c.price * c.qty;
      grandTotal += sub;
      return `
        <div class="cart-row">
          <div>
            <div style="font-weight:800; color:var(--ink-dark);">${c.name}</div>
            <div style="font-size:0.78rem; color:var(--crimson-royal); font-weight:700;">${c.portionLabel} • ₹${c.price}</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="qty-stepper">
              <button class="qty-btn" data-dec="${idx}">−</button>
              <span style="font-weight:800; min-width:16px; text-align:center;">${c.qty}</span>
              <button class="qty-btn" data-inc="${idx}">+</button>
            </div>
            <div style="font-weight:800; min-width:52px; text-align:right; color:var(--ink-dark);">₹${sub}</div>
          </div>
        </div>
      `;
    })
    .join("");

  document.getElementById("cartTotalAmount").textContent = `₹${grandTotal}`;

  listEl.querySelectorAll("[data-dec]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.dec);
      cart[i].qty -= 1;
      if (cart[i].qty <= 0) cart.splice(i, 1);
      updateCartUI();
    });
  });

  listEl.querySelectorAll("[data-inc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.inc);
      cart[i].qty += 1;
      updateCartUI();
    });
  });
}

function renderLiveOrders(orders) {
  const myOrders = orders.filter((o) => Number(o.table) === Number(lockedTable) && !o.paid);
  const badge = document.getElementById("activeOrderBadge");
  if (myOrders.length > 0) {
    badge.textContent = myOrders.length;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  const container = document.getElementById("liveOrdersContainer");
  if (myOrders.length === 0) {
    container.innerHTML = `
      <div class="editorial-panel" style="text-align:center; color:var(--ink-muted);">
        No active orders for Table #${lockedTable} right now.
      </div>
    `;
    return;
  }

  const stages = [
    { num: 1, label: "1. Got It" },
    { num: 2, label: "2. Processing" },
    { num: 3, label: "3. Done" },
    { num: 4, label: "4. Payment Time" }
  ];

  container.innerHTML = myOrders
    .map((ord) => {
      const timeStr = new Date(ord.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const itemsSummary = (ord.items || [])
        .map((i) => `${i.qty}× ${i.name} (${i.portionLabel})`)
        .join(", ");

      const stepsHtml = stages
        .map((st) => {
          let cls = "stage-step";
          if (ord.stage > st.num) cls += " done";
          if (ord.stage === st.num) cls += " current";
          return `<div class="${cls}">${st.label}</div>`;
        })
        .join("");

      const payBanner =
        ord.stage === 4
          ? `<div style="margin-top:12px; padding:10px; border-radius:12px; background:rgba(200,146,62,0.22); border:1px solid var(--brass-gold); color:var(--ink-dark); font-size:0.84rem; font-weight:800; text-align:center;">
              ✦ Order Served! Please settle ₹${ord.total} at Mubeen's counter.
            </div>`
          : "";

      return `
        <div class="editorial-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-weight:800; color:var(--crimson-royal);">Table #${ord.table} • ${timeStr}</span>
            <span style="font-weight:800; color:var(--ink-dark);">₹${ord.total}</span>
          </div>
          <p style="font-size:0.86rem; color:var(--ink-body);">${itemsSummary}</p>
          ${ord.note ? `<p style="font-size:0.76rem; color:var(--ink-muted); margin-top:4px;">Note: ${ord.note}</p>` : ""}
          <div class="stage-tracker">${stepsHtml}</div>
          ${payBanner}
        </div>
      `;
    })
    .join("");
}

async function init() {
  await bootstrapDatabase();

  const mode = getConnectionMode();
  document.getElementById("syncModeLabel").textContent =
    mode === "firebase" ? "Firebase Live Sync" : "Local Preview Mode";

  const tableNum = resolveLockedTable();
  if (!tableNum) {
    document.getElementById("lockedTableLabel").textContent = "Scan QR";
    document.getElementById("customerWorkspace").classList.add("hidden");
    document.getElementById("noTableScreen").classList.remove("hidden");

    const grid = document.getElementById("demoTableGrid");
    for (let i = 1; i <= TOTAL_TABLES; i++) {
      const a = document.createElement("a");
      a.href = `?table=${i}`;
      a.className = "glass-btn glass-btn-sm";
      a.textContent = `T-${i}`;
      grid.appendChild(a);
    }
    return;
  }

  document.getElementById("lockedTableLabel").textContent = `Table #${tableNum}`;
  document.getElementById("cartTableTag").textContent = `Table #${tableNum} Locked`;

  // Navigation buttons
  document.querySelectorAll(".dock-tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.getElementById("topCartIconBtn").addEventListener("click", () => switchTab("viewCart"));
  document.getElementById("quickTrackIconBtn").addEventListener("click", () => switchTab("viewTrack"));
  document.getElementById("heroOrderBtn").addEventListener("click", () => switchTab("viewMenuJump"));
  document.getElementById("viewAllPopularBtn").addEventListener("click", () => switchTab("viewMenuJump"));
  document.getElementById("jumpBreadsBtn").addEventListener("click", () => {
    selectedCategory = "Breads, Dessert & Drinks";
    renderCircularCategories();
    renderMenuSections();
    switchTab("viewMenuJump");
  });

  // Search input
  document.getElementById("menuSearchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderMenuSections();
  });

  // Confirm Order with Daily Table PIN validation
  document.getElementById("confirmOrderBtn").addEventListener("click", async () => {
    const enteredPin = document.getElementById("dailyPinInput").value.trim();
    const errEl = document.getElementById("pinErrorMsg");

    if (!enteredPin || enteredPin !== String(currentDailyPin)) {
      errEl.textContent = "Wrong Daily Table PIN. Please check the tent card on your table.";
      errEl.classList.remove("hidden");
      return;
    }

    errEl.classList.add("hidden");
    const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
    const note = document.getElementById("orderNoteInput").value.trim();

    const btn = document.getElementById("confirmOrderBtn");
    btn.disabled = true;
    btn.textContent = "Sending Order...";

    try {
      await placeCustomerOrder({
        table: lockedTable,
        items: cart,
        total,
        note
      });
      cart = [];
      document.getElementById("dailyPinInput").value = "";
      document.getElementById("orderNoteInput").value = "";
      updateCartUI();
      showToast("Order Sent to Mubeen's Kitchen!");
      switchTab("viewTrack");
    } finally {
      btn.disabled = false;
      btn.textContent = "Confirm Order to Kitchen";
    }
  });

  // Call Waiter button
  document.getElementById("callWaiterBtn").addEventListener("click", async () => {
    if (waiterCooldown) {
      showToast("Waiter already notified for Table #" + lockedTable);
      return;
    }
    waiterCooldown = true;
    await triggerWaiterCall(lockedTable);
    showToast(`🔔 Waiter called to Table #${lockedTable}!`);
    setTimeout(() => {
      waiterCooldown = false;
    }, 15000);
  });

  subscribeMenu((menu) => {
    allMenu = menu;
    renderCircularCategories();
    renderMenuSections();
  });

  subscribeSettings((settings) => {
    if (settings && settings.dailyPin) {
      currentDailyPin = String(settings.dailyPin);
    }
  });

  subscribeOrders((orders) => {
    renderLiveOrders(orders);
  });

  updateCartUI();
}

init();
