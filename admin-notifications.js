// ======================================================
// Vivy 💜 Admin — Notifications
// A live activity feed built entirely from queries against the
// SAME collections every other Admin page already reads (accounts,
// hosts, agencies, recharges, supportTickets, payrollRuns) — no
// separate "adminNotifications" collection, nothing duplicated.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, where, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, formatNumber, formatUsd } from "./ui-helpers.js";

const feeds = new Map();

document.getElementById("backBtn").addEventListener("click", () => goBack("admin-dashboard.html"));

init();

async function init() {

    const session = await adminSessionReady;
    if (!session) return;

    listen("newUsers", query(collection(db, "accounts"), where("role", "==", "user"), orderBy("createdAt", "desc"), limit(5)),
        (docSnap) => ({
            icon: userIcon(),
            title: "New User",
            body: `${docSnap.data().username || docSnap.data().email || "A user"} just signed up.`,
            time: docSnap.data().createdAt
        }));

    listen("newHosts", query(collection(db, "hosts"), where("status", "==", "pending"), orderBy("createdAt", "desc"), limit(20)),
        (docSnap) => ({
            icon: hostIcon(),
            title: "Host Awaiting Approval",
            body: `${docSnap.data().username || "A Host"} is waiting for approval.`,
            time: docSnap.data().createdAt
        }));

    listen("newAgencies", query(collection(db, "agencies"), where("approved", "==", false), orderBy("createdAt", "desc"), limit(20)),
        (docSnap) => ({
            icon: agencyIcon(),
            title: "Agency Awaiting Approval",
            body: `${docSnap.data().agencyName || "An agency"} is waiting for approval.`,
            time: docSnap.data().createdAt
        }));

    listen("tx", query(collection(db, "recharges"), where("status", "==", "success"), orderBy("createdAt", "desc"), limit(5)),
        (docSnap) => ({
            icon: txIcon(),
            title: "New Transaction",
            body: `${formatUsd(docSnap.data().amountUsd)} · ${formatNumber(docSnap.data().totalCoins || docSnap.data().coins || 0)} Coins credited.`,
            time: docSnap.data().createdAt
        }));

    listen("tickets", query(collection(db, "supportTickets"), where("status", "==", "open"), orderBy("createdAt", "desc"), limit(10)),
        (docSnap) => ({
            icon: ticketIcon(),
            title: "Support Ticket",
            body: docSnap.data().subject || "A new ticket needs a reply.",
            time: docSnap.data().createdAt
        }));

    listen("payroll", query(collection(db, "payrollRuns"), orderBy("generatedAt", "desc"), limit(3)),
        (docSnap) => ({
            icon: payrollIcon(),
            title: "Payroll Generated",
            body: `${formatNumber(docSnap.data().hostCount || 0)} Hosts · ${formatUsd(docSnap.data().totalPayroll)} total.`,
            time: docSnap.data().generatedAt
        }));

}

function listen(key, q, mapFn) {

    onSnapshot(q, (snapshot) => {

        feeds.set(key, snapshot.docs.map(mapFn));
        render();

    }, (error) => console.error(`Failed to load ${key}:`, error));

}

function render() {

    const items = Array.from(feeds.values()).flat();

    items.sort((a, b) => (b.time?.toMillis?.() || 0) - (a.time?.toMillis?.() || 0));

    document.getElementById("emptyState").hidden = items.length !== 0;

    const listEl = document.getElementById("notifList");
    listEl.innerHTML = "";

    items.slice(0, 40).forEach((item) => {

        const row = document.createElement("div");
        row.className = "data-row";
        row.innerHTML = `
            <div class="dr-main">
                <div class="dr-title">${item.icon} ${item.title}</div>
                <div class="dr-sub">${item.body}</div>
            </div>
        `;
        listEl.appendChild(row);

    });

}

function userIcon() { return "👤"; }
function hostIcon() { return "🎙️"; }
function agencyIcon() { return "🏢"; }
function txIcon() { return "💳"; }
function ticketIcon() { return "🛟"; }
function payrollIcon() { return "💰"; }
