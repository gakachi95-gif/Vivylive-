// ======================================================
// Vivy 💜 Admin — Payroll
// Owns the "payrollRuns" collection (+ its "entries" subcollection).
// Reads eligible Hosts from the SAME "hosts" collection every other
// page uses (host.diamonds = pending, unpaid balance) and the SAME
// "agencies" collection for each Host's commissionRate — nothing
// new, nothing duplicated on the Host/Agency side.
//
// Diamonds are Vivy's existing USD-pegged Host earning unit — see
// ui-helpers.js DIAMOND_TO_USD_RATE (50,000 💎 = $15), the same rate
// wallet.html / host-wallet.js already display. This is what the
// spec's "Beans" map to in this codebase; kept as-is (not renamed,
// not re-priced) so no existing call-earning logic breaks.
//
// "Generate Payroll" snapshots every approved Host's current
// diamonds balance into a new run. "Mark As Paid" deducts that paid
// amount from each Host's live balance and credits the Agency's
// commission totals — a Host's balance keeps earning normally
// in between, so nothing already-earned is ever double counted or
// silently reset.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import {
    collection, query, where, orderBy, limit, getDocs,
    doc, addDoc, setDoc, getDoc, updateDoc, increment,
    serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { formatNumber, formatUsd, diamondsToUsd, showToast } from "./ui-helpers.js";

const DEFAULT_COMMISSION_RATE = 0.10;

let allRuns = [];
let openRun = null;

document.getElementById("generateBtn").addEventListener("click", generatePayroll);
document.getElementById("closeRunBtn").addEventListener("click", closeRunModal);
document.getElementById("downloadRunBtn").addEventListener("click", downloadRun);
document.getElementById("markPaidBtn").addEventListener("click", markPaid);

init();

async function init() {

    const session = await adminSessionReady;
    if (!session) return;

    await refreshEligiblePreview();
    await listenForRuns();

}

// ------------------------------------------------------
// Live preview of what a NEW payroll run would look like,
// based on current Host diamond balances.
// ------------------------------------------------------

async function refreshEligiblePreview() {

    try {

        const hostsSnap = await getDocs(query(collection(db, "hosts"), where("status", "==", "approved")));

        let eligible = 0;
        let totalHostUsd = 0;
        let totalCommissionUsd = 0;

        const agencyRateCache = new Map();

        for (const hostDoc of hostsSnap.docs) {

            const host = hostDoc.data();
            const diamonds = Number(host.diamonds || 0);

            if (diamonds <= 0) continue;

            eligible++;

            const payoutUsd = diamondsToUsd(diamonds);
            const rate = await getAgencyCommissionRate(host.agencyId, agencyRateCache);

            totalHostUsd += payoutUsd;
            totalCommissionUsd += payoutUsd * rate;

        }

        document.getElementById("statEligible").textContent = formatNumber(eligible);
        document.getElementById("statCommission").textContent = formatUsd(totalCommissionUsd);
        document.getElementById("statHostPayroll").textContent = formatUsd(totalHostUsd);
        document.getElementById("statTotalPayroll").textContent = formatUsd(totalHostUsd + totalCommissionUsd);

    }

    catch (error) {

        console.error("Failed to load payroll preview:", error);

    }

}

async function getAgencyCommissionRate(agencyId, cache) {

    if (!agencyId) return DEFAULT_COMMISSION_RATE;

    if (cache.has(agencyId)) return cache.get(agencyId);

    try {

        const snap = await getDoc(doc(db, "agencies", agencyId));
        const rate = snap.exists() ? Number(snap.data().commissionRate ?? DEFAULT_COMMISSION_RATE) : DEFAULT_COMMISSION_RATE;
        cache.set(agencyId, rate);
        return rate;

    }

    catch (error) {

        return DEFAULT_COMMISSION_RATE;

    }

}

// ------------------------------------------------------
// Payroll run history
// ------------------------------------------------------

