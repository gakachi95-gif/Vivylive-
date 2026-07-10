// ======================================================
// Vivy 💜 Firebase Configuration
// Firebase Web SDK v11 (ES Modules)
// ======================================================

// Firebase Core
import { initializeApp } from "firebase/app";

// Firebase Services
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Optional Analytics (Enable later if needed)
// import { getAnalytics } from "firebase/analytics";

// ======================================================
// Firebase Project Configuration
// ======================================================

const firebaseConfig = {
  apiKey: "AIzaSyDjcjJf7dIyYLbxYrX5r2oXwpgSUr7gkLA",
  authDomain: "vivylive-62c7d.firebaseapp.com",
  projectId: "vivylive-62c7d",
  storageBucket: "vivylive-62c7d.firebasestorage.app",
  messagingSenderId: "279820446345",
  appId: "1:279820446345:web:a2244177c50f45cb463458"
};

// ======================================================
// Initialize Firebase
// ======================================================

const app = initializeApp(firebaseConfig);

// ======================================================
// Firebase Services
// ======================================================

const auth = getAuth(app);

const db = getFirestore(app);

const storage = getStorage(app);

// Optional Analytics
// const analytics = getAnalytics(app);

// ======================================================
// Future Firebase Services
// ======================================================

// Cloud Functions
// import { getFunctions } from "firebase/functions";

// Firebase Cloud Messaging
// import { getMessaging } from "firebase/messaging";

// Firebase App Check
// import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// ======================================================
// Export Services
// ======================================================

export {
  app,
  auth,
  db,
  storage
  // analytics
};
