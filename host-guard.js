// ======================================================
// Vivy 💜 Host Guard
// Protects pages that require a signed-in Host account.
// Any page that includes this script will automatically
// redirect to login.html if no Host session is found.
// ======================================================

import { auth } from "./firebase-config.js";
import { getHostProfile } from "./auth-service.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// ======================================================
// hostSessionReady
// A promise other Host-only scripts can await to safely
// access the signed-in Firebase user AND their Host
// Firestore document ("hosts/{uid}") together.
//
// Resolves with { user, host }, or redirects to login.html
// and resolves with null when:
//   - no one is signed in, or
//   - the signed-in account has no Host document (i.e. it's
//     a regular User account, not a Host account).
// ======================================================

export const hostSessionReady = new Promise((resolve) => {

    onAuthStateChanged(auth, async (user) => {

        if (!user) {

            window.location.href = "login.html";
            resolve(null);
            return;

        }

        try {

            const host = await getHostProfile(user.uid);

            if (!host) {

                window.location.href = "login.html";
                resolve(null);
                return;

            }

            resolve({ user, host });

        }

        catch (error) {

            console.error("Failed to load Host session:", error);
            window.location.href = "login.html";
            resolve(null);

        }

    });

});
