// ======================================================
// Vivy 💜 Agency Notifications
// View-only, realtime. Types: host_joined, payroll, announcement,
// support_reply, account_update.
// ======================================================

import { agencySessionReady } from "./agency-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, orderBy, onSnapshot, doc, writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack } from "./ui-helpers.js";

const TYPE_ICONS = {
    host_joined: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
    payroll: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    announcement: '<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    support_reply: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    account_update: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'
};

const TYPE_TITLES = {
    host_joined: "New Host Joined",
    payroll: "Weekly Payroll Sent",
    announcement: "Admin Announcement",
    support_reply: "Support Reply",
    account_update: "Account Update"
};

let currentUser = null;

document.getElementById("backBtn").addEventListener("click", () => goBack("agency-dashboard.html"));

init();

async function init() {

    const session = await agencySessionReady;
    if (!session) return;

    currentUser = session.user;

    listenForNotifications();

}

function listenForNotifications() {

    const listEl = document.getElementById("notificationsList");

    const q = query(
        collection(db, "agencies", currentUser.uid, "notifications"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {

        if (snapshot.empty) {

            listEl.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    <p>You're all caught up</p>
                </div>
            `;
            return;

        }

        listEl.innerHTML = "";

        const unreadIds = [];

        snapshot.forEach((docSnap) => {

            const n = docSnap.data();
            const type = TYPE_ICONS[n.type] ? n.type : "announcement";

            if (n.read === false) unreadIds.push(docSnap.id);

            const row = document.createElement("div");
            row.className = "list-card" + (n.read === false ? " notif-unread" : "");
            row.innerHTML = `
                <span class="list-icon-circle notif-icon ${type}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TYPE_ICONS[type]}</svg>
                </span>
                <div class="list-text">
                    <div class="list-title">${n.title || TYPE_TITLES[type] || "Vivy"}</div>
                    <div class="list-subtitle">${n.body || ""}</div>
                    <div class="notif-time">${formatDate(n.createdAt)}</div>
                </div>
            `;
            listEl.appendChild(row);

        });

        if (unreadIds.length > 0) markAsRead(unreadIds);

    }, (error) => {

        console.error("Failed to load notifications:", error);

        listEl.innerHTML = `
            <div class="empty-state"><p>Couldn't load notifications right now.</p></div>
        `;

    });

}

async function markAsRead(ids) {

    try {

        const batch = writeBatch(db);

        ids.forEach((id) => {

            batch.update(doc(db, "agencies", currentUser.uid, "notifications", id), { read: true });

        });

        await batch.commit();

    }

    catch (error) {

        console.error("Failed to mark notifications read:", error);

    }

}

function formatDate(timestamp) {

    if (!timestamp?.toDate) return "Just now";

    const date = timestamp.toDate();

    return date.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " · " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

}
