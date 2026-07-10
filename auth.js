// ======================================================
// Vivy 💜 Authentication System
// Part 1 - Imports, Constants & Helper Functions
// ======================================================

// ======================================================
// Firebase Configuration
// ======================================================

import { auth, db } from "./firebase-config.js";

// ======================================================
// Firebase Authentication
// ======================================================

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// ======================================================
// Firebase Firestore
// ======================================================

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
// Firestore Collections
// ======================================================

const USERS_COLLECTION = "users";
const AGENCIES_COLLECTION = "agencies";
const COUNTERS_COLLECTION = "counters";

// ======================================================
// Friendly Alert
// ======================================================

function showMessage(message) {
    alert(message);
}

// ======================================================
// Firebase Error Messages
// ======================================================

function getErrorMessage(error) {

    switch (error.code) {

        case "auth/email-already-in-use":
            return "This email address is already registered.";

        case "auth/user-not-found":
            return "Account not found.";

        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Incorrect email or password.";

        case "auth/invalid-email":
            return "Please enter a valid email address.";

        case "auth/weak-password":
            return "Password must contain at least 6 characters.";

        case "auth/network-request-failed":
            return "Network error. Please check your internet connection.";

        case "permission-denied":
            return "Database permission denied.";

        default:
            console.error(error);
            return error.message || "Something went wrong.";

    }

}

// ======================================================
// Generate Permanent UID
// USR-000001
// HST-000001
// AGY-000001
// ======================================================

async function generateSequentialId(role) {

    let counterId;
    let prefix;

    switch (role) {

        case "user":
            counterId = "users";
            prefix = "USR";
            break;

        case "host":
            counterId = "hosts";
            prefix = "HST";
            break;

        case "agency":
            counterId = "agencies";
            prefix = "AGY";
            break;

        default:
            throw new Error("Invalid account role.");

    }

    const counterRef = doc(
        db,
        COUNTERS_COLLECTION,
        counterId
    );

    return await runTransaction(db, async (transaction) => {

        const counterSnap =
            await transaction.get(counterRef);

        let currentCount = 1;

        if (!counterSnap.exists()) {

            transaction.set(counterRef, {
                count: 1
            });

        } else {

            currentCount =
                counterSnap.data().count + 1;

            transaction.update(counterRef, {
                count: currentCount
            });

        }

        return `${prefix}-${String(currentCount).padStart(6, "0")}`;

    });

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

        // ------------------------------------------
        // Host Registration
        // ------------------------------------------

        if (agencyCode.trim() !== "") {

            const agencyQuery = query(
                collection(db, AGENCIES_COLLECTION),
                where("invitationCode", "==", agencyCode.trim())
            );

            const agencySnapshot =
                await getDocs(agencyQuery);

            if (agencySnapshot.empty) {

                showMessage(
                    "Invalid Agency Invitation Code."
                );

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

        const permanentUid =
            await generateSequentialId(role);

        // ------------------------------------------
        // Create Firestore Profile
        // ------------------------------------------

        const profile = {

            firebaseUid: firebaseUid,

            uid: permanentUid,

            username: username,

            email: email,

            country: country,

            gender: gender,

            dateOfBirth: dob,

            role: role,

            status: status,

            agencyId: agencyId,

            agencyCode: agencyCode || "",

            profilePhoto: "",

            bio: "",

            coins: 0,

            diamonds: 0,

            walletBalance: 0,

            followers: 0,

            following: 0,

            totalCalls: 0,

            totalMessages: 0,

            totalCoinsEarned: 0,

            totalCoinsSpent: 0,

            isOnline: false,

            isBlocked: false,

            isVerified: false,

            notifications: true,

            language: "English",

            theme: "dark",

            createdAt: serverTimestamp(),

            lastSeen: serverTimestamp()

        };

        // ------------------------------------------
        // Save Profile
        // ------------------------------------------

        try {

    const profileRef = doc(
        db,
        USERS_COLLECTION,
        firebaseUid
    );

    console.log("Saving profile to Firestore...");

    console.log(profile);

    await setDoc(
        profileRef,
        profile
    );

    console.log("Profile saved successfully.");

}
catch (error) {

    console.error("Firestore Error:", error);

    alert("Error Code: " + error.code);

    alert("Error Message: " + error.message);

    throw error;

}

        // ------------------------------------------
        // Host Registration
        // ------------------------------------------

        if (role === "host") {

            showMessage(
                "💜 Host application submitted successfully.\n\nPlease wait for Admin approval before logging in."
            );

            await signOut(auth);

            window.location.replace("login.html");

            return true;

        }

        // ------------------------------------------
        // User Registration
        // ------------------------------------------

        showMessage(
            "💜 Account created successfully!"
        );

        window.location.replace(
            "user-dashboard.html"
        );

        return true;

    }

    catch (error) {

        console.error(error);

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

        const credential =
            await signInWithEmailAndPassword(
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

        const profileSnap =
            await getDoc(profileRef);

        if (!profileSnap.exists()) {

            await signOut(auth);

            showMessage(
                "Your account profile could not be found."
            );

            window.location.replace("login.html");

            return false;

        }

        const profile =
            profileSnap.data();

        // ------------------------------------------
        // Blocked Account
        // ------------------------------------------

        if (profile.isBlocked === true) {

            await signOut(auth);

            showMessage(
                "Your account has been blocked."
            );

            return false;

        }

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

            window.location.replace(
                "user-dashboard.html"
            );

            return true;

        }

        // ------------------------------------------
        // Host Login
        // ------------------------------------------

        if (profile.role === "host") {

            if (profile.status === "approved") {

                window.location.replace(
                    "host-dashboard.html"
                );

                return true;

            }

            if (profile.status === "pending") {

                await signOut(auth);

                showMessage(
                    "💜 Your Host application is still awaiting Admin approval."
                );

                window.location.replace(
                    "login.html"
                );

                return false;

            }

            if (profile.status === "rejected") {

                await signOut(auth);

                showMessage(
                    "Your Host application has been rejected."
                );

                window.location.replace(
                    "login.html"
                );

                return false;

            }

        }

        // ------------------------------------------
        // Agency Login
        // ------------------------------------------

        if (profile.role === "agency") {

            window.location.replace(
                "agency-dashboard.html"
            );

            return true;

        }

        // ------------------------------------------
        // Admin Login
        // ------------------------------------------

        if (profile.role === "admin") {

            window.location.replace(
                "admin-dashboard.html"
            );

            return true;

        }

        // ------------------------------------------
        // Unknown Role
        // ------------------------------------------

        await signOut(auth);

        showMessage(
            "Unknown account type."
        );

        return false;

    }

    catch (error) {

        console.error(error);

        showMessage(
            getErrorMessage(error)
        );

        return false;

    }

}

// ======================================================
// Automatically Connect Login Form
// ======================================================

const loginForm =
document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const email =
                document
                    .getElementById("email")
                    .value
                    .trim();

            const password =
                document
                    .getElementById("password")
                    .value;

            await loginUser(
                email,
                password
            );

        }

    );

                            }// ======================================================
