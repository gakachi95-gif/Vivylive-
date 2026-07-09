// ==========================================
// Vivy 💜 User Dashboard
// Part 1 - Imports & Initialization
// ==========================================

import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";


// ==========================================
// Dashboard Elements
// ==========================================

const username = document.getElementById("username");
const userUid = document.getElementById("userUid");
const userPhoto = document.getElementById("userPhoto");
const coinBalance = document.getElementById("coinBalance");

const newHosts = document.getElementById("newHosts");
const onlineHosts = document.getElementById("onlineHosts");
const allHosts = document.getElementById("allHosts");

const loadingScreen = document.getElementById("loadingScreen");


// ==========================================
// Show / Hide Loading
// ==========================================

function showLoading() {
    if (loadingScreen)
        loadingScreen.style.display = "flex";
}

function hideLoading() {
    if (loadingScreen)
        loadingScreen.style.display = "none";
}


// ==========================================
// Authentication Check
// ==========================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "login.html";
        return;

    }

    showLoading();

    await loadUser(user.uid);

    await loadNewHosts();

    await loadOnlineHosts();

    await loadAllHosts();

    hideLoading();

});// ==========================================
// Part 2 - Load Logged-in User
// ==========================================

async function loadUser(firebaseUid) {

    try {

        const userRef = doc(db, "accounts", firebaseUid);

        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {

            alert("User profile not found.");

            window.location.href = "login.html";

            return;

        }

        const user = userSnap.data();

        // Username
        if (username) {
            username.textContent = user.username || "Unknown User";
        }

        // User UID
        if (userUid) {
            userUid.textContent = user.uid || "USR-000000";
        }

        // Coin Balance
        if (coinBalance) {
            coinBalance.textContent = `${user.coins || 0} 🪙`;
        }

        // Profile Photo
        if (userPhoto) {

            if (user.profilePhoto && user.profilePhoto !== "") {

                userPhoto.src = user.profilePhoto;

            } else {

                userPhoto.src = "images/default-avatar.png";

            }

        }

        // Welcome Message
        console.log("Welcome", user.username);

    }

    catch (error) {

        console.error("Error loading user:", error);

        alert("Unable to load your profile.");

    }

}// ==========================================
// Part 3 - Load Hosts
// ==========================================

// Create Host Card
function createHostCard(host) {

    const card = document.createElement("div");

    card.className = "host-card";

    card.innerHTML = `

        <div class="host-left">

            <img
                src="${host.profilePhoto || 'images/default-avatar.png'}"
                class="host-photo">

        </div>

        <div class="host-center">

            <h3>${host.username}</h3>

            <p>${host.uid}</p>

            <small>${host.country}</small>

            <br>

            <span class="${
                host.isOnline ? "online" : "offline"
            }">

                ${
                    host.isOnline
                    ? "🟢 Online"
                    : "🔴 Offline"
                }

            </span>

        </div>

        <div class="host-right">

            <button
                class="messageBtn"
                data-id="${host.firebaseUid}">

                💬

            </button>

            <button
                class="audioBtn"
                data-id="${host.firebaseUid}">

                📞

            </button>

            <button
                class="videoBtn"
                data-id="${host.firebaseUid}">

                🎥

            </button>

            <button
                class="favoriteBtn"
                data-id="${host.firebaseUid}">

                ❤️

            </button>

        </div>

    `;

    return card;

}


// ==========================================
// New Hosts
// ==========================================

async function loadNewHosts() {

    if (!newHosts) return;

    newHosts.innerHTML = "";

    const q = query(
        collection(db, "accounts"),
        where("role", "==", "host"),
        where("status", "==", "approved"),
        orderBy("createdAt", "desc"),
        limit(10)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {

        const host = docSnap.data();

        newHosts.appendChild(
            createHostCard(host)
        );

    });

}


// ==========================================
// Online Hosts
// ==========================================

async function loadOnlineHosts() {

    if (!onlineHosts) return;

    onlineHosts.innerHTML = "";

    const q = query(
        collection(db, "accounts"),
        where("role", "==", "host"),
        where("status", "==", "approved"),
        where("isOnline", "==", true)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {

        const host = docSnap.data();

        onlineHosts.appendChild(
            createHostCard(host)
        );

    });

}


// ==========================================
// Browse All Hosts
// ==========================================

async function loadAllHosts() {

    if (!allHosts) return;

    allHosts.innerHTML = "";

    const q = query(
        collection(db, "accounts"),
        where("role", "==", "host"),
        where("status", "==", "approved")
    );

    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {

        const host = docSnap.data();

        allHosts.appendChild(
            createHostCard(host)
        );

    });

}// ==========================================
// Part 4 - Dashboard Actions
// ==========================================

// Random Match Button
const randomMatchBtn = document.getElementById("randomMatchBtn");

if (randomMatchBtn) {

    randomMatchBtn.addEventListener("click", async () => {

        try {

            const q = query(
                collection(db, "accounts"),
                where("role", "==", "host"),
                where("status", "==", "approved"),
                where("isOnline", "==", true)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {

                alert("💜 No hosts are online right now.");

                return;

            }

            const hosts = [];

            snapshot.forEach((docSnap) => {

                hosts.push(docSnap.data());

            });

            const randomHost =
                hosts[Math.floor(Math.random() * hosts.length)];

            // Save selected host
            sessionStorage.setItem(
                "selectedHost",
                JSON.stringify(randomHost)
            );

            // Open call page
            window.location.href = "audio-call.html";

        }

        catch (error) {

            console.error(error);

            alert("Unable to start Random Match.");

        }

    });

}


// ==========================================
// Search Hosts
// ==========================================

const searchHost =
document.getElementById("searchHost");

if (searchHost) {

    searchHost.addEventListener("keyup", () => {

        const keyword =
        searchHost.value.toLowerCase();

        const cards =
        document.querySelectorAll(".host-card");

        cards.forEach(card => {

            const text =
            card.innerText.toLowerCase();

            card.style.display =
            text.includes(keyword)
            ? "flex"
            : "none";

        });

    });

}


// ==========================================
// Host Card Buttons
// ==========================================

document.addEventListener("click", (event) => {

    // Message

    if (event.target.classList.contains("messageBtn")) {

        const hostId =
        event.target.dataset.id;

        window.location.href =
        `messages.html?host=${hostId}`;

    }

    // Audio Call

    if (event.target.classList.contains("audioBtn")) {

        const hostId =
        event.target.dataset.id;

        window.location.href =
        `audio-call.html?host=${hostId}`;

    }

    // Video Call

    if (event.target.classList.contains("videoBtn")) {

        const hostId =
        event.target.dataset.id;

        window.location.href =
        `video-call.html?host=${hostId}`;

    }

    // Favorite

    if (event.target.classList.contains("favoriteBtn")) {

        alert("❤️ Host added to Favorites.");

        // Future:
        // Save favorite to Firestore

    }

});
