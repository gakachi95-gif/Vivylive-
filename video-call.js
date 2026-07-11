// ======================================================
// Vivy 💜 Video Call
// Part 2 - video-call.js
// ======================================================

import { authReady } from "./auth-guard.js";
import { getCurrentProfile } from "./auth-service.js";
import { db } from "./firebase-config.js";

import {
    doc,
    getDoc,
    addDoc,
    updateDoc,
    increment,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ======================================================
// Elements
// ======================================================

const hostName = document.getElementById("hostName");
const callStatus = document.getElementById("callStatus");
const callTimer = document.getElementById("callTimer");

const coinBalance = document.getElementById("coinBalance");

const remoteVideo = document.getElementById("remoteVideo");
const localVideo = document.getElementById("localVideo");

const giftBtn = document.getElementById("giftBtn");
const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");
const switchCameraBtn = document.getElementById("switchCameraBtn");
const speakerBtn = document.getElementById("speakerBtn");
const messageBtn = document.getElementById("messageBtn");
const endCallBtn = document.getElementById("endCallBtn");
const backBtn = document.getElementById("backBtn");

// ======================================================

let currentUser;
let profile;
let host;

let callId;

let seconds = 0;

let timer;
let billingTimer;

let muted = false;
let cameraEnabled = true;
let speakerEnabled = true;

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

        location.href="user-dashboard.html";
        return;

    }

    const snap = await getDoc(doc(db,"hosts",hostUid));

    if(!snap.exists()){

        location.href="user-dashboard.html";
        return;

    }

    host = snap.data();

    hostName.textContent = host.username;

    const callDoc = await addDoc(doc(db,"calls").parent,{

        callerUid:currentUser.uid,

        hostUid,

        type:"video",

        status:"connecting",

        startedAt:serverTimestamp(),

        coinsSpent:0,

        hostEarned:0

    });

    callId = callDoc.id;

    connectAnimation();

    bindEvents();

}

// ======================================================

function connectAnimation(){

    callStatus.textContent="Connecting...";

    setTimeout(()=>{

        callStatus.textContent="Connected 💜";

        startTimer();

        startBilling();

        watchCoins();

    },3000);

}

// ======================================================

function startTimer(){

    timer=setInterval(()=>{

        seconds++;

        const m=Math.floor(seconds/60).toString().padStart(2,"0");

        const s=(seconds%60).toString().padStart(2,"0");

        callTimer.textContent=`${m}:${s}`;

    },1000);

}

// ======================================================

function startBilling(){

    billingTimer=setInterval(async()=>{

        await updateDoc(doc(db,"accounts",currentUser.uid),{

            coins:increment(-100)

        });

        await updateDoc(doc(db,"hosts",host.hostUid),{

            coins:increment(100)

        });

        await updateDoc(doc(db,"calls",callId),{

            coinsSpent:increment(100),

            hostEarned:increment(100)

        });

    },30000);

}

// ======================================================

function watchCoins(){

    onSnapshot(doc(db,"accounts",currentUser.uid),(snap)=>{

        if(!snap.exists()) return;

        const data=snap.data();

        coinBalance.textContent=data.coins;

        if(data.coins<=0){

            finishCall();

        }

    });

  }// ======================================================
// Vivy 💜 Video Call
// Part 3 - Controls & Call Actions
// ======================================================

function bindEvents() {

    backBtn.addEventListener("click", finishCall);

    endCallBtn.addEventListener("click", finishCall);

    giftBtn.addEventListener("click", () => {

        location.href = `gift.html?hostUid=${host.hostUid}`;

    });

    messageBtn.addEventListener("click", () => {

        location.href = `messages.html?hostUid=${host.hostUid}`;

    });

    muteBtn.addEventListener("click", toggleMute);

    cameraBtn.addEventListener("click", toggleCamera);

    speakerBtn.addEventListener("click", toggleSpeaker);

    switchCameraBtn.addEventListener("click", switchCamera);

}

// ======================================================
// Mute
// ======================================================

function toggleMute() {

    muted = !muted;

    muteBtn.classList.toggle("active", muted);

    muteBtn.textContent = muted ? "🔇" : "🎤";

    // ZEGO:
    // zg.muteMicrophone(muted);

}

// ======================================================
// Camera
// ======================================================

