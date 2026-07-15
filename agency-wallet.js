// ======================================================
// Vivy 💜 Agency Wallet
// Commission-only view. No withdrawal, no payroll generation —
// Vivy Admin pays the Agency, and the Agency pays its Hosts
// directly outside of Vivy.
// ======================================================

import { agencySessionReady } from "./agency-guard.js";
import { db } from "./firebase-config.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { goBack, diamondsToUsd, formatUsd } from "./ui-helpers.js";

document.getElementById("backBtn").addEventListener("click", () => goBack("agency-dashboard.html"));

init();

async function init() {

    const session = await agencySessionReady;
    if (!session) return;

    listenForCommission(session.user.uid);

}

function listenForCommission(agencyUid) {

    const q = query(collection(db, "hosts"), where("agencyId", "==", agencyUid));

    onSnapshot(q, (snapshot) => {

        let totalCommission = 0;
        let weekCommission = 0;

        snapshot.forEach((docSnap) => {

            const host = docSnap.data();

            totalCommission += diamondsToUsd(host.totalDiamondsEarned) * 0.10;
            weekCommission += diamondsToUsd(host.weeklyDiamonds) * 0.10;

        });

        document.getElementById("totalCommission").textContent = formatUsd(totalCommission);
        document.getElementById("weekCommission").textContent = formatUsd(weekCommission);

    }, (error) => {

        console.error("Failed to load commission:", error);

    });

  }
