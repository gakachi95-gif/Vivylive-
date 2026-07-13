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
    increment,
    addDoc,
    collection,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ======================================================
// Config
// ======================================================

const COINS_PER_INTERVAL = 100;
const DIAMONDS_PER_INTERVAL = 50; // 100 coins spent = 50 diamonds earned
const INTERVAL_MS = 30000;
const CONNECT_DELAY_MS = 3000;

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

    await createCall();

    keepScreenAwake();
    watchBalance();

    startConnecting();

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
        hostUid: hostUid,

        callType: "audio",
        status: "connecting",

        startTime: serverTimestamp(),
        duration: 0,

        coinsSpent: 0,
        hostEarnings: 0,
        diamondsEarned: 0

    });

    callId = ref.id;

}

// ======================================================
// Connecting → Live Call
// ======================================================

function startConnecting() {

    callStatus.textContent = "Connecting...";

    setTimeout(beginLiveCall, CONNECT_DELAY_MS);

}

async function beginLiveCall() {

    if (callEnded) {

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

    coinsSpentThisCall += COINS_PER_INTERVAL;
    diamondsEarnedThisCall += DIAMONDS_PER_INTERVAL;

    try {

        await Promise.all([

            updateDoc(doc(db, "accounts", currentUser.uid), {
                coins: increment(-COINS_PER_INTERVAL)
            }),

            // Hosts are paid in Diamonds, never raw coins — Diamonds
            // convert to money through the weekly agency payroll.
            updateDoc(doc(db, "hosts", hostUid), {
                diamonds: increment(DIAMONDS_PER_INTERVAL),
                weeklyDiamonds: increment(DIAMONDS_PER_INTERVAL)
            }),

            updateDoc(doc(db, "calls", callId), {
                coinsSpent: increment(COINS_PER_INTERVAL),
                hostEarnings: increment(COINS_PER_INTERVAL),
                diamondsEarned: increment(DIAMONDS_PER_INTERVAL),
                lastBilling: serverTimestamp()
            })

        ]);

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

    // ZEGOCLOUD: zg.muteMicrophone(muted);

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