function toggleCamera() {

    cameraEnabled = !cameraEnabled;

    cameraBtn.classList.toggle("active", !cameraEnabled);

    cameraBtn.textContent = cameraEnabled ? "📷" : "🚫";

    // ZEGO:
    // zg.enableCamera(cameraEnabled);

}

// ======================================================
// Speaker
// ======================================================

function toggleSpeaker() {

    speakerEnabled = !speakerEnabled;

    speakerBtn.classList.toggle("active", !speakerEnabled);

    speakerBtn.textContent = speakerEnabled ? "🔊" : "🔈";

    // ZEGO:
    // zg.enableSpeaker(speakerEnabled);

}

// ======================================================
// Switch Camera
// ======================================================

function switchCamera() {

    // ZEGO:
    // zg.useFrontCamera(false);

    console.log("Camera Switched");

}

// ======================================================
// Picture Preview
// ======================================================

function showLocalPreview(stream) {

    localVideo.innerHTML = "";

    localVideo.appendChild(stream);

}

function showRemoteVideo(stream) {

    remoteVideo.innerHTML = "";

    remoteVideo.appendChild(stream);

              }// ======================================================
// Vivy 💜 Video Call
// Part 4 - Finish Call & Firebase Updates
// ======================================================

// ===========================================
// Finish Call
// ===========================================

async function finishCall() {

    clearInterval(timer);

    clearInterval(billingTimer);

    try {

        await updateDoc(
            doc(db, "calls", callId),
            {
                status: "ended",

                endedAt: serverTimestamp(),

                duration: seconds,

                coinsSpent: Math.floor(seconds / 30) * 100,

                hostEarned: Math.floor(seconds / 30) * 100
            }
        );

    } catch (e) {

        console.error(e);

    }

    location.href =
        `call-summary.html?callId=${callId}`;

}

// ===========================================
// Watch Call Status
// ===========================================

onSnapshot(doc(db, "calls", callId), (snap) => {

    if (!snap.exists()) return;

    const data = snap.data();

    if (data.status === "ended") {

        finishCall();

    }

});

// ===========================================
// Keep Screen Awake
// ===========================================

let wakeLock = null;

async function keepAwake() {

    try {

        if ("wakeLock" in navigator) {

            wakeLock =
                await navigator.wakeLock.request("screen");

        }

    } catch (e) {

        console.log(e);

    }

}

keepAwake();

// ===========================================
// Before Closing Browser
// ===========================================

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

// ===========================================
// Call Summary
// ===========================================

async function saveSummary() {

    return {

        duration: seconds,

        minutes: Math.floor(seconds / 60),

        coinsSpent: Math.floor(seconds / 30) * 100,

        hostEarned: Math.floor(seconds / 30) * 100

    };

}

console.log("✅ Video Call Part 4 Ready");// ======================================================
// Vivy 💜 Video Call
// Part 5 - ZEGOCLOUD Integration
// ======================================================

import {
    ZegoUIKitPrebuilt
} from "https://unpkg.com/@zegocloud/zego-uikit-prebuilt/zego-uikit-prebuilt.esm.js";

// ======================================================
// Replace with your ZEGOCLOUD credentials later
// ======================================================

const APP_ID = YOUR_APP_ID;
const SERVER_SECRET = "YOUR_SERVER_SECRET";

// ======================================================

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
// Create Room
// ======================================================

const zp = ZegoUIKitPrebuilt.create(kitToken);

zp.joinRoom({

    container: remoteVideo,

    scenario: {

        mode: ZegoUIKitPrebuilt.OneONoneCall

    },

    turnOnCameraWhenJoining: true,

    turnOnMicrophoneWhenJoining: true,

    showScreenSharingButton: false,

    showTextChat: false,

    showUserList: false,

    showLeavingView: false,

    maxUsers: 2,

    onJoinRoom() {

        callStatus.textContent = "Connected 💜";

        console.log("Joined Video Call");

    },

    onLeaveRoom() {

        finishCall();

    }

});

// ======================================================
// Update Firebase
// ======================================================

await updateDoc(

    doc(db, "calls", callId),

    {

        status: "connected",

        connectedAt: serverTimestamp()

    }

);

// ======================================================
// Ready
// ======================================================

console.log("✅ Vivy Video Call Ready");
