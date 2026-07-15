// ======================================================
// Vivy 💜 Agency — Pending Approval
// Shows the Agency's current application status and listens
// live for changes. As soon as Vivy Admin sets approved: true,
// this page auto-redirects to agency-dashboard.html.
// ======================================================

import { agencySessionReadyRaw } from "./agency-guard.js";
import { logoutUser } from "./auth-service.js";
import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

document.getElementById("logoutBtn").addEventListener("click", async () => {

    if (confirm("Log out of Vivy?")) {

        await logoutUser();
        window.location.href = "agency-login.html";

    }

});

document.getElementById("supportBtn").addEventListener("click", () => {

    window.location.href = "mailto:support@vivy.app?subject=Agency%20Application%20Support";

});

init();

async function init() {

    const session = await agencySessionReadyRaw;

    if (!session) {

        return;

    }

    const { user, agency } = session;

    render(agency);

    onSnapshot(doc(db, "agencies", user.uid), (snap) => {

        if (!snap.exists()) {

            return;

        }

        const updated = snap.data();
        render(updated);

        if (updated.approved === true) {

            window.location.href = "agency-dashboard.html";

        }

    });

}

function render(agency) {

    document.getElementById("agencyName").textContent = agency.agencyName || "—";

    const titleEl = document.getElementById("statusTitle");
    const messageEl = document.getElementById("statusMessage");
    const badgeEl = document.getElementById("statusBadge");
    const iconEl = document.getElementById("statusIcon");

    titleEl.classList.remove("skeleton");
    messageEl.classList.remove("skeleton");

    if (agency.status === "suspended" || agency.status === "banned") {

        titleEl.textContent = "Account Suspended";
        messageEl.textContent = "Your Agency account has been suspended. Contact Support for more information.";
        badgeEl.textContent = "Suspended";
        badgeEl.className = "status-badge rejected";
        iconEl.className = "status-icon rejected";

    }

    else if (agency.approved === true) {

        titleEl.textContent = "You're Approved!";
        messageEl.textContent = "Redirecting you to your Agency Dashboard…";
        badgeEl.textContent = "Approved";
        badgeEl.className = "status-badge";
        iconEl.className = "status-icon";

    }

    else {

        titleEl.textContent = "🟣 Application Under Review";
        messageEl.textContent = "Your Agency registration has been submitted successfully. Your account is currently waiting for Admin approval. Please wait while Vivy reviews your application.";
        badgeEl.textContent = "Pending Approval";
        badgeEl.className = "status-badge";
        iconEl.className = "status-icon";

    }

}
