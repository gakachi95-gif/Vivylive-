// ======================================================
// Vivy 💜 Agency Guard
// Protects every Agency-only page (agency-dashboard.html,
// agency-invite.html, agency-hosts.html, agency-performance.html,
// agency-wallet.html, agency-support.html, agency-settings.html,
// agency-notifications.html).
//
// Agencies never self-register through the normal auth flow and
// always start unapproved. This guard enforces:
//   - No signed-in user            -> agency-login.html
//   - Signed in but no agency doc  -> agency-login.html
//   - status is suspended/banned   -> agency-login.html
//   - approved !== true            -> agency-pending.html
//   - Otherwise                    -> resolves { user, agency }
//
// agency-pending.html itself imports agencySessionReadyRaw,
// which resolves without the approved-only redirect so it can
// render the pending state instead of bouncing off itself.
// ======================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

function loadSession({ enforceApproved }) {

    return new Promise((resolve) => {

        onAuthStateChanged(auth, async (user) => {

            if (!user) {

                window.location.href = "agency-login.html";
                resolve(null);
                return;

            }

            let agencySnap;

            try {

                agencySnap = await getDoc(doc(db, "agencies", user.uid));

            }

            catch (error) {

                console.error("Failed to load agency profile:", error);
                window.location.href = "agency-login.html";
                resolve(null);
                return;

            }

            if (!agencySnap.exists()) {

                // Signed in, but not an Agency account at all.
                window.location.href = "agency-login.html";
                resolve(null);
                return;

            }

            const agency = agencySnap.data();

            if (agency.status === "suspended" || agency.status === "banned") {

                window.location.href = "agency-login.html";
                resolve(null);
                return;

            }

            if (enforceApproved && agency.approved !== true) {

                window.location.href = "agency-pending.html";
                resolve(null);
                return;

            }

            resolve({ user, agency });

        });

    });

}

// Used by every approved-only Agency page.
export const agencySessionReady = loadSession({ enforceApproved: true });

// Used by agency-pending.html itself.
export const agencySessionReadyRaw = loadSession({ enforceApproved: false });