// Part 4 - Authentication Guard
// ======================================================

export function initAuthGuard() {

    onAuthStateChanged(auth, async (user) => {

        const currentPage =
            window.location.pathname
            .split("/")
            .pop() || "index.html";

        // ------------------------------------------
        // Protected Pages
        // ------------------------------------------

        const protectedPages = [

            "user-dashboard.html",

            "host-dashboard.html",

            "agency-dashboard.html",

            "admin-dashboard.html"

        ];

        // ------------------------------------------
        // User Not Logged In
        // ------------------------------------------

        if (!user) {

            if (protectedPages.includes(currentPage)) {

                window.location.replace("login.html");

            }

            return;

        }

        try {

            // ------------------------------------------
            // Load Firestore Profile
            // ------------------------------------------

            const profileRef = doc(
                db,
                USERS_COLLECTION,
                user.uid
            );

            const profileSnap =
                await getDoc(profileRef);

            if (!profileSnap.exists()) {

                await signOut(auth);

                window.location.replace(
                    "login.html"
                );

                return;

            }

            const profile =
                profileSnap.data();

            // ------------------------------------------
            // Blocked User
            // ------------------------------------------

            if (profile.isBlocked === true) {

                await signOut(auth);

                showMessage(
                    "Your account has been blocked."
                );

                window.location.replace(
                    "login.html"
                );

                return;

            }

            // ------------------------------------------
            // Update Online Status
            // ------------------------------------------

            await updateDoc(profileRef, {

                isOnline: true,

                lastSeen: serverTimestamp()

            });

            // ------------------------------------------
            // Redirect Logged-in Users
            // Away From Auth Pages
            // ------------------------------------------

            if (

                currentPage === "index.html" ||

                currentPage === "auth.html" ||

                currentPage === "login.html" ||

                currentPage === "onboarding.html"

            ) {

                switch (profile.role) {

                    case "user":

                        window.location.replace(
                            "user-dashboard.html"
                        );

                        return;

                    case "host":

                        if (
                            profile.status === "approved"
                        ) {

                            window.location.replace(
                                "host-dashboard.html"
                            );

                        } else {

                            await signOut(auth);

                            showMessage(
                                "💜 Your Host account is awaiting Admin approval."
                            );

                            window.location.replace(
                                "login.html"
                            );

                        }

                        return;

                    case "agency":

                        window.location.replace(
                            "agency-dashboard.html"
                        );

                        return;

                    case "admin":

                        window.location.replace(
                            "admin-dashboard.html"
                        );

                        return;

                    default:

                        await signOut(auth);

                        window.location.replace(
                            "login.html"
                        );

                        return;

                }

            }

            // ------------------------------------------
            // User Dashboard Protection
            // ------------------------------------------

            if (

                currentPage === "user-dashboard.html" &&

                profile.role !== "user"

            ) {

                window.location.replace(
                    "login.html"
                );

                return;

            }

            // ------------------------------------------
            // Host Dashboard Protection
            // ------------------------------------------

            if (
                currentPage === "host-dashboard.html"
            ) {

                if (
                    profile.role !== "host"
                ) {

                    window.location.replace(
                        "login.html"
                    );

                    return;

                }

                if (
                    profile.status !== "approved"
                ) {

                    await signOut(auth);

                    showMessage(
                        "💜 Your Host account is awaiting Admin approval."
                    );

                    window.location.replace(
                        "login.html"
                    );

                    return;

                }

            }

            // ------------------------------------------
            // Agency Dashboard Protection
            // ------------------------------------------

            if (

                currentPage === "agency-dashboard.html" &&

                profile.role !== "agency"

            ) {

                window.location.replace(
                    "login.html"
                );

                return;

            }

            // ------------------------------------------
            // Admin Dashboard Protection
            // ------------------------------------------

            if (

                currentPage === "admin-dashboard.html" &&

                profile.role !== "admin"

            ) {

                window.location.replace(
                    "login.html"
                );

                return;

            }

        }

        catch (error) {

            console.error(error);

            await signOut(auth);

            window.location.replace(
                "login.html"
            );

        }

    });

}

