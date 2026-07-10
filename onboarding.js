// ======================================================
// Vivy 💜 Onboarding
// Handles Registration Page Only
// ======================================================

import { registerUser } from "./auth-service.js";

const form = document.getElementById("onboardingForm");

if (form) {

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const password =
            document.getElementById("password").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        if (password !== confirmPassword) {

            alert("Passwords do not match.");

            return;

        }

        const userData = {

            username:
                document
                    .getElementById("username")
                    .value
                    .trim(),

            email:
                document
                    .getElementById("email")
                    .value
                    .trim(),

            country:
                document
                    .getElementById("country")
                    .value,

            gender:
                document
                    .getElementById("gender")
                    .value,

            dob:
                document
                    .getElementById("dob")
                    .value,

            password

        };

        try {

            await registerUser(userData);

            alert("💜 Account created successfully.");

            window.location.href =
                "user-dashboard.html";

        }

        catch (error) {

            console.error(error);

            alert(error.message);

        }

    });

    }
