// ======================================================
// Vivy 💜 Host — Online Users
// Realtime list of every User currently online. Hosts can
// message any of them. Hosts can NEVER initiate a call —
// Audio/Video Calls are always started by the User.
// ======================================================

import { hostSessionReady } from "./host-guard.js";
import { db } from "./firebase-config.js";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack } from "./ui-helpers.js";

document.getElementById("backBtn").addEventListener("click", () => goBack("host-dashboard.html"));

init();

async function init() {

    const session = await hostSessionReady;
    if (!session) return;

    listenForOnlineUsers();

}

function listenForOnlineUsers() {

    const usersList = document.getElementById("usersList");

    const q = query(
        collection(db, "accounts"),
        where("role", "==", "user"),
        where("isOnline", "==", true),
        orderBy("lastActive", "desc")
    );

    onSnapshot(q, (snapshot) => {

        document.getElementById("onlineCountLabel").textContent =
            `${snapshot.size} online now`;

        if (snapshot.empty) {

            usersList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="4"/><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/></svg>
                    <p>No Users online right now</p>
                </div>
            `;
            return;

        }

        usersList.innerHTML = "";

        snapshot.forEach((docSnap) => {

            usersList.appendChild(buildUserRow(docSnap.id, docSnap.data()));

        });

    }, (error) => {

        console.error("Failed to load online users:", error);

        usersList.innerHTML = `
            <div class="empty-state"><p>Couldn't load online users right now.</p></div>
        `;

    });

}

function buildUserRow(uid, user) {

    const row = document.createElement("div");
    row.className = "list-card";

    const flagMarkup = user.countryCode
        ? `<img class="user-flag" src="https://flagcdn.com/24x18/${user.countryCode.toLowerCase()}.png" alt="${escapeHtml(user.country || user.countryCode)}">`
        : "";

    row.innerHTML = `
        <div class="user-photo-wrap">
            <img class="user-photo" src="${user.profilePhoto || "assets/default-avatar.png"}" alt="">
            <span class="user-online-dot"></span>
        </div>
        <div class="list-text">
            <div class="list-title">${escapeHtml(user.username || "Vivy User")}</div>
            <div class="user-meta-row">
                <span class="user-uid">UID: ${uid.slice(0, 8)}…</span>
                ${flagMarkup}
            </div>
        </div>
        <button type="button" class="message-btn" aria-label="Message ${escapeHtml(user.username || "user")}">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
    `;

    row.querySelector(".message-btn").addEventListener("click", () => {

        window.location.href = `host-chat.html?userUid=${uid}`;

    });

    return row;

}

function escapeHtml(value) {

    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;

}
