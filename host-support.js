// ======================================================
// Vivy 💜 Host Support
// Contact support, submit/view tickets, read FAQs.
// Only Vivy Admin/Support Team can reply to a ticket —
// Hosts can only create tickets and view their status here.
// ======================================================

import { hostSessionReady } from "./host-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, showToast } from "./ui-helpers.js";

const FAQS = [
    {
        q: "Why haven't my Diamonds updated after a call?",
        a: "Diamonds are credited automatically the moment a Gift is sent during a call. If a balance looks wrong, refresh the Wallet page — if it's still off after a few minutes, submit a ticket below with the approximate time of the call."
    },
    {
        q: "When do I get paid?",
        a: "Vivy Admin runs payroll and pays your Agency. Your Agency then pays you directly. Hosts don't withdraw straight from Vivy — check with your Agency for their payout schedule."
    },
    {
        q: "Can I switch Agencies?",
        a: "No — only Vivy Admin can transfer a Host between Agencies. Contact Support if you believe this is necessary."
    },
    {
        q: "Why can't I call Users?",
        a: "Hosts only ever receive calls. Users always initiate Audio and Video calls to Hosts — this keeps the platform fair and prevents unwanted outgoing charges."
    }
];

let currentUser = null;

document.getElementById("backBtn").addEventListener("click", () => goBack("host-dashboard.html"));
document.getElementById("ticketForm").addEventListener("submit", submitTicket);

renderFaqs();
init();

async function init() {

    const session = await hostSessionReady;
    if (!session) return;

    currentUser = session.user;

    listenForTickets();

}

async function submitTicket(e) {

    e.preventDefault();

    const subject = document.getElementById("ticketSubject").value.trim();
    const message = document.getElementById("ticketMessage").value.trim();

    if (!subject || !message) return;

    const btn = document.getElementById("ticketSubmitBtn");
    btn.disabled = true;
    btn.textContent = "Submitting...";

    try {

        await addDoc(collection(db, "supportTickets"), {
            uid: currentUser.uid,
            role: "host",
            subject,
            message,
            status: "open",
            createdAt: serverTimestamp()
        });

        document.getElementById("ticketForm").reset();
        showToast("Ticket submitted — Vivy Support will follow up soon 💜");

    }

    catch (error) {

        console.error("Failed to submit ticket:", error);
        showToast("Couldn't submit your ticket — please try again.");

    }

    finally {

        btn.disabled = false;
        btn.textContent = "Submit Ticket";

    }

}

function listenForTickets() {

    const q = query(
        collection(db, "supportTickets"),
        where("uid", "==", currentUser.uid),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {

        const container = document.getElementById("ticketList");

        if (snapshot.empty) {

            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6m-6 4h6M9 8h6M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>
                    <p>No tickets yet</p>
                </div>
            `;
            return;

        }

        container.innerHTML = "";

        snapshot.forEach((docSnap) => {

            const ticket = docSnap.data();

            const row = document.createElement("div");
            row.className = "list-card";
            row.innerHTML = `
                <div class="list-text">
                    <div class="list-title">${escapeHtml(ticket.subject)}</div>
                    <div class="list-subtitle">${formatDate(ticket.createdAt)}</div>
                </div>
                <span class="ticket-pill ${ticket.status}">${ticket.status || "open"}</span>
            `;

            container.appendChild(row);

        });

    }, (error) => {

        console.error("Failed to load tickets:", error);

    });

}

function renderFaqs() {

    const container = document.getElementById("faqList");

    FAQS.forEach((item, index) => {

        const el = document.createElement("div");
        el.className = "faq-item";

        el.innerHTML = `
            <div class="faq-q">
                <span>${escapeHtml(item.q)}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div class="faq-a">${escapeHtml(item.a)}</div>
        `;

        el.addEventListener("click", () => el.classList.toggle("open"));

        container.appendChild(el);

        if (index < FAQS.length - 1) {

            const divider = document.createElement("div");
            divider.style.borderBottom = "1px solid var(--glass-border)";
            container.appendChild(divider);

        }

    });

}

function formatDate(timestamp) {

    if (!timestamp?.toDate) return "Just now";
    return timestamp.toDate().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

}

function escapeHtml(value) {

    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;

      }
