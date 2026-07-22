// ======================================================
// Vivy 💜 Audio Call
// audio-call.js
//
// Economy rules (do not change):
//   • 100 coins deducted from the caller every 30s of an
//     active (connected) call.
//   • Every 100 coins spent credits the host 50 Diamonds
//     (never raw coins — hosts are paid out via payroll).
//   • Billing starts only once the call is connected and
//     stops immediately when the call ends.
//   • If the caller's balance can't cover the next 30s
//     interval, billing pauses and a low-balance popup
//     offers Recharge or End Call — never a silent alert.
//
// ZEGOCLOUD: this file simulates the connect handshake with
// a timeout so the whole call/billing/logging flow works
// today. Swap `startConnecting()`'s timeout for a real
// "both peers joined" callback later, and call `endCall()`
// from ZEGOCLOUD's onLeaveRoom — nothing else here changes.
// ======================================================

import { authReady } from "./auth-guard.js";
import { getCurrentProfile } from "./auth-service.js";
import { db } from "./firebase-config.js";

import {
    doc,
    getDoc,
    updateDoc,
    addDoc,
    collection,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { joinCall, leaveCall, setMicMuted } from "./zego-call.js";
import { runBillingTick } from "./call-billing.js";

// ======================================================
// Config
// ======================================================

const COINS_PER_INTERVAL = 100;
const DIAMONDS_PER_INTERVAL = 50; // 100 coins spent = 50 diamonds earned
const INTERVAL_MS = 30000;

// ======================================================
// Elements
// ======================================================

const hostPhoto = document.getElementById("hostPhoto");
const hostName = document.getElementById("hostName");
const hostCountry = document.getElementById("hostCountry");
const hostFlag = document.getElementById("hostFlag");

const coinBalanceEl = document.getElementById("coinBalance");
const callStatus = document.getElementById("callStatus");
const callTimer = document.getElementById("callTimer");

const backBtn = document.getElementById("backBtn");
const endCallBtn = document.getElementById("endCallBtn");

const giftBtn = document.getElementById("giftBtn");
const muteBtn = document.getElementById("muteBtn");
const speakerBtn = document.getElementById("speakerBtn");
const messageBtn = document.getElementById("messageBtn");

const lowBalanceModal = document.getElementById("lowBalanceModal");
const lowBalanceRechargeBtn = document.getElementById("lowBalanceRechargeBtn");
const lowBalanceEndBtn = document.getElementById("lowBalanceEndBtn");

// ======================================================
// State
// ======================================================

let currentUser = null;
let profile = null;

let hostUid = null;
let host = null;

let seconds = 0;
let timer = null;
let billingTimer = null;

let callId = null;
let callActive = false;
let callEnded = false;

let currentCoins = 0;
let coinsSpentThisCall = 0;
let diamondsEarnedThisCall = 0;

let muted = false;
let speaker = true;

let wakeLock = null;
let balanceUnsubscribe = null;

let isCaller = true;
let statusUnsubscribe = null;
let ringTimeoutId = null;

const RING_TIMEOUT_MS = 40000; // 40s of nobody accepting → auto-end as "no answer"

// ======================================================
// Init
// ======================================================

init();

async function init() {

    currentUser = await authReady;

    if (!currentUser) {

        return;

    }

    // Bind Back/End Call (and everything else) FIRST, before any
    // Firestore calls that could throw — a permission error or a
    // missing doc below must never leave the user stuck on a
    // screen with dead buttons.
    bindEvents();

    try {

        profile = await getCurrentProfile(currentUser.uid);

        currentCoins = Number(profile?.coins || 0);
        coinBalanceEl.textContent = currentCoins.toLocaleString();

        const params = new URLSearchParams(location.search);

        hostUid = params.get("hostUid");
        const existingCallId = params.get("callId");
        isCaller = params.get("role") !== "host";

        if (!hostUid) {

            alert("No host selected.");
            location.href = "user-dashboard.html";
            return;

        }

        const loaded = await loadHost();

        if (!loaded) {

            return;

        }

        if (isCaller) {

            await createCall();

        }

        else {

            if (!existingCallId) {

                location.href = "host-dashboard.html";
                return;

            }

            callId = existingCallId;

        }

        keepScreenAwake();
        watchBalance();

        if (isCaller) {

            callStatus.textContent = "Ringing…";
            watchCallStatus();

        }

        else {

            connectRealCall();

        }

    }

    catch (error) {

        console.error("Failed to start the call:", error);
        callStatus.textContent = "Couldn't start the call";
        showToast("Couldn't start the call — check your connection and try again.");

    }

}

// ======================================================
// Load Host
// ======================================================

async function loadHost() {

    const snap = await getDoc(doc(db, "hosts", hostUid));

    if (!snap.exists()) {

        alert("Host not found.");
        location.href = "user-dashboard.html";
        return false;

    }

    host = snap.data();

    hostPhoto.src = host.profilePhoto || "assets/default-avatar.png";
    hostName.textContent = host.username || "Host";
    hostCountry.textContent = host.country || "Unknown";

    if (host.countryCode) {

        hostFlag.src = `https://flagcdn.com/24x18/${host.countryCode.toLowerCase()}.png`;

    }

    return true;

}

// ======================================================
// Create Call Record
// ======================================================

async function createCall() {

    const ref = await addDoc(collection(db, "calls"), {

        callerUid: currentUser.uid,
        callerName: profile?.username || currentUser.email || "Vivy User",
        hostUid: hostUid,

        callType: "audio",
        status: "ringing",

        startTime: serverTimestamp(),
        duration: 0,

        coinsSpent: 0,
        hostEarnings: 0,
        diamondsEarned: 0

    });

    callId = ref.id;

}

// ======================================================
// Ringing → real connect (replaces the old simulated timeout)
// ======================================================

function watchCallStatus() {

    ringTimeoutId = setTimeout(() => {

        if (callEnded) return;

        if (statusUnsubscribe) { statusUnsubscribe(); statusUnsubscribe = null; }

        updateDoc(doc(db, "calls", callId), { status: "missed" }).catch(() => {});

        showToast("No answer");
        endCall("no_answer");

    }, RING_TIMEOUT_MS);

    statusUnsubscribe = onSnapshot(doc(db, "calls", callId), (snap) => {

        if (!snap.exists() || callEnded) return;

        const status = snap.data().status;

        if (status === "accepted") {

            if (ringTimeoutId) { clearTimeout(ringTimeoutId); ringTimeoutId = null; }
            if (statusUnsubscribe) { statusUnsubscribe(); statusUnsubscribe = null; }
            connectRealCall();

        }

        else if (status === "rejected") {

            if (ringTimeoutId) { clearTimeout(ringTimeoutId); ringTimeoutId = null; }
            showToast("Call declined");
            endCall("rejected");

        }

    });

}

async function connectRealCall() {

    if (callEnded) return;

    callStatus.textContent = "Connecting...";

    try {

        const idToken = await currentUser.getIdToken();

        await joinCall({

            roomId: callId,
            firebaseIdToken: idToken,
            userId: currentUser.uid,
            userName: profile?.username || currentUser.email || "Vivy User",
            callType: "audio",

            onLocalStream: () => {

                // Audio-only — no local video element to attach.

            },

            onRemoteJoined: () => {

                beginLiveCall();

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

async function beginLiveCall() {

    if (callEnded || callActive) {

        return;

    }

    callActive = true;

    callStatus.textContent = "Connected 💜";

    try {

        await updateDoc(doc(db, "calls", callId), {
            status: "connected",
            connectedAt: serverTimestamp()
        });

    }

    catch (error) {

        console.error("Failed to mark call connected:", error);

    }

    startTimer();
    startBilling();

}

// ======================================================
// Timer
// ======================================================

function startTimer() {

    timer = setInterval(() => {

        seconds++;

        const m = Math.floor(seconds / 60).toString().padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");

        callTimer.textContent = `${m}:${s}`;

    }, 1000);

}

// ======================================================
// Billing — every 30 seconds of active call time
// ======================================================

function startBilling() {

    billingTimer = setInterval(() => {

        if (!callActive) {

            return;

        }

        if (currentCoins < COINS_PER_INTERVAL) {

            showLowBalanceModal();
            return;

        }

        chargeInterval();

    }, INTERVAL_MS);

}

async function chargeInterval() {

    try {

        const result = await runBillingTick({
            callId,
            callerUid: currentUser.uid,
            hostUid,
            callType: "audio"
        });

        if (!result.charged) {

            showLowBalanceModal();
            return;

        }

        coinsSpentThisCall += COINS_PER_INTERVAL;
        diamondsEarnedThisCall += DIAMONDS_PER_INTERVAL;

        currentCoins = result.callerBalanceAfter;
        coinBalanceEl.textContent = currentCoins.toLocaleString();

    }

    catch (error) {

        console.error("Billing failed:", error);

    }

}

// ======================================================
// Watch Live Coin Balance
// ======================================================

function watchBalance() {

    balanceUnsubscribe = onSnapshot(
        doc(db, "accounts", currentUser.uid),
        (snap) => {

            if (!snap.exists()) {

                return;

            }

            currentCoins = Number(snap.data().coins || 0);
            coinBalanceEl.textContent = currentCoins.toLocaleString();

            if (callActive && !callEnded && currentCoins < COINS_PER_INTERVAL) {

                showLowBalanceModal();

            }

        }
    );

}

// ======================================================
// Low Balance Modal
// ======================================================

function showLowBalanceModal() {

    if (lowBalanceModal.classList.contains("show")) {

        return;

    }

    // Pause billing while the person decides — never charge a partial
    // interval they can't afford.
    if (billingTimer) {

        clearInterval(billingTimer);
        billingTimer = null;

    }

    lowBalanceModal.classList.add("show");

}

function hideLowBalanceModal() {

    lowBalanceModal.classList.remove("show");

}

// ======================================================
// Events
// ======================================================

function bindEvents() {

    backBtn.addEventListener("click", () => endCall("manual"));
    endCallBtn.addEventListener("click", () => endCall("manual"));

    muteBtn.addEventListener("click", toggleMute);
    speakerBtn.addEventListener("click", toggleSpeaker);

    giftBtn.addEventListener("click", () => {

        // Gifts are a separate economy from call earnings (they convert
        // to Diamonds directly) — placeholder hook for that future page.
        showToast("Gifts are coming soon 🎁");

    });

    messageBtn.addEventListener("click", () => {

        if (!hostUid) return;

        location.href = `chat.html?hostUid=${hostUid}`;

    });

    lowBalanceRechargeBtn.addEventListener("click", () => {

        hideLowBalanceModal();
        endCall("low_balance");

    });

    lowBalanceEndBtn.addEventListener("click", () => {

        hideLowBalanceModal();
        endCall("manual");

    });

}

function toggleMute() {

    muted = !muted;

    muteBtn.style.opacity = muted ? .5 : 1;
    muteBtn.textContent = muted ? "🔇" : "🎤";

    setMicMuted(muted);

}

function toggleSpeaker() {

    speaker = !speaker;

    speakerBtn.style.opacity = speaker ? 1 : .5;
    speakerBtn.textContent = speaker ? "🔊" : "🔈";

    // ZEGOCLOUD: zg.enableSpeaker(speaker);

}

// ======================================================
// End Call
// ======================================================

async function endCall(reason) {

    if (callEnded) {

        return;

    }

    callEnded = true;
    callActive = false;

    if (timer) clearInterval(timer);
    if (billingTimer) clearInterval(billingTimer);
    if (balanceUnsubscribe) balanceUnsubscribe();
    if (statusUnsubscribe) statusUnsubscribe();
    if (ringTimeoutId) clearTimeout(ringTimeoutId);

    leaveCall();

    if (wakeLock) {

        try { await wakeLock.release(); } catch (e) {}

    }

    try {

        await updateDoc(doc(db, "calls", callId), {

            status: "ended",
            endReason: reason,
            endTime: serverTimestamp(),
            duration: seconds,
            coinsSpent: coinsSpentThisCall,
            hostEarnings: coinsSpentThisCall,
            diamondsEarned: diamondsEarnedThisCall

        });

    }

    catch (error) {

        console.error("Failed to save call record:", error);

    }

    // Route each side back to its own dashboard. The host tab has no
    // accounts/{uid} document (hosts live in the separate "hosts"
    // collection), so sending it to user-dashboard.html was landing the
    // host on a page that thinks their account is missing — the "logged
    // out" behavior seen after a failed/ended call.
    if (!isCaller) {

        location.href = "host-dashboard.html";

    }

    else {

        location.href = reason === "low_balance" ? "recharge.html" : "user-dashboard.html";

    }

}

// ======================================================
// Keep Screen Awake
// ======================================================

async function keepScreenAwake() {

    try {

        if ("wakeLock" in navigator) {

            wakeLock = await navigator.wakeLock.request("screen");

        }

    }

    catch (error) {

        console.log(error);

    }

}

// ======================================================
// Mini Toast
// ======================================================

let toastTimer = null;

function showToast(message) {

    let toastEl = document.querySelector(".mini-toast");

    if (!toastEl) {

        toastEl = document.createElement("div");
        toastEl.className = "mini-toast";
        document.body.appendChild(toastEl);

    }

    toastEl.textContent = message;

    void toastEl.offsetWidth;

    toastEl.classList.add("show");

    if (toastTimer) clearTimeout(toastTimer);

    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);

}

// ======================================================
// If the caller closes/reloads mid-call, best-effort mark
// the call ended so it doesn't sit "connected" forever.
// ======================================================

window.addEventListener("beforeunload", () => {

    if (callEnded || !callId) {

        return;

    }

    updateDoc(doc(db, "calls", callId), {

        status: "ended",
        endReason: "closed",
        endTime: serverTimestamp(),
        duration: seconds,
        coinsSpent: coinsSpentThisCall,
        hostEarnings: coinsSpentThisCall,
        diamondsEarned: diamondsEarnedThisCall

    }).catch(() => {});

});
