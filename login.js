// ======================================================
// Vivy 💜 Login
// Handles Login Page Only
// ======================================================

import { loginUser } from "./auth-service.js";

const form = document.getElementById("loginForm");

if (form) {

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email =
            document
                .getElementById("email")
                .value
                .trim();

        const password =
            document.getElementById("password").value;

        try {

            await loginUser(email, password);

            window.location.href =
                "user-dashboard.html";

        }

        catch (error) {

            console.error(error);

            alert(error.message);

        }

    });

}
