// ======================================================
// Vivy 💜 zego-call.js
//
// Thin shared wrapper around the ZEGOCLOUD Express Engine
// (Web). call.js, audio-call.js, and video-call.js all import
// this instead of talking to the SDK directly, so the actual
// join/publish/play plumbing lives in exactly one place.
//
// Loaded as an ES module straight from jsDelivr's "+esm"
// endpoint — no bundler, matching every other file in this
// project (same pattern as the firebase-*.js CDN imports).
//
// ⚠️ SDK API surface note: ZEGOCLOUD's Web SDK method names
// (loginRoom / createZegoStream / startPublishingStream, the
// ZegoExpressEngine constructor signature, etc.) below reflect
// the widely-documented v3 Express Engine API. SDK vendors do
// occasionally rename methods across major versions, so before
// going live, sanity-check this file's calls against the
// current docs for whatever version jsDelivr resolves
// (https://docs.zegocloud.com — Video/Voice Call → Web → API
// reference) and pin an exact version below if anything drifts.
// ======================================================

// Loaded via a plain <script> tag in audio-call.html / video-call.html
// (NOT an ES module import) — the jsDelivr "+esm" auto-conversion of this
// SDK's UMD bundle was unreliable and, when it failed, silently aborted
// this entire module before any code ran (no init(), no button listeners,
// nothing) with zero visible error. Loading the SDK as a classic script
// sets window.ZegoExpressEngine directly, so this file just reads it off
// the global instead of importing it.
const ZegoExpressEngine = window.ZegoExpressEngine;

const ZEGO_APP_ID = 1736781522; // matches server/.env ZEGO_APP_ID
const ZEGO_TOKEN_ENDPOINT = "https://vivylive-payment.onrender.com/zego-token";

let zg = null;
let localStream = null;
let currentRoomId = null;
let currentStreamId = null;

// ------------------------------------------------------
// Asks the Render backend for a room token. Send the caller's
// Firebase ID token, not their uid — the backend derives the
// ZEGO userID itself from that verified token so nobody can
// request a token for an account that isn't theirs.
// ------------------------------------------------------
async function fetchZegoToken(firebaseIdToken, roomId) {

    const response = await fetch(ZEGO_TOKEN_ENDPOINT, {

        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${firebaseIdToken}`
        },
        body: JSON.stringify({ roomId })

    });

    if (!response.ok) {

        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Could not get a call token.");

    }

    return response.json(); // { token, appId, userId, roomId }

}

// ------------------------------------------------------
// Joins a room, publishes the local mic/camera stream, and
// wires up the standard 1:1 call lifecycle callbacks. Call
// this once per call screen, after the callee has accepted
// (or immediately for the caller — ZEGOCLOUD just won't have
// anyone to talk to in the room until the other side joins).
//
//   roomId           - unique per-call room ID (the Firestore "calls" doc ID works well)
//   firebaseIdToken  - from currentUser.getIdToken()
//   userId           - Firebase UID (must be the same account the token was issued to)
//   userName         - display name shown to the other side
//   callType         - "audio" | "video" — "audio" never opens the camera
//   onLocalStream(mediaStream)  - fires once with the local mic/camera stream
//   onRemoteJoined(mediaStream) - fires once the other side's stream arrives
//   onRemoteLeft()              - fires when the other side leaves the room
// ------------------------------------------------------
export async function joinCall({
    roomId,
    firebaseIdToken,
    userId,
    userName,
    callType,
    onLocalStream,
    onRemoteJoined,
    onRemoteLeft
}) {

    const { token } = await fetchZegoToken(firebaseIdToken, roomId);

    zg = new ZegoExpressEngine(ZEGO_APP_ID, "wss://webliveroom-api.zego.im/ws");

    zg.on("roomStreamUpdate", async (roomID, updateType, streamList) => {

        if (roomID !== currentRoomId) return;

        if (updateType === "ADD") {

            for (const stream of streamList) {

                try {

                    const remoteStream = await zg.startPlayingStream(stream.streamID);
                    onRemoteJoined?.(remoteStream);

                }

                catch (error) {

                    console.error("Failed to play remote stream:", error);

                }

            }

        }

        else {

            onRemoteLeft?.();

        }

    });

    zg.on("roomUserUpdate", (roomID, updateType) => {

        // Fine for 1:1 rooms — the only other participant leaving
        // is exactly the case this should fire for.
        if (roomID === currentRoomId && updateType === "DELETE") {

            onRemoteLeft?.();

        }

    });

    currentRoomId = roomId;

    await zg.loginRoom(roomId, token, { userID: userId, userName: userName || userId });

    localStream = await zg.createZegoStream({
        camera: {
            video: callType === "video",
            audio: true
        }
    });

    onLocalStream?.(localStream);

    currentStreamId = `${userId}_${Date.now()}`;
    await zg.startPublishingStream(currentStreamId, localStream);

}

export function setMicMuted(muted) {

    if (localStream) localStream.muteAudio(muted);

}

export function setCameraEnabled(enabled) {

    if (localStream) localStream.muteVideo(!enabled);

}

// ------------------------------------------------------
// Leaves the room and releases everything. Safe to call more
// than once (e.g. from both an explicit "End Call" tap and a
// beforeunload handler) — it's a no-op after the first call.
// ------------------------------------------------------
export async function leaveCall() {

    if (!zg) return;

    try {

        if (currentStreamId) zg.stopPublishingStream(currentStreamId);
        if (localStream) zg.destroyStream(localStream);
        if (currentRoomId) await zg.logoutRoom(currentRoomId);

    }

    catch (error) {

        console.error("Error while leaving ZEGOCLOUD call:", error);

    }

    finally {

        zg = null;
        localStream = null;
        currentRoomId = null;
        currentStreamId = null;

    }

                }
