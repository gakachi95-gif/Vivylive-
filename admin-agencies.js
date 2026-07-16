// ======================================================
// Vivy 💜 Admin — Agency Management
// Reads/writes the SAME "agencies" collection every other page
// in the app uses — nothing new, nothing duplicated.
//
// "Agency Registration Link" is simply agency-register.html
// itself — Agencies never self-register through a code, Vivy
// Admin shares this direct link (see agency-register.js).
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, orderBy, limit, where,
    onSnapshot, doc, updateDoc, getCountFromServer
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, formatNumber, showToast } from "./ui-helpers.js";

let allAgencies = [];
let activeFilter = "all";
let pendingAction = null;

document.getElementById("backBtn").addEventListener("click", () => goBack("admin-management.html"));

document.getElementById("searchInput").addEventListener("input", renderList);

document.getElementById("generateLinkBtn").addEventListener("click", copyRegistrationLink);

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

    listenForAgencies();

}

function listenForAgencies() {

    const q = query(collection(db, "agencies"), orderBy("createdAt", "desc"), limit(200));

    onSnapshot(q, (snapshot) => {

        allAgencies = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        renderList();

    }, (error) => {

        console.error("Failed to load agencies:", error);
        showToast("Couldn't load agencies.");

    });

}

// "status" filter tab uses agency.status ("active" only means not
// suspended/banned) — "pending" and "approved" filter on the
// approved boolean instead, since that's how the data is modeled.
function matchesFilter(agency) {

    if (activeFilter === "all") return true;

    if (activeFilter === "pending") return agency.approved !== true;

    if (activeFilter === "active") return agency.approved === true && agency.status !== "suspended";

    if (activeFilter === "suspended") return agency.status === "suspended";

    return true;

}

function renderList() {

    const term = document.getElementById("searchInput").value.trim().toLowerCase();

    const filtered = allAgencies.filter((agency) => {

        if (!matchesFilter(agency)) return false;

        if (!term) return true;

        return (
            (agency.agencyName || "").toLowerCase().includes(term) ||
            agency.id.toLowerCase().includes(term) ||
            (agency.agencyUID || "").toLowerCase().includes(term)
        );

    });

    document.getElementById("resultCount").textContent =
        `${filtered.length} agenc${filtered.length === 1 ? "y" : "ies"}`;

    document.getElementById("emptyState").hidden = filtered.length !== 0;

    const listEl = document.getElementById("agencyList");
    listEl.innerHTML = "";

    filtered.forEach((agency) => listEl.appendChild(buildAgencyCard(agency)));

}

function buildAgencyCard(agency) {

    const statusLabel = agency.approved !== true ? "pending" : (agency.status === "suspended" ? "suspended" : "active");

    const card = document.createElement("div");
    card.className = "mgmt-card mgmt-full";

    card.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;width:100%">
            <div class="mgmt-photo">
                <img src="${agency.logoURL || "assets/default-avatar.png"}" alt="">
            </div>
            <div class="mgmt-text">
                <div class="mgmt-name">${escapeHtml(agency.agencyName || "Agency")}</div>
                <div class="mgmt-meta">UID ${agency.agencyUID || agency.id} · <span class="hostCount">…</span> Hosts</div>
            </div>
            <span class="pill ${statusLabel}">${statusLabel}</span>
        </div>
        <div class="mgmt-actions">
            ${agency.approved !== true
                ? `<button type="button" class="btn-mini approve" data-action="approve">Approve</button>
                   <button type="button" class="btn-mini reject" data-action="reject">Reject</button>`
                : agency.status === "suspended"
                    ? `<button type="button" class="btn-mini approve" data-action="reinstate">Reinstate</button>`
                    : `<button type="button" class="btn-mini suspend" data-action="suspend">Suspend</button>`}
            <button type="button" class="btn-mini" data-action="view">View Agency</button>
        </div>
    `;

    countHosts(agency.id, card.querySelector(".hostCount"));

    card.querySelector('[data-action="approve"]')?.addEventListener("click", () => setApproval(agency, true));
    card.querySelector('[data-action="reject"]')?.addEventListener("click", () => confirmAction(
        "Reject this agency?",
        `${agency.agencyName || "This agency"}'s application will be rejected. Their account remains unapproved and they can't sign into the Agency Dashboard.`,
        () => setStatus(agency, "rejected")
    ));
    card.querySelector('[data-action="suspend"]')?.addEventListener("click", () => confirmAction(
        "Suspend this agency?",
        `${agency.agencyName || "This agency"} and all of its Hosts will be blocked from the Agency Dashboard until reinstated.`,
        () => setStatus(agency, "suspended")
    ));
    card.querySelector('[data-action="reinstate"]')?.addEventListener("click", () => setStatus(agency, "active"));
    card.querySelector('[data-action="view"]')?.addEventListener("click", () => openProfileModal(agency));

    return card;

}

async function countHosts(agencyId, el) {

    if (!el) return;

    try {

        const snap = await getCountFromServer(query(collection(db, "hosts"), where("agencyId", "==", agencyId)));
        el.textContent = formatNumber(snap.data().count);

    }

    catch (error) {

        el.textContent = "0";

    }

}

async function setApproval(agency, approved) {

    try {

        await updateDoc(doc(db, "agencies", agency.id), { approved, status: "active" });
        showToast(`${agency.agencyName || "Agency"} is now approved.`);

    }

    catch (error) {

        console.error("Failed to approve agency:", error);
        showToast("Couldn't update this agency. Please try again.");

    }

}

async function setStatus(agency, status) {

    try {

        await updateDoc(doc(db, "agencies", agency.id), { status });
        showToast(`${agency.agencyName || "Agency"} is now ${status}.`);

    }

    catch (error) {

        console.error("Failed to update agency status:", error);
        showToast("Couldn't update this agency. Please try again.");

    }

}

function confirmAction(title, body, action) {

    openConfirm(title, body, action);

}

function copyRegistrationLink() {

    const link = `${window.location.origin}/agency-register.html`;

    if (navigator.clipboard?.writeText) {

        navigator.clipboard.writeText(link)
            .then(() => showToast("Agency Registration Link copied!"))
            .catch(() => showToast(link));

    }

    else {

        showToast(link);

    }

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

function openProfileModal(agency) {

    const backdrop = document.getElementById("confirmBackdrop");

    document.getElementById("confirmTitle").textContent = agency.agencyName || "Agency";

    document.getElementById("confirmBody").innerHTML = `
        <span style="display:block;margin-bottom:4px">Agency UID: ${agency.agencyUID || agency.id}</span>
        <span style="display:block;margin-bottom:4px">Owner: ${escapeHtml(agency.fullName || "—")}</span>
        <span style="display:block;margin-bottom:4px">Email: ${escapeHtml(agency.email || "—")}</span>
        <span style="display:block;margin-bottom:4px">WhatsApp: ${escapeHtml(agency.whatsapp || "—")}</span>
        <span style="display:block;margin-bottom:4px">Invitation Code: ${agency.invitationCode || "—"}</span>
        <span style="display:block;margin-bottom:4px">Commission Rate: ${((agency.commissionRate ?? 0.10) * 100).toFixed(0)}%</span>
        <span style="display:block">Status: ${agency.approved !== true ? "pending" : (agency.status || "active")}</span>
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
