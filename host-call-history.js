// ======================================================
// Vivy 💜 Host Call History
// Read-only log of every call this Host has received.
// Hosts never initiate calls, so every row here started
// from a User — caller profile is loaded from "accounts".
// ======================================================

import { hostSessionReady } from "./host-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, where, orderBy, onSnapshot,
    doc, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack } from "./ui-helpers.js";

let currentUser = null;
const callerProfileCache = new Map();

document.getElementById("backBtn").addEventListener("click", () => goBack("host-dashboard.html"));

init();

async function init() {

    const session = await hostSessionReady;
    if (!session) return;

    currentUser = session.user;

    listenForCalls();

}

function listenForCalls() {

    const q = query(
        collection(db, "calls"),
        where("hostUid", "==", currentUser.uid),
        orderBy("startTime", "desc")
    );

    onSnapshot(q, async (snapshot) => {

        const container = document.getElementById("callList");

        if (snapshot.empty) {

            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <p>No calls yet</p>
                    <p style="font-size:0.7rem">Calls from Users will appear here once you receive them.</p>
                </div>
            `;
            return;

        }

        const rows = await Promise.all(
            snapshot.docs.map((docSnap) => buildRow({ id: docSnap.id, ...docSnap.data() }))
        );

        container.innerHTML = "";
        rows.forEach((row) => container.appendChild(row));

    }, (error) => {

        console.error("Failed to load call history:", error);

        document.getElementById("callList").innerHTML =
            `<div class="empty-state"><p>Couldn't load your call history right now.</p></div>`;

    });

}

async function buildRow(call) {

    const caller = await getCallerProfile(call.callerUid);

    const row = document.createElement("div");
    row.className = "list-card";

    const isVideo = call.callType === "video";
    const status = resolveStatus(call);

    row.innerHTML = `
        <img class="call-photo" src="${caller.profilePhoto || "assets/default-avatar.png"}" alt="">
        <div class="call-type-icon">
            ${isVideo
                ? `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`}
        </div>
        <div class="list-text">
            <div class="list-title">${escapeHtml(caller.username || "Vivy User")}</div>
            <div class="list-subtitle">${isVideo ? "Video Call" : "Audio Call"} · ${formatDate(call.startTime)}</div>
        </div>
        <div class="call-meta-col">
            <span class="call-status-pill ${status.className}">${status.label}</span>
            <span class="call-duration">${formatDuration(call.duration)}</span>
        </div>
    `;

    return row;

}

function resolveStatus(call) {

    if (call.status === "connected" || (call.connectedAt && call.status !== "declined")) {

        return { label: "Completed", className: "connected" };

    }

    if (call.endReason === "declined" || call.status === "declined") {

        return { label: "Declined", className: "declined" };

    }

    if (!call.connectedAt) {

        return { label: "Missed", className: "missed" };

    }

    return { label: call.status || "Ended", className: "" };

}

async function getCallerProfile(uid) {

    if (!uid) return {};

    if (callerProfileCache.has(uid)) {

        return callerProfileCache.get(uid);

    }

    let profile = {};

    try {

        const snap = await getDoc(doc(db, "accounts", uid));
        if (snap.exists()) profile = snap.data();

    }

    catch (error) {

        console.error("Failed to load caller profile:", error);

    }

    callerProfileCache.set(uid, profile);
    return profile;

}

function formatDuration(seconds) {

    const total = Number(seconds || 0);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;

}

function formatDate(timestamp) {

    if (!timestamp?.toDate) {

        return "";

    }

    const date = timestamp.toDate();

    return date.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " · " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

}

function escapeHtml(value) {

    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;

}
