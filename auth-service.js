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
    getDocs,
    runTransaction
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

// ======================================================
// AGENCY SYSTEM — Agency registration + profile lookup
// Additive only. Agencies never self-register through the
// normal /auth.html flow — Vivy Admin shares a dedicated
// agency-register.html link. New Agencies always start
// approved: false and cannot open agency-dashboard.html
// until Vivy Admin flips that flag (see agency-guard.js).
// ======================================================

// ------------------------------------------------------
// Generate a sequential, human-friendly Agency UID
// ("AG000001", "AG000002", ...) using a Firestore counter
// document so concurrent registrations never collide.
// ------------------------------------------------------

async function nextAgencyUID() {

    const counterRef = doc(db, "settings", "agencyCounter");

    const nextNumber = await runTransaction(db, async (transaction) => {

        const counterSnap = await transaction.get(counterRef);

        const current =
            counterSnap.exists() ? Number(counterSnap.data().value || 0) : 0;

        const updated = current + 1;

        transaction.set(counterRef, { value: updated }, { merge: true });

        return updated;

    });

    return `AG${String(nextNumber).padStart(6, "0")}`;

}

// ------------------------------------------------------
// Generate a unique Invitation Code ("AGY" + 5 random
// base-36 characters), retrying on the rare collision.
// ------------------------------------------------------

async function generateUniqueInvitationCode() {

    for (let attempt = 0; attempt < 8; attempt++) {

        const random =
            Math.random().toString(36).slice(2, 7).toUpperCase();

        const candidate = `AGY${random}`;

        const existing = await getAgencyByCode(candidate);

        if (!existing) {

            return candidate;

        }

    }

    throw new Error("Could not generate a unique invitation code. Please try again.");

}

// ======================================================
// Register Agency
// ======================================================

export async function registerAgency(agencyData) {

    const credential =
        await createUserWithEmailAndPassword(
            auth,
            agencyData.email,
            agencyData.password
        );

    const uid = credential.user.uid;

    const [agencyUID, invitationCode] = await Promise.all([
        nextAgencyUID(),
        generateUniqueInvitationCode()
    ]);

    const invitationLink =
        `${window.location.origin}/host-register.html?agency=${invitationCode}`;

    const agencyDoc = {

        agencyUID,
        fullName: agencyData.fullName,
        agencyName: agencyData.agencyName,
        email: agencyData.email,
        whatsapp: agencyData.whatsapp,

        invitationCode,
        invitationLink,

        role: "agency",

        // Vivy Admin must flip this to true before the Agency can log
        // into agency-dashboard.html — see AGENCY APPROVAL in the spec.
        approved: false,

        // Kept alongside "approved" so Vivy Admin can also suspend/ban
        // an already-approved Agency later without touching the
        // approval flag itself.
        status: "active", // active | suspended | banned

        logoURL: "",

        commissionRate: 0.10,
        totalCommissionEarned: 0,
        weekCommission: 0,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()

    };

    await setDoc(doc(db, "agencies", uid), agencyDoc);

    return { uid, agencyUID, invitationCode, invitationLink };

}

// ======================================================
// Get Agency Profile (by uid)
// ======================================================

export async function getAgencyProfile(uid) {

    const snap =
        await getDoc(
            doc(db, "agencies", uid)
        );

    if (!snap.exists()) {

        return null;

    }

    return snap.data();

}
