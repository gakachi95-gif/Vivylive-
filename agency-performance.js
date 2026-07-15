// ======================================================
// Vivy 💜 Agency — Host Performance
// View only. Top Hosts + Weekly Rankings come straight from
// each Host's own running totals (totalDiamondsEarned /
// weeklyDiamonds). Monthly Rankings and Total Calls are
// aggregated from the "calls" collection (hostUid + startTime +
// diamondsEarned already exist on every call doc — see
// audio-call.js / video-call.js), so no new collection or
// field is introduced anywhere.
// ======================================================

import { agencySessionReady } from "./agency-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, where, getDocs, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, formatNumber } from "./ui-helpers.js";

const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

let allHosts = [];
let monthlyTotals = new Map(); // hostUid -> diamonds earned in the last 30 days
let activeTab = "top";

document.getElementById("backBtn").addEventListener("click", () => goBack("agency-dashboard.html"));

document.getElementById("tabTop").addEventListener("click", () => switchTab("top"));
document.getElementById("tabWeekly").addEventListener("click", () => switchTab("weekly"));
document.getElementById("tabMonthly").addEventListener("click", () => switchTab("monthly"));

init();

async function init() {

    const session = await agencySessionReady;
    if (!session) return;

    listenForHosts(session.user.uid);

}

function listenForHosts(agencyUid) {

    const q = query(collection(db, "hosts"), where("agencyId", "==", agencyUid));

    onSnapshot(q, async (snapshot) => {

        allHosts = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

        const totalDiamonds = allHosts.reduce((sum, h) => sum + Number(h.totalDiamondsEarned || 0), 0);
        document.getElementById("totalDiamonds").textContent = formatNumber(totalDiamonds);

        await loadCallStats(allHosts.map((h) => h.id));
        renderRankings();

    }, (error) => {

        console.error("Failed to load hosts:", error);

    });

}

// Firestore "in" queries cap at 30 values, so chunk host ids for
// Agencies with larger rosters.
async function loadCallStats(hostIds) {

    monthlyTotals = new Map();
    let totalCalls = 0;

    if (hostIds.length === 0) {

        document.getElementById("totalCalls").textContent = "0";
        return;

    }

    const cutoff = new Date(Date.now() - MS_30_DAYS);
    const chunks = [];

    for (let i = 0; i < hostIds.length; i += 30) {

        chunks.push(hostIds.slice(i, i + 30));

    }

    try {

        for (const chunk of chunks) {

            const q = query(collection(db, "calls"), where("hostUid", "in", chunk));
            const snap = await getDocs(q);

            totalCalls += snap.size;

            snap.forEach((docSnap) => {

                const call = docSnap.data();
                const startedAt = call.startTime?.toDate ? call.startTime.toDate() : null;

                if (startedAt && startedAt >= cutoff) {

                    const prev = monthlyTotals.get(call.hostUid) || 0;
                    monthlyTotals.set(call.hostUid, prev + Number(call.diamondsEarned || 0));

                }

            });

        }

    }

    catch (error) {

        console.error("Failed to load call stats:", error);

    }

    document.getElementById("totalCalls").textContent = formatNumber(totalCalls);

}

function switchTab(tab) {

    activeTab = tab;

    document.getElementById("tabTop").classList.toggle("active", tab === "top");
    document.getElementById("tabWeekly").classList.toggle("active", tab === "weekly");
    document.getElementById("tabMonthly").classList.toggle("active", tab === "monthly");

    renderRankings();

}

function renderRankings() {

    const container = document.getElementById("rankingsList");

    let ranked;

    if (activeTab === "weekly") {

        ranked = [...allHosts]
            .map((h) => ({ ...h, rankValue: Number(h.weeklyDiamonds || 0) }))
            .sort((a, b) => b.rankValue - a.rankValue);

    }

    else if (activeTab === "monthly") {

        ranked = [...allHosts]
            .map((h) => ({ ...h, rankValue: monthlyTotals.get(h.id) || 0 }))
            .sort((a, b) => b.rankValue - a.rankValue);

    }

    else {

        ranked = [...allHosts]
            .map((h) => ({ ...h, rankValue: Number(h.totalDiamondsEarned || 0) }))
            .sort((a, b) => b.rankValue - a.rankValue);

    }

    ranked = ranked.slice(0, 10);

    if (ranked.length === 0) {

        container.innerHTML = `<div class="empty-state"><p>No host activity yet.</p></div>`;
        return;

    }

    container.innerHTML = "";

    ranked.forEach((host, index) => {

        const row = document.createElement("div");
        row.className = "rank-row list-card";

        row.innerHTML = `
            <span class="rank-num">${index + 1}</span>
            <img class="rank-photo" src="${host.profilePhoto || "assets/default-avatar.png"}" alt="">
            <div class="rank-text">
                <div class="name">${escapeHtml(host.username || "Host")}</div>
            </div>
            <span class="rank-diamonds">${formatNumber(host.rankValue)} 💎</span>
        `;

        container.appendChild(row);

        if (index < ranked.length - 1) {

            const divider = document.createElement("div");
            divider.style.borderBottom = "1px solid var(--glass-border)";
            container.appendChild(divider);

        }

    });

}

function escapeHtml(value) {

    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;

}
