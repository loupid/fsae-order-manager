import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc
} from "firebase/firestore";

// Helper to load Firebase Config from localStorage or environment
const getFirebaseConfig = () => {
  const localConfig = localStorage.getItem("fsae_firebase_config");
  if (localConfig) {
    try {
      return JSON.parse(localConfig);
    } catch (e) {
      console.error("Failed to parse local Firebase config:", e);
    }
  }

  // Check if window.env is injected at runtime (e.g. Docker environment variables)
  if (typeof window !== 'undefined' && window.env && window.env.VITE_FIREBASE_API_KEY) {
    return {
      apiKey: window.env.VITE_FIREBASE_API_KEY,
      authDomain: window.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: window.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: window.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: window.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: window.env.VITE_FIREBASE_APP_ID
    };
  }
  
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  if (env.VITE_FIREBASE_API_KEY) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID
    };
  }
  
  return null;
};

const config = getFirebaseConfig();
let db = null;
let isFirebaseActive = false;

if (config && config.apiKey) {
  try {
    const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    db = getFirestore(app);
    isFirebaseActive = true;
    console.log("Firebase Firestore successfully initialized!");
  } catch (error) {
    console.error("Firebase initialization failed, falling back to LocalStorage:", error);
  }
}

// Initialize localStorage with empty arrays if not present
const initializeLocalStorage = () => {
  if (!localStorage.getItem("fsae_parts")) {
    localStorage.setItem("fsae_parts", JSON.stringify([]));
  }
  if (!localStorage.getItem("fsae_orders")) {
    localStorage.setItem("fsae_orders", JSON.stringify([]));
  }
};

initializeLocalStorage();

// Local Storage CRUD Helpers (Side-effect free)
const localDb = {
  get: (key) => JSON.parse(localStorage.getItem(key)) || [],
  set: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
  
  // Parts
  getParts: () => localDb.get("fsae_parts"),
  savePart: (part) => {
    const parts = localDb.getParts();
    const idx = parts.findIndex(p => p.id === part.id || p.mpn.toUpperCase() === part.mpn.toUpperCase());
    if (idx >= 0) {
      parts[idx] = { ...parts[idx], ...part };
    } else {
      part.id = part.id || "part_" + Math.random().toString(36).substr(2, 9);
      parts.push(part);
    }
    localDb.set("fsae_parts", parts);
    return part;
  },
  deletePart: (id) => {
    const parts = localDb.getParts().filter(p => p.id !== id);
    localDb.set("fsae_parts", parts);
  },

  // Orders
  getOrders: () => localDb.get("fsae_orders"),
  saveOrder: (order) => {
    const orders = localDb.getOrders();
    const idx = orders.findIndex(o => o.id === order.id);
    if (idx >= 0) {
      orders[idx] = { ...orders[idx], ...order };
    } else {
      order.id = order.id || "ord_" + Math.random().toString(36).substr(2, 9);
      order.createdAt = order.createdAt || new Date().toISOString();
      orders.push(order);
    }
    localDb.set("fsae_orders", orders);
    return order;
  },
  deleteOrder: (id) => {
    const orders = localDb.getOrders().filter(o => o.id !== id);
    localDb.set("fsae_orders", orders);
  }
};

// Stock transition logic helper
const applyStockTransitions = (oldOrder, newOrder) => {
  const parts = localDb.getParts();
  let partsChanged = false;

  const oldApplied = oldOrder && oldOrder.stockApplied === true;
  const newIsReceived = newOrder && newOrder.status === 'Received';

  // 1. Order transitioned to RECEIVED -> Add stock
  if (newIsReceived && !oldApplied) {
    newOrder.items.forEach(item => {
      const pIdx = parts.findIndex(p => p.id === item.partId);
      if (pIdx >= 0) {
        parts[pIdx].stock = (parts[pIdx].stock || 0) + Number(item.quantity);
        partsChanged = true;
      }
    });
    newOrder.stockApplied = true;
  }
  // 2. Order transitioned OUT of RECEIVED -> Subtract stock
  else if (!newIsReceived && oldApplied) {
    newOrder.items.forEach(item => {
      const pIdx = parts.findIndex(p => p.id === item.partId);
      if (pIdx >= 0) {
        parts[pIdx].stock = Math.max(0, (parts[pIdx].stock || 0) - Number(item.quantity));
        partsChanged = true;
      }
    });
    newOrder.stockApplied = false;
  }
  // 3. Keep stockApplied flag synced if no transition
  else if (oldOrder) {
    newOrder.stockApplied = oldOrder.stockApplied;
  }

  if (partsChanged) {
    localDb.set("fsae_parts", parts);
  }
};

