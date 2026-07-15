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

import { db, storage } from "./firebase-config.js";

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

import {
    ref,
    uploadBytesResumable,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

// ======================================================
// Element References
// ======================================================

const userPhotoEl = document.getElementById("userPhoto");
const usernameEl = document.getElementById("username");
const userUidEl = document.getElementById("userUid");

const profilePhotoWrapEl = document.getElementById("profilePhotoWrap");
const profilePhotoInputEl = document.getElementById("profilePhotoInput");
const photoUploadProgressEl = document.getElementById("photoUploadProgress");
const photoProgressRingEl = document.getElementById("photoProgressRing");

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

    // Wire up every interactive control immediately — the person
    // shouldn't have to wait for data to be able to tap around.
    bindStaticControls();
    setupProfilePhotoUpload();
    setupPresenceTracking();

    // Everything data-driven loads in the background, in parallel.
    // The shell (header, wallet card, skeleton host rails) is already
    // painted the instant the HTML/CSS loaded, so this never blocks
    // the UI — it just fills skeletons in with real content.
    Promise.all([
        loadProfile().then(() => renderFavorites()),
        renderHostSection("newHosts", newHostsQuery()),
        renderHostSection("onlineHosts", onlineHostsQuery()),
        renderHostSection("popularHosts", popularHostsQuery()),
        renderHostSection("allHosts", allHostsQuery())
    ]).catch((error) => {

        console.error("Dashboard background load error:", error);

    });

}

// ======================================================
// Presence
// Marks this User account "online" (and stamps lastActive)
// while the dashboard tab is open/visible, so Hosts can see
// them in Online Users. This is the only place in the app
// that writes these two fields for a User account — without
// it, Online Users would always be empty.
// Best-effort only — there's no realtime presence backend
// (e.g. Realtime Database onDisconnect) wired up, so this
// relies on visibility/unload events rather than a true
// server-side disconnect signal.
// ======================================================

