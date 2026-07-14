// ======================================================
// Vivy 💜 Host Messages
// host-messages.js
// Host <-> User messaging ONLY. Hosts can never message
// other Hosts — every conversation here is with a User.
// ======================================================

import { hostSessionReady } from "./host-guard.js";
import { db } from "./firebase-config.js";

import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { goBack } from "./ui-helpers.js";

// ======================================================
// Elements
// ======================================================

const backBtn = document.getElementById("backBtn");
const searchBtn = document.getElementById("searchBtn");
const searchBar = document.getElementById("searchBar");
const searchInput = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClearBtn");
const searchResultsLabel = document.getElementById("searchResultsLabel");
const conversationsList = document.getElementById("conversationsList");

// ======================================================
// State
// ======================================================

let currentHostUid = null;

let conversations = [];  // enriched with User profile data
let usersCache = null;   // lazily loaded, used for "search users"

const statusUnsubscribes = new Map(); // userUid -> unsubscribe fn

// ======================================================
// Init
// ======================================================

backBtn.addEventListener("click", () => goBack("host-dashboard.html"));

searchBtn.addEventListener("click", () => {

    searchInput.focus();

});

searchInput.addEventListener("input", handleSearchInput);

searchClearBtn.addEventListener("click", () => {

    searchInput.value = "";
    handleSearchInput();
    searchInput.focus();

});

init();

async function init() {

    const session = await hostSessionReady;
    if (!session) return;

    currentHostUid = session.user.uid;

    listenForConversations();

}

// ======================================================
// Realtime Conversation List
// ======================================================

function listenForConversations() {

    const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", currentHostUid),
        orderBy("lastMessageAt", "desc")
    );

    onSnapshot(q, async (snapshot) => {

        if (snapshot.empty) {

            conversations = [];
            clearStatusListeners();
            renderConversations();
            return;

        }

        const rows = await Promise.all(
            snapshot.docs.map(async (docSnap) => {

                const convo = { id: docSnap.id, ...docSnap.data() };
                const otherUid = (convo.participants || []).find((uid) => uid !== currentHostUid);

                let userProfile = {};

                try {

                    const userSnap = await getDoc(doc(db, "accounts", otherUid));
                    if (userSnap.exists()) userProfile = userSnap.data();

                }

                catch (error) { /* fall back to placeholder text below */ }

                return {
                    ...convo,
                    userUid: otherUid,
                    userUsername: userProfile.username || "Vivy User",
                    userPhoto: userProfile.profilePhoto || "assets/default-avatar.png",
                    userOnline: Boolean(userProfile.isOnline)
                };

            })
        );

        conversations = rows;
        renderConversations();

    }, (error) => {

        console.error("Failed to listen for conversations:", error);

        conversationsList.innerHTML =
            `<div class="empty-state"><p>Couldn't load your messages right now.</p></div>`;

    });

}

// ======================================================
// Render
// ======================================================

