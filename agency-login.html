// ======================================================
// Vivy 💜 Agency Login
// Agencies always log in with Email + Password — never with
// an Invitation Code, which exists only to invite Hosts.
// ======================================================

import { loginUser, getAgencyProfile } from "./auth-service.js";
import { logoutUser } from "./auth-service.js";

const form = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in…";

    try {

        const user = await loginUser(email, password);

        const agency = await getAgencyProfile(user.uid);

        if (!agency) {

            // Signed in, but this account has no Agency document —
            // don't leave them signed in under the wrong context.
            await logoutUser();
            alert("This account is not registered as a Vivy Agency.");
            return;

        }

        if (agency.status === "suspended" || agency.status === "banned") {

            await logoutUser();
            alert("Your Agency account has been suspended. Please contact Vivy Support.");
            return;

        }

        window.location.href =
            agency.approved === true
                ? "agency-dashboard.html"
                : "agency-pending.html";

    }

    catch (error) {

        console.error("Agency login failed:", error);
        alert(error.message || "Login failed. Please check your email and password.");

    }

    finally {

        loginBtn.disabled = false;
        loginBtn.textContent = "Log In";

    }

});
