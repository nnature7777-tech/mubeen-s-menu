// =========================================================================
// MUBEEN'S - UNIFIED MANAGER & KITCHEN CONTROLLER
// Password: admin_3214 | Creator: n.nature7777@gmail.com
// =========================================================================

import { getFallbackIllustration } from "./menu-data.js";
import {
  bootstrapDatabase,
  getConnectionMode,
  subscribeMenu,
  subscribeSettings,
  subscribeOrders,
  subscribeWaiterCalls,
  updateOrderStage,
  acknowledgeWaiterCall,
  updateDailyPin,
  saveMenuItem,
  deleteMenuItem,
  resetDefaultMenu
} from "./db-service.js";

const MANAGER_PASSWORD = "admin_3214";
const TOTAL_TABLES = 15;

let knownOrderIds = new Set();
let knownCallIds = new Set();
let initialLoadComplete = false;
let allMenuItems = [];

function playRoyalChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.22, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.46);
    });
  } catch (e) {}
}

function triggerInstantPopup(emoji, title, tableText, detailText) {
  document.getElementById("alertEmoji").textContent = emoji;
  document.getElementById("alertTitle").textContent = title;
  document.getElementById("alertTableText").textContent = tableText;
  document.getElementById("alertDetailText").textContent = detailText;
  document.getElementById("instantAlertOverlay").classList.add("show");
  playRoyalChime();
}

function switchManagerTab(viewId) {
  ["mgrViewOrders", "mgrViewMenu", "mgrViewSettings"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", id !== viewId);
  });
  document.querySelectorAll(".dock-tab[data-mgrtab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mgrtab === viewId);
  });
}

function renderStatsAndOrders(orders) {
  if (initialLoadComplete) {
    orders.forEach((ord) => {
      if (!knownOrderIds.has(ord.id) && !ord.paid) {
        const summary = (ord.items || []).map((i) => `${i.qty}× ${i.name}`).join(", ");
        triggerInstantPopup(
          "🍲",
          "New Order Received!",
          `Table #${ord.table}`,
          `${summary} • Total: ₹${ord.total}`
        );
      }
    });
  }
  orders.forEach((o) => knownOrderIds.add(o.id));

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter((o) => o.createdAt >= startOfDay.getTime());

  const todaySale = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const doneCount = todayOrders.filter((o) => o.stage >= 3 || o.paid).length;
  const pendingOrders = orders.filter((o) => !o.paid && o.stage < 4);

  document.getElementById("statTodaySale").textContent = `₹${todaySale}`;
  document.getElementById("statOrdersDone").textContent = doneCount;
  document.getElementById("statOrdersPending").textContent = pendingOrders.length;

  const badge = document.getElementById("mgrPendingBadge");
  if (pendingOrders.length > 0) {
    badge.textContent = pendingOrders.length;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  const listEl = document.getElementById("mgrOrdersList");
  const activeOrders = orders.filter((o) => !o.paid);

  if (activeOrders.length === 0) {
    listEl.innerHTML = `<div class="editorial-panel" style="text-align:center; color:var(--ink-muted);">No active table orders right now.</div>`;
    return;
  }

  listEl.innerHTML = activeOrders
    .map((ord) => {
      const timeStr = new Date(ord.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const itemsHtml = (ord.items || [])
        .map((i) => `<li><strong>${i.qty}×</strong> ${i.name} (${i.portionLabel}) — ₹${i.price * i.qty}</li>`)
        .join("");

      return `
        <div class="editorial-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <div>
              <span class="table-status-chip">Table #${ord.table}</span>
              <span style="font-size:0.78rem; color:var(--ink-muted); margin-left:8px;">${timeStr}</span>
            </div>
            <div style="font-size:1.12rem; font-weight:800; color:var(--crimson-royal);">₹${ord.total}</div>
          </div>

          <ul style="list-style:none; font-size:0.88rem; color:var(--ink-dark); margin-bottom:10px;">
            ${itemsHtml}
          </ul>
          ${ord.note ? `<div style="font-size:0.8rem; color:var(--crimson-mid); font-weight:700; margin-bottom:10px;">📝 Note: ${ord.note}</div>` : ""}

          <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-top:10px;">
            <button class="glass-btn glass-btn-sm ${ord.stage === 1 ? "" : "glass-btn-outline"}" data-stage="1" data-oid="${ord.id}">
              1. Got It
            </button>
            <button class="glass-btn glass-btn-sm ${ord.stage === 2 ? "" : "glass-btn-outline"}" data-stage="2" data-oid="${ord.id}">
              2. Process
            </button>
            <button class="glass-btn glass-btn-sm ${ord.stage === 3 ? "" : "glass-btn-outline"}" data-stage="3" data-oid="${ord.id}">
              3. Done
            </button>
            <button class="glass-btn glass-btn-sm ${ord.stage === 4 ? "glass-btn-gold" : "glass-btn-outline"}" data-stage="4" data-oid="${ord.id}">
              4. Payment
            </button>
          </div>

          <div style="margin-top:10px; text-align:right;">
            <button class="glass-btn glass-btn-sm glass-btn-success" data-settle="${ord.id}">
              ✓ Mark Paid &amp; Close Bill
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-stage]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await updateOrderStage(btn.dataset.oid, Number(btn.dataset.stage), false);
    });
  });

  listEl.querySelectorAll("[data-settle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await updateOrderStage(btn.dataset.settle, 4, true);
    });
  });
}

function renderWaiterCalls(calls) {
  const unacked = calls.filter((c) => !c.acknowledged);

  if (initialLoadComplete) {
    unacked.forEach((c) => {
      if (!knownCallIds.has(c.id)) {
        triggerInstantPopup(
          "🔔",
          "Customer Calling Waiter!",
          `Table #${c.table}`,
          "Customer tapped 'Waiter' on their table screen."
        );
      }
    });
  }
  calls.forEach((c) => knownCallIds.add(c.id));

  const panel = document.getElementById("waiterCallsPanel");
  const listEl = document.getElementById("waiterCallsList");

  if (unacked.length === 0) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  listEl.innerHTML = unacked
    .map((c) => {
      const t = new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed rgba(110,27,20,0.2);">
          <span><strong>Table #${c.table}</strong> called a waiter (${t})</span>
          <button class="glass-btn glass-btn-sm glass-btn-gold" data-ack="${c.id}">Acknowledge</button>
        </div>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-ack]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await acknowledgeWaiterCall(btn.dataset.ack);
    });
  });
}

