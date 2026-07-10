// ======================================================
// Vivy 💜 Authentication Service
// ======================================================

import { auth, db } from "./firebase-config.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ======================================================
// Register User
// ======================================================

export async function registerUser(userData) {

    const credential =
        await createUserWithEmailAndPassword(
            auth,
            userData.email,
            userData.password
        );

    const uid = credential.user.uid;

    await setDoc(
        doc(db, "accounts", uid),
        {
            firebaseUid: uid,
            username: userData.username,
            email: userData.email,
            country: userData.country,
            gender: userData.gender,
            dateOfBirth: userData.dob,
            role: "user",
            status: "active",
            coins: 0,
            diamonds: 0,
            walletBalance: 0,
            profilePhoto: "",
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp()
        }
    );

    return credential.user;

}

// ======================================================
// Login User
// ======================================================

export async function loginUser(email, password) {

    const credential =
        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

    return credential.user;

}

// ======================================================
// Logout User
// ======================================================

export async function logoutUser() {

    await signOut(auth);

}

// ======================================================
// Get Current Profile
// ======================================================

export async function getCurrentProfile(uid) {

    const snap =
        await getDoc(
            doc(db, "accounts", uid)
        );

    if (!snap.exists()) {

        return null;

    }

    return snap.data();

}
