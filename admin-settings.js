// ======================================================
// Vivy 💜 Admin — Platform Settings
// Owns a single doc: "settings/platform". The "settings"
// collection already exists in this app (auth-service.js uses
// "settings/agencyCounter" for Agency UID numbering) — this adds
// one more doc to that SAME collection, nothing duplicated.
// ======================================================

import { adminSessionReady } from "./admin-guard.js";
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { showToast } from "./ui-helpers.js";

const SETTINGS_REF = () => doc(db, "settings", "platform");

document.getElementById("settingsForm").addEventListener("submit", handleSave);

init();

async function init() {

    const session = await adminSessionReady;
    if (!session) return;

    await loadSettings();

}

async function loadSettings() {

    try {

        const snap = await getDoc(SETTINGS_REF());
        const s = snap.exists() ? snap.data() : {};

        document.getElementById("fPlatformName").value = s.platformName || "Vivy";
        document.getElementById("fMaintenance").checked = !!s.maintenanceMode;
        document.getElementById("fMinWithdrawal").value = s.minWithdrawalDiamonds ?? 50000;
        document.getElementById("fCommissionRate").value = (s.defaultAgencyCommissionRate ?? 0.10) * 100;
        document.getElementById("fBonusCoins").value = s.globalBonusCoinsPercent ?? 0;
        document.getElementById("fNotifySignups").checked = s.notifySignups !== false;
        document.getElementById("fNotifyTx").checked = s.notifyTransactions !== false;
        document.getElementById("fNotifyTickets").checked = s.notifyTickets !== false;

    }

    catch (error) {

        console.error("Failed to load settings:", error);
        showToast("Couldn't load settings.");

    }

}

async function handleSave(event) {

    event.preventDefault();

    const saveBtn = document.getElementById("saveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {

        await setDoc(SETTINGS_REF(), {
            platformName: document.getElementById("fPlatformName").value.trim() || "Vivy",
            maintenanceMode: document.getElementById("fMaintenance").checked,
            minWithdrawalDiamonds: Number(document.getElementById("fMinWithdrawal").value) || 0,
            defaultAgencyCommissionRate: (Number(document.getElementById("fCommissionRate").value) || 0) / 100,
            globalBonusCoinsPercent: Number(document.getElementById("fBonusCoins").value) || 0,
            notifySignups: document.getElementById("fNotifySignups").checked,
            notifyTransactions: document.getElementById("fNotifyTx").checked,
            notifyTickets: document.getElementById("fNotifyTickets").checked,
            updatedAt: serverTimestamp()
        }, { merge: true });

        showToast("Settings saved.");

    }

    catch (error) {

        console.error("Failed to save settings:", error);
        showToast("Couldn't save settings. Please try again.");

    }

    finally {

        saveBtn.disabled = false;
        saveBtn.textContent = "Save Settings";

    }

  }