function renderManagerMenu(menu) {
  allMenuItems = menu;
  const container = document.getElementById("mgrMenuList");

  container.innerHTML = menu
    .map((item) => {
      const imgSrc =
        item.image && item.image.trim().startsWith("http")
          ? item.image.trim()
          : getFallbackIllustration(item.category);
      const fallback = getFallbackIllustration(item.category);

      const priceLabel =
        item.halfPrice !== null && item.fullPrice !== null
          ? `Half: ₹${item.halfPrice} | Full: ₹${item.fullPrice}`
          : `Single: ₹${item.singlePrice}`;

      return `
        <div class="editorial-panel" style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${imgSrc}" alt="${item.name}" onerror="this.onerror=null;this.src='${fallback}'" style="width:68px; height:52px; object-fit:cover; border-radius:10px; border:1px solid rgba(110,27,20,0.2);" />
            <div>
              <div style="font-weight:800; color:var(--ink-dark);">${item.name}</div>
              <div style="font-size:0.78rem; color:var(--crimson-royal); font-weight:700;">${item.category} • ${priceLabel}</div>
            </div>
          </div>

          <div style="display:flex; gap:7px; flex-wrap:wrap;">
            <button class="glass-btn glass-btn-sm ${item.available ? "glass-btn-success" : "glass-btn-danger"}" data-toggle="${item.id}">
              ${item.available ? "In Stock" : "Sold Out"}
            </button>
            <button class="glass-btn glass-btn-sm glass-btn-outline" data-edit="${item.id}">Edit</button>
            <button class="glass-btn glass-btn-sm glass-btn-danger" data-del="${item.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = allMenuItems.find((m) => m.id === btn.dataset.toggle);
      if (item) {
        await saveMenuItem({ ...item, available: !item.available });
      }
    });
  });

  container.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = allMenuItems.find((m) => m.id === btn.dataset.edit);
      if (!item) return;
      document.getElementById("menuFormTitle").textContent = `Edit: ${item.name}`;
      document.getElementById("editDishId").value = item.id;
      document.getElementById("dishNameInput").value = item.name;
      document.getElementById("dishCatInput").value = item.category;
      document.getElementById("dishSubInput").value = item.subtitle || "";
      document.getElementById("dishHalfInput").value = item.halfPrice ?? "";
      document.getElementById("dishFullInput").value = item.fullPrice ?? "";
      document.getElementById("dishSingleInput").value = item.singlePrice ?? "";
      document.getElementById("dishImgInput").value = item.image || "";
      document.getElementById("cancelEditBtn").classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  container.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Delete this dish from Mubeen's menu?")) {
        await deleteMenuItem(btn.dataset.del);
      }
    });
  });
}

function build15TableQRs() {
  const baseUrl = window.location.href.replace(/manager\.html.*$/, "index.html");
  const grid = document.getElementById("qrCodesGrid");
  let html = "";
  for (let t = 1; t <= TOTAL_TABLES; t++) {
    const tableUrl = `${baseUrl}?table=${t}`;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tableUrl)}`;
    html += `
      <div class="qr-card">
        <div style="font-family:'Cinzel',serif; font-weight:800; font-size:0.95rem; color:#6E1B14;">MUBEEN'S</div>
        <div style="font-size:0.78rem; font-weight:800;">TABLE #${t}</div>
        <img src="${qrImg}" alt="Table ${t} QR Code" />
        <div style="font-size:0.68rem; color:#4A2B23;">Scan to Order • Enter Tent PIN</div>
      </div>
    `;
  }
  grid.innerHTML = html;
}

async function startManagerSession() {
  document.getElementById("loginGate").classList.add("hidden");
  document.getElementById("managerDashboard").classList.remove("hidden");
  document.getElementById("mgrBottomDock").classList.remove("hidden");

  await bootstrapDatabase();

  const mode = getConnectionMode();
  document.getElementById("mgrSyncText").textContent =
    mode === "firebase" ? "Firebase Live" : "Local Mode";

  build15TableQRs();

  subscribeOrders((orders) => {
    renderStatsAndOrders(orders);
  });

  subscribeWaiterCalls((calls) => {
    renderWaiterCalls(calls);
    initialLoadComplete = true;
  });

  subscribeMenu((menu) => {
    renderManagerMenu(menu);
  });

  subscribeSettings((settings) => {
    if (settings && settings.dailyPin) {
      document.getElementById("mgrDailyPinInput").value = settings.dailyPin;
    }
  });
}

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const val = document.getElementById("managerPwdInput").value;
  if (val === MANAGER_PASSWORD) {
    sessionStorage.setItem("mubeens_mgr_auth", "1");
    startManagerSession();
  } else {
    document.getElementById("loginErr").classList.remove("hidden");
  }
});

