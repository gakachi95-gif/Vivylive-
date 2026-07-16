// ======================================================
// Vivy 💜 Admin — User Management
// Reads/writes the SAME "accounts" collection every other
// page in the app uses — nothing new, nothing duplicated.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, where, orderBy, limit,
    onSnapshot, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, formatNumber, showToast } from "./ui-helpers.js";

let allUsers = [];
let activeFilter = "all";
let pendingAction = null;

document.getElementById("backBtn").addEventListener("click", () => goBack("admin-management.html"));

document.getElementById("searchInput").addEventListener("input", renderList);

document.querySelectorAll(".filter-tab").forEach((tab) => {

    tab.addEventListener("click", () => {

        document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        activeFilter = tab.dataset.filter;
        renderList();

    });

});

document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirm);

document.getElementById("confirmOkBtn").addEventListener("click", async () => {

    if (pendingAction) await pendingAction();
    closeConfirm();

});

init();

async function init() {

    const session = await adminSessionReady;

    if (!session) return;

    listenForUsers();

}

function listenForUsers() {

    const q = query(
        collection(db, "accounts"),
        where("role", "==", "user"),
        orderBy("createdAt", "desc"),
        limit(200)
    );

    onSnapshot(q, (snapshot) => {

        allUsers = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        renderList();

    }, (error) => {

        console.error("Failed to load users:", error);
        showToast("Couldn't load users.");

    });

}

function renderList() {

    const term = document.getElementById("searchInput").value.trim().toLowerCase();

    const filtered = allUsers.filter((user) => {

        const status = user.status || "active";

        if (activeFilter !== "all" && status !== activeFilter) return false;

        if (!term) return true;

        return (
            (user.username || "").toLowerCase().includes(term) ||
            user.id.toLowerCase().includes(term) ||
            (user.email || "").toLowerCase().includes(term)
        );

    });

    document.getElementById("resultCount").textContent =
        `${filtered.length} user${filtered.length === 1 ? "" : "s"}`;

    document.getElementById("emptyState").hidden = filtered.length !== 0;

    const listEl = document.getElementById("userList");
    listEl.innerHTML = "";

    filtered.forEach((user) => listEl.appendChild(buildUserCard(user)));

}

function buildUserCard(user) {

    const status = user.status || "active";

    const card = document.createElement("div");
    card.className = "mgmt-card mgmt-full";

    card.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;width:100%">
            <div class="mgmt-photo">
                <img src="${user.profilePhoto || "assets/default-avatar.png"}" alt="">
                <span class="dot ${user.isOnline ? "online" : ""}"></span>
            </div>
            <div class="mgmt-text">
                <div class="mgmt-name">${escapeHtml(user.username || "Vivy User")}</div>
                <div class="mgmt-meta">UID ${user.id} · 💜 ${formatNumber(user.coins ?? 0)}</div>
            </div>
            <span class="pill ${status}">${status}</span>
        </div>
        <div class="mgmt-actions">
            ${status !== "suspended"
                ? `<button type="button" class="btn-mini suspend" data-action="suspend">Suspend</button>`
                : `<button type="button" class="btn-mini approve" data-action="unsuspend">Unsuspend</button>`}
            ${status !== "banned"
                ? `<button type="button" class="btn-mini ban" data-action="ban">Ban</button>`
                : `<button type="button" class="btn-mini approve" data-action="unban">Unban</button>`}
            <button type="button" class="btn-mini delete" data-action="delete">Delete</button>
        </div>
    `;

    card.querySelector('[data-action="suspend"]')?.addEventListener("click", () => setStatus(user, "suspended"));
    card.querySelector('[data-action="unsuspend"]')?.addEventListener("click", () => setStatus(user, "active"));
    card.querySelector('[data-action="ban"]')?.addEventListener("click", () => confirmBan(user));
    card.querySelector('[data-action="unban"]')?.addEventListener("click", () => setStatus(user, "active"));
    card.querySelector('[data-action="delete"]')?.addEventListener("click", () => confirmDelete(user));

    return card;

}

async function setStatus(user, status) {

    try {

        await updateDoc(doc(db, "accounts", user.id), { status });
        showToast(`${user.username || "User"} is now ${status}.`);

    }

    catch (error) {

        console.error("Failed to update user status:", error);
        showToast("Couldn't update this user. Please try again.");

    }

}

function confirmBan(user) {

    openConfirm(
        "Ban this user?",
        `${user.username || "This user"} will be banned from Vivy and won't be able to sign back in with this behavior. This can be reversed from the Banned tab.`,
        () => setStatus(user, "banned")
    );

}

function confirmDelete(user) {

    openConfirm(
        "Delete this user?",
        `This permanently removes ${user.username || "this user"}'s Vivy profile data. Note: the underlying Firebase Authentication account isn't removed by this action — that requires the Firebase Console or a backend Admin SDK function, since a client app can never delete another person's login credentials.`,
        () => deleteUser(user)
    );

}

async function deleteUser(user) {

    try {

        await deleteDoc(doc(db, "accounts", user.id));
        showToast(`${user.username || "User"}'s profile was deleted.`);

    }

    catch (error) {

        console.error("Failed to delete user:", error);
        showToast("Couldn't delete this user. Please try again.");

    }

}

function openConfirm(title, body, action) {

    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmBody").textContent = body;
    pendingAction = action;
    document.getElementById("confirmBackdrop").classList.add("show");

}

function closeConfirm() {

    document.getElementById("confirmBackdrop").classList.remove("show");
    pendingAction = null;

}

function escapeHtml(text) {

    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;

}
