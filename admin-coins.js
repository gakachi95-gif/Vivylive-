// ======================================================
// Vivy 💜 Admin — Coin Package Management
// Owns the "coinPackages" collection. This is the ONLY place
// packages are created/edited — recharge.html / buy-coins.html /
// payment-service.js only ever READ this collection (ordered by
// priceUsd) to render the packages a user can purchase.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, formatNumber, formatUsd, showToast } from "./ui-helpers.js";

let allPackages = [];
let editingId = null;

document.getElementById("backBtn").addEventListener("click", () => goBack("admin-dashboard.html"));

document.getElementById("addBtn").addEventListener("click", () => openForm());
document.getElementById("formCancelBtn").addEventListener("click", closeForm);

document.getElementById("packageForm").addEventListener("submit", handleSave);

init();

async function init() {

    const session = await adminSessionReady;
    if (!session) return;

    listenForPackages();

}

function listenForPackages() {

    const q = query(collection(db, "coinPackages"), orderBy("priceUsd", "asc"));

    onSnapshot(q, (snapshot) => {

        allPackages = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        renderList();

    }, (error) => {

        console.error("Failed to load coin packages:", error);
        showToast("Couldn't load coin packages.");

    });

}

function renderList() {

    document.getElementById("emptyState").hidden = allPackages.length !== 0;

    const listEl = document.getElementById("packageList");
    listEl.innerHTML = "";

    allPackages.forEach((pkg) => listEl.appendChild(buildPackageRow(pkg)));

}

function buildPackageRow(pkg) {

    const row = document.createElement("div");
    row.className = "data-row";

    row.innerHTML = `
        <div class="dr-main">
            <div class="dr-title">💜 ${formatNumber(pkg.coins)}${pkg.bonus ? ` <span style="color:var(--gold);font-weight:600">+${formatNumber(pkg.bonus)} bonus</span>` : ""}${pkg.best ? ` <span class="pill approved" style="margin-left:2px">best</span>` : ""}</div>
            <div class="dr-sub">${formatUsd(pkg.priceUsd)}</div>
        </div>
        <span class="pill ${pkg.enabled === false ? "disabled" : "enabled"}" style="margin-right:6px">${pkg.enabled === false ? "disabled" : "enabled"}</span>
        <button type="button" class="btn-mini" data-edit>Edit</button>
        <button type="button" class="btn-mini delete" data-delete>Delete</button>
    `;

    row.querySelector("[data-edit]").addEventListener("click", () => openForm(pkg));
    row.querySelector("[data-delete]").addEventListener("click", () => handleDelete(pkg));

    return row;

}

function openForm(pkg = null) {

    editingId = pkg ? pkg.id : null;

    document.getElementById("formTitle").textContent = pkg ? "Edit Package" : "Add Package";
    document.getElementById("fCoins").value = pkg?.coins ?? "";
    document.getElementById("fPrice").value = pkg?.priceUsd ?? "";
    document.getElementById("fBonus").value = pkg?.bonus ?? 0;
    document.getElementById("fBest").checked = !!pkg?.best;
    document.getElementById("fEnabled").checked = pkg?.enabled !== false;
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

    const coins = Number(document.getElementById("fCoins").value);
    const priceUsd = Number(document.getElementById("fPrice").value);
    const bonus = Number(document.getElementById("fBonus").value) || 0;
    const best = document.getElementById("fBest").checked;
    const enabled = document.getElementById("fEnabled").checked;

    if (!coins || coins <= 0 || !priceUsd || priceUsd <= 0) {

        errorEl.textContent = "Please enter a valid coin amount and USD price.";
        errorEl.style.display = "block";
        return;

    }

    const saveBtn = document.getElementById("formSaveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {

        const payload = { coins, priceUsd, bonus, best, enabled, updatedAt: serverTimestamp() };

        if (editingId) {

            await updateDoc(doc(db, "coinPackages", editingId), payload);

        }

        else {

            await addDoc(collection(db, "coinPackages"), { ...payload, createdAt: serverTimestamp() });

        }

        showToast("Coin package saved.");
        closeForm();

    }

    catch (error) {

        console.error("Failed to save coin package:", error);
        errorEl.textContent = "Couldn't save this package. Please try again.";
        errorEl.style.display = "block";

    }

    finally {

        saveBtn.disabled = false;
        saveBtn.textContent = "Save";

    }

}

async function handleDelete(pkg) {

    if (!confirm(`Delete the ${formatNumber(pkg.coins)} Coins package?`)) return;

    try {

        await deleteDoc(doc(db, "coinPackages", pkg.id));
        showToast("Package deleted.");

    }

    catch (error) {

        console.error("Failed to delete package:", error);
        showToast("Couldn't delete this package.");

    }

}
