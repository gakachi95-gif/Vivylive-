// ======================================================
// Vivy 💜 Admin — Host Management
// Reads/writes the SAME "hosts" collection every other page
// in the app uses — nothing new, nothing duplicated.
//
// "View Profile" opens an in-page detail modal rather than
// navigating to host-profile.html, since that page is gated
// by host-guard.js (Host accounts only) and is meant for a
// Host editing their own profile — not for Admin to view
// someone else's.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, orderBy, limit,
    onSnapshot, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, formatNumber, showToast } from "./ui-helpers.js";

let allHosts = [];
let activeFilter = "all";
let pendingAction = null;

document.getElementById("backBtn").addEventListener("click", () => goBack("admin-management.html"));

document.getElementById("searchInput").addEventListener("input", renderList);

document.querySelectorAll(".filter-tab").forEach((tab) => {

    tab.addEventListener("click", () => {

        document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        activeFilter = tab.dataset.filter;
        renderList();

    });

});

document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirm);

document.getElementById("confirmOkBtn").addEventListener("click", async () => {

    if (pendingAction) await pendingAction();
    closeConfirm();

});

init();

async function init() {

    const session = await adminSessionReady;

    if (!session) return;

    listenForHosts();

}

function listenForHosts() {

    const q = query(collection(db, "hosts"), orderBy("createdAt", "desc"), limit(200));

    onSnapshot(q, (snapshot) => {

        allHosts = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        renderList();

    }, (error) => {

        console.error("Failed to load hosts:", error);
        showToast("Couldn't load hosts.");

    });

}

function renderList() {

    const term = document.getElementById("searchInput").value.trim().toLowerCase();

    const filtered = allHosts.filter((host) => {

        const status = host.status || "pending";

        if (activeFilter !== "all" && status !== activeFilter) return false;

        if (!term) return true;

        return (
            (host.username || "").toLowerCase().includes(term) ||
            host.id.toLowerCase().includes(term) ||
            (host.agencyName || "").toLowerCase().includes(term)
        );

    });

    document.getElementById("resultCount").textContent =
        `${filtered.length} host${filtered.length === 1 ? "" : "s"}`;

    document.getElementById("emptyState").hidden = filtered.length !== 0;

    const listEl = document.getElementById("hostList");
    listEl.innerHTML = "";

    filtered.forEach((host) => listEl.appendChild(buildHostCard(host)));

}

function buildHostCard(host) {

    const status = host.status || "pending";

    const card = document.createElement("div");
    card.className = "mgmt-card mgmt-full";

    card.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;width:100%">
            <div class="mgmt-photo">
                <img src="${host.profilePhoto || "assets/default-avatar.png"}" alt="">
                <span class="dot ${host.isOnline ? "online" : ""}"></span>
            </div>
            <div class="mgmt-text">
                <div class="mgmt-name">${escapeHtml(host.username || "Host")}</div>
                <div class="mgmt-meta">UID ${host.id} · ${escapeHtml(host.agencyName || "No agency")}</div>
            </div>
            <span class="pill ${status}">${status}</span>
        </div>
        <div class="mgmt-actions">
            ${status === "pending" ? `
                <button type="button" class="btn-mini approve" data-action="approve">Approve</button>
                <button type="button" class="btn-mini reject" data-action="reject">Reject</button>
            ` : ""}
            ${status !== "suspended" && status !== "pending"
                ? `<button type="button" class="btn-mini suspend" data-action="suspend">Suspend</button>`
                : ""}
            ${status === "suspended"
                ? `<button type="button" class="btn-mini approve" data-action="approve">Reinstate</button>`
                : ""}
            ${status !== "banned"
                ? `<button type="button" class="btn-mini ban" data-action="ban">Ban</button>`
                : `<button type="button" class="btn-mini approve" data-action="approve">Unban</button>`}
            <button type="button" class="btn-mini" data-action="view">View Profile</button>
        </div>
    `;

    card.querySelector('[data-action="approve"]')?.addEventListener("click", () => setStatus(host, "approved"));
    card.querySelector('[data-action="reject"]')?.addEventListener("click", () => confirmAction(
        "Reject this host?",
        `${host.username || "This host"}'s application will be rejected. They won't be able to go online or receive calls.`,
        () => setStatus(host, "rejected")
    ));
    card.querySelector('[data-action="suspend"]')?.addEventListener("click", () => confirmAction(
        "Suspend this host?",
        `${host.username || "This host"} will be taken offline and blocked from receiving calls until reinstated.`,
        () => setStatus(host, "suspended")
    ));
    card.querySelector('[data-action="ban"]')?.addEventListener("click", () => confirmAction(
        "Ban this host?",
        `${host.username || "This host"} will be permanently banned from hosting on Vivy. This can be reversed from the Banned tab.`,
        () => setStatus(host, "banned")
    ));
    card.querySelector('[data-action="view"]')?.addEventListener("click", () => openProfileModal(host));

    return card;

}

async function setStatus(host, status) {

    try {

        const payload = { status };

        // Pending Hosts always start offline — approving them doesn't
        // automatically bring them online, but rejecting/suspending/
        // banning an already-online Host should take them offline
        // immediately.
        if (status !== "approved") {

            payload.isOnline = false;

        }

        await updateDoc(doc(db, "hosts", host.id), payload);
        showToast(`${host.username || "Host"} is now ${status}.`);

    }

    catch (error) {

        console.error("Failed to update host status:", error);
        showToast("Couldn't update this host. Please try again.");

    }

}

function confirmAction(title, body, action) {

    openConfirm(title, body, action);

}

function openConfirm(title, body, action) {

    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmBody").textContent = body;
    pendingAction = action;
    document.getElementById("confirmBackdrop").classList.add("show");

}

function closeConfirm() {

    document.getElementById("confirmBackdrop").classList.remove("show");
    pendingAction = null;

}

// ------------------------------------------------------
// View Profile — read-only detail modal
// ------------------------------------------------------

function openProfileModal(host) {

    const backdrop = document.getElementById("confirmBackdrop");

    document.getElementById("confirmTitle").textContent = host.username || "Host";

    document.getElementById("confirmBody").innerHTML = `
        <span style="display:block;margin-bottom:4px">UID: ${host.id}</span>
        <span style="display:block;margin-bottom:4px">Agency: ${escapeHtml(host.agencyName || "—")}</span>
        <span style="display:block;margin-bottom:4px">Status: ${host.status || "pending"}</span>
        <span style="display:block;margin-bottom:4px">Online: ${host.isOnline ? "Yes" : "No"}</span>
        <span style="display:block;margin-bottom:4px">Diamonds: ${formatNumber(host.diamonds ?? 0)}</span>
        <span style="display:block;margin-bottom:4px">Total Earned: ${formatNumber(host.totalDiamondsEarned ?? 0)} 💎</span>
        <span style="display:block;margin-bottom:4px">Country: ${escapeHtml(host.country || "—")}</span>
        <span style="display:block">Bio: ${escapeHtml(host.bio || "—")}</span>
    `;

    pendingAction = null;

    const okBtn = document.getElementById("confirmOkBtn");
    okBtn.textContent = "Close";

    const cancelBtn = document.getElementById("confirmCancelBtn");
    cancelBtn.hidden = true;

    const restoreAndClose = () => {

        okBtn.textContent = "Confirm";
        cancelBtn.hidden = false;
        okBtn.removeEventListener("click", restoreAndClose);
        closeConfirm();

    };

    okBtn.addEventListener("click", restoreAndClose, { once: true });

    backdrop.classList.add("show");

}

function escapeHtml(text) {

    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;

  }
