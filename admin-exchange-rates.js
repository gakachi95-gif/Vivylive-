// ======================================================
// Vivy 💜 Admin — Exchange Rate Management
// Owns the "exchangeRates" collection (doc ID = currency code,
// e.g. "NGN", "GHS", "KES", "ZAR"). This is the ONLY place these
// rates are edited — buy-coins.html / recharge.html / payment-service.js
// only ever READ this collection to convert the USD Coin Package
// price into the user's local currency.
//
// Each doc is structured so a live Exchange Rate API can be wired
// in later without changing the shape: { source: "manual" } today
// can become { source: "api", lastSyncedAt } without touching any
// field a page already reads.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, onSnapshot, doc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, showToast } from "./ui-helpers.js";

let allRates = [];
let editingCode = null;

document.getElementById("backBtn").addEventListener("click", () => goBack("admin-dashboard.html"));

document.getElementById("addBtn").addEventListener("click", () => openForm());
document.getElementById("formCancelBtn").addEventListener("click", closeForm);

document.getElementById("rateForm").addEventListener("submit", handleSave);

init();

async function init() {

    const session = await adminSessionReady;
    if (!session) return;

    listenForRates();

}

function listenForRates() {

    onSnapshot(collection(db, "exchangeRates"), (snapshot) => {

        allRates = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .sort((a, b) => (a.country || "").localeCompare(b.country || ""));

        renderList();

    }, (error) => {

        console.error("Failed to load exchange rates:", error);
        showToast("Couldn't load exchange rates.");

    });

}

function renderList() {

    document.getElementById("emptyState").hidden = allRates.length !== 0;

    const listEl = document.getElementById("rateList");
    listEl.innerHTML = "";

    allRates.forEach((rate) => listEl.appendChild(buildRateRow(rate)));

}

function buildRateRow(rate) {

    const row = document.createElement("div");
    row.className = "data-row";

    row.innerHTML = `
        <div class="dr-main">
            <div class="dr-title">${escapeHtml(rate.country || rate.id)} · ${escapeHtml(rate.currencyCode || rate.id)}</div>
            <div class="dr-sub">1 USD = ${escapeHtml(rate.symbol || "")}${formatRate(rate.rateToUsd)}</div>
        </div>
        <span class="pill ${rate.enabled === false ? "disabled" : "enabled"}" style="margin-right:6px">${rate.enabled === false ? "disabled" : "enabled"}</span>
        <label class="toggle-switch">
            <input type="checkbox" ${rate.enabled === false ? "" : "checked"} data-toggle>
            <span class="track"></span>
        </label>
        <button type="button" class="btn-mini" style="margin-left:8px" data-edit>Edit</button>
    `;

    row.querySelector("[data-toggle]").addEventListener("change", (event) => toggleEnabled(rate, event.target.checked));
    row.querySelector("[data-edit]").addEventListener("click", () => openForm(rate));

    return row;

}

function formatRate(value) {

    return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });

}

async function toggleEnabled(rate, enabled) {

    try {

        await updateDoc(doc(db, "exchangeRates", rate.id), { enabled, updatedAt: serverTimestamp() });
        showToast(`${rate.currencyCode || rate.id} is now ${enabled ? "enabled" : "disabled"}.`);

    }

    catch (error) {

        console.error("Failed to toggle currency:", error);
        showToast("Couldn't update this currency.");

    }

}

function openForm(rate = null) {

    editingCode = rate ? rate.id : null;

    document.getElementById("formTitle").textContent = rate ? "Edit Currency" : "Add Currency";
    document.getElementById("fCountry").value = rate?.country || "";
    document.getElementById("fCurrencyName").value = rate?.currencyName || "";
    document.getElementById("fCurrencyCode").value = rate?.currencyCode || rate?.id || "";
    document.getElementById("fCurrencyCode").disabled = !!rate;
    document.getElementById("fSymbol").value = rate?.symbol || "";
    document.getElementById("fRate").value = rate?.rateToUsd ?? "";
    document.getElementById("fEnabled").checked = rate?.enabled !== false;
    document.getElementById("formError").style.display = "none";

    document.getElementById("formBackdrop").classList.add("show");

}

function closeForm() {

    document.getElementById("formBackdrop").classList.remove("show");
    document.getElementById("fCurrencyCode").disabled = false;
    editingCode = null;

}

async function handleSave(event) {

    event.preventDefault();

    const errorEl = document.getElementById("formError");
    errorEl.style.display = "none";

    const country = document.getElementById("fCountry").value.trim();
    const currencyName = document.getElementById("fCurrencyName").value.trim();
    const currencyCode = document.getElementById("fCurrencyCode").value.trim().toUpperCase();
    const symbol = document.getElementById("fSymbol").value.trim();
    const rateToUsd = Number(document.getElementById("fRate").value);
    const enabled = document.getElementById("fEnabled").checked;

    if (!country || !currencyName || !currencyCode || !symbol || !rateToUsd || rateToUsd <= 0) {

        errorEl.textContent = "Please fill in every field with a valid exchange rate.";
        errorEl.style.display = "block";
        return;

    }

    const saveBtn = document.getElementById("formSaveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {

        await setDoc(doc(db, "exchangeRates", currencyCode), {
            country,
            currencyName,
            currencyCode,
            symbol,
            rateToUsd,
            enabled,
            source: "manual",
            updatedAt: serverTimestamp(),
            ...(editingCode ? {} : { createdAt: serverTimestamp() })
        }, { merge: true });

        showToast(`${currencyCode} saved.`);
        closeForm();

    }

    catch (error) {

        console.error("Failed to save currency:", error);
        errorEl.textContent = "Couldn't save this currency. Please try again.";
        errorEl.style.display = "block";

    }

    finally {

        saveBtn.disabled = false;
        saveBtn.textContent = "Save";

    }

}

function escapeHtml(text) {

    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;

  }
