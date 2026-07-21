// ======================================================
// Vivy 💜 Admin — Transactions
// Reads the SAME "recharges" collection every Coin purchase in
// the app writes to (buy-coins.html / recharge.html / the
// Render backend's /verify-payment and /flutterwave-webhook) —
// nothing new, nothing duplicated. Search, filter, and CSV export only.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, formatNumber, formatUsd, showToast } from "./ui-helpers.js";

let allTx = [];
let activeFilter = "all";

document.getElementById("backBtn").addEventListener("click", () => goBack("admin-dashboard.html"));
document.getElementById("exportBtn").addEventListener("click", exportCsv);
document.getElementById("searchInput").addEventListener("input", renderList);

document.querySelectorAll(".filter-tab").forEach((tab) => {

    tab.addEventListener("click", () => {

        document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        activeFilter = tab.dataset.filter;
        renderList();

    });

});

init();

async function init() {

    const session = await adminSessionReady;
    if (!session) return;

    listenForTx();

}

function listenForTx() {

    const q = query(collection(db, "recharges"), orderBy("createdAt", "desc"), limit(300));

    onSnapshot(q, (snapshot) => {

        allTx = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        renderList();

    }, (error) => {

        console.error("Failed to load transactions:", error);
        showToast("Couldn't load transactions.");

    });

}

function renderList() {

    const term = document.getElementById("searchInput").value.trim().toLowerCase();

    const filtered = allTx.filter((tx) => {

        const status = tx.status || "pending";

        if (activeFilter !== "all" && status !== activeFilter) return false;

        if (!term) return true;

        return (
            (tx.uid || "").toLowerCase().includes(term) ||
            (tx.reference || "").toLowerCase().includes(term)
        );

    });

    document.getElementById("resultCount").textContent =
        `${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`;

    document.getElementById("emptyState").hidden = filtered.length !== 0;

    let revenue = 0;
    let coins = 0;

    filtered.forEach((tx) => {

        if ((tx.status || "pending") === "success") {

            revenue += Number(tx.amountUsd || 0);
            coins += Number(tx.totalCoins || tx.coins || 0);

        }

    });

    document.getElementById("statRevenue").textContent = formatUsd(revenue);
    document.getElementById("statCoins").textContent = formatNumber(coins);

    const listEl = document.getElementById("txList");
    listEl.innerHTML = "";

    filtered.forEach((tx) => listEl.appendChild(buildTxRow(tx)));

}

function buildTxRow(tx) {

    const status = tx.status || "pending";
    const date = tx.createdAt?.toDate ? tx.createdAt.toDate() : null;

    const row = document.createElement("div");
    row.className = "data-row";

    const localAmount = tx.amountLocal && tx.localCurrency
        ? ` · ${tx.localCurrency} ${formatNumber(tx.amountLocal)}`
        : "";

    row.innerHTML = `
        <div class="dr-main">
            <div class="dr-title">${escapeHtml(tx.uid || "—")} · ${formatUsd(tx.amountUsd)}${localAmount}</div>
            <div class="dr-sub">${escapeHtml(tx.gateway || "flutterwave")} · ${escapeHtml(tx.reference || tx.id)}${date ? ` · ${date.toLocaleDateString()}` : ""}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
            <div class="dr-value">💜 ${formatNumber(tx.totalCoins || tx.coins || 0)}</div>
            <span class="pill ${status}" style="margin-top:4px;display:inline-block">${status}</span>
        </div>
    `;

    return row;

}

function exportCsv() {

    if (allTx.length === 0) {

        showToast("No transactions to export.");
        return;

    }

    const headers = ["UID", "Currency", "Local Amount", "USD Amount", "Coins", "Gateway", "Reference", "Status", "Date"];

    const rows = allTx.map((tx) => {

        const date = tx.createdAt?.toDate ? tx.createdAt.toDate().toISOString() : "";

        return [
            tx.uid || "",
            tx.localCurrency || "USD",
            tx.amountLocal ?? "",
            tx.amountUsd ?? "",
            tx.totalCoins || tx.coins || 0,
            tx.gateway || "flutterwave",
            tx.reference || tx.id,
            tx.status || "pending",
            date
        ];

    });

    const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `vivy-transactions-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

}

function escapeHtml(text) {

    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;

                                                    }
