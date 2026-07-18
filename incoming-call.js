// ======================================================
// Vivy 💜 incoming-call.js
//
// Listens for calls ringing in for the signed-in host and
// shows an Accept/Reject modal. The modal is built and styled
// entirely in JS and appended to <body> — nothing in
// host-dashboard.html's markup or CSS needs to change beyond
// adding one <script type="module" src="incoming-call.js">
// tag, so the existing dashboard layout is untouched.
//
// Signaling model: a "ringing" call is just a doc in the same
// "calls" collection call.js/audio-call.js/video-call.js
// already write to — no new collection. The caller creates it
// with status "ringing"; this file updates it to "accepted" or
// "rejected"; the caller's own onSnapshot listener (in the
// call screen) reacts to that.
// ======================================================

import { authReady } from "./auth-guard.js";
import { db } from "./firebase-config.js";
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let modalEl = null;

init();

async function init() {

    const user = await authReady;
    if (!user) return;

    const ringingQuery = query(
        collection(db, "calls"),
        where("hostUid", "==", user.uid),
        where("status", "==", "ringing")
    );

    onSnapshot(ringingQuery, (snap) => {

        snap.docChanges().forEach((change) => {

            if (change.type === "added") {

                showIncomingCall(change.doc.id, change.doc.data());

            }

        });

    });

}

function ensureModal() {

    if (modalEl) return modalEl;

    modalEl = document.createElement("div");
    modalEl.id = "incomingCallModal";
    modalEl.style.cssText =
        "position:fixed;inset:0;z-index:9999;display:none;align-items:center;" +
        "justify-content:center;background:rgba(10,0,20,0.75);backdrop-filter:blur(6px);";

    modalEl.innerHTML = `
        <div style="background:linear-gradient(160deg,#2a0a45,#150522);border:1px solid rgba(190,120,255,0.35);
                    border-radius:24px;padding:28px;max-width:320px;width:88%;text-align:center;
                    box-shadow:0 20px 60px rgba(0,0,0,0.5);font-family:inherit;">
            <div style="font-size:0.8rem;color:#c9a6ff;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;">
                Incoming <span id="incomingCallType"></span> Call
            </div>
            <div style="font-size:1.2rem;font-weight:700;color:#fff;margin-bottom:20px;" id="incomingCallerName">
                Someone
            </div>
            <div style="display:flex;gap:12px;">
                <button id="incomingRejectBtn"
                        style="flex:1;padding:14px;border:none;border-radius:14px;background:#3a1a1a;color:#ff8080;font-weight:600;font-size:0.95rem;">
                    Decline
                </button>
                <button id="incomingAcceptBtn"
                        style="flex:1;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#8b2fd6,#c65bff);color:#fff;font-weight:600;font-size:0.95rem;">
                    Accept
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modalEl);
    return modalEl;

}

function showIncomingCall(callId, call) {

    const modal = ensureModal();

    modal.querySelector("#incomingCallType").textContent = call.callType || "video";
    modal.querySelector("#incomingCallerName").textContent = call.callerName || "Someone";
    modal.style.display = "flex";

    modal.querySelector("#incomingAcceptBtn").onclick = async () => {

        modal.style.display = "none";

        try {

            await updateDoc(doc(db, "calls", callId), {
                status: "accepted",
                acceptedAt: serverTimestamp()
            });

        }

        catch (error) {

            console.error("Failed to accept call:", error);
            return;

        }

        const destination = call.callType === "audio" ? "audio-call.html" : "video-call.html";
        window.location.href = `${destination}?hostUid=${call.hostUid}&callId=${callId}&role=host`;

    };

    modal.querySelector("#incomingRejectBtn").onclick = async () => {

        modal.style.display = "none";

        try {

            await updateDoc(doc(db, "calls", callId), { status: "rejected" });

        }

        catch (error) {

            console.error("Failed to reject call:", error);

        }

    };

}
