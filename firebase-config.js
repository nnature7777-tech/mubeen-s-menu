// =========================================================================
// MUBEEN'S - GOOGLE FIREBASE REALTIME DATABASE CONFIGURATION
// Creator: n.nature7777@gmail.com
// =========================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyCW67mUNPrTFKtrNVvhmnSdn_t61l4s67U",
  authDomain: "mubeens-restaurant.firebaseapp.com",
  databaseURL: "https://mubeens-restaurant-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mubeens-restaurant",
  storageBucket: "mubeens-restaurant.firebasestorage.app",
  messagingSenderId: "573113494999",
  appId: "1:573113494999:web:1d0bb3e6ee14836b2aaf92"
};

export function isFirebaseConfigured() {
  return (
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes("YOUR_API_KEY") &&
    firebaseConfig.databaseURL &&
    !firebaseConfig.databaseURL.includes("YOUR_PROJECT_ID")
  );
}