async function listenForRuns() {

    try {

        const snap = await getDocs(query(collection(db, "payrollRuns"), orderBy("generatedAt", "desc"), limit(50)));
        allRuns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderRuns();

    }

    catch (error) {

        console.error("Failed to load payroll runs:", error);

    }

}

function renderRuns() {

    document.getElementById("emptyState").hidden = allRuns.length !== 0;

    const listEl = document.getElementById("runList");
    listEl.innerHTML = "";

    allRuns.forEach((run) => listEl.appendChild(buildRunRow(run)));

}

function buildRunRow(run) {

    const date = run.generatedAt?.toDate ? run.generatedAt.toDate() : null;

    const row = document.createElement("div");
    row.className = "data-row";
    row.style.cursor = "pointer";

    row.innerHTML = `
        <div class="dr-main">
            <div class="dr-title">${date ? date.toLocaleDateString() : "Payroll Run"} · ${formatNumber(run.hostCount || 0)} Hosts</div>
            <div class="dr-sub">Total ${formatUsd(run.totalPayroll)}</div>
        </div>
        <span class="pill ${run.status === "paid" ? "paid" : "pending"}">${run.status || "generated"}</span>
    `;

    row.addEventListener("click", () => openRunModal(run));

    return row;

}

// ------------------------------------------------------
// Generate Payroll
// ------------------------------------------------------

async function generatePayroll() {

    const btn = document.getElementById("generateBtn");
    btn.disabled = true;
    btn.textContent = "Generating…";

    try {

        const hostsSnap = await getDocs(query(collection(db, "hosts"), where("status", "==", "approved")));

        const agencyRateCache = new Map();
        const agencyNameCache = new Map();
        const entries = [];

        let totalHostUsd = 0;
        let totalCommissionUsd = 0;

        for (const hostDoc of hostsSnap.docs) {

            const host = hostDoc.data();
            const diamonds = Number(host.diamonds || 0);

            if (diamonds <= 0) continue;

            const payoutUsd = diamondsToUsd(diamonds);
            const rate = await getAgencyCommissionRate(host.agencyId, agencyRateCache);
            const commissionUsd = payoutUsd * rate;

            if (host.agencyId && !agencyNameCache.has(host.agencyId)) {

                agencyNameCache.set(host.agencyId, host.agencyName || "—");

            }

            entries.push({
                hostId: hostDoc.id,
                hostUsername: host.username || "Host",
                agencyId: host.agencyId || null,
                agencyName: host.agencyName || "—",
                diamonds,
                hostPayoutUsd: payoutUsd,
                agencyCommissionUsd: commissionUsd
            });

            totalHostUsd += payoutUsd;
            totalCommissionUsd += commissionUsd;

        }

        if (entries.length === 0) {

            showToast("No Hosts have unpaid earnings right now.");
            return;

        }

        const runRef = await addDoc(collection(db, "payrollRuns"), {
            status: "generated",
            hostCount: entries.length,
            totalHostPayroll: totalHostUsd,
            totalAgencyCommission: totalCommissionUsd,
            totalPayroll: totalHostUsd + totalCommissionUsd,
            generatedAt: serverTimestamp()
        });

        // Firestore batches cap at 500 writes — payroll entries are
        // written in chunks of 400 to stay safely under that limit.
        for (let i = 0; i < entries.length; i += 400) {

            const batch = writeBatch(db);

            entries.slice(i, i + 400).forEach((entry) => {

                const entryRef = doc(collection(db, "payrollRuns", runRef.id, "entries"), entry.hostId);
                batch.set(entryRef, entry);

            });

            await batch.commit();

        }

        showToast(`Payroll generated for ${entries.length} Host${entries.length === 1 ? "" : "s"}.`);

        await refreshEligiblePreview();
        await listenForRuns();

    }

    catch (error) {

        console.error("Failed to generate payroll:", error);
        showToast("Couldn't generate payroll. Please try again.");

    }

    finally {

        btn.disabled = false;
        btn.textContent = "Generate Payroll";

    }

}

