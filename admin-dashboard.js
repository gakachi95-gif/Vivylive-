// ======================================================
// Vivy 💜 Admin Dashboard
// Realtime platform-wide statistics. Reuses the exact same
// Firestore collections as every other dashboard in the app
// (accounts, hosts, agencies, recharges, withdrawals, calls,
// supportTickets) — nothing new is created here.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { logoutUser } from "./auth-service.js";
import { db } from "./firebase-config.js";
import {
    collection, onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { formatNumber, formatUsd } from "./ui-helpers.js";

document.getElementById("notificationBtn")
    .addEventListener("click", () => window.location.href = "admin-notifications.html");

document.getElementById("logoutBtn")
    .addEventListener("click", async () => {

        if (!confirm("Log out of the Admin Dashboard?")) return;

        await logoutUser();
        window.location.href = "index.html";

    });

init();

async function init() {

    const session = await adminSessionReady;

    if (!session) return;

    document.getElementById("adminNameLabel").textContent =
        session.admin.username || session.admin.email || "Admin";

    document.getElementById("adminNameLabel").classList.remove("skeleton");

    const photoEl = document.getElementById("adminPhoto");
    photoEl.src = session.admin.profilePhoto || "assets/default-avatar.png";
    photoEl.classList.remove("skeleton");

    listenForUserStats();
    listenForHostStats();
    listenForAgencyStats();
    listenForRevenueStats();
    listenForDiamondStats();
    listenForUnreadNotifications();

}

// ------------------------------------------------------
// Users — accounts where role == "user"
// ------------------------------------------------------

function listenForUserStats() {

    const q = query(collection(db, "accounts"), where("role", "==", "user"));

    onSnapshot(q, (snapshot) => {

        let onlineCount = 0;

        snapshot.forEach((docSnap) => {

            if (docSnap.data().isOnline) onlineCount++;

        });

        document.getElementById("statTotalUsers").textContent = formatNumber(snapshot.size);
        document.getElementById("statOnlineUsers").textContent = formatNumber(onlineCount);

    }, (error) => {

        console.error("Failed to load user stats:", error);

    });

}

// ------------------------------------------------------
// Hosts — every doc in "hosts"
// ------------------------------------------------------

function listenForHostStats() {

    onSnapshot(collection(db, "hosts"), (snapshot) => {

        let onlineCount = 0;
        let pendingCount = 0;
        let diamondTotal = 0;

        snapshot.forEach((docSnap) => {

            const host = docSnap.data();

            if (host.isOnline) onlineCount++;
            if (host.status === "pending") pendingCount++;

            diamondTotal += Number(host.totalDiamondsEarned || 0);

        });

        document.getElementById("statTotalHosts").textContent = formatNumber(snapshot.size);
        document.getElementById("statOnlineHosts").textContent = formatNumber(onlineCount);
        document.getElementById("statPendingHosts").textContent = formatNumber(pendingCount);
        document.getElementById("statDiamonds").textContent = formatNumber(diamondTotal);

    }, (error) => {

        console.error("Failed to load host stats:", error);

    });

}

// ------------------------------------------------------
// Agencies — every doc in "agencies"
// ------------------------------------------------------

function listenForAgencyStats() {

    onSnapshot(collection(db, "agencies"), (snapshot) => {

        let pendingCount = 0;

        snapshot.forEach((docSnap) => {

            if (docSnap.data().approved === false) pendingCount++;

        });

        document.getElementById("statTotalAgencies").textContent = formatNumber(snapshot.size);
        document.getElementById("statPendingAgencies").textContent = formatNumber(pendingCount);

    }, (error) => {

        console.error("Failed to load agency stats:", error);

    });

}

// ------------------------------------------------------
// Coins sold + revenue — every successful "recharges" doc
// (the same collection buy-coins.html / recharge.html write to)
// ------------------------------------------------------

function listenForRevenueStats() {

    const q = query(collection(db, "recharges"), where("status", "==", "success"));

    onSnapshot(q, (snapshot) => {

        let coinsSold = 0;
        let revenueUsd = 0;

        snapshot.forEach((docSnap) => {

            const recharge = docSnap.data();

            coinsSold += Number(recharge.totalCoins || recharge.coins || 0);
            revenueUsd += Number(recharge.amountUsd || 0);

        });

        document.getElementById("statCoinsSold").textContent = formatNumber(coinsSold);
        document.getElementById("statRevenue").textContent = formatUsd(revenueUsd);

    }, (error) => {

        console.error("Failed to load revenue stats:", error);

    });

}

// ------------------------------------------------------
// Diamonds generated is already covered inside
// listenForHostStats() (totalDiamondsEarned across Hosts) —
// kept as its own named step so it's easy to swap for a
// calls-based sum later without touching Host stats.
// ------------------------------------------------------

function listenForDiamondStats() {

    // Intentionally a no-op — see listenForHostStats().

}

// ------------------------------------------------------
// Notification dot — lights up whenever there's something
// waiting on admin-notifications.html (pending approvals,
// open support tickets).
// ------------------------------------------------------

function listenForUnreadNotifications() {

    const pendingHostsQuery = query(collection(db, "hosts"), where("status", "==", "pending"));
    const openTicketsQuery = query(collection(db, "supportTickets"), where("status", "==", "open"));

    let pendingHosts = 0;
    let openTickets = 0;

    const updateDot = () => {

        document.getElementById("notifDot").hidden = (pendingHosts + openTickets) === 0;

    };

    onSnapshot(pendingHostsQuery, (snapshot) => {

        pendingHosts = snapshot.size;
        updateDot();

    }, (error) => console.error("Failed to check pending hosts:", error));

    onSnapshot(openTicketsQuery, (snapshot) => {

        openTickets = snapshot.size;
        updateDot();

    }, (error) => console.error("Failed to check open tickets:", error));

    }
