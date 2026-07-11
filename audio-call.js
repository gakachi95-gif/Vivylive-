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
// End Call
// ======================================================

function endCall(){

    clearInterval(timer);

    location.href="user-dashboard.html";

                                        }