function setupPresenceTracking() {

    const setOnline = (isOnline) => {

        updateDoc(doc(db, "accounts", currentUser.uid), {
            isOnline,
            lastActive: new Date()
        }).catch(() => { /* best effort */ });

    };

    setOnline(true);

    document.addEventListener("visibilitychange", () => {

        setOnline(document.visibilityState === "visible");

    });

    window.addEventListener("pagehide", () => setOnline(false));

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

            userPhotoEl.classList.remove("skeleton");

        }

        if (usernameEl) {

            usernameEl.textContent =
                profile.username || "Vivy User";

            usernameEl.classList.remove("skeleton");

        }

        if (userUidEl) {

            userUidEl.textContent = currentUser.uid;

            userUidEl.classList.remove("skeleton");

        }

        if (coinBalanceEl) {

            coinBalanceEl.textContent =
                formatNumber(profile.coins ?? 0);

            coinBalanceEl.classList.remove("skeleton");

        }

        const headerCoinDisplayEl = document.getElementById("headerCoinDisplay");

        if (headerCoinDisplayEl) {

            headerCoinDisplayEl.textContent = formatNumber(profile.coins ?? 0);

        }

        if (walletBalanceEl) {

            walletBalanceEl.textContent =
                Number(profile.walletBalance ?? 0).toFixed(2);

            walletBalanceEl.classList.remove("skeleton");

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

// ======================================================
// Profile Photo Upload
// ======================================================

function setupProfilePhotoUpload() {

    if (!profilePhotoWrapEl || !profilePhotoInputEl) {

        return;

    }

    profilePhotoWrapEl.addEventListener("click", () => {

        profilePhotoInputEl.click();

    });

    profilePhotoInputEl.addEventListener("change", async (event) => {

        const file = event.target.files?.[0];

        // Always reset the input so choosing the same file twice
        // in a row still fires a "change" event next time.
        event.target.value = "";

        if (!file) {

            return;

        }

        if (!file.type.startsWith("image/")) {

            alert("Please choose an image file.");
            return;

        }

        await uploadProfilePhoto(file);

    });

}

async function uploadProfilePhoto(file) {

    if (!currentUser) {

        return;

    }

    // Keep a reference to whatever photo is already showing, so we can
    // restore it if the upload fails partway through.
    const previousSrc = userPhotoEl?.src || "";

    try {

        const compressedBlob = await compressImage(file, 800, 800, 0.82);

        showPhotoUploadProgress(0);

        const filePath =
            `profile-photos/${currentUser.uid}/${Date.now()}.jpg`;

        const storageRef = ref(storage, filePath);

        const uploadTask = uploadBytesResumable(storageRef, compressedBlob, {
            contentType: "image/jpeg"
        });

        // Optimistic local preview while the upload is in flight,
        // so the person sees their photo change immediately.
        const localPreviewUrl = URL.createObjectURL(compressedBlob);

        if (userPhotoEl) {

            userPhotoEl.src = localPreviewUrl;
            userPhotoEl.classList.remove("skeleton");

        }

        await new Promise((resolve, reject) => {

            uploadTask.on(
                "state_changed",
                (snapshot) => {

                    const progress =
                        snapshot.bytesTransferred / snapshot.totalBytes;

                    showPhotoUploadProgress(progress);

                },
                (error) => reject(error),
                () => resolve()
            );

        });

        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

        await updateDoc(
            doc(db, "accounts", currentUser.uid),
            { profilePhoto: downloadUrl }
        );

        // Swap the optimistic blob preview for the real hosted URL.
        if (userPhotoEl) {

            userPhotoEl.src = downloadUrl;

        }

        URL.revokeObjectURL(localPreviewUrl);

    }

    catch (error) {

        console.error("Profile photo upload failed:", error);

        // Upload failed — keep the previous photo in place.
        if (userPhotoEl && previousSrc) {

            userPhotoEl.src = previousSrc;

        }

        alert("Couldn't upload your photo. Please try again.");

    }

    finally {

        hidePhotoUploadProgress();

    }

}

function showPhotoUploadProgress(fraction) {

    if (!photoUploadProgressEl) {

        return;

    }

    photoUploadProgressEl.hidden = false;

    if (photoProgressRingEl) {

        const circumference = 106.8;

        const offset = circumference - (circumference * fraction);

        photoProgressRingEl.style.strokeDashoffset = String(offset);

    }

}

function hidePhotoUploadProgress() {

    if (photoUploadProgressEl) {

        photoUploadProgressEl.hidden = true;

    }

}

// Downscale + re-encode an image client-side before upload, so large
// camera photos don't chew through storage/bandwidth.
function compressImage(file, maxWidth, maxHeight, quality) {

    return new Promise((resolve, reject) => {

        const img = new Image();

        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {

            let { width, height } = img;

            if (width > maxWidth || height > maxHeight) {

                const scale = Math.min(maxWidth / width, maxHeight / height);

                width = Math.round(width * scale);
                height = Math.round(height * scale);

            }

            const canvas = document.createElement("canvas");

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {

                    URL.revokeObjectURL(objectUrl);

                    if (blob) {

                        resolve(blob);

                    }

                    else {

                        reject(new Error("Image compression failed"));

                    }

                },
                "image/jpeg",
                quality
            );

        };

        img.onerror = (error) => {

            URL.revokeObjectURL(objectUrl);
            reject(error);

        };

        img.src = objectUrl;

    });

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

            // If this container only ever held skeleton placeholders,
            // clear them and show a lightweight empty message instead
            // of leaving stale shimmer bars on screen forever.
            if (container.querySelector(".skeleton-card")) {

                container.innerHTML =
                    '<div class="empty-state" style="width:100%">' +
                    '<p>No hosts to show right now</p></div>';

            }

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

        if (container.querySelector(".skeleton-card")) {

            container.innerHTML =
                '<div class="empty-state" style="width:100%">' +
                '<p>Couldn\u2019t load hosts. Pull down to retry.</p></div>';

        }

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

    // Online indicator dot (template class is .host-online-dot)
    const onlineIndicator = card.querySelector(".host-online-dot");

    if (onlineIndicator) {

        onlineIndicator.style.display = host.isOnline ? "" : "none";

    }

    const usernameEl = card.querySelector(".host-username");

    if (usernameEl) {

        usernameEl.textContent = host.username || "Vivy Host";

    }

    // Verified badge (template class is .verified-badge)
    const verifiedBadge = card.querySelector(".verified-badge");

    if (verifiedBadge) {

        verifiedBadge.hidden = !host.isVerified;

    }

    const uidValueEl = card.querySelector(".host-uid-value");

    if (uidValueEl) {

        uidValueEl.textContent = hostUid;

    }

    // Country flag (template class is .host-flag)
    const flagEl = card.querySelector(".host-flag");

    if (flagEl && host.countryCode) {

        flagEl.src =
            `https://flagcdn.com/24x18/${host.countryCode.toLowerCase()}.png`;

        flagEl.alt = host.country || host.countryCode;

    }

    else if (flagEl) {

        flagEl.style.display = "none";

    }

    const ageEl = card.querySelector(".host-age");

    if (ageEl) {

        ageEl.textContent = host.age ? `${host.age}` : "";

    }

    // Gender icon (template class is .gender-icon)
    const genderEl = card.querySelector(".gender-icon");

    if (genderEl) {

        genderEl.classList.add(
            host.gender === "female" ? "icon-gender-female" : "icon-gender-male"
        );

    }

    // Favorite button (template class is .host-fav-btn)
    const favoriteBtn = card.querySelector(".host-fav-btn");

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

            window.location.href = "favorites.html";

        });

    document.getElementById("claimRewardBtn")
        ?.addEventListener("click", () => {

            window.location.href = "daily-reward.html";

        });

    document.getElementById("copyReferralBtn")
        ?.addEventListener("click", shareReferralCode);

    // Profile photo → tap opens the image picker (see setupProfilePhotoUpload)
    // Username / UID block → profile.html
    document.getElementById("headerIdBlock")
        ?.addEventListener("click", () => {

            window.location.href = "profile.html";

        });

    // Wallet card → wallet.html, unless the tap landed on the coin
    // sub-item (→ buy-coins.html) or the wallet sub-item (→ wallet.html)
    document.getElementById("walletCard")
        ?.addEventListener("click", (event) => {

            if (event.target.closest("#coinCardItem")) {

                window.location.href = "buy-coins.html";
                return;

            }

            if (event.target.closest("#walletCardItem")) {

                window.location.href = "wallet.html";
                return;

            }

            if (event.target.closest("#rechargeBtn") ||
                event.target.closest("#buyCoinsBtn")) {

                // Let their own listeners (bound above) handle it.
                return;

            }

            window.location.href = "wallet.html";

        });

    // Invite card → invite.html, unless the tap is the copy-code button
    document.getElementById("inviteCard")
        ?.addEventListener("click", (event) => {

            if (event.target.closest("#copyReferralBtn") ||
                event.target.closest("#inviteShareBtn")) {

                return;

            }

            window.location.href = "invite.html";

        });

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
            card.querySelector(".host-flag")?.alt.toLowerCase() || "";

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

    if (event.target.closest(".message-btn")) {

        window.location.href = `chat.html?hostUid=${hostUid}`;

    }

    else if (event.target.closest(".audio-btn")) {

        window.location.href =
            `call.html?mode=audio&hostUid=${hostUid}&callerUid=${currentUser.uid}&callType=audio`;

    }

    else if (event.target.closest(".video-btn")) {

        window.location.href =
            `call.html?mode=video&hostUid=${hostUid}&callerUid=${currentUser.uid}&callType=video`;

    }

    else if (event.target.closest(".host-fav-btn")) {

        toggleFavorite(hostUid, event.target.closest(".host-fav-btn"));

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

// (no full-screen loading overlay anymore — the shell paints instantly
// and skeletons handle the in-between state)
