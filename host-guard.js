// ======================================================
// Vivy 💜 Auth Guard
// Protects pages that require a signed-in user.
// Any page that includes this script will automatically
// redirect to login.html if no user session is found.
// ======================================================

import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// ======================================================
// authReady
// A promise other scripts can await to safely access the
// signed-in user. Resolves with the Firebase user object,
// or redirects to login.html and resolves with null.
// ======================================================

export const authReady = new Promise((resolve) => {

    onAuthStateChanged(auth, (user) => {

        if (!user) {

            window.location.href = "login.html";

            resolve(null);

            return;

        }

        resolve(user);

    });

});
