// Vivy 💜 — call sound controller
//
// One shared module for all four call sounds so the play/stop/loop logic
// lives in exactly one place instead of being copy-pasted into
// audio-call.js, video-call.js, and incoming-call.js.
//
// Usage:
//   import { playOutgoing, playIncoming, stopRingtone, playConnected, playEnd } from "./call-sounds.js";
//
//   playOutgoing();      // caller: start looping while waiting for answer
//   playIncoming();      // receiver: start looping until accept/reject
//   stopRingtone();      // call this the instant status becomes
//                        // "accepted" | "rejected" | "cancelled" | "missed" | "no_answer"
//   playConnected();     // once, right when both sides are actually joined
//   playEnd();           // once, when the call ends for any reason

const SOUND_PATHS = {
    outgoing: "assets/sounds/vivy_outgoing.mp3",
    incoming: "assets/sounds/vivy_incoming.mp3",
    connected: "assets/sounds/vivy_connected.mp3",
    end: "assets/sounds/vivy_end.mp3"
};

// Cache Audio() instances so repeated calls don't re-fetch the file.
const cache = {};

function getAudio(key) {

    if (!cache[key]) {

        const audio = new Audio(SOUND_PATHS[key]);
        audio.preload = "auto";
        cache[key] = audio;

    }

    return cache[key];

}

// Tracks whichever ringtone (outgoing or incoming) is currently playing,
// so stopRingtone() doesn't need to know which one was started.
let activeRingtone = null;

function startRingtone(key) {

    // If the other ringtone is somehow already going (shouldn't normally
    // happen, but guards against a rapid re-call), stop it first so two
    // ringtones never overlap.
    if (activeRingtone && activeRingtone !== key) {

        stopRingtone();

    }

    const audio = getAudio(key);
    audio.loop = true;
    audio.currentTime = 0;

    // play() returns a promise that rejects if the browser blocks
    // autoplay (e.g. no user gesture yet) — swallow that instead of
    // throwing, since the call UI itself doesn't depend on the sound.
    audio.play().catch(() => {});

    activeRingtone = key;

}

export function playOutgoing() {

    startRingtone("outgoing");

}

export function playIncoming() {

    startRingtone("incoming");

}

// Call this the moment call status changes to accepted / rejected /
// cancelled / missed / no_answer / timed_out — i.e. the instant the
// "is anyone still ringing" question is answered, in either direction.
export function stopRingtone() {

    if (!activeRingtone) return;

    const audio = cache[activeRingtone];

    if (audio) {

        audio.pause();
        audio.currentTime = 0;
        audio.loop = false;

    }

    activeRingtone = null;

}

// One-shot sounds — no looping, just play from the start each time.
function playOnce(key) {

    const audio = getAudio(key);
    audio.loop = false;
    audio.currentTime = 0;
    audio.play().catch(() => {});

}

export function playConnected() {

    playOnce("connected");

}

export function playEnd() {

    playOnce("end");

}

// Safety net: if the page is about to navigate away (endCall() redirects
// to a dashboard), make sure nothing keeps looping into the next page's
// audio context on browsers that don't fully tear down media on unload.
window.addEventListener("pagehide", stopRingtone);
