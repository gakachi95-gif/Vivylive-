// ======================================================
// Vivy 💜 Admin — Support
// Reads/writes the SAME "supportTickets" collection Hosts and
// Agencies already submit tickets to (host-support.js /
// agency-support.js) — nothing new, nothing duplicated. Adds
// "adminReply" / "repliedAt" fields to a ticket additively so
// existing ticket lists keep working unchanged.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, orderBy, limit, onSnapshot, doc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, showToast } from "./ui-helpers.js";

let allTickets = [];
let activeFilter = "open";
let openTicket = null;

document.getElementById("backBtn").addEventListener("click", () => goBack("admin-dashboard.html"));
document.getElementById("searchInput").addEventListener("input", renderList);

document.querySelectorAll(".filter-tab").forEach((tab) => {

    tab.addEventListener("click", () => {

        document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        activeFilter = tab.dataset.filter;
        renderList();

    });

});

document.getElementById("dismissTicketBtn").addEventListener("click", closeModal);
document.getElementById("sendReplyBtn").addEventListener("click", sendReply);
document.getElementById("closeTicketBtn").addEventListener("click", closeTicket);

init();

async function init() {

    const session = await adminSessionReady;
    if (!session) return;

    listenForTickets();

}

function listenForTickets() {

    const q = query(collection(db, "supportTickets"), orderBy("createdAt", "desc"), limit(300));

    onSnapshot(q, (snapshot) => {

        allTickets = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        renderList();

    }, (error) => {

        console.error("Failed to load support tickets:", error);
        showToast("Couldn't load support tickets.");

    });

}

function renderList() {

    const term = document.getElementById("searchInput").value.trim().toLowerCase();

    const filtered = allTickets.filter((ticket) => {

        const status = ticket.status || "open";

        if (activeFilter !== "all" && status !== activeFilter) return false;

        if (!term) return true;

        return (
            (ticket.subject || "").toLowerCase().includes(term) ||
            (ticket.uid || "").toLowerCase().includes(term)
        );

    });

    document.getElementById("resultCount").textContent =
        `${filtered.length} ticket${filtered.length === 1 ? "" : "s"}`;

    document.getElementById("emptyState").hidden = filtered.length !== 0;

    const listEl = document.getElementById("ticketList");
    listEl.innerHTML = "";

    filtered.forEach((ticket) => listEl.appendChild(buildTicketRow(ticket)));

}

function buildTicketRow(ticket) {

    const status = ticket.status || "open";
    const date = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : null;

    const row = document.createElement("div");
    row.className = "data-row";
    row.style.cursor = "pointer";

    row.innerHTML = `
        <div class="dr-main">
            <div class="dr-title">${escapeHtml(ticket.subject || "Support Request")}</div>
            <div class="dr-sub">${escapeHtml(ticket.role || "user")} · ${escapeHtml(ticket.uid || "—")}${date ? ` · ${date.toLocaleDateString()}` : ""}</div>
        </div>
        <span class="pill ${status}">${status}</span>
    `;

    row.addEventListener("click", () => openModal(ticket));

    return row;

}

function openModal(ticket) {

    openTicket = ticket;

    document.getElementById("ticketSubject").textContent = ticket.subject || "Support Request";
    document.getElementById("ticketMeta").textContent =
        `${ticket.role || "user"} · UID ${ticket.uid || "—"} · ${ticket.status || "open"}`;
    document.getElementById("ticketMessage").textContent = ticket.message || "";

    const replyWrap = document.getElementById("existingReplyWrap");

    if (ticket.adminReply) {

        replyWrap.hidden = false;
        document.getElementById("existingReply").textContent = ticket.adminReply;

    }

    else {

        replyWrap.hidden = true;

    }

    document.getElementById("replyInput").value = "";

    const closeBtn = document.getElementById("closeTicketBtn");
    closeBtn.hidden = ticket.status === "closed";

    document.getElementById("ticketBackdrop").classList.add("show");

}

function closeModal() {

    document.getElementById("ticketBackdrop").classList.remove("show");
    openTicket = null;

}

async function sendReply() {

    if (!openTicket) return;

    const reply = document.getElementById("replyInput").value.trim();

    if (!reply) {

        showToast("Please type a reply first.");
        return;

    }

    const btn = document.getElementById("sendReplyBtn");
    btn.disabled = true;
    btn.textContent = "Sending…";

    try {

        await updateDoc(doc(db, "supportTickets", openTicket.id), {
            adminReply: reply,
            repliedAt: serverTimestamp()
        });

        showToast("Reply sent.");
        closeModal();

    }

    catch (error) {

        console.error("Failed to send reply:", error);
        showToast("Couldn't send reply. Please try again.");

    }

    finally {

        btn.disabled = false;
        btn.textContent = "Send Reply";

    }

}

async function closeTicket() {

    if (!openTicket) return;

    try {

        await updateDoc(doc(db, "supportTickets", openTicket.id), { status: "closed" });
        showToast("Ticket closed.");
        closeModal();

    }

    catch (error) {

        console.error("Failed to close ticket:", error);
        showToast("Couldn't close this ticket.");

    }

}

function escapeHtml(text) {

    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;

  }
