// ======================================================
// Vivy 💜 Admin — Announcements
// Owns the "announcements" collection. Only Admin can create,
// edit, or delete here. Users / Hosts / Agencies read this same
// collection read-only (see notifications.html) filtered by
// audience — nothing duplicated.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, showToast } from "./ui-helpers.js";

let allAnnouncements = [];
let editingId = null;

document.getElementById("backBtn").addEventListener("click", () => goBack("admin-dashboard.html"));
document.getElementById("addBtn").addEventListener("click", () => openForm());
document.getElementById("formCancelBtn").addEventListener("click", closeForm);
document.getElementById("announcementForm").addEventListener("submit", handleSave);

init();

async function init() {

    const session = await adminSessionReady;
    if (!session) return;

    listenForAnnouncements();

}

function listenForAnnouncements() {

    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {

        allAnnouncements = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        renderList();

    }, (error) => {

        console.error("Failed to load announcements:", error);
        showToast("Couldn't load announcements.");

    });

}

function renderList() {

    document.getElementById("emptyState").hidden = allAnnouncements.length !== 0;

    const listEl = document.getElementById("announcementList");
    listEl.innerHTML = "";

    allAnnouncements.forEach((item) => listEl.appendChild(buildRow(item)));

}

function buildRow(item) {

    const date = item.createdAt?.toDate ? item.createdAt.toDate() : null;
    const audience = (item.audience || []).join(", ") || "everyone";

    const row = document.createElement("div");
    row.className = "data-row";

    row.innerHTML = `
        <div class="dr-main">
            <div class="dr-title">${escapeHtml(item.title || "Announcement")}</div>
            <div class="dr-sub">${escapeHtml(audience)}${date ? ` · ${date.toLocaleDateString()}` : ""}</div>
        </div>
        <button type="button" class="btn-mini" data-edit>Edit</button>
        <button type="button" class="btn-mini delete" data-delete>Delete</button>
    `;

    row.querySelector("[data-edit]").addEventListener("click", () => openForm(item));
    row.querySelector("[data-delete]").addEventListener("click", () => handleDelete(item));

    return row;

}

function openForm(item = null) {

    editingId = item ? item.id : null;

    document.getElementById("formTitle").textContent = item ? "Edit Announcement" : "New Announcement";
    document.getElementById("fTitle").value = item?.title || "";
    document.getElementById("fMessage").value = item?.message || "";

    const audience = item?.audience || ["user", "host", "agency"];
    document.querySelectorAll(".audienceBox").forEach((box) => {

        box.checked = audience.includes(box.value);

    });

    document.getElementById("formError").style.display = "none";
    document.getElementById("formBackdrop").classList.add("show");

}

function closeForm() {

    document.getElementById("formBackdrop").classList.remove("show");
    editingId = null;

}

async function handleSave(event) {

    event.preventDefault();

    const errorEl = document.getElementById("formError");
    errorEl.style.display = "none";

    const title = document.getElementById("fTitle").value.trim();
    const message = document.getElementById("fMessage").value.trim();
    const audience = Array.from(document.querySelectorAll(".audienceBox:checked")).map((box) => box.value);

    if (!title || !message || audience.length === 0) {

        errorEl.textContent = "Please add a title, a message, and at least one audience.";
        errorEl.style.display = "block";
        return;

    }

    const saveBtn = document.getElementById("formSaveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {

        if (editingId) {

            await updateDoc(doc(db, "announcements", editingId), {
                title, message, audience, updatedAt: serverTimestamp()
            });

        }

        else {

            await addDoc(collection(db, "announcements"), {
                title, message, audience, createdAt: serverTimestamp()
            });

        }

        showToast("Announcement saved.");
        closeForm();

    }

    catch (error) {

        console.error("Failed to save announcement:", error);
        errorEl.textContent = "Couldn't save this announcement. Please try again.";
        errorEl.style.display = "block";

    }

    finally {

        saveBtn.disabled = false;
        saveBtn.textContent = "Publish";

    }

}

async function handleDelete(item) {

    if (!confirm(`Delete "${item.title}"?`)) return;

    try {

        await deleteDoc(doc(db, "announcements", item.id));
        showToast("Announcement deleted.");

    }

    catch (error) {

        console.error("Failed to delete announcement:", error);
        showToast("Couldn't delete this announcement.");

    }

}

function escapeHtml(text) {

    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;

}
