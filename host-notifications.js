// ======================================================
// Vivy 💜 Host Notifications
// View-only, realtime. Hosts can never dismiss or act on
// a notification here beyond reading it — this just marks
// unread items as read once they've been seen, which also
// clears the bell-icon dot on the Dashboard.
//
// Expected "type" values (see HOST_NOTIFICATION_TYPES.md
// wherever notifications get created — messages, incoming
// call, missed call, account approved/suspended, admin
// announcements, weekly payroll ready):
//   "message" | "call" | "missed" | "approved" |
//   "suspended" | "announcement" | "payroll"
// ======================================================

import { hostSessionReady } from "./host-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack } from "./ui-helpers.js";

const TYPE_ICONS = {
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    call: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
    missed: '<path d="M23 7l-6 6M17 7l6 6"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91"/>',
    approved: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>',
    suspended: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    announcement: '<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    payroll: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
};

const TYPE_TITLES = {
    message: "New Message",
    call: "Incoming Call",
    missed: "Missed Call",
    approved: "Account Approved",
    suspended: "Account Suspended",
    announcement: "Admin Announcement",
    payroll: "Weekly Payroll Ready"
};

let currentUser = null;

document.getElementById("backBtn").addEventListener("click", () => goBack("host-dashboard.html"));

init();

async function init() {

    const session = await hostSessionReady;
    if (!session) return;

    currentUser = session.user;

    listenForNotifications();

}

function listenForNotifications() {

    const listEl = document.getElementById("notificationsList");

    const q = query(
        collection(db, "hosts", currentUser.uid, "notifications"),
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

        // Reading this page is what "clears" a notification for a Host —
        // there's no separate dismiss action, per the View-only spec.
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

            batch.update(doc(db, "hosts", currentUser.uid, "notifications", id), { read: true });

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
