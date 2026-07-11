// ======================================================
// Vivy 💜 Messages
// Part 2 - messages.js
// ======================================================

import { authReady } from "./auth-guard.js";
import { getCurrentProfile } from "./auth-service.js";
import { db } from "./firebase-config.js";

import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ======================================================
// Elements
// ======================================================

const conversationList =
document.getElementById("conversationList");

const conversationTemplate =
document.getElementById("conversationTemplate");

const emptyState =
document.getElementById("emptyState");

const searchInput =
document.getElementById("searchInput");

const backBtn =
document.getElementById("backBtn");

const searchBtn =
document.getElementById("searchBtn");

const findHostBtn =
document.getElementById("findHostBtn");

// ======================================================

let currentUser;

// ======================================================

init();

async function init(){

    currentUser = await authReady;

    if(!currentUser) return;

    listenForChats();

    bindEvents();

}

// ======================================================
// Events
// ======================================================

function bindEvents(){

    backBtn.onclick=()=>{

        location.href="user-dashboard.html";

    };

    findHostBtn.onclick=()=>{

        location.href="random-match.html";

    };

    searchInput.oninput=filterChats;

}

// ======================================================
// Load Chats
// ======================================================

function listenForChats(){

    const q=query(

        collection(db,"conversations"),

        where("members","array-contains",currentUser.uid),

        orderBy("updatedAt","desc")

    );

    onSnapshot(q,(snapshot)=>{

        conversationList.innerHTML="";

        if(snapshot.empty){

            emptyState.style.display="block";

            return;

        }

        emptyState.style.display="none";

        snapshot.forEach((doc)=>{

            renderConversation(doc.data());

        });

    });

}

// ======================================================
// Render Card
// ======================================================

function renderConversation(chat){

    const card=
    conversationTemplate.content.cloneNode(true);

    card.querySelector(".avatar").src=
        chat.photo ||
        "assets/default-avatar.png";

    card.querySelector(".username").textContent=
        chat.username;

    card.querySelector(".lastMessage").textContent=
        chat.lastMessage || "";

    card.querySelector(".time").textContent=
        formatTime(chat.updatedAt);

    if(chat.unread>0){

        card.querySelector(".badge").textContent=
            chat.unread;

    }

    card.querySelector(".conversation-card")
        .onclick=()=>{

        location.href=
        `chat.html?id=${chat.id}`;

    };

    conversationList.appendChild(card);

}

// ======================================================
// Search
// ======================================================

function filterChats(){

    const value=
    searchInput.value.toLowerCase();

    document.querySelectorAll(".conversation-card")
    .forEach((card)=>{

        const name=
        card.querySelector(".username")
        .textContent
        .toLowerCase();

        card.style.display=
        name.includes(value)
        ? ""
        : "none";

    });

}

// ======================================================

function formatTime(timestamp){

    if(!timestamp) return "";

    const date=
    timestamp.toDate();

    return date.toLocaleTimeString([],{

        hour:"2-digit",

        minute:"2-digit"

    });

}// ======================================================
// Vivy 💜 Messages
// Part 3 - Chat Screen Navigation & Real-time Updates
// ======================================================

