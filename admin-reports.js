// ======================================================
// Vivy 💜 Admin — Reports
// Reads the SAME "recharges" and "hosts" / "agencies" collections
// every other Admin page reads — all math here (daily/weekly/
// monthly revenue, top performers) is computed client-side from
// that shared data, nothing new is written or duplicated.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { formatNumber, formatUsd } from "./ui-helpers.js";

init();

async function init() {

    const session = await adminSessionReady;
    if (!session) return;

    await loadRevenueReport();
    await loadTopHosts();
    await loadTopAgencies();

}

async function loadRevenueReport() {

    try {

        const snap = await getDocs(query(collection(db, "recharges"), where("status", "==", "success")));

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        let daily = 0, weekly = 0, monthly = 0, total = 0, coinSales = 0;

        snap.forEach((docSnap) => {

            const tx = docSnap.data();
            const amount = Number(tx.amountUsd || 0);
            const millis = tx.createdAt?.toMillis ? tx.createdAt.toMillis() : 0;
            const ageMs = now - millis;

            total += amount;
            coinSales += Number(tx.totalCoins || tx.coins || 0);

            if (ageMs <= oneDay) daily += amount;
            if (ageMs <= oneDay * 7) weekly += amount;
            if (ageMs <= oneDay * 30) monthly += amount;

        });

        document.getElementById("statDaily").textContent = formatUsd(daily);
        document.getElementById("statWeekly").textContent = formatUsd(weekly);
        document.getElementById("statMonthly").textContent = formatUsd(monthly);
        document.getElementById("statTotal").textContent = formatUsd(total);
        document.getElementById("statCoinSales").textContent = formatNumber(coinSales);

    }

    catch (error) {

        console.error("Failed to load revenue report:", error);

    }

}

async function loadTopHosts() {

    try {

        const snap = await getDocs(collection(db, "hosts"));

        let diamondTotal = 0;

        const hosts = snap.docs.map((docSnap) => {

            const host = docSnap.data();
            diamondTotal += Number(host.totalDiamondsEarned || 0);

            return { username: host.username || "Host", earned: Number(host.totalDiamondsEarned || 0) };

        });

        document.getElementById("statDiamonds").textContent = formatNumber(diamondTotal);

        hosts.sort((a, b) => b.earned - a.earned);

        renderRankedList("topHosts", hosts.slice(0, 10), (h) => `💜 ${formatNumber(h.earned)}`);

    }

    catch (error) {

        console.error("Failed to load top hosts:", error);

    }

}

async function loadTopAgencies() {

    try {

        const snap = await getDocs(collection(db, "agencies"));

        const agencies = snap.docs.map((docSnap) => {

            const agency = docSnap.data();
            return { username: agency.agencyName || "Agency", earned: Number(agency.totalCommissionEarned || 0) };

        });

        agencies.sort((a, b) => b.earned - a.earned);

        renderRankedList("topAgencies", agencies.slice(0, 10), (a) => formatUsd(a.earned));

    }

    catch (error) {

        console.error("Failed to load top agencies:", error);

    }

}

function renderRankedList(containerId, items, valueFn) {

    const listEl = document.getElementById(containerId);
    listEl.innerHTML = "";

    if (items.length === 0) {

        listEl.innerHTML = `<p class="admin-note" style="padding:12px">No data yet.</p>`;
        return;

    }

    items.forEach((item, index) => {

        const row = document.createElement("div");
        row.className = "data-row";
        row.innerHTML = `
            <div class="dr-main">
                <div class="dr-title">#${index + 1} ${escapeHtml(item.username)}</div>
            </div>
            <div class="dr-value">${valueFn(item)}</div>
        `;
        listEl.appendChild(row);

    });

}

function escapeHtml(text) {

    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;

}
