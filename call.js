// ======================================================
// Vivy 💜 Call Screen
//
// Business rules (must always hold):
//   • Caller spends 100 coins every 30s of an ACTIVE (connected) call.
//   • Host earns 100 coins every 30s of that same active call.
//   • Deduction starts only once both sides are connected.
//   • Deduction stops immediately when the call ends.
//   • If the caller runs out of coins, the call ends automatically
//     and they're redirected to recharge.html.
//   • Every completed call is logged to Firestore's "calls" collection.
//
// NOTE ON REAL-TIME SIGNALING: this screen currently *simulates* the
// connect handshake with a timeout. The economy/logging logic below is
// intentionally decoupled from that simulation so a real signaling SDK
// (e.g. ZEGOCLOUD) can later just call `handleConnected()` once its own
// "both peers joined" event fires, and `endCall(reason)` on hangup —
// nothing else in this file needs to change.
// ======================================================

import { authReady } from "./auth-guard.js";

import { db } from "./firebase-config.js";

import {
    doc,
    getDoc,
    updateDoc,
    increment,
    collection,
    addDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { getUrlParam, showToast } from "./ui-helpers.js";

const COINS_PER_INTERVAL = 100;
const INTERVAL_SECONDS = 30;
const MIN_COINS_TO_START = 100;

const hostUid = getUrlParam("hostUid");
const callerUid = getUrlParam("callerUid");
const callType = getUrlParam("callType") === "audio" ? "audio" : "video";

let currentUser = null;
let isCaller = false;

let callerCoins = 0;
let hostEarningsThisCall = 0;
let coinsSpentThisCall = 0;

let elapsedSeconds = 0;
let timerIntervalId = null;
let connectingTimeoutId = null;

let callStartedAt = null;
let callHasEnded = false;

const panels = {
    connecting: document.getElementById("panelConnecting"),
    connected: document.getElementById("panelConnected"),
    ended: document.getElementById("panelEnded")
};

init();

async function init() {

    currentUser = await authReady;

    if (!currentUser) {

        return;

    }

    if (!hostUid || !callerUid) {

        showToast("Missing call details");
        setTimeout(() => window.location.href = "user-dashboard.html", 1200);
        return;

    }

    isCaller = currentUser.uid === callerUid;

    bindControls();

    if (callType === "audio") {

        document.getElementById("videoToggleBtn").style.display = "none";

    }

    try {

        const hostSnap = await getDoc(doc(db, "hosts", hostUid));
        const host = hostSnap.exists() ? hostSnap.data() : {};

        const photoUrl = host.profilePhoto || "assets/default-avatar.png";
        const displayName = host.username || "Vivy Host";

        document.getElementById("callHostPhotoConnecting").src = photoUrl;
        document.getElementById("callHostPhoto").src = photoUrl;
        document.getElementById("connectingHostName").textContent = `Calling ${displayName}…`;
        document.getElementById("callHostName").textContent = displayName;

        if (callType === "video") {

            document.getElementById("callBg").style.backgroundImage = `url(${photoUrl})`;

        }

    }

    catch (error) {

        console.error("Failed to load host info:", error);

    }

    if (isCaller) {

        try {

            const callerSnap = await getDoc(doc(db, "accounts", callerUid));
            callerCoins = callerSnap.exists() ? (callerSnap.data().coins ?? 0) : 0;

        }

        catch (error) {

            console.error("Failed to load caller coin balance:", error);

        }

        updateCoinTicker();

        if (callerCoins < MIN_COINS_TO_START) {

            showToast("Not enough coins to start this call");
            setTimeout(() => window.location.href = "recharge.html", 1200);
            return;

        }

    }

    else {

        document.getElementById("coinTicker").textContent = "Host";

    }

    // Simulated handshake — swap for a real "both peers joined" signal later.
    connectingTimeoutId = setTimeout(handleConnected, 1800);

}

function bindControls() {

    document.getElementById("endCallBtn")
        .addEventListener("click", () => endCall("manual"));

    document.getElementById("muteBtn")
        .addEventListener("click", (e) => e.currentTarget.classList.toggle("active-toggle"));

    document.getElementById("speakerBtn")
        .addEventListener("click", (e) => e.currentTarget.classList.toggle("active-toggle"));

    document.getElementById("videoToggleBtn")
        .addEventListener("click", (e) => e.currentTarget.classList.toggle("active-toggle"));

    document.getElementById("giftBtn")
        .addEventListener("click", () => {

            // Gifts are a separate economy from call earnings (they convert
            // to Diamonds for hosts) — this is a placeholder hook for that
            // future feature, deliberately not touching coin/call logic.
            showToast("Gifts are coming soon 🎁");

        });

}

function handleConnected() {

    if (callHasEnded) {

        return;

    }

    callStartedAt = new Date();

    showPanel("connected");

    document.getElementById("connectedAvatarWrap").style.display =
        callType === "audio" ? "block" : "none";

    timerIntervalId = setInterval(tick, 1000);

}

function tick() {

    elapsedSeconds += 1;

    document.getElementById("callTimer").textContent = formatDuration(elapsedSeconds);

    if (!isCaller) {

        return; // only the caller's client drives the economy

    }

    if (elapsedSeconds % INTERVAL_SECONDS === 0) {

        if (callerCoins < COINS_PER_INTERVAL) {

            endCall("insufficient_coins");
            return;

        }

        chargeInterval();

    }

}

async function chargeInterval() {

    callerCoins -= COINS_PER_INTERVAL;
    coinsSpentThisCall += COINS_PER_INTERVAL;
    hostEarningsThisCall += COINS_PER_INTERVAL;

    updateCoinTicker();

    try {

        await Promise.all([
            updateDoc(doc(db, "accounts", callerUid), {
                coins: increment(-COINS_PER_INTERVAL)
            }),
            updateDoc(doc(db, "hosts", hostUid), {
                coins: increment(COINS_PER_INTERVAL)
            })
        ]);

    }

    catch (error) {

        console.error("Coin deduction failed:", error);

    }

}

function updateCoinTicker() {

    if (isCaller) {

        document.getElementById("coinTicker").textContent = callerCoins.toLocaleString();

    }

}

function formatDuration(totalSeconds) {

    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

}

function showPanel(name) {

    Object.values(panels).forEach((panel) => panel.classList.remove("active"));
    panels[name].classList.add("active");

}

async function endCall(reason) {

    if (callHasEnded) {

        return;

    }

    callHasEnded = true;

    if (connectingTimeoutId) clearTimeout(connectingTimeoutId);
    if (timerIntervalId) clearInterval(timerIntervalId);

    document.getElementById("callControls").style.display = "none";

    const endedAt = new Date();

    showPanel("ended");

    document.getElementById("endedTitle").textContent =
        reason === "insufficient_coins" ? "Out of Coins" : "Call Ended";

    document.getElementById("endedDuration").textContent =
        `Duration: ${formatDuration(elapsedSeconds)}`;

    document.getElementById("endedCoins").textContent =
        `Coins spent: ${coinsSpentThisCall.toLocaleString()}`;

    // Only the caller's client logs the call, so a two-tab scenario
    // (caller + host both on call.html) doesn't write it twice.
    if (isCaller && callStartedAt) {

        try {

            await addDoc(collection(db, "calls"), {
                callerUid,
                hostUid,
                duration: elapsedSeconds,
                coinsSpent: coinsSpentThisCall,
                hostEarnings: hostEarningsThisCall,
                callType,
                startTime: callStartedAt,
                endTime: endedAt
            });

        }

        catch (error) {

            console.error("Failed to save call record:", error);

        }

    }

    const redirectTo =
        reason === "insufficient_coins" ? "recharge.html" : "user-dashboard.html";

    if (reason === "insufficient_coins") {

        showToast("You're out of coins — call ended");

    }

    setTimeout(() => {

        window.location.href = redirectTo;

    }, 1600);

}
