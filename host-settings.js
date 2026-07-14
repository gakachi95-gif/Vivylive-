// ======================================================
// Vivy 💜 Host Settings
// Change Password, Notification Preferences, Privacy,
// Logout, Delete Account. Agency assignment is never
// editable here — only Vivy Admin can transfer a Host.
// ======================================================

import { hostSessionReady } from "./host-guard.js";
import { auth, db } from "./firebase-config.js";
import {
    sendPasswordResetEmail, signOut, deleteUser,
    reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, showToast } from "./ui-helpers.js";

let currentUser = null;
let currentHost = null;

const toggles = {
    toggleMessages: "notificationPrefs.messages",
    toggleMissedCalls: "notificationPrefs.missedCalls",
    toggleAnnouncements: "notificationPrefs.announcements",
    toggleShowOnline: "privacy.showOnlineStatus"
};

document.getElementById("backBtn").addEventListener("click", () => goBack("host-dashboard.html"));

document.getElementById("changePasswordRow").addEventListener("click", changePassword);
document.getElementById("logoutRow").addEventListener("click", logout);
document.getElementById("deleteAccountRow").addEventListener("click", deleteAccount);

Object.keys(toggles).forEach((id) => {

    document.getElementById(id).addEventListener("click", () => toggleSetting(id));

});

init();

async function init() {

    const session = await hostSessionReady;
    if (!session) return;

    currentUser = session.user;

    const snap = await getDoc(doc(db, "hosts", currentUser.uid));
    currentHost = snap.exists() ? snap.data() : {};

    render();

}

function render() {

    const prefs = currentHost.notificationPrefs || {};
    const privacy = currentHost.privacy || {};

    setToggleState("toggleMessages", prefs.messages !== false);
    setToggleState("toggleMissedCalls", prefs.missedCalls !== false);
    setToggleState("toggleAnnouncements", prefs.announcements !== false);
    setToggleState("toggleShowOnline", privacy.showOnlineStatus !== false);

}

function setToggleState(id, on) {

    document.getElementById(id).classList.toggle("on", on);

}

async function toggleSetting(id) {

    const el = document.getElementById(id);
    const nowOn = !el.classList.contains("on");

    el.classList.toggle("on", nowOn);

    try {

        await updateDoc(doc(db, "hosts", currentUser.uid), {
            [toggles[id]]: nowOn
        });

    }

    catch (error) {

        console.error("Failed to update setting:", error);
        el.classList.toggle("on", !nowOn); // revert on failure
        showToast("Couldn't save that setting — try again.");

    }

}

async function changePassword() {

    if (!currentUser?.email) return;

    if (!confirm(`Send a password reset link to ${currentUser.email}?`)) return;

    try {

        await sendPasswordResetEmail(auth, currentUser.email);
        showToast("Password reset link sent to your email 💜");

    }

    catch (error) {

        console.error("Failed to send password reset:", error);
        showToast("Couldn't send the reset link — please try again.");

    }

}

async function logout() {

    if (!confirm("Log out of Vivy?")) return;

    try {

        await updateDoc(doc(db, "hosts", currentUser.uid), {
            isOnline: false,
            callState: "offline"
        });

    }

    catch (e) { /* best effort */ }

    await signOut(auth);
    window.location.href = "login.html";

}

async function deleteAccount() {

    if (!confirm("This permanently deletes your Vivy Host account and cannot be undone. Continue?")) return;

    const password = prompt("For your security, please re-enter your password to confirm:");
    if (!password) return;

    try {

        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);

        await updateDoc(doc(db, "hosts", currentUser.uid), {
            status: "deleted",
            isOnline: false,
            callState: "offline"
        });

        await deleteUser(currentUser);

        window.location.href = "login.html";

    }

    catch (error) {

        console.error("Failed to delete account:", error);
        showToast("Couldn't delete your account — check your password and try again.");

    }

}
