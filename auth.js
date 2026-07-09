// ======================================================
// Vivy 💜 Authentication System
// Part 1 - Imports, Configuration & Helper Functions
// ======================================================

// Import Firebase services
import { auth, db } from "./firebase-config.js";

// Firebase Authentication
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// Firestore
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ======================================================
// Collections
// ======================================================

const USERS_COLLECTION = "accounts";
const AGENCIES_COLLECTION = "agencies";
const COUNTERS_COLLECTION = "counters";

// ======================================================
// Friendly Error Messages
// ======================================================

function getErrorMessage(error) {
  switch (error.code) {

    case "auth/email-already-in-use":
      return "This email is already registered.";

    case "auth/user-not-found":
      return "No account was found with this email.";

    case "auth/wrong-password":
      return "Incorrect password.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/user-disabled":
      return "This account has been disabled.";

    case "auth/weak-password":
      return "Password should contain at least 6 characters.";

    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";

    case "auth/invalid-credential":
      return "Invalid email or password.";

    default:
      return error.message || "Something went wrong.";
  }
}

// ======================================================
// Sequential UID Generator
// Generates:
// USR-000001
// HST-000001
// AGY-000001
// ======================================================

async function generateSequentialId(type) {

  let documentId = "";
  let prefix = "";

  switch (type) {

    case "user":
      documentId = "users";
      prefix = "USR";
      break;

    case "host":
      documentId = "hosts";
      prefix = "HST";
      break;

    case "agency":
      documentId = "agencies";
      prefix = "AGY";
      break;

    default:
      throw new Error("Invalid account type.");
  }

  const counterRef = doc(db, COUNTERS_COLLECTION, documentId);

  const newId = await runTransaction(db, async (transaction) => {

    const counterDoc = await transaction.get(counterRef);

    let count = 1;

    if (!counterDoc.exists()) {

      transaction.set(counterRef, {
        count: 1
      });

    } else {

      count = counterDoc.data().count + 1;

      transaction.update(counterRef, {
        count: count
      });

    }

    return `${prefix}-${String(count).padStart(6, "0")}`;

  });

  return newId;
}

// ======================================================
// Helper Function
// ======================================================

function showMessage(message) {
  alert(message);
}// ======================================================
// Part 2 - Registration System
// ======================================================

export async function registerAccount(formData) {

  try {

    const {
      username,
      email,
      country,
      gender,
      dob,
      password,
      confirmPassword,
      agencyCode
    } = formData;

    // ------------------------------------------
    // Validate Password
    // ------------------------------------------

    if (password !== confirmPassword) {
      showMessage("Passwords do not match.");
      return false;
    }

    // ------------------------------------------
    // Default Account
    // ------------------------------------------

    let role = "user";
    let status = "active";
    let agencyId = "";
    let permanentUid = "";

    // ------------------------------------------
    // Host Registration
    // ------------------------------------------

    if (agencyCode && agencyCode.trim() !== "") {

      const agencyQuery = query(
        collection(db, AGENCIES_COLLECTION),
        where("invitationCode", "==", agencyCode.trim())
      );

      const agencySnapshot = await getDocs(agencyQuery);

      if (agencySnapshot.empty) {

        showMessage("Invalid Agency Invitation Code.");

        return false;

      }

      role = "host";
      status = "pending";
      agencyId = agencySnapshot.docs[0].id;

    }

    // ------------------------------------------
    // Create Firebase Authentication Account
    // ------------------------------------------

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const firebaseUid = credential.user.uid;

    // ------------------------------------------
    // Generate Permanent UID
    // ------------------------------------------

    permanentUid =
      await generateSequentialId(role);

    // ------------------------------------------
    // Create Firestore Profile
    // ------------------------------------------

    const profile = {

      firebaseUid,

      uid: permanentUid,

      username,

      email,

      country,

      gender,

      dateOfBirth: dob,

      role,

      status,

      agencyId,

      agencyCode: agencyCode || "",

      profilePhoto: "",

      bio: "",

      walletBalance: 0,

      coins: 0,

      diamonds: 0,

      followers: 0,

      following: 0,

      friends: [],

      friendRequests: [],

      blockedUsers: [],

      favoriteHosts: [],

      callsMade: 0,

      callsReceived: 0,

      totalSpent: 0,

      totalEarnings: 0,

      isOnline: false,

      isVerified: false,

      isBlocked: false,

      notifications: true,

      language: "English",

      theme: "dark",

      accountCreatedFrom: "web",

      lastSeen: serverTimestamp(),

      createdAt: serverTimestamp()

    };

    // ------------------------------------------
    // Save Profile
    // ------------------------------------------

    await setDoc(
      doc(db, USERS_COLLECTION, firebaseUid),
      profile
    );

    // ------------------------------------------
    // Success
    // ------------------------------------------

    if (role === "host") {

      showMessage(
        "💜 Application Submitted Successfully.\n\nPlease wait for Admin approval before accessing the Host Dashboard."
      );

      window.location.href = "login.html";

    } else {

      window.location.href = "user-dashboard.html";

    }

    return true;

  } catch (error) {

    showMessage(
      getErrorMessage(error)
    );

    return false;

  }

  }// ======================================================
