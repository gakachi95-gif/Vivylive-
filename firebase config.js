// firebase-config.js  
// Configuration and initialization for the Vivy 💜 calling app  
// Using Firebase Web SDK v11 (ES Modules)  
  
import { initializeApp } from "firebase/app";  
import { getAuth } from "firebase/auth";  
import { getFirestore } from "firebase/firestore";  
import { getStorage } from "firebase/storage";  
  
/**  
 * Firebase Project Configuration  
 * Replace the placeholder values below with your actual project settings   
 * found in the Firebase Console.  
 */  
const firebaseConfig = {  
  apiKey: "YOUR_API_KEY",  
  authDomain: "YOUR_AUTH_DOMAIN",  
  projectId: "YOUR_PROJECT_ID",  
  storageBucket: "YOUR_STORAGE_BUCKET",  
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",  
  appId: "YOUR_APP_ID"  
};  
  
// Initialize Firebase App  
const app = initializeApp(firebaseConfig);  
  
// Initialize Firebase Services  
const auth = getAuth(app);  
const db = getFirestore(app);  
const storage = getStorage(app);  
  
// Export initialized services for use across the application  
export { app, auth, db, storage };  
