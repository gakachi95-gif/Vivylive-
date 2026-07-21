// ======================================================
// Vivy 💜 Wallet
// Coin + diamond balances, host payroll/earnings stats,
// and tabbed history (activity / recharges / withdrawals).
// ======================================================

import { authReady } from "./auth-guard.js";
import { getCurrentProfile } from "./auth-service.js";
import { db } from "./firebase-config.js";
import {
    collection, query, where, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, formatNumber } from "./ui-helpers.js";

// ======================================================
// Vivy economy constants — do not change without updating
// the same constants in audio-call.js / video-call.js /
// recharge.js / the payroll backend job.
// ======================================================
const MIN_WITHDRAWAL_DIAMONDS = 50000;
const MIN_WITHDRAWAL_USD = 15;

let currentUser = null;
let profile = null;
let activeTab = "activity";

document.getElementById("backBtn").addEventListener("click", () => goBack("user-dashboard.html"));
document.getElementById("rechargeBtn").addEventListener("click", () => window.location.href = "recharge.html");

// Optional — only wired up if a future markup change adds a #historyBtn.
// Guarded so its absence can never crash the module (this was previously
// an unguarded getElementById(...).addEventListener(...) call that threw
// on every page load and silently prevented init() from ever running).
document.getElementById("historyBtn")?.addEventListener("click", () => {

    switchTab("recharge");
    document.getElementById("transactionsList").scrollIntoView({ behavior: "smooth", block: "start" });

});

document.querySelectorAll(".tab-btn").forEach((btn) => {

    btn.addEventListener("click", () => switchTab(btn.dataset.tab));

});

init();

async function init() {

    currentUser = await authReady;
    if (!currentUser) return;

    try {

        profile = await getCurrentProfile(currentUser.uid);
        renderBalances();

        if (profile?.role === "host") {

            // wallet.html's Host section is id="hostPayrollSection" (not a
            // .host-only class — that selector never matched anything here).
            document.getElementById("hostPayrollSection")?.classList.add("show");
            renderHostEconomy();

        }

        loadActivity();

    }

    catch (error) {

        console.error("Failed to load wallet:", error);

    }

}

function renderBalances() {

    const coinsEl = document.getElementById("coinBalanceAmt");
    coinsEl.textContent = formatNumber(profile?.coins ?? 0);
    coinsEl.classList.remove("skeleton");

    if (profile?.bonusCoinsTotal) {

        const bonusLineEl = document.getElementById("bonusCoinsLine");
        const bonusAmtEl = document.getElementById("bonusCoinsAmt");

        if (bonusLineEl) bonusLineEl.style.display = "block";
        if (bonusAmtEl) bonusAmtEl.textContent = formatNumber(profile.bonusCoinsTotal);

    }

    const diamondsEl = document.getElementById("diamondBalanceAmt");
    diamondsEl.textContent = formatNumber(profile?.diamonds ?? 0);
    diamondsEl.classList.remove("skeleton");

}

function renderHostEconomy() {

    const diamonds = profile?.diamonds ?? 0;
    const weeklyDiamonds = profile?.weeklyDiamonds ?? 0;

    // Pending payroll: diamonds already banked but not yet paid out.
    // Only balances at/above the minimum are actually payable next run.
    const eligibleUnits = Math.floor(diamonds / MIN_WITHDRAWAL_DIAMONDS);
    const pendingUsd = eligibleUnits * MIN_WITHDRAWAL_USD;

    // Every lookup below is optional-chained on purpose: this branch only
    // ever runs for profile.role === "host", which — given Hosts live in
    // their own "hosts" collection, not "accounts" — can't currently
    // happen in practice (Hosts use host-wallet.html instead). Guarding
    // it means that fact can never turn into a crash that blocks the
    // rest of the page (Recent Calls / Recharge History) from loading.
    const pendingPayrollEl = document.getElementById("pendingPayrollAmt");
    if (pendingPayrollEl) pendingPayrollEl.textContent = `$${pendingUsd.toFixed(2)}`;

    const nextPayrollEl = document.getElementById("nextPayrollDate");
    if (nextPayrollEl) nextPayrollEl.textContent = formatDate(getNextPayrollDate());

    const weeklyUsd = (weeklyDiamonds / MIN_WITHDRAWAL_DIAMONDS) * MIN_WITHDRAWAL_USD;

    const weeklyDiamondsEl = document.getElementById("weeklyDiamondsAmt");
    if (weeklyDiamondsEl) weeklyDiamondsEl.textContent = `${formatNumber(weeklyDiamonds)} 💎`;

    const weeklyEarningsEl = document.getElementById("weeklyEarningsAmt");
    if (weeklyEarningsEl) weeklyEarningsEl.textContent = `$${weeklyUsd.toFixed(2)}`;

    const progressPct = Math.min(100, (diamonds / MIN_WITHDRAWAL_DIAMONDS) * 100);

    const progressFillEl = document.getElementById("withdrawalProgressFill");
    if (progressFillEl) progressFillEl.style.width = `${progressPct}%`;

    const progressPercentEl = document.getElementById("progressPercentLabel");
    if (progressPercentEl) progressPercentEl.textContent = `${Math.round(progressPct)}%`;

    const progressNoteEl = document.getElementById("withdrawalProgressNote");
    if (progressNoteEl) {

        progressNoteEl.textContent =
            `${formatNumber(Math.min(diamonds, MIN_WITHDRAWAL_DIAMONDS))} / ${formatNumber(MIN_WITHDRAWAL_DIAMONDS)} Diamonds needed to withdraw`;

    }

}

