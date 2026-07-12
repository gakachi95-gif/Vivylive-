// ======================================================
// Vivy 💜 Messages
// Realtime conversation list: search, unread badges,
// online status, last-message preview + timestamp.
// ======================================================

import { authReady } from "./auth-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, where, orderBy, onSnapshot, doc, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack } from "./ui-helpers.js";

let currentUser = null;
let allConversations = [];   // [{ id, convo, hostUid, hostProfile }]
let searchTerm = "";

const listEl = document.getElementById("conversationsList");
const searchBarWrap = document.getElementById("searchBarWrap");
const searchInput = document.getElementById("searchInput");

document.getElementById("backBtn").addEventListener("click", () => goBack("user-dashboard.html"));

document.getElementById("searchBtn").addEventListener("click", () => {

    searchBarWrap.classList.toggle("show");

    if (searchBarWrap.classList.contains("show")) {

        searchInput.focus();

    }

    else {

        searchInput.value = "";
        searchTerm = "";
        renderList();

    }

});

searchInput.addEventListener("input", () => {

    searchTerm = searchInput.value.trim().toLowerCase();
    renderList();

});

init();

async function init() {

    currentUser = await authReady;
    if (!currentUser) return;

    listenForConversations();

}

function listenForConversations() {

    const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", currentUser.uid),
        orderBy("lastMessageAt", "desc")
    );

    onSnapshot(q, async (snapshot) => {

        try {

            const rows = await Promise.all(snapshot.docs.map(async (docSnap) => {

                const convo = docSnap.data();
                const hostUid = (convo.participants || []).find((uid) => uid !== currentUser.uid);

                let hostProfile = {};

                try {

                    const hostSnap = await getDoc(doc(db, "hosts", hostUid));
                    if (hostSnap.exists()) hostProfile = hostSnap.data();

                }

                catch (e) { /* fallback text used below */ }

                return { id: docSnap.id, convo, hostUid, hostProfile };

            }));

            allConversations = rows;
            renderList();

        }

        catch (error) {

            console.error("Failed to process conversations:", error);
            renderError();

        }

    }, (error) => {

        console.error("Failed to listen for conversations:", error);
        renderError();

    });

}

function renderList() {

    if (allConversations.length === 0) {

        renderEmpty("No conversations yet", "Match with a host to start chatting");
        return;

    }

    const filtered = searchTerm
        ? allConversations.filter((row) => {

            const name = (row.hostProfile.username || "").toLowerCase();
            const lastMsg = (row.convo.lastMessage || "").toLowerCase();
            return name.includes(searchTerm) || lastMsg.includes(searchTerm);

        })
        : allConversations;

    if (filtered.length === 0) {

        renderEmpty("No matches found", "Try a different search term");
        return;

    }

    listEl.innerHTML = "";

    filtered.forEach((row) => {

        const { convo, hostUid, hostProfile } = row;

        const unread = convo.unreadCount?.[currentUser.uid] || 0;
        const isOnline = !!hostProfile.isOnline;

        const item = document.createElement("a");
        item.className = "list-card";
        item.href = `chat.html?hostUid=${hostUid}`;
        item.innerHTML = `
            <div class="convo-photo-wrap">
                <img class="convo-photo" src="${hostProfile.profilePhoto || 'assets/default-avatar.png'}" alt="">
                <span class="convo-online-dot ${isOnline ? "online" : ""}"></span>
            </div>
            <div class="list-text">
                <div class="list-title-row">
                    <div class="list-title">${escapeHtml(hostProfile.username || "Vivy Host")}</div>
                </div>
                <div class="list-subtitle">${escapeHtml(convo.lastMessage || "Say hello 👋")}</div>
            </div>
            <div class="list-meta">
                <span>${formatTimestamp(convo.lastMessageAt)}</span>
                ${unread > 0 ? `<span class="unread-badge">${unread > 99 ? "99+" : unread}</span>` : ""}
            </div>
        `;
        listEl.appendChild(item);

    });

}

function renderEmpty(title, subtitle) {

    listEl.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p>${escapeHtml(title)}</p>
            <p style="font-size:0.7rem">${escapeHtml(subtitle)}</p>
        </div>
    `;

}

function renderError() {

    listEl.innerHTML = `
        <div class="empty-state">
            <p>Couldn't load your messages right now.</p>
        </div>
    `;

}

function formatTimestamp(timestamp) {

    if (!timestamp?.toDate) return "";

    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

}

function escapeHtml(str) {

    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;

}