// ------------------------------------------------------
// Run detail modal
// ------------------------------------------------------

async function openRunModal(run) {

    openRun = run;

    document.getElementById("runTitle").textContent =
        `Payroll · ${run.generatedAt?.toDate ? run.generatedAt.toDate().toLocaleDateString() : ""}`;

    const bodyEl = document.getElementById("runBody");
    bodyEl.innerHTML = `<p style="font-size:0.78rem;color:var(--text-faint)">Loading entries…</p>`;

    document.getElementById("markPaidBtn").hidden = run.status === "paid";
    document.getElementById("markPaidBtn").disabled = false;
    document.getElementById("markPaidBtn").textContent = "Mark As Paid";

    document.getElementById("runBackdrop").classList.add("show");

    try {

        const entriesSnap = await getDocs(collection(db, "payrollRuns", run.id, "entries"));
        openRun.entries = entriesSnap.docs.map((d) => d.data());

        bodyEl.innerHTML = openRun.entries.map((entry) => `
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:6px 0;border-bottom:1px solid var(--glass-border)">
                <span>${escapeHtml(entry.hostUsername)} <span style="color:var(--text-faint)">(${escapeHtml(entry.agencyName)})</span></span>
                <span style="font-weight:700">${formatUsd(entry.hostPayoutUsd)}</span>
            </div>
        `).join("") || `<p style="font-size:0.78rem;color:var(--text-faint)">No entries.</p>`;

    }

    catch (error) {

        console.error("Failed to load run entries:", error);
        bodyEl.innerHTML = `<p style="font-size:0.78rem;color:var(--danger)">Couldn't load entries.</p>`;

    }

}

function closeRunModal() {

    document.getElementById("runBackdrop").classList.remove("show");
    openRun = null;

}

async function markPaid() {

    if (!openRun || openRun.status === "paid") return;

    if (!confirm("Mark this payroll run as paid? This deducts the paid Diamonds from each Host's balance and credits Agency commissions.")) return;

    const btn = document.getElementById("markPaidBtn");
    btn.disabled = true;
    btn.textContent = "Processing…";

    try {

        const entries = openRun.entries || (await getDocs(collection(db, "payrollRuns", openRun.id, "entries"))).docs.map((d) => d.data());

        for (const entry of entries) {

            await updateDoc(doc(db, "hosts", entry.hostId), {
                diamonds: increment(-entry.diamonds)
            });

            if (entry.agencyId) {

                await updateDoc(doc(db, "agencies", entry.agencyId), {
                    totalCommissionEarned: increment(entry.agencyCommissionUsd)
                }).catch(() => {});

            }

        }

        await updateDoc(doc(db, "payrollRuns", openRun.id), {
            status: "paid",
            paidAt: serverTimestamp()
        });

        showToast("Payroll marked as paid.");
        closeRunModal();

        await refreshEligiblePreview();
        await listenForRuns();

    }

    catch (error) {

        console.error("Failed to mark payroll as paid:", error);
        showToast("Couldn't complete payout. Please try again.");

    }

    finally {

        btn.disabled = false;
        btn.textContent = "Mark As Paid";

    }

}

function downloadRun() {

    if (!openRun?.entries?.length) {

        showToast("No entries to download.");
        return;

    }

    const headers = ["Host", "Agency", "Diamonds", "Host Payout (USD)", "Agency Commission (USD)"];

    const rows = openRun.entries.map((entry) => [
        entry.hostUsername, entry.agencyName, entry.diamonds,
        entry.hostPayoutUsd.toFixed(2), entry.agencyCommissionUsd.toFixed(2)
    ]);

    const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `vivy-payroll-${openRun.id}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

}

function escapeHtml(text) {

    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;

  }
