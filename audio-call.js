// ======================================================
// Vivy 💜 Audio Call
// audio-call.js
// Part 2 - Firebase, Call Initialization & UI
// ======================================================

import { authReady } from "./auth-guard.js";
import { getCurrentProfile } from "./auth-service.js";
import { db } from "./firebase-config.js";

import {
    doc,
    getDoc,
    addDoc,
    collection,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ======================================================
// Elements
// ======================================================

const hostPhoto = document.getElementById("hostPhoto");
const hostName = document.getElementById("hostName");
const hostCountry = document.getElementById("hostCountry");
const hostFlag = document.getElementById("hostFlag");

const coinBalance = document.getElementById("coinBalance");
const callStatus = document.getElementById("callStatus");
const callTimer = document.getElementById("callTimer");

const backBtn = document.getElementById("backBtn");
const endCallBtn = document.getElementById("endCallBtn");

const giftBtn = document.getElementById("giftBtn");
const muteBtn = document.getElementById("muteBtn");
const speakerBtn = document.getElementById("speakerBtn");
const messageBtn = document.getElementById("messageBtn");

// ======================================================
// Variables
// ======================================================

let currentUser = null;
let profile = null;
let host = null;

let seconds = 0;
let timer = null;

let callId = null;

let muted = false;
let speaker = true;

// ======================================================
// Init
// ======================================================

init();

async function init(){

    currentUser = await authReady;

    if(!currentUser) return;

    profile = await getCurrentProfile(currentUser.uid);

    coinBalance.textContent =
        Number(profile.coins || 0).toLocaleString();

    const params = new URLSearchParams(location.search);

    const hostUid = params.get("hostUid");

    if(!hostUid){

        alert("No host selected.");

        location.href="user-dashboard.html";

        return;

    }

    await loadHost(hostUid);

    await createCall();

    bindEvents();

    startConnecting();

}

// ======================================================
// Load Host
// ======================================================

async function loadHost(hostUid){

    const snap = await getDoc(doc(db,"hosts",hostUid));

    if(!snap.exists()){

        alert("Host not found.");

        location.href="user-dashboard.html";

        return;

    }

    host = snap.data();

    hostPhoto.src =
        host.profilePhoto || "assets/default-avatar.png";

    hostName.textContent =
        host.username || "Host";

    hostCountry.textContent =
        host.country || "Unknown";

    if(host.countryCode){

        hostFlag.src =
        `https://flagcdn.com/24x18/${host.countryCode.toLowerCase()}.png`;

    }

}

// ======================================================
// Create Call Record
// ======================================================

async function createCall(){

    const ref = await addDoc(collection(db,"calls"),{

        callerUid:currentUser.uid,

        hostUid:host.hostUid,

        type:"audio",

        status:"connecting",

        startedAt:serverTimestamp(),

        coinsSpent:0,

        hostEarned:0

    });

    callId = ref.id;

}

// ======================================================
// Connecting Animation
// ======================================================

function startConnecting(){

    callStatus.textContent="Connecting...";

    setTimeout(()=>{

        callStatus.textContent="Connected";

        startTimer();

    },3000);

}

// ======================================================
// Timer
// ======================================================

function startTimer(){

    timer=setInterval(()=>{

        seconds++;

        const m=Math.floor(seconds/60)
            .toString()
            .padStart(2,"0");

        const s=(seconds%60)
            .toString()
            .padStart(2,"0");

        callTimer.textContent=`${m}:${s}`;

    },1000);

}

// ======================================================
// Events
// ======================================================

function bindEvents(){

    backBtn.onclick=endCall;

    endCallBtn.onclick=endCall;

    muteBtn.onclick=toggleMute;

    speakerBtn.onclick=toggleSpeaker;

    giftBtn.onclick=()=>{

        location.href=
        `gift.html?hostUid=${host.hostUid}`;

    };

    messageBtn.onclick=()=>{

        location.href=
        `chat.html?hostUid=${host.hostUid}`;

    };

}

// ======================================================
// Controls
// ======================================================

function toggleMute(){

    muted=!muted;

    muteBtn.style.opacity=
        muted?.5:1;

}

function toggleSpeaker(){

    speaker=!speaker;

    speakerBtn.style.opacity=
        speaker?1:.5;

}

// ======================================================
// Vivy 💜 Audio Call
// Part 3 - Live Call Engine
// ======================================================

import {
    doc,
    updateDoc,
    increment,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let billingTimer = null;
let callStarted = false;

// ===========================================
// Start Live Call
// ===========================================

function beginLiveCall() {

    if (callStarted) return;

    callStarted = true;

    callStatus.textContent = "Connected 💜";

    startBilling();

    watchBalance();

}

// ===========================================
// Billing Every 30 Seconds
// ===========================================

function startBilling() {

    billingTimer = setInterval(async () => {

        try {

            const userRef = doc(db, "accounts", currentUser.uid);

            const hostRef = doc(db, "hosts", host.hostUid);

            const callRef = doc(db, "calls", callId);

            await updateDoc(userRef, {
                coins: increment(-100),
                coinsSpent: increment(100)
            });

            await updateDoc(hostRef, {
                coins: increment(100),
                totalEarned: increment(100)
            });

            await updateDoc(callRef, {
                coinsSpent: increment(100),
                hostEarned: increment(100),
                lastBilling: serverTimestamp()
            });

        } catch (e) {

            console.error(e);

        }

    }, 30000);

}

// ===========================================
// Watch Coin Balance
// ===========================================

function watchBalance() {

    onSnapshot(doc(db, "accounts", currentUser.uid), (snap) => {

        if (!snap.exists()) return;

        const data = snap.data();

        coinBalance.textContent =
            Number(data.coins || 0).toLocaleString();

        if ((data.coins || 0) <= 0) {

            alert("Not enough coins.");

            endCall();

        }

    });

}

// ===========================================
// End Call
// ===========================================

async function endCall() {

    clearInterval(timer);

    clearInterval(billingTimer);

    try {

        await updateDoc(doc(db, "calls", callId), {

            status: "ended",

            endedAt: serverTimestamp(),

            duration: seconds

        });

    } catch (e) {}

    location.href = "user-dashboard.html";

}

// ===========================================
// Connect After Animation
// ===========================================

setTimeout(() => {

    beginLiveCall();

}, 3000);
// ======================================================
// Vivy 💜 Audio Call
// Part 4 - Gifts, Mute, Speaker, Chat & Call Summary
// ======================================================

// ----------------------------
// Gift Button
// ----------------------------
giftBtn.addEventListener("click", () => {

    if (!host) return;

    location.href = `gift.html?hostUid=${host.hostUid}`;

});

// ----------------------------
// Message Button
// ----------------------------
messageBtn.addEventListener("click", () => {

    if (!host) return;

    location.href = `messages.html?hostUid=${host.hostUid}`;

});

// ----------------------------
// Toggle Mute
// ----------------------------
muteBtn.addEventListener("click", () => {

    muted = !muted;

    muteBtn.classList.toggle("active", muted);

    muteBtn.innerHTML = muted ? "🔇" : "🎤";

    // TODO:
    // Replace with ZEGOCLOUD muteMicrophone()
    console.log("Microphone:", muted ? "Muted" : "Unmuted");

});

// ----------------------------
// Toggle Speaker
// ----------------------------
speakerBtn.addEventListener("click", () => {

    speaker = !speaker;

    speakerBtn.classList.toggle("active", speaker);

    speakerBtn.innerHTML = speaker ? "🔊" : "🔈";

    // TODO:
    // Replace with ZEGOCLOUD enableSpeaker()
    console.log("Speaker:", speaker ? "On" : "Off");

});

// ----------------------------
// Call Summary
// ----------------------------
async function saveCallSummary() {

    try {

        await updateDoc(
            doc(db, "calls", callId),
            {

                duration: seconds,

                endedAt: serverTimestamp(),

                coinsSpent: Math.floor(seconds / 30) * 100,

                hostEarned: Math.floor(seconds / 30) * 100,

                status: "completed"

            }
        );

    } catch (error) {

        console.error(error);

    }

}

// ----------------------------
// Override End Call
// ----------------------------
async function finishCall() {

    clearInterval(timer);

    clearInterval(billingTimer);

    await saveCallSummary();

    location.href = "call-summary.html?callId=" + callId;

}

// Replace old event
endCallBtn.onclick = finishCall;

// Back button
backBtn.onclick = finishCall;

// ----------------------------
// Auto End if Host Disconnects
// ----------------------------
onSnapshot(doc(db, "calls", callId), (snap) => {

    if (!snap.exists()) return;

    const call = snap.data();

    if (call.status === "ended") {

        finishCall();

    }

});

// ----------------------------
// Keep Screen Awake (Supported Browsers)
// ----------------------------
let wakeLock = null;

async function keepScreenAwake() {

    try {

        if ("wakeLock" in navigator) {

            wakeLock = await navigator.wakeLock.request("screen");

        }

    } catch (e) {

        console.log(e);

    }

}

keepScreenAwake();// ======================================================
// Vivy 💜 Audio Call
// Part 5 - ZEGOCLOUD Call Engine
// Replace YOUR_APP_ID and YOUR_SERVER_SECRET
// ======================================================

import {
    ZegoUIKitPrebuilt
} from "https://unpkg.com/@zegocloud/zego-uikit-prebuilt/zego-uikit-prebuilt.esm.js";

// ======================================================
// ZEGO Config
// ======================================================

const APP_ID = YOUR_APP_ID;

const SERVER_SECRET = "YOUR_SERVER_SECRET";

const ROOM_ID = callId;

const USER_ID = currentUser.uid;

const USER_NAME = profile.username || "Vivy User";

// ======================================================
// Generate Token
// ======================================================

const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(

    APP_ID,

    SERVER_SECRET,

    ROOM_ID,

    USER_ID,

    USER_NAME

);

// ======================================================
// Join Audio Room
// ======================================================

const zp = ZegoUIKitPrebuilt.create(kitToken);

zp.joinRoom({

    container: document.body,

    scenario: {

        mode: ZegoUIKitPrebuilt.OneONoneCall

    },

    turnOnMicrophoneWhenJoining: true,

    turnOnCameraWhenJoining: false,

    showMyCameraToggleButton: false,

    showScreenSharingButton: false,

    showTextChat: false,

    showUserList: false,

    showLeavingView: false,

    maxUsers: 2,

    onJoinRoom: () => {

        console.log("Joined Audio Room");

    },

    onLeaveRoom: async () => {

        await finishCall();

    }

});

// ======================================================
// Update Call Status
// ======================================================

await updateDoc(

    doc(db, "calls", callId),

    {

        status: "connected",

        connectedAt: serverTimestamp()

    }

);

// ======================================================
// Before User Closes App
// ======================================================

window.addEventListener("beforeunload", async () => {

    try {

        await updateDoc(

            doc(db, "calls", callId),

            {

                status: "ended",

                endedAt: serverTimestamp()

            }

        );

    } catch (e) {}

});

// ======================================================
// Call Finished
// ======================================================

console.log("✅ Vivy Audio Call Ready");