// ======================================================
// Start Authentication Guard
// ======================================================

initAuthGuard();// ======================================================
// Part 5 - Logout, Form Connections & Helper Functions
// ======================================================

// ------------------------------------------
// Logout
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

            const profileSnap =
                await getDoc(profileRef);

            if (profileSnap.exists()) {

                await updateDoc(profileRef, {

                    isOnline: false,

                    lastSeen: serverTimestamp()

                });

            }

        }

        await signOut(auth);

        window.location.replace("login.html");

    }

    catch (error) {

        console.error(error);

        showMessage("Unable to logout.");

    }

}

// Make available globally
window.logoutUser = logoutUser;

// ======================================================
// Connect Registration Form
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
                    document
                        .getElementById("username")
                        .value
                        .trim(),

                email:
                    document
                        .getElementById("email")
                        .value
                        .trim(),

                country:
                    document
                        .getElementById("country")
                        .value,

                gender:
                    document
                        .getElementById("gender")
                        .value,

                dob:
                    document
                        .getElementById("dob")
                        .value,

                password:
                    document
                        .getElementById("password")
                        .value,

                confirmPassword:
                    document
                        .getElementById("confirmPassword")
                        .value,

                agencyCode:
                    document
                        .getElementById("agencyCode")
                        .value
                        .trim()

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
// Future Vivy Features
// ======================================================

// ✔ User Dashboard
// ✔ Host Dashboard
// ✔ Agency Dashboard
// ✔ Admin Dashboard
// ✔ Audio Calls
// ✔ Video Calls
// ✔ Random Match
// ✔ Online Hosts
// ✔ Messaging
// ✔ AI Moderation
// ✔ Payroll
// ✔ Coin System
// ✔ Paystack
// ✔ Gifts
// ✔ Support Team
// ✔ Notifications
// ✔ Call History
// ✔ Wallet
// ✔ Profile Verification

// ======================================================
// Vivy 💜 Authentication System Complete
// ======================================================
