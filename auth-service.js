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
    serverTimestamp,
    collection,
    query,
    where,
    limit,
    getDocs
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

// ======================================================
// HOST SYSTEM — Agency + Host account functions
// Additive only. Hosts live in their own "hosts" Firestore
// collection (never mixed with "accounts"), keyed by the
// same Firebase Auth uid used everywhere else in the app.
// ======================================================

// ======================================================
// Get Agency By Invitation Code
// Looks up an Agency document by its unique invitation
// code. Used by Host Registration to detect/verify an
// invitation link (?agency=CODE) or a manually entered
// code. Returns null if no matching Agency exists.
// ======================================================

export async function getAgencyByCode(invitationCode) {

    if (!invitationCode) {

        return null;

    }

    const code = invitationCode.trim().toUpperCase();

    const snap =
        await getDocs(
            query(
                collection(db, "agencies"),
                where("invitationCode", "==", code),
                limit(1)
            )
        );

    if (snap.empty) {

        return null;

    }

    const agencyDoc = snap.docs[0];

    return {
        agencyId: agencyDoc.id,
        ...agencyDoc.data()
    };

}

// ======================================================
// Register Host
// A Host account can only be created against a valid
// Agency invitation. Creates the Firebase Auth user, then
// writes the Host's Firestore document with status
// "pending" — Hosts always start pending Vivy Admin
// verification and cannot receive calls, appear online, or
// appear in Browse Hosts until approved.
// ======================================================

export async function registerHost(hostData) {

    const agency = await getAgencyByCode(hostData.agencyInvitationCode);

    if (!agency) {

        throw new Error("Invalid Agency Invitation Code.");

    }

    const credential =
        await createUserWithEmailAndPassword(
            auth,
            hostData.email,
            hostData.password
        );

    const uid = credential.user.uid;

    const hostDoc = {

        hostUID: uid,

        fullName: hostData.fullName,
        username: hostData.username,
        email: hostData.email,
        country: hostData.country,
        gender: hostData.gender,
        dateOfBirth: hostData.dob,

        // Agency relationship — a Host belongs to exactly one
        // Agency for life. Only Vivy Admin can transfer a Host
        // to another Agency (future Admin Dashboard feature).
        agencyId: agency.agencyId,
        agencyName: agency.agencyName,
        agencyInvitationCode: agency.invitationCode,

        role: "host",
        status: "pending", // pending | approved | rejected | suspended

        // Presence — pending Hosts always start offline and stay
        // that way until Vivy Admin approves them.
        isOnline: false,
        callState: "offline", // future-ready: offline | online | busy

        // Profile
        profilePhoto: "",
        coverPhoto: "",
        bio: "",
        languages: [],

        // Economy — Diamonds only, never Coins. See audio-call.js /
        // video-call.js for how these are credited during calls.
        diamonds: 0,
        totalDiamondsEarned: 0,
        todayEarnings: 0,
        weeklyDiamonds: 0,
        paymentHistory: [],

        // Future Ready — reserved for the upcoming "Go Live" feature.
        // Left as false/empty so it can be wired up later without any
        // restructuring of this document.
        isLive: false,
        liveViewers: 0,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()

    };

    await setDoc(doc(db, "hosts", uid), hostDoc);

    return { uid, agencyName: agency.agencyName };

}

// ======================================================
// Get Host Profile
// ======================================================

export async function getHostProfile(uid) {

    const snap =
        await getDoc(
            doc(db, "hosts", uid)
        );

    if (!snap.exists()) {

        return null;

    }

    return snap.data();

                }
