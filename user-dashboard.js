// ======================================================
// Vivy 💜 User Dashboard
// Populates the dashboard UI and wires up interactions.
//
// NOTE ON DATA SHAPE (adjust to match your real schema):
//   accounts/{uid}   -> username, profilePhoto, coins,
//                        walletBalance, favorites[], stats
//   hosts/{hostUid}  -> username, profilePhoto, hostUid,
//                        countryCode, age, gender,
//                        isOnline, isVerified,
//                        popularity, createdAt
// ======================================================

import { authReady } from "./auth-guard.js";

import { getCurrentProfile } from "./auth-service.js";

import { db } from "./firebase-config.js";

import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ======================================================
// Element References
// ======================================================

const loadingScreen = document.getElementById("loadingScreen");

const userPhotoEl = document.getElementById("userPhoto");
const usernameEl = document.getElementById("username");
const userUidEl = document.getElementById("userUid");

const coinBalanceEl = document.getElementById("coinBalance");
const walletBalanceEl = document.getElementById("walletBalance");

const searchHostEl = document.getElementById("searchHost");

const hostCardTemplate = document.getElementById("hostCardTemplate");

const hostContainers = {
    newHosts: document.getElementById("newHosts"),
    onlineHosts: document.getElementById("onlineHosts"),
    popularHosts: document.getElementById("popularHosts"),
    allHosts: document.getElementById("allHosts"),
    favoriteHosts: document.getElementById("favoriteHosts")
};

let currentUser = null;
let currentFavorites = [];

// ======================================================
// Boot
// ======================================================

init();

async function init() {

    currentUser = await authReady;

    if (!currentUser) {

        // authReady already redirected to login.html
        return;

    }

    await loadProfile();

    await Promise.all([
        renderHostSection("newHosts", newHostsQuery()),
        renderHostSection("onlineHosts", onlineHostsQuery()),
        renderHostSection("popularHosts", popularHostsQuery()),
        renderHostSection("allHosts", allHostsQuery()),
        renderFavorites()
    ]);

    bindStaticControls();

    hideLoadingScreen();

}

// ======================================================
// Profile
// ======================================================

async function loadProfile() {

    try {

        const profile = await getCurrentProfile(currentUser.uid);

        if (!profile) {

            return;

        }

        if (userPhotoEl) {

            userPhotoEl.src =
                profile.profilePhoto || "assets/default-avatar.png";

        }

        if (usernameEl) {

            usernameEl.textContent =
                profile.username || "Vivy User";

        }

        if (userUidEl) {

            userUidEl.textContent = currentUser.uid;

        }

        if (coinBalanceEl) {

            coinBalanceEl.textContent =
                formatNumber(profile.coins ?? 0);

        }

        if (walletBalanceEl) {

            walletBalanceEl.textContent =
                Number(profile.walletBalance ?? 0).toFixed(2);

        }

        currentFavorites = profile.favorites || [];

        updateStat("favoriteHostsCount", currentFavorites.length);
        updateStat("friends", profile.friendsCount ?? 0);
        updateStat("callsMade", profile.callsMade ?? 0);
        updateStat("messagesSent", profile.messagesSent ?? 0);
        updateStat("coinsSpent", profile.coinsSpent ?? 0);

        const referralCodeEl = document.getElementById("referralCode");

        if (referralCodeEl) {

            referralCodeEl.textContent =
                profile.referralCode || currentUser.uid.slice(0, 8).toUpperCase();

        }

    }

    catch (error) {

        console.error("Failed to load profile:", error);

    }

}

function updateStat(statName, value) {

    const el = document.querySelector(`[data-stat="${statName}"] .stat-value`);

    if (el) {

        el.textContent = formatNumber(value);

    }

}

function formatNumber(value) {

    return Number(value).toLocaleString();

}

// ======================================================
// Host Queries
// (adjust field names to match your real "hosts" schema)
// ======================================================

function newHostsQuery() {

    return query(
        collection(db, "hosts"),
        orderBy("createdAt", "desc"),
        limit(10)
    );

}

function onlineHostsQuery() {

    return query(
        collection(db, "hosts"),
        where("isOnline", "==", true),
        limit(10)
    );

}

function popularHostsQuery() {

    return query(
        collection(db, "hosts"),
        orderBy("popularity", "desc"),
        limit(10)
    );

}

function allHostsQuery() {

    return query(
        collection(db, "hosts"),
        limit(30)
    );

}

// ======================================================
// Render Hosts
// ======================================================

