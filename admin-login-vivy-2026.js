// ======================================================
// Vivy 💜 Admin Login
// Only Firebase Auth accounts that also have a Firestore
// "accounts/{uid}" document with role: "admin" may pass.
// Admin accounts are never created by this app — they are
// created manually by the platform owner inside Firebase.
// ======================================================

import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const form = document.getElementById("adminLoginForm");
const loginBtn = document.getElementById("loginBtn");
const errorEl = document.getElementById("loginError");

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    errorEl.classList.remove("show");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in…";

    try {

        const credential = await signInWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;

        const accountSnap = await getDoc(doc(db, "accounts", uid));

        if (!accountSnap.exists() || accountSnap.data().role !== "admin") {

            await signOut(auth).catch(() => {});
            showError();
            return;

        }

        window.location.href = "admin-dashboard.html";

    }

    catch (error) {

        console.error("Admin login failed:", error);
        await signOut(auth).catch(() => {});
        showError();

    }

    finally {

        loginBtn.disabled = false;
        loginBtn.textContent = "Log In";

    }

});

function showError() {

    errorEl.classList.add("show");

}
