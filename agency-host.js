// ======================================================
// Vivy 💜 Agency — My Hosts
// View-only. Agencies can see every Host that belongs to them,
// but can never approve, reject, suspend, or remove a Host —
// only Vivy Admin can do that.
// ======================================================

import { agencySessionReady } from "./agency-guard.js";
import { db } from "./firebase-config.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, formatNumber } from "./ui-helpers.js";

let allHosts = [];

document.getElementById("backBtn").addEventListener("click", () => goBack("agency-dashboard.html"));
document.getElementById("searchInput").addEventListener("input", (e) => render(filterHosts(e.target.value)));

init();

async function init() {

    const session = await agencySessionReady;
    if (!session) return;

    listenForHosts(session.user.uid);

}

function listenForHosts(agencyUid) {

    const q = query(collection(db, "hosts"), where("agencyId", "==", agencyUid));

    onSnapshot(q, (snapshot) => {

        allHosts = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        render(filterHosts(document.getElementById("searchInput").value));

    }, (error) => {

        console.error("Failed to load hosts:", error);

        document.getElementById("hostsList").innerHTML =
            `<div class="empty-state"><p>Couldn't load your hosts right now.</p></div>`;

    });

}

function filterHosts(term) {

    const clean = term.trim().toLowerCase();
    if (!clean) return allHosts;

    return allHosts.filter((host) =>
        host.username?.toLowerCase().includes(clean) ||
        host.id?.toLowerCase().includes(clean)
    );

}

function render(hosts) {

    const container = document.getElementById("hostsList");

    if (hosts.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                <p>No hosts found</p>
                <p style="font-size:0.7rem">Invite Hosts to see them appear here.</p>
            </div>
        `;
        return;

    }

    container.innerHTML = "";

    hosts.forEach((host, index) => {

        const row = document.createElement("div");
        row.className = "host-card list-card";

        row.innerHTML = `
            <span class="host-card-photo">
                <img src="${host.profilePhoto || "assets/default-avatar.png"}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">
                <span class="online-dot ${host.isOnline ? "online" : ""}"></span>
            </span>
            <div class="host-card-text">
                <div class="name">${escapeHtml(host.username || "Host")}</div>
                <div class="meta">${escapeHtml(host.country || "—")} · UID ${host.id.slice(0, 8)}…</div>
            </div>
            <div class="host-card-stats">
                <div class="diamonds">${formatNumber(host.totalDiamondsEarned ?? 0)} 💎</div>
                <div class="earnings">Today ${formatNumber(host.todayEarnings ?? 0)} · Week ${formatNumber(host.weeklyDiamonds ?? 0)}</div>
            </div>
        `;

        container.appendChild(row);

        if (index < hosts.length - 1) {

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
