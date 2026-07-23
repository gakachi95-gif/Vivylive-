// ======================================================
// Vivy 💜 Agency Dashboard
// Realtime Agency profile + a live count/sum over every Host
// belonging to this Agency (hosts where agencyId == this uid).
// Commission is derived client-side at the same fixed rate as
// the Host Wallet (50,000 💎 = $15) — no separate ledger needed.
// ======================================================

import { agencySessionReady } from "./agency-guard.js";
import { logoutUser } from "./auth-service.js";
import { db } from "./firebase-config.js";
import {
    doc, onSnapshot, collection, query, where
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { formatNumber, diamondsToUsd, formatUsd } from "./ui-helpers.js";

let currentUser = null;

document.getElementById("qaInvite").addEventListener("click", () => window.location.href = "agency-invite.html");
document.getElementById("qaHosts").addEventListener("click", () => window.location.href = "agency-host.html");
document.getElementById("qaPerformance").addEventListener("click", () => window.location.href = "agency-performance.html");
document.getElementById("qaWallet").addEventListener("click", () => window.location.href = "agency-wallet.html");
document.getElementById("qaSupport").addEventListener("click", () => window.location.href = "agency-support.html");
document.getElementById("qaSettings").addEventListener("click", () => window.location.href = "agency-settings.html");

document.getElementById("notificationBtn").addEventListener("click", () => window.location.href = "agency-notifications.html");

document.getElementById("logoutBtn").addEventListener("click", async () => {

    if (!confirm("Log out of Vivy?")) return;

    await logoutUser();
    window.location.href = "agency-login.html";

});

init();

async function init() {

    const session = await agencySessionReady;
    if (!session) return;

    currentUser = session.user;

    document.getElementById("agencyUidLabel").textContent = `UID: ${session.agency.agencyUID || "—"}`;

    listenForAgencyProfile();
    listenForHostStats();
    listenForUnreadNotifications();

}

function listenForAgencyProfile() {

    onSnapshot(doc(db, "agencies", currentUser.uid), (snap) => {

        if (!snap.exists()) return;

        const agency = snap.data();

        document.getElementById("agencyNameLabel").textContent = agency.agencyName || "Agency";
        document.getElementById("agencyNameLabel").classList.remove("skeleton");

        document.getElementById("agencyUidLabel").textContent = `UID: ${agency.agencyUID || "—"}`;

        const logoEl = document.getElementById("agencyLogo");
        logoEl.src = agency.logoURL || "assets/default-avatar.png";
        logoEl.classList.remove("skeleton");
        logoEl.style.cursor = "pointer";
        logoEl.onclick = () => { location.href = "agency-settings.html"; };

    }, (error) => {

        console.error("Failed to load agency profile:", error);

    });

}

function listenForHostStats() {

    const q = query(collection(db, "hosts"), where("agencyId", "==", currentUser.uid));

    onSnapshot(q, (snapshot) => {

        let onlineCount = 0;
        let activeCount = 0;
        let totalCommissionUsd = 0;

        snapshot.forEach((docSnap) => {

            const host = docSnap.data();

            if (host.isOnline) onlineCount++;
            if (host.status === "approved") activeCount++;

            totalCommissionUsd += diamondsToUsd(host.totalDiamondsEarned) * 0.10;

        });

        document.getElementById("totalHosts").textContent = formatNumber(snapshot.size);
        document.getElementById("onlineHosts").textContent = formatNumber(onlineCount);
        document.getElementById("activeHosts").textContent = formatNumber(activeCount);
        document.getElementById("totalCommission").textContent = formatUsd(totalCommissionUsd);

    }, (error) => {

        console.error("Failed to load host stats:", error);

    });

}

function listenForUnreadNotifications() {

    const q = query(
        collection(db, "agencies", currentUser.uid, "notifications"),
        where("read", "==", false)
    );

    onSnapshot(q, (snapshot) => {

        document.getElementById("notifDot").hidden = snapshot.empty;

    }, (error) => {

        console.error("Failed to listen for notifications:", error);

    });

                                                          }
