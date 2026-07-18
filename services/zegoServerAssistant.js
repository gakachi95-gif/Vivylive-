// ======================================================
// Vivy 💜 Server — ZEGOCLOUD token04 helper
//
// ⚠️  REPLACE THIS FILE before deploying.
//
// token04 is ZEGOCLOUD's proprietary binary token format (AES
// encryption + a specific byte layout for version/expire/iv/
// ciphertext). Getting a single byte of that layout wrong
// produces a token that LOOKS fine but silently fails to
// authenticate — there's no useful error, calls just never
// connect. Because of that, this file deliberately does NOT
// contain a from-scratch reimplementation of the algorithm.
//
// Instead:
//   1. Go to https://github.com/ZEGOCLOUD/zego_server_assistant
//   2. Open token/nodejs/server/zegoServerAssistant.js
//   3. Copy that file's contents into this file, replacing
//      everything below this comment block.
//
// It exports exactly one function this project uses:
//
//   generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload)
//     -> { token, code, message } (per ZEGOCLOUD's own README —
//        check `code === 0` before trusting `.token`)
//
// routes/zego.js and services/zegoToken.js already call it with
// that exact signature, so once this file is swapped in, nothing
// else needs to change.
// ======================================================

function generateToken04() {

    throw new Error(
        "zegoServerAssistant.js is a placeholder — copy the real file from " +
        "https://github.com/ZEGOCLOUD/zego_server_assistant (token/nodejs/server/zegoServerAssistant.js) " +
        "before calling /zego-token."
    );

}

module.exports = { generateToken04 };