async function renderHostSection(containerId, hostQuery) {

    const container = hostContainers[containerId];

    if (!container) {

        return;

    }

    try {

        const snapshot = await getDocs(hostQuery);

        if (snapshot.empty) {

            // Leave the existing empty state (if any) in place.
            return;

        }

        container.innerHTML = "";

        snapshot.forEach((docSnap) => {

            const host = { id: docSnap.id, ...docSnap.data() };

            container.appendChild(buildHostCard(host));

        });

    }

    catch (error) {

        console.error(`Failed to load ${containerId}:`, error);

    }

}

async function renderFavorites() {

    const container = hostContainers.favoriteHosts;

    if (!container || currentFavorites.length === 0) {

        return;

    }

    try {

        const hostDocs = await Promise.all(
            currentFavorites.map((hostUid) =>
                getDoc(doc(db, "hosts", hostUid))
            )
        );

        const validHosts = hostDocs
            .filter((snap) => snap.exists())
            .map((snap) => ({ id: snap.id, ...snap.data() }));

        if (validHosts.length === 0) {

            return;

        }

        container.innerHTML = "";

        validHosts.forEach((host) => {

            container.appendChild(buildHostCard(host));

        });

    }

    catch (error) {

        console.error("Failed to load favorites:", error);

    }

}

function buildHostCard(host) {

    const card = hostCardTemplate.content.cloneNode(true);

    const article = card.querySelector(".host-card");

    const hostUid = host.hostUid || host.id;

    article.dataset.hostUid = hostUid;

    const photoEl = card.querySelector(".host-photo");

    if (photoEl) {

        photoEl.src = host.profilePhoto || "assets/default-avatar.png";
        photoEl.alt = host.username || "Host photo";

    }

    const onlineIndicator = card.querySelector(".host-online-indicator");

    if (onlineIndicator) {

        onlineIndicator.classList.toggle("is-online", Boolean(host.isOnline));

    }

    const usernameEl = card.querySelector(".host-username");

    if (usernameEl) {

        usernameEl.textContent = host.username || "Vivy Host";

    }

    const verifiedBadge = card.querySelector(".host-verified-badge");

    if (verifiedBadge) {

        verifiedBadge.hidden = !host.isVerified;

    }

    const uidValueEl = card.querySelector(".host-uid-value");

    if (uidValueEl) {

        uidValueEl.textContent = hostUid;

    }

    const flagEl = card.querySelector(".host-country-flag");

    if (flagEl && host.countryCode) {

        flagEl.src =
            `https://flagcdn.com/24x18/${host.countryCode.toLowerCase()}.png`;

        flagEl.alt = host.country || host.countryCode;

    }

    const ageEl = card.querySelector(".host-age");

    if (ageEl) {

        ageEl.textContent = host.age ? `${host.age}` : "";

    }

    const genderEl = card.querySelector(".host-gender-icon");

    if (genderEl) {

        genderEl.classList.add(
            host.gender === "female" ? "icon-gender-female" : "icon-gender-male"
        );

    }

    const favoriteBtn = card.querySelector(".host-favorite-btn");

    if (favoriteBtn) {

        favoriteBtn.classList.toggle(
            "is-favorited",
            currentFavorites.includes(hostUid)
        );

    }

    return card;

}

// ======================================================
// Static Controls
// ======================================================

function bindStaticControls() {

    document.getElementById("notificationBtn")
        ?.addEventListener("click", () => {

            window.location.href = "notifications.html";

        });

    document.getElementById("settingsBtn")
        ?.addEventListener("click", () => {

            window.location.href = "settings.html";

        });

    document.getElementById("buyCoinsBtn")
        ?.addEventListener("click", () => {

            window.location.href = "buy-coins.html";

        });

    document.getElementById("rechargeBtn")
        ?.addEventListener("click", () => {

            window.location.href = "recharge.html";

        });

    document.getElementById("randomMatchBtn")
        ?.addEventListener("click", startRandomMatch);

    document.getElementById("floatingRandomMatchBtn")
        ?.addEventListener("click", startRandomMatch);

    document.getElementById("audioCallBtn")
        ?.addEventListener("click", () => {

            window.location.href = "random-match.html?mode=audio";

        });

    document.getElementById("videoCallBtn")
        ?.addEventListener("click", () => {

            window.location.href = "random-match.html?mode=video";

        });

    document.getElementById("messagesBtn")
        ?.addEventListener("click", () => {

            window.location.href = "messages.html";

        });

    document.getElementById("favoritesBtn")
        ?.addEventListener("click", () => {

            const el = hostContainers.favoriteHosts;

            el?.scrollIntoView({ behavior: "smooth" });

        });

    document.getElementById("claimRewardBtn")
        ?.addEventListener("click", () => {

            window.location.href = "daily-reward.html";

        });

    document.getElementById("inviteShareBtn")
        ?.addEventListener("click", shareReferralCode);

    searchHostEl?.addEventListener("input", handleSearch);

    document.querySelectorAll(".filter-chip")
        .forEach((chip) => {

            chip.addEventListener("click", () => handleFilterChip(chip));

        });

    // Delegated handling for dynamically rendered host cards
    Object.values(hostContainers)
        .forEach((container) => {

            container?.addEventListener("click", handleHostCardClick);

        });

}