// Part 3 - Login System
// ======================================================

export async function loginUser(email, password) {

  try {

    // ------------------------------------------
    // Sign In
    // ------------------------------------------

    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const firebaseUid = credential.user.uid;

    // ------------------------------------------
    // Get User Profile
    // ------------------------------------------

    const profileRef = doc(
      db,
      USERS_COLLECTION,
      firebaseUid
    );

    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {

      await signOut(auth);

      showMessage(
        "Account profile not found."
      );

      return false;

    }

    const profile = profileSnap.data();

    // ------------------------------------------
    // Update Online Status
    // ------------------------------------------

    await updateDoc(profileRef, {

      isOnline: true,

      lastSeen: serverTimestamp()

    });

    // ------------------------------------------
    // User Login
    // ------------------------------------------

    if (profile.role === "user") {

      window.location.href =
        "user-dashboard.html";

      return true;

    }

    // ------------------------------------------
    // Host Login
    // ------------------------------------------

    if (profile.role === "host") {

      if (profile.status === "approved") {

        window.location.href =
          "host-dashboard.html";

        return true;

      }

      if (profile.status === "pending") {

        showMessage(
          "💜 Your Host application is still awaiting Admin approval."
        );

        await signOut(auth);

        window.location.href =
          "login.html";

        return false;

      }

      if (profile.status === "rejected") {

        showMessage(
          "Your Host application was not approved."
        );

        await signOut(auth);

        return false;

      }

    }

    // ------------------------------------------
    // Future Agency Login
    // ------------------------------------------

    if (profile.role === "agency") {

      // Future:
      // window.location.href =
      // "agency-dashboard.html";

      return true;

    }

    // ------------------------------------------
    // Future Admin Login
    // ------------------------------------------

    if (profile.role === "admin") {

      // Future:
      // window.location.href =
      // "admin-dashboard.html";

      return true;

    }

    showMessage(
      "Unknown account type."
    );

    await signOut(auth);

    return false;

  }

  catch (error) {

    showMessage(
      getErrorMessage(error)
    );

    return false;

  }

}

// ======================================================
// Connect Login Form Automatically
// ======================================================

const loginForm =
document.getElementById("loginForm");

if (loginForm) {

  loginForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const email =
        loginForm.email.value.trim();

      const password =
        loginForm.password.value;

      await loginUser(
        email,
        password
      );

    }

  );

      }// ======================================================
// Part 4 - Authentication Guard & Session Management
// ======================================================

