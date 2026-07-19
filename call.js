// ======================================================
// Vivy 💜 Call Screen
//
// Business rules (must always hold):
//   • Caller spends 100 coins (audio) or 150 coins (video) every 30s
//     of an ACTIVE (connected) call.
//   • Host earns 50 Diamonds every 30s of that same active call,
//     regardless of call type — Diamonds convert to money through
//     the weekly agency payroll (admin-payroll.js), not spendable
//     directly the way a caller's coins are.
//   • Deduction starts only once both sides are connected.
//   • Deduction stops immediately when the call ends.
//   • If the caller runs out of coins, the call ends automatically
//     and they're redirected to recharge.html.
//   • Every completed call is logged to Firestore's "calls" collection,
//     and every individual billing tick is logged to "callBillingLogs"
//     (see call-billing.js) — both written atomically via a single
//     Firestore transaction per tick.
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
    collection,
    addDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { getUrlParam, showToast } from "./ui-helpers.js";
import { joinCall, leaveCall, setMicMuted, setCameraEnabled } from "./zego-call.js";
import { runBillingTick, getBillingRate } from "./call-billing.js";

const INTERVAL_SECONDS = 30;

const hostUid = getUrlParam("hostUid");
const callerUid = getUrlParam("callerUid");
const callType = getUrlParam("callType") === "audio" ? "audio" : "video";

const BILLING_RATE = getBillingRate(callType); // { coins, diamonds } — 100/50 audio, 150/50 video
const MIN_COINS_TO_START = BILLING_RATE.coins;

// Both the caller and host land on this page with the same hostUid +
// callerUid pair, so a deterministic room ID lets each side compute the
// same ZEGOCLOUD room independently — no separate signaling doc needed.
const roomId = `vivycall_${[hostUid, callerUid].sort().join("_")}`;

let currentUser = null;
let isCaller = false;

let callerCoins = 0;
let hostEarningsThisCall = 0;
let coinsSpentThisCall = 0;
let diamondsEarnedThisCall = 0;
let callId = null;

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

    connectRealCall();

}

async function connectRealCall() {

    if (callHasEnded) return;

    try {

        const idToken = await currentUser.getIdToken();

        await joinCall({

            roomId,
            firebaseIdToken: idToken,
            userId: currentUser.uid,
            userName: currentUser.email || "Vivy User",
            callType,

            onLocalStream: (stream) => {

                if (callType !== "video") return;

                const videoEl = document.createElement("video");
                videoEl.autoplay = true;
                videoEl.muted = true;
                videoEl.playsInline = true;
                videoEl.srcObject = stream;
                videoEl.style.cssText = "width:100%;height:100%;object-fit:cover;";

                const bg = document.getElementById("callBg");
                if (bg) { bg.innerHTML = ""; bg.appendChild(videoEl); }

            },

            onRemoteJoined: () => {

                handleConnected();

            },

            onRemoteLeft: () => {

                endCall("remote_left");

            }

        });

    }

    catch (error) {

        console.error("Failed to join ZEGOCLOUD call:", error);
        showToast("Couldn't connect the call.");
        endCall("connect_failed");

    }

}

function bindControls() {

    document.getElementById("endCallBtn")
        .addEventListener("click", () => endCall("manual"));

    document.getElementById("muteBtn")
        .addEventListener("click", (e) => {

            const nowMuted = e.currentTarget.classList.toggle("active-toggle");
            setMicMuted(nowMuted);

        });

    document.getElementById("speakerBtn")
        .addEventListener("click", (e) => e.currentTarget.classList.toggle("active-toggle"));

    document.getElementById("videoToggleBtn")
        .addEventListener("click", (e) => {

            const nowOff = e.currentTarget.classList.toggle("active-toggle");
            setCameraEnabled(!nowOff);

        });

    document.getElementById("giftBtn")
        .addEventListener("click", () => {

            // Gifts are a separate economy from call earnings (they convert
            // to Diamonds for hosts) — this is a placeholder hook for that
            // future feature, deliberately not touching coin/call logic.
            showToast("Gifts are coming soon 🎁");

        });

}

function handleConnected() {

    if (callHasEnded || callStartedAt) {

        return;

    }

    callStartedAt = new Date();

    if (isCaller) {

        createCallRecord();

    }

    showPanel("connected");

    document.getElementById("connectedAvatarWrap").style.display =
        callType === "audio" ? "block" : "none";

    timerIntervalId = setInterval(tick, 1000);

}

async function createCallRecord() {

    try {

        const ref = await addDoc(collection(db, "calls"), {

            callerUid,
            hostUid,
            callType,
            status: "active",

            startTime: callStartedAt,
            duration: 0,

            coinsSpent: 0,
            hostEarnings: 0,
            diamondsEarned: 0

        });

        callId = ref.id;

    }

    catch (error) {

        console.error("Failed to create call record:", error);

    }

}

function tick() {

    elapsedSeconds += 1;

    document.getElementById("callTimer").textContent = formatDuration(elapsedSeconds);

    if (!isCaller) {

        return; // only the caller's client drives the economy

    }

    if (elapsedSeconds % INTERVAL_SECONDS === 0) {

        if (!callId || callerCoins < BILLING_RATE.coins) {

            endCall("insufficient_coins");
            return;

        }

        chargeInterval();

    }

}

async function chargeInterval() {

    try {

        const result = await runBillingTick({
            callId,
            callerUid,
            hostUid,
            callType
        });

        if (!result.charged) {

            endCall("insufficient_coins");
            return;

        }

        callerCoins = result.callerBalanceAfter;
        coinsSpentThisCall += BILLING_RATE.coins;
        hostEarningsThisCall += BILLING_RATE.coins;
        diamondsEarnedThisCall += BILLING_RATE.diamonds;

        updateCoinTicker();

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

    leaveCall();

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
    if (isCaller && callStartedAt && callId) {

        try {

            await updateDoc(doc(db, "calls", callId), {
                status: "ended",
                endReason: reason,
                duration: elapsedSeconds,
                coinsSpent: coinsSpentThisCall,
                hostEarnings: hostEarningsThisCall,
                diamondsEarned: diamondsEarnedThisCall,
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
