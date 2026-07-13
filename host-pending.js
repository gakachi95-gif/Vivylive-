// ======================================================
// Vivy 💜 Host — Pending Verification
// Shows the Host's current application status and listens
// live for changes. As soon as Vivy Admin approves the
// account, this page auto-redirects to host-dashboard.html.
// ======================================================

import { hostSessionReady } from "./host-guard.js";
import { logoutUser } from "./auth-service.js";
import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

document.getElementById("logoutBtn").addEventListener("click", async () => {

    if (confirm("Log out of Vivy?")) {

        await logoutUser();
        window.location.href = "login.html";

    }

});

document.getElementById("supportBtn").addEventListener("click", () => {

    window.location.href = "mailto:support@vivy.app?subject=Host%20Application%20Support";

});

init();

async function init() {

    const session = await hostSessionReady;

    if (!session) {

        return;

    }

    const { user, host } = session;

    render(host);

    onSnapshot(doc(db, "hosts", user.uid), (snap) => {

        if (!snap.exists()) {

            return;

        }

        const updated = snap.data();
        render(updated);

        if (updated.status === "approved") {

            window.location.href = "host-dashboard.html";

        }

    });

}

function render(host) {

    document.getElementById("agencyName").textContent = host.agencyName || "—";

    const titleEl = document.getElementById("statusTitle");
    const messageEl = document.getElementById("statusMessage");
    const badgeEl = document.getElementById("statusBadge");
    const iconEl = document.getElementById("statusIcon");

    titleEl.classList.remove("skeleton");
    messageEl.classList.remove("skeleton");

    if (host.status === "rejected") {

        titleEl.textContent = "Application Not Approved";
        messageEl.textContent = "Your Host application wasn't approved this time. Contact Support if you believe this is a mistake.";
        badgeEl.textContent = "Rejected";
        badgeEl.className = "status-badge rejected";
        iconEl.className = "status-icon rejected";

    }

    else if (host.status === "suspended") {

        titleEl.textContent = "Account Suspended";
        messageEl.textContent = "Your Host account has been suspended. Contact Support for more information.";
        badgeEl.textContent = "Suspended";
        badgeEl.className = "status-badge suspended";
        iconEl.className = "status-icon rejected";

    }

    else {

        titleEl.textContent = "Your Host application has been submitted successfully.";
        messageEl.textContent = "Your account is awaiting Vivy Admin verification. You will be notified once approved.";
        badgeEl.textContent = "Pending Verification";
        badgeEl.className = "status-badge";
        iconEl.className = "status-icon";

    }

                                                      }