function startRandomMatch() {

    window.location.href = "random-match.html";

}

async function shareReferralCode() {

    const code = document.getElementById("referralCode")?.textContent;

    if (!code) {

        return;

    }

    if (navigator.share) {

        try {

            await navigator.share({
                title: "Join me on Vivy 💜",
                text: `Use my code ${code} to join Vivy!`
            });

        }

        catch (error) {

            console.error("Share cancelled or failed:", error);

        }

    }

    else if (navigator.clipboard) {

        await navigator.clipboard.writeText(code);

        alert("Referral code copied to clipboard.");

    }

}

function handleSearch() {

    const term = searchHostEl.value.trim().toLowerCase();

    document.querySelectorAll(".host-card").forEach((card) => {

        const username =
            card.querySelector(".host-username")?.textContent.toLowerCase() || "";

        const uid =
            card.querySelector(".host-uid-value")?.textContent.toLowerCase() || "";

        const country =
            card.querySelector(".host-country-flag")?.alt.toLowerCase() || "";

        const matches =
            !term ||
            username.includes(term) ||
            uid.includes(term) ||
            country.includes(term);

        card.style.display = matches ? "" : "none";

    });

}

function handleFilterChip(selectedChip) {

    document.querySelectorAll(".filter-chip")
        .forEach((chip) => {

            chip.classList.toggle("filter-chip-active", chip === selectedChip);

        });

    const filter = selectedChip.dataset.filter;

    let filteredQuery;

    switch (filter) {

        case "female":

            filteredQuery = query(
                collection(db, "hosts"),
                where("gender", "==", "female"),
                limit(30)
            );

            break;

        case "male":

            filteredQuery = query(
                collection(db, "hosts"),
                where("gender", "==", "male"),
                limit(30)
            );

            break;

        case "online":

            filteredQuery = onlineHostsQuery();

            break;

        case "verified":

            filteredQuery = query(
                collection(db, "hosts"),
                where("isVerified", "==", true),
                limit(30)
            );

            break;

        case "newest":

            filteredQuery = newHostsQuery();

            break;

        case "popular":

            filteredQuery = popularHostsQuery();

            break;

        default:

            filteredQuery = allHostsQuery();

    }

    renderHostSection("allHosts", filteredQuery);

}

function handleHostCardClick(event) {

    const card = event.target.closest(".host-card");

    if (!card) {

        return;

    }

    const hostUid = card.dataset.hostUid;

    if (event.target.closest(".host-message-btn")) {

        window.location.href = `chat.html?hostUid=${hostUid}`;

    }

    else if (event.target.closest(".host-audio-btn")) {

        window.location.href = `random-match.html?mode=audio&hostUid=${hostUid}`;

    }

    else if (event.target.closest(".host-video-btn")) {

        window.location.href = `random-match.html?mode=video&hostUid=${hostUid}`;

    }

    else if (event.target.closest(".host-favorite-btn")) {

        toggleFavorite(hostUid, event.target.closest(".host-favorite-btn"));

    }

}

async function toggleFavorite(hostUid, buttonEl) {

    if (!currentUser) {

        return;

    }

    const isFavorited = currentFavorites.includes(hostUid);

    try {

        await updateDoc(
            doc(db, "accounts", currentUser.uid),
            {
                favorites: isFavorited
                    ? arrayRemove(hostUid)
                    : arrayUnion(hostUid)
            }
        );

        if (isFavorited) {

            currentFavorites = currentFavorites.filter((uid) => uid !== hostUid);

        }

        else {

            currentFavorites.push(hostUid);

        }

        buttonEl.classList.toggle("is-favorited", !isFavorited);

        updateStat("favoriteHostsCount", currentFavorites.length);

    }

    catch (error) {

        console.error("Failed to update favorite:", error);

    }

}

// ======================================================
// Loading Screen
// ======================================================

function hideLoadingScreen() {

    if (loadingScreen) {

        loadingScreen.classList.add("loading-screen-hidden");

    }

}
