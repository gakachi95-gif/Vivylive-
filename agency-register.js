// ======================================================
// Vivy 💜 Agency Registration
// Agencies never self-register through the normal auth flow —
// Vivy Admin shares this page's link directly. Submitting here
// creates the Firebase Auth account + Firestore "agencies" doc
// with approved: false, then shows a submitted-for-review
// screen before redirecting to agency-pending.html.
// ======================================================

import { registerAgency } from "./auth-service.js";
import { goBack, showToast } from "./ui-helpers.js";

const form = document.getElementById("agencyForm");
const submitBtn = document.getElementById("submitBtn");
const passwordError = document.getElementById("passwordError");

const registerScreen = document.getElementById("registerScreen");
const successScreen = document.getElementById("successScreen");

document.getElementById("backBtn").addEventListener("click", () => goBack("agency-login.html"));
document.getElementById("continueBtn").addEventListener("click", () => window.location.href = "agency-pending.html");

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {

        passwordError.classList.add("show");
        return;

    }

    passwordError.classList.remove("show");

    if (password.length < 6) {

        showToast("Password must be at least 6 characters.");
        return;

    }

    const agencyData = {

        fullName: document.getElementById("fullName").value.trim(),
        agencyName: document.getElementById("agencyName").value.trim(),
        email: document.getElementById("email").value.trim(),
        whatsapp: document.getElementById("whatsapp").value.trim(),
        password

    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {

        await registerAgency(agencyData);

        registerScreen.classList.add("hide");
        successScreen.classList.add("show");

    }

    catch (error) {

        console.error("Agency registration failed:", error);

        if (error.code === "auth/email-already-in-use") {

            showToast("That email is already registered.");

        }

        else {

            showToast(error.message || "Registration failed. Please try again.");

        }

    }

    finally {

        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Agency Application";

    }

});