import {
    doc,
    updateDoc,
    serverTimestamp,
    increment
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ======================================================
// Open Conversation
// ======================================================

function openConversation(chatId) {

    location.href = `chat.html?chatId=${chatId}`;

}

// ======================================================
// Mark Messages Read
// ======================================================

async function markConversationRead(chatId) {

    try {

        await updateDoc(
            doc(db, "conversations", chatId),
            {
                unread: 0,
                lastRead: serverTimestamp()
            }
        );

    } catch (error) {

        console.error(error);

    }

}

// ======================================================
// Update Last Seen
// ======================================================

async function updateLastSeen() {

    try {

        await updateDoc(
            doc(db, "accounts", currentUser.uid),
            {
                lastSeen: serverTimestamp()
            }
        );

    } catch (error) {

        console.error(error);

    }

}

setInterval(updateLastSeen, 60000);

// ======================================================
// New Message Notification
// ======================================================

function playNotification() {

    const audio = new Audio("assets/message.mp3");

    audio.play().catch(() => {});

}

// ======================================================
// Conversation Click
// ======================================================

document.addEventListener("click", async (event) => {

    const card = event.target.closest(".conversation-card");

    if (!card) return;

    const chatId = card.dataset.chatid;

    await markConversationRead(chatId);

    openConversation(chatId);

});

// ======================================================
// Refresh Badge Count
// ======================================================

function updateUnreadBadge(totalUnread) {

    const badge = document.getElementById("messageBadge");

    if (!badge) return;

    badge.textContent = totalUnread;

    badge.style.display = totalUnread > 0 ? "flex" : "none";

}

// ======================================================
// Ready
// ======================================================

console.log("✅ Messages Part 3 Ready");// ======================================================
// Vivy 💜 Messages
// Part 4 - Delete, Pin, Mute & Online Status
// ======================================================

import {
    deleteDoc,
    updateDoc,
    doc,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ======================================================
// Delete Conversation
// ======================================================

async function deleteConversation(chatId){

    const confirmed = confirm(
        "Delete this conversation?"
    );

    if(!confirmed) return;

    try{

        await deleteDoc(
            doc(db,"conversations",chatId)
        );

    }catch(error){

        console.error(error);

    }

}

// ======================================================
// Pin Conversation
// ======================================================

async function pinConversation(chatId,pinned){

    try{

        await updateDoc(
            doc(db,"conversations",chatId),
            {

                pinned:!pinned,

                updatedAt:serverTimestamp()

            }
        );

    }catch(error){

        console.error(error);

    }

}

// ======================================================
// Mute Conversation
// ======================================================

async function muteConversation(chatId,muted){

    try{

        await updateDoc(
            doc(db,"conversations",chatId),
            {

                muted:!muted

            }
        );

    }catch(error){

        console.error(error);

    }

}

// ======================================================
// Listen Host Online Status
// ======================================================

function watchHostStatus(hostUid,statusElement){

    onSnapshot(

        doc(db,"hosts",hostUid),

        (snap)=>{

            if(!snap.exists()) return;

            const host=snap.data();

            statusElement.textContent=
                host.isOnline
                ? "🟢 Online"
                : "⚪ Offline";

        }

    );

}

// ======================================================
// Long Press Menu
// ======================================================

document.addEventListener("contextmenu",(e)=>{

    const card=e.target.closest(".conversation-card");

    if(!card) return;

    e.preventDefault();

    const chatId=card.dataset.chatid;

    const pinned=
        card.dataset.pinned==="true";

    const muted=
        card.dataset.muted==="true";

    const option=prompt(

`Choose Action

1 = Pin / Unpin

2 = Mute / Unmute

3 = Delete`

    );

    switch(option){

        case "1":

            pinConversation(chatId,pinned);

            break;

        case "2":

            muteConversation(chatId,muted);

            break;

        case "3":

            deleteConversation(chatId);

            break;

    }

});

// ======================================================

console.log("✅ Messages Part 4 Ready");// ======================================================
// Vivy 💜 Messages
// Part 5 - Firebase Presence, Typing & Notifications
// ======================================================

import {
    addDoc,
    collection,
    doc,
    updateDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ======================================================
// User Presence
// ======================================================

async function setOnline() {

    try {

        await updateDoc(
            doc(db, "accounts", currentUser.uid),
            {
                isOnline: true,
                lastSeen: serverTimestamp()
            }
        );

    } catch (e) {}

}

async function setOffline() {

    try {

        await updateDoc(
            doc(db, "accounts", currentUser.uid),
            {
                isOnline: false,
                lastSeen: serverTimestamp()
            }
        );

    } catch (e) {}

}

window.addEventListener("beforeunload", setOffline);

setOnline();

// ======================================================
// Typing Indicator
// ======================================================

async function updateTyping(chatId, typing) {

    try {

        await updateDoc(
            doc(db, "conversations", chatId),
            {
                typing
            }
        );

    } catch (e) {}

}

// ======================================================
// Push Notification
// ======================================================

async function createNotification(hostUid, message) {

    try {

        await addDoc(
            collection(db, "notifications"),
            {

                receiver: hostUid,

                sender: currentUser.uid,

                title: "New Message",

                body: message,

                read: false,

                createdAt: serverTimestamp()

            }
        );

    } catch (e) {}

}

// ======================================================
// Listen Notification Count
// ======================================================

function listenNotifications() {

    onSnapshot(

        collection(db, "notifications"),

        (snapshot) => {

            let total = 0;

            snapshot.forEach((doc) => {

                const data = doc.data();

                if (
                    data.receiver === currentUser.uid &&
                    !data.read
                ) {

                    total++;

                }

            });

            const badge =
                document.getElementById("notificationBadge");

            if (!badge) return;

            badge.textContent = total;

            badge.style.display =
                total > 0 ? "flex" : "none";

        }

    );

}

listenNotifications();

// ======================================================
// Ready
// ======================================================

console.log("✅ messages.js Complete");
