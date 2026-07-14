// ======================================================
// Vivy 💜 Host Wallet
// Diamonds-only wallet view for approved Hosts.
// No Payment History, no Pending Payroll, no Coin
// Recharge/Purchase — Hosts only ever earn Diamonds.
// ======================================================

import { hostSessionReady } from "./host-guard.js";
import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { formatNumber, goBack } from "./ui-helpers.js";

const MIN_WITHDRAWAL_DIAMONDS = 50000;

let currentUser = null;

document.getElementById("backBtn").addEventListener("click", () => goBack("host-dashboard.html"));

init();

async function init() {

    const session = await hostSessionReady;
    if (!session) return;

    currentUser = session.user;

    listenForWallet();

}

function listenForWallet() {

    onSnapshot(doc(db, "hosts", currentUser.uid), (snap) => {

        if (!snap.exists()) return;

        render(snap.data());

    }, (error) => {

        console.error("Failed to load wallet:", error);

    });

}

function render(host) {

    const diamonds = host.diamonds ?? 0;

    document.getElementById("diamondBalance").textContent = `${formatNumber(diamonds)} 💎`;
    document.getElementById("todayEarnings").textContent = `${formatNumber(host.todayEarnings ?? 0)} 💎`;
    document.getElementById("weekEarnings").textContent = `${formatNumber(host.weeklyDiamonds ?? 0)} 💎`;
    document.getElementById("totalDiamondsEarned").textContent = `${formatNumber(host.totalDiamondsEarned ?? 0)} 💎`;

    const pct = Math.min(100, (diamonds / MIN_WITHDRAWAL_DIAMONDS) * 100);
    document.getElementById("withdrawalProgressFill").style.width = `${pct}%`;
    document.getElementById("withdrawalProgressCaption").textContent =
        `${formatNumber(Math.min(diamonds, MIN_WITHDRAWAL_DIAMONDS))} / ${formatNumber(MIN_WITHDRAWAL_DIAMONDS)} diamonds`;

    const statusEl = document.getElementById("withdrawalStatus");

    if (diamonds >= MIN_WITHDRAWAL_DIAMONDS) {

        statusEl.textContent = "Eligible for next payroll.";
        statusEl.classList.add("eligible");

    }

    else {

        statusEl.textContent = "Keep earning to reach the minimum withdrawal.";
        statusEl.classList.remove("eligible");

    }

          }