// Unified Data Service (Handles Business Logic and delegation)
export const api = {
  isFirebaseActive: () => isFirebaseActive,
  
  updateFirebaseConfig: (newConfig) => {
    localStorage.setItem("fsae_firebase_config", JSON.stringify(newConfig));
    window.location.reload();
  },
  
  clearFirebaseConfig: () => {
    localStorage.removeItem("fsae_firebase_config");
    window.location.reload();
  },

  // PARTS
  getParts: async () => {
    if (!isFirebaseActive) return localDb.getParts();
    try {
      const q = collection(db, "parts");
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      localStorage.setItem("fsae_parts", JSON.stringify(list));
      return list;
    } catch (e) {
      console.error("Firestore read parts error:", e);
      return localDb.getParts();
    }
  },

  savePart: async (part) => {
    if (!isFirebaseActive) return localDb.savePart(part);
    try {
      const partId = part.id || "part_" + Math.random().toString(36).substr(2, 9);
      const partData = { ...part, id: partId };
      await setDoc(doc(db, "parts", partId), partData);
      localDb.savePart(partData);
      return partData;
    } catch (e) {
      console.error("Firestore write part error:", e);
      return localDb.savePart(part);
    }
  },

  deletePart: async (id) => {
    if (!isFirebaseActive) return localDb.deletePart(id);
    try {
      await deleteDoc(doc(db, "parts", id));
      localDb.deletePart(id);
    } catch (e) {
      console.error("Firestore delete part error:", e);
      localDb.deletePart(id);
    }
  },

  // ORDERS
  getOrders: async () => {
    if (!isFirebaseActive) return localDb.getOrders();
    try {
      const q = collection(db, "orders");
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      localStorage.setItem("fsae_orders", JSON.stringify(list));
      return list;
    } catch (e) {
      console.error("Firestore read orders error:", e);
      return localDb.getOrders();
    }
  },

  saveOrder: async (order) => {
    const currentOrders = localDb.getOrders();
    const existing = currentOrders.find(o => o.id === order.id);

    const updatedOrder = { ...order };
    applyStockTransitions(existing, updatedOrder);

    if (!isFirebaseActive) {
      localDb.saveOrder(updatedOrder);
      return updatedOrder;
    }

    try {
      const ordId = order.id || "ord_" + Math.random().toString(36).substr(2, 9);
      const ordData = { 
        ...updatedOrder, 
        id: ordId, 
        createdAt: order.createdAt || new Date().toISOString() 
      };
      
      // Update parts stock on Firestore if needed
      if (ordData.stockApplied && (!existing || !existing.stockApplied)) {
        const parts = await api.getParts();
        for (const item of ordData.items) {
          const part = parts.find(p => p.id === item.partId);
          if (part) {
            part.stock = (part.stock || 0) + Number(item.quantity);
            await setDoc(doc(db, "parts", part.id), part);
          }
        }
      } else if (!ordData.stockApplied && (existing && existing.stockApplied)) {
        const parts = await api.getParts();
        for (const item of ordData.items) {
          const part = parts.find(p => p.id === item.partId);
          if (part) {
            part.stock = Math.max(0, (part.stock || 0) - Number(item.quantity));
            await setDoc(doc(db, "parts", part.id), part);
          }
        }
      }

      await setDoc(doc(db, "orders", ordId), ordData);
      localDb.saveOrder(ordData);
      return ordData;
    } catch (e) {
      console.error("Firestore write order error:", e);
      localDb.saveOrder(updatedOrder);
      return updatedOrder;
    }
  },

  deleteOrder: async (id) => {
    const orders = localDb.getOrders();
    const order = orders.find(o => o.id === id);
    
    if (order && order.stockApplied) {
      // Subtract stock locally
      const parts = localDb.getParts();
      let partsChanged = false;
      order.items.forEach(item => {
        const pIdx = parts.findIndex(p => p.id === item.partId);
        if (pIdx >= 0) {
          parts[pIdx].stock = Math.max(0, (parts[pIdx].stock || 0) - Number(item.quantity));
          partsChanged = true;
        }
      });
      if (partsChanged) {
        localDb.set("fsae_parts", parts);
      }

      // Subtract stock on Firestore
      if (isFirebaseActive) {
        try {
          const fsParts = await api.getParts();
          for (const item of order.items) {
            const part = fsParts.find(p => p.id === item.partId);
            if (part) {
              part.stock = Math.max(0, (part.stock || 0) - Number(item.quantity));
              await setDoc(doc(db, "parts", part.id), part);
            }
          }
        } catch (e) {
          console.error("Firestore stock update on delete error:", e);
        }
      }
    }

    if (!isFirebaseActive) {
      localDb.deleteOrder(id);
      return;
    }

    try {
      await deleteDoc(doc(db, "orders", id));
      localDb.deleteOrder(id);
    } catch (e) {
      console.error("Firestore delete order error:", e);
      localDb.deleteOrder(id);
    }
  }
};
