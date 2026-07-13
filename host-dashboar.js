// ======================================================
// Vivy 💜 Host Dashboard
// Realtime host profile, online/offline presence toggle,
// earnings cards, withdrawal progress, quick actions.
// ======================================================

import { hostSessionReady } from "./host-guard.js";
import { logoutUser } from "./auth-service.js";
import { db } from "./firebase-config.js";
import { doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { formatNumber, showToast } from "./ui-helpers.js";

const MIN_WITHDRAWAL_DIAMONDS = 50000;
const MIN_WITHDRAWAL_USD = 15;

let currentUser = null;
let currentHost = null;

const presenceToggle = document.getElementById("presenceToggle");
const presenceLabel = document.getElementById("presenceLabel");

presenceToggle.addEventListener("click", togglePresence);

document.getElementById("qaWallet").addEventListener("click", () => window.location.href = "host-wallet.html");
document.getElementById("qaPayments").addEventListener("click", () => window.location.href = "host-payment-history.html");
document.getElementById("qaProfile").addEventListener("click", () => window.location.href = "host-profile.html");
document.getElementById("qaCallHistory").addEventListener("click", () => window.location.href = "host-call-history.html");
document.getElementById("qaSupport").addEventListener("click", () => window.location.href = "host-support.html");
document.getElementById("qaSettings").addEventListener("click", () => window.location.href = "host-settings.html");

document.getElementById("logoutBtn").addEventListener("click", async () => {

    if (!confirm("Log out of Vivy?")) return;

    // Go offline on the way out so no one tries to call a signed-out Host.
    try {

        if (currentUser) {

            await updateDoc(doc(db, "hosts", currentUser.uid), {
                isOnline: false,
                callState: "offline"
            });

        }

    }

    catch (e) { /* best effort */ }

    await logoutUser();
    window.location.href = "login.html";

});

init();

async function init() {

    const session = await hostSessionReady;
    if (!session) return;

    currentUser = session.user;

    // Only fully approved Hosts belong on this page — anything else
    // (pending, rejected, suspended) goes back to the status page.
    if (session.host.status !== "approved") {

        window.location.href = "host-pending.html";
        return;

    }

    document.getElementById("hostUidLabel").textContent = `UID: ${currentUser.uid.slice(0, 10)}…`;

    listenForHostUpdates();

}

function listenForHostUpdates() {

    onSnapshot(doc(db, "hosts", currentUser.uid), (snap) => {

        if (!snap.exists()) return;

        currentHost = snap.data();
        render(currentHost);

    }, (error) => {

        console.error("Failed to load host profile:", error);

    });

}

function render(host) {

    const avatarEl = document.getElementById("hostAvatar");
    avatarEl.src = host.profilePhoto || "assets/default-avatar.png";
    avatarEl.classList.remove("skeleton");

    const nameEl = document.getElementById("hostUsername");
    nameEl.textContent = host.username || host.fullName || "Host";
    nameEl.classList.remove("skeleton");

    document.getElementById("hostAgencyName").textContent = host.agencyName || "—";

    presenceToggle.classList.toggle("online", !!host.isOnline);
    presenceLabel.textContent = host.isOnline ? "Online" : "Offline";

    document.getElementById("diamondBalance").textContent = `${formatNumber(host.diamonds ?? 0)} 💎`;
    document.getElementById("todayEarnings").textContent = `${formatNumber(host.todayEarnings ?? 0)} 💎`;
    document.getElementById("weekEarnings").textContent = `${formatNumber(host.weeklyDiamonds ?? 0)} 💎`;
    document.getElementById("totalDiamondsEarned").textContent = `${formatNumber(host.totalDiamondsEarned ?? 0)} 💎`;

    renderProgress(host.diamonds ?? 0);

}

function renderProgress(diamonds) {

    const pct = Math.min(100, (diamonds / MIN_WITHDRAWAL_DIAMONDS) * 100);
    document.getElementById("withdrawalProgressFill").style.width = `${pct}%`;
    document.getElementById("withdrawalProgressCaption").textContent =
        `${formatNumber(Math.min(diamonds, MIN_WITHDRAWAL_DIAMONDS))} / ${formatNumber(MIN_WITHDRAWAL_DIAMONDS)} diamonds`;

    const statusEl = document.getElementById("withdrawalStatus");

    if (diamonds >= MIN_WITHDRAWAL_DIAMONDS) {

        statusEl.textContent = `Eligible For Next Payroll — $${((Math.floor(diamonds / MIN_WITHDRAWAL_DIAMONDS)) * MIN_WITHDRAWAL_USD).toFixed(2)}`;
        statusEl.classList.add("eligible");

    }

    else {

        statusEl.textContent = "Keep earning to reach the minimum withdrawal.";
        statusEl.classList.remove("eligible");

    }

}

async function togglePresence() {

    if (!currentHost) return;

    // A Host already on an active call shouldn't be able to go offline
    // mid-call — the call flow itself handles ending the call first.
    if (currentHost.callState === "busy") {

        showToast("You're on a call — presence updates when it ends.");
        return;

    }

    const goingOnline = !currentHost.isOnline;

    try {

        await updateDoc(doc(db, "hosts", currentUser.uid), {
            isOnline: goingOnline,
            callState: goingOnline ? "online" : "offline"
        });

        showToast(goingOnline ? "You're online 💜" : "You're offline");

    }

    catch (error) {

        console.error("Failed to update presence:", error);
        showToast("Couldn't update your status — try again.");

    }

}
