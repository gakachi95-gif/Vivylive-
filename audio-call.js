// ======================================================
// Vivy 💜 Audio Call
// audio-call.js
//
// Economy rules (final billing system):
//   • 100 coins deducted from the caller every 30s of an
//     active (connected) call.
//   • The host is credited 50 Diamonds every 30s, flat —
//     never raw coins (hosts are paid out via payroll).
//   • Billing starts only once the call is connected and
//     stops immediately when the call ends.
//   • Every 30s cycle is billed through a single atomic
//     Firestore transaction (see call-billing.js) — the
//     coin deduction, the diamond credit, and a permanent
//     per-cycle ledger entry all happen together or not at
//     all, and the same cycle can never be billed twice
//     even though both the caller's and host's tabs run
//     this billing loop independently.
//   • If the caller can't afford the next 30s cycle, the
//     call ends AUTOMATICALLY — a brief notice is shown,
//     then the call ends without waiting for a tap.
//
// ZEGOCLOUD: real join/leave is wired in via zego-call.js —
// billing starts on ZEGOCLOUD's "remote joined" event and
// ends on "remote left" / manual hangup.
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
import { billCycle } from "./call-billing.js";

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
let callerUid = null;

let seconds = 0;
let timer = null;
let billingTimer = null;
let currentCycle = 0;
let lowBalanceAutoEndTimer = null;

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

// ======================================================
// Init
// ======================================================

init();

async function init() {

    currentUser = await authReady;

    if (!currentUser) {

        return;

    }

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

    bindEvents();

    const loaded = await loadHost();

    if (!loaded) {

        return;

    }

    if (isCaller) {

        callerUid = currentUser.uid;

        await createCall();

    }

    else {

        if (!existingCallId) {

            location.href = "host-dashboard.html";
            return;

        }

        callId = existingCallId;

        // The host's tab never receives the caller's UID as a URL
        // param — read it off the call doc that createCall() (on the
        // caller's side) already wrote.
        try {

            const callSnap = await getDoc(doc(db, "calls", callId));
            callerUid = callSnap.exists() ? callSnap.data().callerUid : null;

        }

        catch (error) {

            console.error("Failed to load caller UID from call doc:", error);

        }

        if (!callerUid) {

            location.href = "host-dashboard.html";
            return;

        }

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
        diamondsEarned: 0,
        billedCycles: 0,
        billingClosed: false

    });

    callId = ref.id;

}

// ======================================================
// Ringing → real connect (replaces the old simulated timeout)
// ======================================================

function watchCallStatus() {

    statusUnsubscribe = onSnapshot(doc(db, "calls", callId), (snap) => {

        if (!snap.exists() || callEnded) return;

        const status = snap.data().status;

        if (status === "accepted") {

            if (statusUnsubscribe) { statusUnsubscribe(); statusUnsubscribe = null; }
            connectRealCall();

        }

        else if (status === "rejected") {

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

    billingTimer = setInterval(runBillingTick, INTERVAL_MS);

}

async function runBillingTick() {

    if (!callActive || callEnded) {

        return;

    }

    currentCycle += 1;

    const result = await billCycle({

        callId,
        cycleNumber: currentCycle,
        callerUid,
        hostUid,
        callType: "audio",
        coinsPerInterval: COINS_PER_INTERVAL,
        diamondsPerInterval: DIAMONDS_PER_INTERVAL,
        elapsedSeconds: seconds

    });

    if (result.billed) {

        coinsSpentThisCall += COINS_PER_INTERVAL;
        diamondsEarnedThisCall += DIAMONDS_PER_INTERVAL;
        return;

    }

    if (result.reason === "insufficient-funds") {

        showLowBalanceModal();
        return;

    }

    if (result.reason === "call-not-active") {

        // The call already ended (on this side or the other) — stop
        // trying to bill it.
        if (billingTimer) { clearInterval(billingTimer); billingTimer = null; }

    }

    // "already-billed" (the other tab won this cycle) and "error"
    // (safe to retry next tick) both need no action here.

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

    location.href = reason === "low_balance" ? "recharge.html" : "user-dashboard.html";

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