function getNextPayrollDate() {

    // Payroll is generated every Monday. If today is Monday, treat today
    // as the payout date; otherwise find the coming Monday.
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday ... 6 = Saturday
    const daysUntilMonday = (1 - day + 7) % 7;

    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilMonday);
    return next;

}

function formatDate(date) {

    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

}

function switchTab(tab) {

    activeTab = tab;

    document.querySelectorAll(".tab-btn").forEach((btn) => {

        btn.classList.toggle("active", btn.dataset.tab === tab);

    });

    loadActivity();

}

async function loadActivity() {

    const listEl = document.getElementById("transactionsList");
    listEl.innerHTML = `<div class="empty-state"><p>Loading…</p></div>`;

    try {

        if (activeTab === "activity") await loadCallActivity(listEl);
        else if (activeTab === "recharge") await loadRechargeHistory(listEl);
        else if (activeTab === "withdrawal") await loadWithdrawalHistory(listEl);

    }

    catch (error) {

        console.error(`Failed to load ${activeTab} history:`, error);
        listEl.innerHTML = `<div class="empty-state"><p>Couldn't load this right now.</p></div>`;

    }

}

async function loadCallActivity(listEl) {

    // Completed calls double as the wallet's spend history —
    // coin spend events are recorded there (see audio-call.js / video-call.js).
    const snapshot = await getDocs(
        query(
            collection(db, "calls"),
            where("callerUid", "==", currentUser.uid),
            orderBy("startTime", "desc"),
            limit(20)
        )
    );

    if (snapshot.empty) {

        listEl.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>
                <p>No transactions yet</p>
            </div>
        `;
        return;

    }

    listEl.innerHTML = "";

    snapshot.forEach((docSnap) => {

        const call = docSnap.data();
        const row = document.createElement("div");
        row.className = "list-card";
        row.innerHTML = `
            <span class="list-icon-circle tx-icon out">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    ${call.callType === "video"
                        ? '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>'
                        : '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>'}
                </svg>
            </span>
            <div class="list-text">
                <div class="list-title">${call.callType === "video" ? "Video" : "Audio"} call</div>
                <div class="list-subtitle">${call.duration ? Math.round(call.duration) + "s" : ""}</div>
            </div>
            <div class="tx-amount negative">-${formatNumber(call.coinsSpent ?? 0)}</div>
        `;
        listEl.appendChild(row);

    });

}

async function loadRechargeHistory(listEl) {

    const snapshot = await getDocs(
        query(
            collection(db, "recharges"),
            where("uid", "==", currentUser.uid),
            orderBy("createdAt", "desc"),
            limit(20)
        )
    );

    if (snapshot.empty) {

        listEl.innerHTML = `
            <div class="empty-state">
                <p>No recharges yet</p>
                <p style="font-size:0.7rem">Your Flutterwave recharges will show up here</p>
            </div>
        `;
        return;

    }

    listEl.innerHTML = "";

    snapshot.forEach((docSnap) => {

        const tx = docSnap.data();
        const row = document.createElement("div");
        row.className = "list-card";
        row.innerHTML = `
            <span class="list-icon-circle tx-icon in">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            </span>
            <div class="list-text">
                <div class="list-title">$${Number(tx.amountUsd ?? 0).toFixed(2)} recharge</div>
                <div class="list-subtitle">${tx.status || "completed"}${tx.bonusCoins ? ` · +${formatNumber(tx.bonusCoins)} bonus` : ""}</div>
            </div>
            <div class="tx-amount positive">+${formatNumber(tx.totalCoins ?? tx.coinsPurchased ?? 0)}</div>
        `;
        listEl.appendChild(row);

    });

}

async function loadWithdrawalHistory(listEl) {

    const snapshot = await getDocs(
        query(
            collection(db, "withdrawals"),
            where("uid", "==", currentUser.uid),
            orderBy("createdAt", "desc"),
            limit(20)
        )
    );

    if (snapshot.empty) {

        listEl.innerHTML = `
            <div class="empty-state">
                <p>No payouts yet</p>
                <p style="font-size:0.7rem">Payroll runs every Monday for eligible hosts</p>
            </div>
        `;
        return;

    }

    listEl.innerHTML = "";

    snapshot.forEach((docSnap) => {

        const tx = docSnap.data();
        const row = document.createElement("div");
        row.className = "list-card";
        row.innerHTML = `
            <span class="list-icon-circle tx-icon in">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            </span>
            <div class="list-text">
                <div class="list-title">${formatNumber(tx.diamonds ?? 0)} 💎 payout</div>
                <div class="list-subtitle">${tx.status || "pending"}</div>
            </div>
            <div class="tx-amount positive">+$${Number(tx.usdAmount ?? 0).toFixed(2)}</div>
        `;
        listEl.appendChild(row);

    });

}