export function initAuthGuard() {

    onAuthStateChanged(auth, async (user) => {

        const currentPage = window.location.pathname.split("/").pop();

        // ------------------------------------------
        // User NOT Logged In
        // ------------------------------------------

        if (!user) {

            if (
                currentPage === "user-dashboard.html" ||
                currentPage === "host-dashboard.html"
            ) {

                window.location.href = "login.html";

            }

            return;

        }

        try {

            // ------------------------------------------
            // Get User Profile
            // ------------------------------------------

            const profileRef = doc(db, USERS_COLLECTION, user.uid);

            const profileSnap = await getDoc(profileRef);

            if (!profileSnap.exists()) {

                await signOut(auth);

                window.location.href = "login.html";

                return;

            }

            const profile = profileSnap.data();

            // ------------------------------------------
            // Update Online Status
            // ------------------------------------------

            await updateDoc(profileRef, {

                isOnline: true,

                lastSeen: serverTimestamp()

            });

            // ------------------------------------------
            // Prevent Logged-in Users
            // from Returning to Login
            // ------------------------------------------

            if (
                currentPage === "login.html" ||
                currentPage === "onboarding.html"
            ) {

                if (profile.role === "user") {

                    window.location.href = "user-dashboard.html";

                    return;

                }

                if (
                    profile.role === "host" &&
                    profile.status === "approved"
                ) {

                    window.location.href = "host-dashboard.html";

                    return;

                }

            }

            // ------------------------------------------
            // Host Protection
            // ------------------------------------------

            if (
                currentPage === "host-dashboard.html"
            ) {

                if (
                    profile.role !== "host"
                ) {

                    window.location.href = "user-dashboard.html";

                    return;

                }

                if (
                    profile.status !== "approved"
                ) {

                    showMessage(
                        "Your Host account is awaiting approval."
                    );

                    await signOut(auth);

                    window.location.href = "login.html";

                    return;

                }

            }

            // ------------------------------------------
            // User Protection
            // ------------------------------------------

            if (
                currentPage === "user-dashboard.html"
            ) {

                if (
                    profile.role !== "user"
                ) {

                    if (
                        profile.role === "host" &&
                        profile.status === "approved"
                    ) {

                        window.location.href =
                            "host-dashboard.html";

                        return;

                    }

                }

            }

            // ------------------------------------------
            // Future Agency Dashboard
            // ------------------------------------------

            // Reserved for future implementation.

            // ------------------------------------------
            // Future Admin Dashboard
            // ------------------------------------------

            // Reserved for future implementation.

        }

        catch (error) {

            console.error(error);

            await signOut(auth);

            window.location.href = "login.html";

        }

    });

}

// ======================================================
// Start Authentication Guard Automatically
// ======================================================

initAuthGuard();// ======================================================
// Part 5 - Logout, Form Connections & Final Initialization
// ======================================================

// ------------------------------------------
// Logout User
// ------------------------------------------

export async function logoutUser() {

    try {

        const user = auth.currentUser;

        if (user) {

            const profileRef = doc(
                db,
                USERS_COLLECTION,
                user.uid
            );

            await updateDoc(profileRef, {

                isOnline: false,

                lastSeen: serverTimestamp()

            });

        }

        await signOut(auth);

        window.location.href = "login.html";

    }

    catch (error) {

        console.error(error);

        showMessage(
            "Unable to logout."
        );

    }

}

// Make logout available globally
window.logoutUser = logoutUser;


// ======================================================
// Automatically Connect Onboarding Form
// ======================================================

const onboardingForm =
document.getElementById("onboardingForm");

if (onboardingForm) {

    onboardingForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            await registerAccount({

                username:
                onboardingForm.username.value.trim(),

                email:
                onboardingForm.email.value.trim(),

                country:
                onboardingForm.country.value,

                gender:
                onboardingForm.gender.value,

                dob:
                onboardingForm.dob.value,

                password:
                onboardingForm.password.value,

                confirmPassword:
                onboardingForm.confirmPassword.value,

                agencyCode:
                onboardingForm.agencyCode.value.trim()

            });

        }

    );

}


// ======================================================
// Helper Functions
// ======================================================

export function getCurrentUser() {

    return auth.currentUser;

}

export function isLoggedIn() {

    return auth.currentUser !== null;

}


// ======================================================
// Future Features Reserved
// ======================================================

// Future:
//
// ✔ User Wallet
// ✔ Coin Purchases (Paystack)
// ✔ Gift Sending
// ✔ Audio Calls
// ✔ Video Calls
// ✔ Friends
// ✔ Messaging
// ✔ Notifications
// ✔ Agency Dashboard
// ✔ Admin Dashboard
// ✔ Payroll
// ✔ Withdrawals


// ======================================================
// Vivy 💜
// Authentication System Complete
// ======================================================
