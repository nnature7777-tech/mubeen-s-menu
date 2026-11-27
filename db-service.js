// =========================================================================
// MUBEEN'S - REAL-TIME DATABASE ENGINE (Firebase RTDB + Instant Sync)
// Created by: n.nature7777@gmail.com
// =========================================================================

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { INITIAL_MENU } from "./menu-data.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  push,
  update,
  remove,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

let db = null;
let useFirebase = false;

if (isFirebaseConfigured()) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    useFirebase = true;
  } catch (err) {
    console.warn("Firebase init fallback to local demo mode:", err);
    useFirebase = false;
  }
}

export function getConnectionMode() {
  return useFirebase ? "firebase" : "local";
}

const LS_KEYS = {
  MENU: "mubeens_menu_v2",
  ORDERS: "mubeens_orders_v2",
  CALLS: "mubeens_waiter_calls_v2",
  SETTINGS: "mubeens_settings_v2"
};

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
  window.dispatchEvent(new CustomEvent("mubeens-sync", { detail: { key } }));
}

export async function bootstrapDatabase() {
  const defaultSettings = {
    dailyPin: "7860",
    updatedAt: Date.now()
  };

  if (useFirebase) {
    const menuSnap = await get(ref(db, "menu"));
    if (!menuSnap.exists()) {
      const menuObj = {};
      INITIAL_MENU.forEach((item) => {
        menuObj[item.id] = item;
      });
      await set(ref(db, "menu"), menuObj);
    }
    const setSnap = await get(ref(db, "settings"));
    if (!setSnap.exists()) {
      await set(ref(db, "settings"), defaultSettings);
    }
  } else {
    if (!localStorage.getItem(LS_KEYS.MENU)) {
      const menuObj = {};
      INITIAL_MENU.forEach((item) => {
        menuObj[item.id] = item;
      });
      writeLS(LS_KEYS.MENU, menuObj);
    }
    if (!localStorage.getItem(LS_KEYS.SETTINGS)) {
      writeLS(LS_KEYS.SETTINGS, defaultSettings);
    }
    if (!localStorage.getItem(LS_KEYS.ORDERS)) {
      writeLS(LS_KEYS.ORDERS, {});
    }
    if (!localStorage.getItem(LS_KEYS.CALLS)) {
      writeLS(LS_KEYS.CALLS, {});
    }
  }
}

export function subscribeMenu(callback) {
  if (useFirebase) {
    return onValue(ref(db, "menu"), (snap) => {
      const val = snap.val() || {};
      callback(Object.values(val));
    });
  } else {
    const emit = () => callback(Object.values(readLS(LS_KEYS.MENU, {})));
    emit();
    window.addEventListener("mubeens-sync", emit);
    window.addEventListener("storage", emit);
    return () => {
      window.removeEventListener("mubeens-sync", emit);
      window.removeEventListener("storage", emit);
    };
  }
}

export function subscribeSettings(callback) {
  if (useFirebase) {
    return onValue(ref(db, "settings"), (snap) => {
      callback(snap.val() || { dailyPin: "7860" });
    });
  } else {
    const emit = () => callback(readLS(LS_KEYS.SETTINGS, { dailyPin: "7860" }));
    emit();
    window.addEventListener("mubeens-sync", emit);
    window.addEventListener("storage", emit);
    return () => {
      window.removeEventListener("mubeens-sync", emit);
      window.removeEventListener("storage", emit);
    };
  }
}

export function subscribeOrders(callback) {
  if (useFirebase) {
    return onValue(ref(db, "orders"), (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    });
  } else {
    const emit = () => {
      const val = readLS(LS_KEYS.ORDERS, {});
      const list = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    };
    emit();
    window.addEventListener("mubeens-sync", emit);
    window.addEventListener("storage", emit);
    return () => {
      window.removeEventListener("mubeens-sync", emit);
      window.removeEventListener("storage", emit);
    };
  }
}

export function subscribeWaiterCalls(callback) {
  if (useFirebase) {
    return onValue(ref(db, "waiterCalls"), (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    });
  } else {
    const emit = () => {
      const val = readLS(LS_KEYS.CALLS, {});
      const list = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    };
    emit();
    window.addEventListener("mubeens-sync", emit);
    window.addEventListener("storage", emit);
    return () => {
      window.removeEventListener("mubeens-sync", emit);
      window.removeEventListener("storage", emit);
    };
  }
}

export async function placeCustomerOrder(orderPayload) {
  const newOrder = {
    ...orderPayload,
    stage: 1,
    paid: false,
    createdAt: Date.now()
  };

  if (useFirebase) {
    const newRef = push(ref(db, "orders"));
    await set(newRef, newOrder);
    return newRef.key;
  } else {
    const id = "ord_" + Date.now();
    const all = readLS(LS_KEYS.ORDERS, {});
    all[id] = newOrder;
    writeLS(LS_KEYS.ORDERS, all);
    return id;
  }
}

export async function triggerWaiterCall(tableNumber) {
  const callObj = {
    table: Number(tableNumber),
    acknowledged: false,
    createdAt: Date.now()
  };

  if (useFirebase) {
    const newRef = push(ref(db, "waiterCalls"));
    await set(newRef, callObj);
    return newRef.key;
  } else {
    const id = "call_" + Date.now();
    const all = readLS(LS_KEYS.CALLS, {});
    all[id] = callObj;
    writeLS(LS_KEYS.CALLS, all);
    return id;
  }
}

export async function updateOrderStage(orderId, stage, paid = false) {
  if (useFirebase) {
    await update(ref(db, `orders/${orderId}`), { stage, paid });
  } else {
    const all = readLS(LS_KEYS.ORDERS, {});
    if (all[orderId]) {
      all[orderId].stage = stage;
      all[orderId].paid = paid;
      writeLS(LS_KEYS.ORDERS, all);
    }
  }
}

export async function acknowledgeWaiterCall(callId) {
  if (useFirebase) {
    await update(ref(db, `waiterCalls/${callId}`), { acknowledged: true });
  } else {
    const all = readLS(LS_KEYS.CALLS, {});
    if (all[callId]) {
      all[callId].acknowledged = true;
      writeLS(LS_KEYS.CALLS, all);
    }
  }
}

export async function updateDailyPin(newPin) {
  const payload = { dailyPin: String(newPin).trim(), updatedAt: Date.now() };
  if (useFirebase) {
    await update(ref(db, "settings"), payload);
  } else {
    writeLS(LS_KEYS.SETTINGS, payload);
  }
}

export async function saveMenuItem(item) {
  if (useFirebase) {
    await set(ref(db, `menu/${item.id}`), item);
  } else {
    const all = readLS(LS_KEYS.MENU, {});
    all[item.id] = item;
    writeLS(LS_KEYS.MENU, all);
  }
}

export async function deleteMenuItem(itemId) {
  if (useFirebase) {
    await remove(ref(db, `menu/${itemId}`));
  } else {
    const all = readLS(LS_KEYS.MENU, {});
    delete all[itemId];
    writeLS(LS_KEYS.MENU, all);
  }
}

export async function resetDefaultMenu() {
  const menuObj = {};
  INITIAL_MENU.forEach((item) => {
    menuObj[item.id] = item;
  });
  if (useFirebase) {
    await set(ref(db, "menu"), menuObj);
  } else {
    writeLS(LS_KEYS.MENU, menuObj);
  }
}
