// ======================================================
// Vivy 💜 Login
// Handles Login Page Only
// ======================================================

import { loginUser, getHostProfile } from "./auth-service.js";

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

            const user = await loginUser(email, password);

            // Every Host belongs to an Agency and lives in the "hosts"
            // collection. If this uid has a Host document, route them
            // there — Hosts are never sent to the User Dashboard.
            const host = await getHostProfile(user.uid);

            if (host) {

                window.location.href =
                    host.status === "approved"
                        ? "host-dashboard.html"
                        : "host-pending.html";

                return;

            }

            window.location.href =
                "user-dashboard.html";

        }

        catch (error) {

            console.error(error);

            alert(error.message);

        }

    });

}