function renderConversations() {

    // Search mode takes over rendering entirely — see handleSearchInput.
    if (searchInput.value.trim()) {

        return;

    }

    searchResultsLabel.hidden = true;
    clearStatusListeners();

    if (conversations.length === 0) {

        conversationsList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p>No conversations yet</p>
                <p style="font-size:0.7rem">Search for a User above, or message someone from Online Users</p>
            </div>
        `;
        return;

    }

    conversationsList.innerHTML = "";

    conversations.forEach((convo) => {

        conversationsList.appendChild(buildConversationRow(convo));
        watchUserOnlineStatus(convo.userUid);

    });

}

function buildConversationRow(convo) {

    const unread = convo.unreadCount?.[currentHostUid] || 0;

    const isTyping = Boolean(convo.typing?.[convo.userUid]);

    const iSentLast = convo.lastMessageSender === currentHostUid;
    const theirLastRead = convo.lastRead?.[convo.userUid];
    const seen = iSentLast && theirLastRead && convo.lastMessageAt &&
        theirLastRead.toMillis?.() >= convo.lastMessageAt.toMillis?.();

    const row = document.createElement("a");
    row.className = "list-card";
    row.href = `host-chat.html?userUid=${convo.userUid}`;
    row.dataset.useruid = convo.userUid;
    row.dataset.username = (convo.userUsername || "").toLowerCase();

    row.innerHTML = `
        <div class="convo-photo-wrap">
            <img class="convo-photo" src="${convo.userPhoto}" alt="">
            <span class="convo-online-dot ${convo.userOnline ? "online" : ""}" data-role="online-dot"></span>
        </div>
        <div class="list-text">
            <div class="list-title">${escapeHtml(convo.userUsername)}</div>
            <div class="list-subtitle-row">
                ${iSentLast ? `<svg class="read-receipt ${seen ? "seen" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L7 17l-5-5"/><path d="M22 10L11 21l-2-2"/></svg>` : ""}
                <div class="list-subtitle ${isTyping ? "typing-text" : (unread > 0 ? "unread-text" : "")}">${isTyping ? "typing…" : escapeHtml(convo.lastMessage || "Say hello 👋")}</div>
            </div>
        </div>
        <div class="convo-meta">
            <span class="convo-time">${formatTime(convo.lastMessageAt)}</span>
            <span class="unread-badge ${unread > 0 ? "show" : ""}">${unread > 99 ? "99+" : unread}</span>
        </div>
    `;

    return row;

}

// ======================================================
// Live "online" dot per conversation
// ======================================================

function watchUserOnlineStatus(userUid) {

    if (statusUnsubscribes.has(userUid)) {

        return;

    }

    const unsubscribe = onSnapshot(doc(db, "accounts", userUid), (snap) => {

        if (!snap.exists()) {

            return;

        }

        const isOnline = Boolean(snap.data().isOnline);

        document
            .querySelectorAll(`[data-useruid="${userUid}"] [data-role="online-dot"]`)
            .forEach((dot) => dot.classList.toggle("online", isOnline));

    });

    statusUnsubscribes.set(userUid, unsubscribe);

}

function clearStatusListeners() {

    statusUnsubscribes.forEach((unsubscribe) => unsubscribe());
    statusUnsubscribes.clear();

}

// ======================================================
// Search — filters existing conversations AND searches
// the Users directory to start a brand new conversation.
// ======================================================

async function handleSearchInput() {

    const value = searchInput.value.trim().toLowerCase();

    searchBar.classList.toggle("has-value", value.length > 0);

    if (!value) {

        renderConversations();
        return;

    }

    const matchingConvos = conversations.filter((c) =>
        (c.userUsername || "").toLowerCase().includes(value)
    );

    const users = await getUsersCache();

    const existingUserUids = new Set(conversations.map((c) => c.userUid));

    const matchingNewUsers = users.filter((u) =>
        !existingUserUids.has(u.id) &&
        (u.username || "").toLowerCase().includes(value)
    );

    conversationsList.innerHTML = "";

    if (matchingConvos.length === 0 && matchingNewUsers.length === 0) {

        searchResultsLabel.hidden = true;

        conversationsList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <p>No matches for "${escapeHtml(searchInput.value.trim())}"</p>
            </div>
        `;
        return;

    }

    matchingConvos.forEach((convo) => {

        conversationsList.appendChild(buildConversationRow(convo));

    });

    if (matchingNewUsers.length > 0) {

        searchResultsLabel.hidden = false;

        matchingNewUsers.forEach((user) => {

            conversationsList.appendChild(buildUserResultRow(user));

        });

    }

    else {

        searchResultsLabel.hidden = true;

    }

}

function buildUserResultRow(user) {

    const row = document.createElement("a");
    row.className = "list-card";
    row.href = `host-chat.html?userUid=${user.id}`;

    row.innerHTML = `
        <div class="convo-photo-wrap">
            <img class="convo-photo" src="${user.profilePhoto || "assets/default-avatar.png"}" alt="">
            <span class="convo-online-dot ${user.isOnline ? "online" : ""}"></span>
        </div>
        <div class="list-text">
            <div class="list-title">${escapeHtml(user.username || "Vivy User")}</div>
            <div class="list-subtitle">${user.isOnline ? "Online now — say hi" : "Start a new conversation"}</div>
        </div>
    `;

    return row;

}

async function getUsersCache() {

    if (usersCache) {

        return usersCache;

    }

    try {

        const snapshot = await getDocs(
            query(collection(db, "accounts"), where("role", "==", "user"), limit(60))
        );

        usersCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    }

    catch (error) {

        console.error("Failed to search users:", error);
        usersCache = [];

    }

    return usersCache;

}

// ======================================================
// Helpers
// ======================================================

function formatTime(timestamp) {

    if (!timestamp?.toDate) {

        return "";

    }

    const date = timestamp.toDate();
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {

        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {

        return "Yesterday";

    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });

}

function escapeHtml(value) {

    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;

  }
