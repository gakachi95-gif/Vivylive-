// ======================================================
// Vivy 💜 Random Match
// Finds an online host and redirects into audio-call.html
// or video-call.html with hostUid — ready for future
// ZEGOCLOUD signaling to slot in behind this same flow.
// ======================================================

import { authReady } from "./auth-guard.js";

import { db } from "./firebase-config.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    limit,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { getUrlParam, goBack } from "./ui-helpers.js";

// Audio costs 100 coins / 30s, video costs 150 coins / 30s — require at
// least one interval's worth of coins before searching for either.
const callType = getUrlParam("mode") === "audio" ? "audio" : "video";
const MIN_COINS_TO_MATCH = callType === "audio" ? 100 : 150;

const panels = {
    searching: document.getElementById("panelSearching"),
    matched: document.getElementById("panelMatched"),
    noHosts: document.getElementById("panelNoHosts"),
    noCoins: document.getElementById("panelNoCoins")
};

let currentUser = null;
let matchTimeoutId = null;

document.getElementById("backBtn")
    .addEventListener("click", () => window.location.href = "user-dashboard.html");

document.getElementById("cancelBtn")
    .addEventListener("click", cancelMatch);

document.getElementById("cancelFromNoHostsBtn")
    .addEventListener("click", cancelMatch);

document.getElementById("retryBtn")
    .addEventListener("click", startMatch);

document.getElementById("goBackBtn")
    .addEventListener("click", () => window.location.href = "user-dashboard.html");

document.getElementById("rechargeMatchBtn")
    .addEventListener("click", () => window.location.href = "recharge.html");

document.getElementById("searchingModeLabel").textContent =
    `Finding you a ${callType} match…`;

document.getElementById("noCoinsSub").textContent =
    `You need at least ${MIN_COINS_TO_MATCH} coins to start a ${callType} call`;

init();

async function init() {

    currentUser = await authReady;

    if (!currentUser) {

        return;

    }

    try {

        const accountSnap = await getDoc(doc(db, "accounts", currentUser.uid));
        const coins = accountSnap.exists() ? (accountSnap.data().coins ?? 0) : 0;

        if (coins < MIN_COINS_TO_MATCH) {

            showPanel("noCoins");
            return;

        }

    }

    catch (error) {

        console.error("Failed to check coin balance:", error);

    }

    startMatch();

}

function showPanel(name) {

    Object.values(panels).forEach((panel) => panel.classList.remove("active"));
    panels[name].classList.add("active");

}

function cancelMatch() {

    if (matchTimeoutId) {

        clearTimeout(matchTimeoutId);
        matchTimeoutId = null;

    }

    window.location.href = "user-dashboard.html";

}

async function startMatch() {

    showPanel("searching");

    try {

        const snapshot = await getDocs(
            query(
                collection(db, "hosts"),
                where("isOnline", "==", true),
                limit(20)
            )
        );

        if (snapshot.empty) {

            // Give the radar animation a beat before showing "no hosts",
            // so a fast Firestore response doesn't feel abrupt.
            matchTimeoutId = setTimeout(() => showPanel("noHosts"), 900);
            return;

        }

        const hosts = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        const matchedHost = hosts[Math.floor(Math.random() * hosts.length)];

        // Simulated matchmaking delay — swap for real signaling latency
        // once ZEGOCLOUD (or similar) is wired in.
        matchTimeoutId = setTimeout(() => revealMatch(matchedHost), 1600);

    }

    catch (error) {

        console.error("Matchmaking failed:", error);
        matchTimeoutId = setTimeout(() => showPanel("noHosts"), 600);

    }

}

function revealMatch(host) {

    const photoEl = document.getElementById("matchedHostPhoto");
    const nameEl = document.getElementById("matchedHostName");
    const metaEl = document.getElementById("matchedHostMeta");

    photoEl.src = host.profilePhoto || "assets/default-avatar.png";
    nameEl.textContent = host.username || "Vivy Host";
    metaEl.textContent = "Match found!";

    showPanel("matched");

    matchTimeoutId = setTimeout(() => {

        const destination = callType === "audio" ? "audio-call.html" : "video-call.html";

        window.location.href = `${destination}?hostUid=${host.id}`;

    }, 1100);

}
