// ======================================================
// Vivy 💜 Host Registration
// Every Host account requires a valid Agency Invitation —
// either auto-detected from the invite link's ?agency=CODE
// param, or entered manually and verified against Firestore.
// ======================================================

import { getAgencyByCode, registerHost } from "./auth-service.js";
import { getUrlParam, goBack, showToast } from "./ui-helpers.js";

let verifiedAgency = null;

const agencyBanner = document.getElementById("agencyBanner");
const agencyNameLabel = document.getElementById("agencyNameLabel");
const noInviteNotice = document.getElementById("noInviteNotice");
const manualEntryCard = document.getElementById("manualEntryCard");
const codeEntryRow = document.getElementById("codeEntryRow");
const codeError = document.getElementById("codeError");
const agencyCodeInput = document.getElementById("agencyCodeInput");
const verifyCodeBtn = document.getElementById("verifyCodeBtn");

const hostForm = document.getElementById("hostForm");
const lockedAgencyCode = document.getElementById("lockedAgencyCode");
const submitBtn = document.getElementById("submitBtn");

const registerScreen = document.getElementById("registerScreen");
const successScreen = document.getElementById("successScreen");
const successAgencyName = document.getElementById("successAgencyName");

document.getElementById("backBtn").addEventListener("click", () => goBack("auth.html?role=host"));
document.getElementById("continueBtn").addEventListener("click", () => window.location.href = "host-pending.html");

init();

async function init() {

    const agencyParam = getUrlParam("agency");

    if (agencyParam) {

        const agency = await getAgencyByCode(agencyParam);

        if (agency) {

            lockToAgency(agency);
            return;

        }

        // Bad/expired link — fall back to manual entry with an error shown.
        noInviteNotice.classList.add("show");
        manualEntryCard.classList.add("show");
        codeError.textContent = "Invalid Agency Invitation Code.";
        codeError.classList.add("show");

    }

    else {

        noInviteNotice.classList.add("show");

    }

    verifyCodeBtn.addEventListener("click", handleManualVerify);
    agencyCodeInput.addEventListener("keydown", (event) => {

        if (event.key === "Enter") {

            event.preventDefault();
            handleManualVerify();

        }

    });

}

async function handleManualVerify() {

    const code = agencyCodeInput.value.trim();

    if (!code) {

        return;

    }

    verifyCodeBtn.disabled = true;
    verifyCodeBtn.textContent = "Verifying…";

    try {

        const agency = await getAgencyByCode(code);

        if (!agency) {

            codeError.classList.add("show");
            return;

        }

        codeError.classList.remove("show");
        lockToAgency(agency);

    }

    catch (error) {

        console.error("Agency lookup failed:", error);
        showToast("Couldn't verify that code right now.");

    }

    finally {

        verifyCodeBtn.disabled = false;
        verifyCodeBtn.textContent = "Verify";

    }

}

function lockToAgency(agency) {

    verifiedAgency = agency;

    agencyNameLabel.textContent = agency.agencyName;
    agencyBanner.classList.add("show");

    noInviteNotice.classList.remove("show");
    codeEntryRow.classList.add("hide");

    lockedAgencyCode.value = agency.invitationCode;

    hostForm.classList.add("show");

}

hostForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!verifiedAgency) {

        showToast("Please verify an Agency Invitation Code first.");
        return;

    }

    const password = document.getElementById("password").value;

    if (password.length < 6) {

        showToast("Password must be at least 6 characters.");
        return;

    }

    const hostData = {

        fullName: document.getElementById("fullName").value.trim(),
        username: document.getElementById("username").value.trim(),
        email: document.getElementById("email").value.trim(),
        password,
        country: document.getElementById("country").value,
        gender: document.getElementById("gender").value,
        dob: document.getElementById("dob").value,
        agencyInvitationCode: verifiedAgency.invitationCode

    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {

        const result = await registerHost(hostData);

        successAgencyName.textContent = result.agencyName;
        registerScreen.style.display = "none";
        successScreen.classList.add("show");

    }

    catch (error) {

        console.error("Host registration failed:", error);

        if (error.code === "auth/email-already-in-use") {

            showToast("That email is already registered.");

        }

        else {

            showToast(error.message || "Registration failed. Please try again.");

        }

    }

    finally {

        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Host Application";

    }

});
