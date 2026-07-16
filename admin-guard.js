// ======================================================
// Vivy 💜 Admin Guard
// Protects every Admin-only page (admin-dashboard.html,
// admin-management.html, admin-users.html, admin-hosts.html,
// admin-agencies.html, admin-exchange-rates.html, admin-coins.html,
// admin-transactions.html, admin-payroll.html, admin-support.html,
// admin-announcements.html, admin-reports.html, admin-settings.html,
// admin-notifications.html).
//
// Reads the SAME "accounts" collection every other page in the app
// uses — an Admin is simply an "accounts/{uid}" document with
// role === "admin". Nothing new is created here. Admin accounts are
// never created by this app — they are created manually by the
// platform owner inside the Firebase Console.
//
//   - No signed-in user             -> index.html ("Access Denied.")
//   - Signed in but role !== admin  -> index.html ("Access Denied.")
//   - Otherwise                     -> resolves { user, admin }
//
// admin-login-vivy-2026.html does its own inline check (it needs a
// custom "Invalid Admin Credentials." message instead of a redirect)
// so it does NOT import this guard — every OTHER admin-*.html page
// must import this guard as its very first module.
// ======================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

function denyAccess() {

    try {

        sessionStorage.setItem("vivyAccessDenied", "1");

    }

    catch (error) {

        // sessionStorage unavailable — the redirect below still protects the page.

    }

    window.location.href = "index.html";

}

export const adminSessionReady = new Promise((resolve) => {

    onAuthStateChanged(auth, async (user) => {

        if (!user) {

            denyAccess();
            resolve(null);
            return;

        }

        let accountSnap;

        try {

            accountSnap = await getDoc(doc(db, "accounts", user.uid));

        }

        catch (error) {

            console.error("Admin Guard failed to load account:", error);
            denyAccess();
            resolve(null);
            return;

        }

        if (!accountSnap.exists() || accountSnap.data().role !== "admin") {

            await signOut(auth).catch(() => {});
            denyAccess();
            resolve(null);
            return;

        }

        const admin = accountSnap.data();

        if (admin.status === "suspended" || admin.status === "banned") {

            await signOut(auth).catch(() => {});
            denyAccess();
            resolve(null);
            return;

        }

        resolve({ user, admin });

    });

});
