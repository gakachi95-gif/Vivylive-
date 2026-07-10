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

const USERS_COLLECTION = "accounts";
const AGENCIES_COLLECTION = "agencies";
const COUNTERS_COLLECTION = "counters";

// ======================================================
// Alert Helper
// ======================================================

function showMessage(message) {
    alert(message);
}

// ======================================================
// Friendly Firebase Errors
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

async function generateSequentialId(accountType) {

    let counterId;
    let prefix;

    switch (accountType) {

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
            throw new Error("Invalid account type.");

    }

    const counterRef = doc(
        db,
        COUNTERS_COLLECTION,
        counterId
    );

    return await runTransaction(db, async (transaction) => {

        const counterSnap =
            await transaction.get(counterRef);

        let count = 1;

        if (!counterSnap.exists()) {

            transaction.set(counterRef, {
                count: 1
            });

        } else {

            count =
                counterSnap.data().count + 1;

            transaction.update(counterRef, {
                count: count
            });

        }

        return `${prefix}-${String(count).padStart(6, "0")}`;

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

        if (agencyCode && agencyCode.trim() !== "") {

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
        // Create Authentication Account
        // ------------------------------------------

        const credential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        const firebaseUid =
            credential.user.uid;

        // ------------------------------------------
        // Generate Permanent UID
        // ------------------------------------------

        const permanentUid =
            await generateSequentialId(role);

        // ------------------------------------------
        // User Profile
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

            coins: 0,

            diamonds: 0,
// ======================================================
// Part 2 - Registration System
// ======================================================

export async function registerAccount(formData) {

    console.log("Registration started");

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

        if (agencyCode && agencyCode.trim() !== "") {

            console.log("Checking Agency Code...");

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

        console.log("Creating Authentication account...");

        const credential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        console.log("Authentication account created.");

        const firebaseUid =
            credential.user.uid;

        // ------------------------------------------
        // Generate Permanent UID
        // ------------------------------------------

        console.log("Generating Permanent UID...");

        const permanentUid =
            await generateSequentialId(role);

        console.log("Permanent UID:", permanentUid);

        // ------------------------------------------
        // User Profile
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

            coins: 0,

            diamonds: 0,

            walletBalance: 0,

            followers: 0,

            following: 0,

            friends: [],

            blockedUsers: [],

            favouriteHosts: [],

            callHistory: [],

            notifications: true,

            isOnline: false,

            isBlocked: false,

            isVerified: false,

            language: "English",

            theme: "dark",

            createdAt: serverTimestamp(),

            lastSeen: serverTimestamp()

        };

        // ------------------------------------------
        // Save Profile To Firestore
        // ------------------------------------------

        console.log("Saving profile to Firestore...");

        await setDoc(

            doc(
                db,
                USERS_COLLECTION,
                firebaseUid
            ),

            profile

        );

        console.log("Firestore profile saved.");

        // ------------------------------------------
        // Host Registration
        // ------------------------------------------

        if (role === "host") {

            showMessage(
                "💜 Host application submitted successfully.\n\nPlease wait for Admin approval before logging in."
            );

            await signOut(auth);

            window.location.href = "login.html";

            return true;

        }

        // ------------------------------------------
        // User Registration
        // ------------------------------------------

        showMessage(
            "💜 Account created successfully!"
        );

        console.log("Redirecting to user dashboard...");

        window.location.href = "user-dashboard.html";

        return true;

    }

    catch (error) {

        console.error("Registration Error:", error);

        showMessage(
            getErrorMessage(error)
        );

        return false;

    }

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

        const firebaseUid =
            credential.user.uid;

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
                "Account profile not found."
            );

            return false;

        }

        const profile =
            profileSnap.data();

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
                    "💜 Your Host application is awaiting Admin approval."
                );

                await signOut(auth);

                window.location.href =
                    "login.html";

                return false;

            }

            if (profile.status === "rejected") {

                showMessage(
                    "Your Host application was rejected."
                );

                await signOut(auth);

                window.location.href =
                    "login.html";

                return false;

            }

        }

        // ------------------------------------------
        // Agency Login (Future)
        // ------------------------------------------

        if (profile.role === "agency") {

            // window.location.href =
            // "agency-dashboard.html";

            return true;

        }

        // ------------------------------------------
        // Admin Login (Future)
        // ------------------------------------------

        if (profile.role === "admin") {

            // window.location.href =
            // "admin-dashboard.html";

            return true;

        }

        // ------------------------------------------
        // Unknown Account Type
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

            await loginUser(

                document
                    .getElementById("email")
                    .value
                    .trim(),

                document
                    .getElementById("password")
                    .value

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
            .pop();

        // ------------------------------------------
        // User Not Logged In
        // ------------------------------------------

        if (!user) {

            if (
                currentPage === "user-dashboard.html" ||
                currentPage === "host-dashboard.html" ||
                currentPage === "agency-dashboard.html" ||
                currentPage === "admin-dashboard.html"
            ) {

                window.location.replace(
                    "login.html"
                );

            }

            return;

        }

        try {

            // ------------------------------------------
            // Get Firestore Profile
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
            // Update Online Status
            // ------------------------------------------

            await updateDoc(profileRef, {

                isOnline: true,

                lastSeen: serverTimestamp()

            });

            // ------------------------------------------
            // Redirect Logged-in Users
            // ------------------------------------------

            if (

                currentPage === "auth.html" ||
                currentPage === "login.html" ||
                currentPage === "onboarding.html"

            ) {

                if (profile.role === "user") {

                    window.location.replace(
                        "user-dashboard.html"
                    );

                    return;

                }

                if (

                    profile.role === "host" &&
                    profile.status === "approved"

                ) {

                    window.location.replace(
                        "host-dashboard.html"
                    );

                    return;

                }

            }

            // ------------------------------------------
            // User Dashboard Protection
            // ------------------------------------------

            if (
                currentPage === "user-dashboard.html"
            ) {

                if (profile.role !== "user") {

                    if (

                        profile.role === "host" &&
                        profile.status === "approved"

                    ) {

                        window.location.replace(
                            "host-dashboard.html"
                        );

                        return;

                    }

                    window.location.replace(
                        "login.html"
                    );

                    return;

                }

            }

            // ------------------------------------------
            // Host Dashboard Protection
            // ------------------------------------------

            if (
                currentPage === "host-dashboard.html"
            ) {

                if (profile.role !== "host") {

                    window.location.replace(
                        "login.html"
                    );

                    return;

                }

                if (
                    profile.status !== "approved"
                ) {

                    showMessage(
                        "💜 Your Host account is awaiting Admin approval."
                    );

                    await signOut(auth);

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
                currentPage === "agency-dashboard.html"
            ) {

                if (
                    profile.role !== "agency"
                ) {

                    window.location.replace(
                        "login.html"
                    );

                    return;

                }

            }

            // ------------------------------------------
            // Admin Dashboard Protection
            // ------------------------------------------

            if (
                currentPage === "admin-dashboard.html"
            ) {

                if (
                    profile.role !== "admin"
                ) {

                    window.location.replace(
                        "login.html"
                    );

                    return;

                }

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
// Part 5 - Logout, Forms & Helper Functions
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

            await updateDoc(profileRef, {

                isOnline: false,

                lastSeen: serverTimestamp()

            });

        }

        await signOut(auth);

        window.location.replace(
            "login.html"
        );

    }

    catch (error) {

        console.error(error);

        showMessage(
            "Unable to logout."
        );

    }

}

// Make Logout Available Everywhere
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
// Vivy 💜 Authentication System Complete
// ======================================================