document.getElementById("mgrLogoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("mubeens_mgr_auth");
  window.location.reload();
});

document.querySelectorAll(".dock-tab[data-mgrtab]").forEach((btn) => {
  btn.addEventListener("click", () => switchManagerTab(btn.dataset.mgrtab));
});

document.getElementById("dismissAlertBtn").addEventListener("click", () => {
  document.getElementById("instantAlertOverlay").classList.remove("show");
  switchManagerTab("mgrViewOrders");
});

document.getElementById("enableAudioBtn").addEventListener("click", () => {
  playRoyalChime();
});

document.getElementById("savePinBtn").addEventListener("click", async () => {
  const val = document.getElementById("mgrDailyPinInput").value.trim();
  if (val.length < 4) {
    alert("Please enter at least a 4-digit PIN.");
    return;
  }
  await updateDailyPin(val);
  alert(`Today's Table PIN updated to: ${val}`);
});

document.getElementById("randomPinBtn").addEventListener("click", async () => {
  const rnd = String(Math.floor(1000 + Math.random() * 9000));
  document.getElementById("mgrDailyPinInput").value = rnd;
  await updateDailyPin(rnd);
  alert(`New Daily Table PIN generated & live: ${rnd}`);
});

document.getElementById("dishForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("editDishId").value || "dish_" + Date.now();
  const halfVal = document.getElementById("dishHalfInput").value;
  const fullVal = document.getElementById("dishFullInput").value;
  const singleVal = document.getElementById("dishSingleInput").value;

  const item = {
    id,
    name: document.getElementById("dishNameInput").value.trim(),
    category: document.getElementById("dishCatInput").value,
    subtitle: document.getElementById("dishSubInput").value.trim(),
    badge: "SPECIAL",
    rating: "4.8",
    reviews: "250+",
    popular: false,
    halfPrice: halfVal !== "" ? Number(halfVal) : null,
    fullPrice: fullVal !== "" ? Number(fullVal) : null,
    singlePrice: singleVal !== "" ? Number(singleVal) : null,
    halfLabel: halfVal !== "" ? "Half" : "1 Pc",
    fullLabel: fullVal !== "" ? "Full" : "",
    image: document.getElementById("dishImgInput").value.trim(),
    available: true
  };

  await saveMenuItem(item);
  e.target.reset();
  document.getElementById("editDishId").value = "";
  document.getElementById("menuFormTitle").textContent = "+ Add / Update Dish";
  document.getElementById("cancelEditBtn").classList.add("hidden");
  alert(`Saved "${item.name}" to Mubeen's live menu!`);
});

document.getElementById("cancelEditBtn").addEventListener("click", () => {
  document.getElementById("dishForm").reset();
  document.getElementById("editDishId").value = "";
  document.getElementById("menuFormTitle").textContent = "+ Add / Update Dish";
  document.getElementById("cancelEditBtn").classList.add("hidden");
});

document.getElementById("resetMenuBtn").addEventListener("click", async () => {
  if (confirm("Restore all 27 original Mubeen's Mughlai dishes with real photos?")) {
    await resetDefaultMenu();
  }
});

if (sessionStorage.getItem("mubeens_mgr_auth") === "1") {
  startManagerSession();
}
