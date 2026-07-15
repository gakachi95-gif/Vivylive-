// ======================================================
// Vivy 💜 Agency — Invite Host
// Displays this Agency's permanent Invitation Code + Link.
// Only Vivy Admin can ever change either value.
// ======================================================

import { agencySessionReady } from "./agency-guard.js";
import { goBack, showToast } from "./ui-helpers.js";

let invitationCode = "";
let invitationLink = "";

document.getElementById("backBtn").addEventListener("click", () => goBack("agency-dashboard.html"));

init();

async function init() {

    const session = await agencySessionReady;
    if (!session) return;

    const { agency } = session;

    invitationCode = agency.invitationCode || "";
    invitationLink = agency.invitationLink || `${window.location.origin}/host-register.html?agency=${invitationCode}`;

    document.getElementById("codeDisplay").textContent = invitationCode || "—";
    document.getElementById("linkDisplay").textContent = invitationLink;

    document.getElementById("copyCodeBtn").addEventListener("click", () => copyText(invitationCode, "Invitation Code copied"));
    document.getElementById("copyLinkBtn").addEventListener("click", () => copyText(invitationLink, "Invitation Link copied"));
    document.getElementById("shareBtn").addEventListener("click", shareInvite);

}

async function copyText(text, successMessage) {

    try {

        await navigator.clipboard.writeText(text);
        showToast(successMessage);

    }

    catch (error) {

        showToast("Couldn't copy — please try again.");

    }

}

async function shareInvite() {

    const shareText = `Join Vivy as a Host through my Agency! Use my invitation code ${invitationCode} or this link: ${invitationLink}`;

    if (navigator.share) {

        try {

            await navigator.share({ title: "Join Vivy as a Host", text: shareText, url: invitationLink });

        }

        catch (error) {

            // share cancelled — no-op

        }

    }

    else {

        await copyText(shareText, "Invite message copied to clipboard");

    }

      }
