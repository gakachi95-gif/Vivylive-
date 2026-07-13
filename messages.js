// ======================================================
// Vivy 💜 Messages
// messages.js
// ======================================================

import { authReady } from "./auth-guard.js";
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

let currentUser = null;

let conversations = [];   // enriched with host profile data
let hostsCache = null;    // lazily loaded, used for "search users/hosts"

const statusUnsubscribes = new Map(); // hostUid -> unsubscribe fn

// ======================================================
// Init
// ======================================================

backBtn.addEventListener("click", () => goBack("user-dashboard.html"));

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

    currentUser = await authReady;

    if (!currentUser) {

        return;

    }

    listenForConversations();

}

// ======================================================
// Realtime Conversation List
// ======================================================

function listenForConversations() {

    const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", currentUser.uid),
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
                const otherUid = (convo.participants || []).find((uid) => uid !== currentUser.uid);

                let hostProfile = {};

                try {

                    const hostSnap = await getDoc(doc(db, "hosts", otherUid));
                    if (hostSnap.exists()) hostProfile = hostSnap.data();

                }

                catch (error) { /* fall back to placeholder text below */ }

                return {
                    ...convo,
                    hostUid: otherUid,
                    hostUsername: hostProfile.username || "Vivy Host",
                    hostPhoto: hostProfile.profilePhoto || "assets/default-avatar.png",
                    hostOnline: Boolean(hostProfile.isOnline)
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
                <p style="font-size:0.7rem">Search for a host above or match with one to start chatting</p>
            </div>
        `;
        return;

    }

    conversationsList.innerHTML = "";

    conversations.forEach((convo) => {

        conversationsList.appendChild(buildConversationRow(convo));
        watchHostOnlineStatus(convo.hostUid);

    });

}

function buildConversationRow(convo) {

    const unread = convo.unreadCount?.[currentUser.uid] || 0;

    const row = document.createElement("a");
    row.className = "list-card";
    row.href = `chat.html?hostUid=${convo.hostUid}`;
    row.dataset.hostuid = convo.hostUid;
    row.dataset.username = (convo.hostUsername || "").toLowerCase();

    row.innerHTML = `
        <div class="convo-photo-wrap">
            <img class="convo-photo" src="${convo.hostPhoto}" alt="">
            <span class="convo-online-dot ${convo.hostOnline ? "online" : ""}" data-role="online-dot"></span>
        </div>
        <div class="list-text">
            <div class="list-title">${escapeHtml(convo.hostUsername)}</div>
            <div class="list-subtitle ${unread > 0 ? "unread-text" : ""}">${escapeHtml(convo.lastMessage || "Say hello 👋")}</div>
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

function watchHostOnlineStatus(hostUid) {

    if (statusUnsubscribes.has(hostUid)) {

        return;

    }

    const unsubscribe = onSnapshot(doc(db, "hosts", hostUid), (snap) => {

        if (!snap.exists()) {

            return;

        }

        const isOnline = Boolean(snap.data().isOnline);

        document
            .querySelectorAll(`[data-hostuid="${hostUid}"] [data-role="online-dot"]`)
            .forEach((dot) => dot.classList.toggle("online", isOnline));

    });

    statusUnsubscribes.set(hostUid, unsubscribe);

}

function clearStatusListeners() {

    statusUnsubscribes.forEach((unsubscribe) => unsubscribe());
    statusUnsubscribes.clear();

}

// ======================================================
// Search — filters existing conversations AND searches
// the hosts directory to start a brand new conversation.
// ======================================================

async function handleSearchInput() {

    const value = searchInput.value.trim().toLowerCase();

    searchBar.classList.toggle("has-value", value.length > 0);

    if (!value) {

        renderConversations();
        return;

    }

    const matchingConvos = conversations.filter((c) =>
        (c.hostUsername || "").toLowerCase().includes(value)
    );

    const hosts = await getHostsCache();

    const existingHostUids = new Set(conversations.map((c) => c.hostUid));

    const matchingNewHosts = hosts.filter((h) =>
        !existingHostUids.has(h.id) &&
        (h.username || "").toLowerCase().includes(value)
    );

    conversationsList.innerHTML = "";

    if (matchingConvos.length === 0 && matchingNewHosts.length === 0) {

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

    if (matchingNewHosts.length > 0) {

        searchResultsLabel.hidden = false;

        matchingNewHosts.forEach((host) => {

            conversationsList.appendChild(buildHostResultRow(host));

        });

    }

    else {

        searchResultsLabel.hidden = true;

    }

}

function buildHostResultRow(host) {

    const row = document.createElement("a");
    row.className = "list-card";
    row.href = `chat.html?hostUid=${host.id}`;

    row.innerHTML = `
        <div class="convo-photo-wrap">
            <img class="convo-photo" src="${host.profilePhoto || "assets/default-avatar.png"}" alt="">
            <span class="convo-online-dot ${host.isOnline ? "online" : ""}"></span>
        </div>
        <div class="list-text">
            <div class="list-title">${escapeHtml(host.username || "Vivy Host")}</div>
            <div class="list-subtitle">${host.isOnline ? "Online now — say hi" : "Start a new conversation"}</div>
        </div>
    `;

    return row;

}

async function getHostsCache() {

    if (hostsCache) {

        return hostsCache;

    }

    try {

        const snapshot = await getDocs(
            query(collection(db, "hosts"), limit(60))
        );

        hostsCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    }

    catch (error) {

        console.error("Failed to search hosts:", error);
        hostsCache = [];

    }

    return hostsCache;

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
