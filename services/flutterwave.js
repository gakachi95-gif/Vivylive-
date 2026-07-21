// ======================================================
// Vivy 💜 Server — Flutterwave service
//
// Same role services/paystack.js used to play: server-side
// verification against the gateway's API, plus the webhook
// signature check. routes/verify.js and routes/webhook.js both
// call verifyWithFlutterwave() so a payment is only ever
// trusted after Flutterwave's own API confirms it — never from
// data the client or the webhook payload merely claims.
// ======================================================

const crypto = require("crypto");

const FLW_VERIFY_URL = "https://api.flutterwave.com/v3/transactions/";

// ------------------------------------------------------
// Verifies a transaction by Flutterwave's own numeric
// transaction_id (NOT tx_ref — Flutterwave's v3 "verify"
// endpoint takes the id path param). This is the one call that
// decides whether a payment is real; both routes/verify.js
// (called right after checkout) and routes/webhook.js (called
// when Flutterwave's servers ping us) go through this same
// function so neither path can be tricked by a spoofed client
// response or a spoofed webhook body alone.
// ------------------------------------------------------
async function verifyWithFlutterwave(transactionId) {

    const secretKey = process.env.FLW_SECRET_KEY;

    const response = await fetch(FLW_VERIFY_URL + encodeURIComponent(transactionId) + "/verify", {
        headers: { Authorization: `Bearer ${secretKey}` }
    });

    const json = await response.json();

    if (!response.ok || json.status !== "success") {

        throw new Error(`Flutterwave verification failed for transaction ${transactionId}: ${json.message || response.status}`);

    }

    return json.data; // { id, tx_ref, status, amount, currency, meta, ... }

}

// ------------------------------------------------------
// Flutterwave doesn't HMAC-sign webhook bodies the way Paystack
// does — instead you set an arbitrary "Secret Hash" string in
// the Flutterwave Dashboard (Settings → Webhooks), and every
// webhook call echoes it back verbatim in the "verif-hash"
// header. This checks that header matches what you configured.
//
// This check alone is NOT treated as sufficient proof of a real
// payment — routes/webhook.js still calls verifyWithFlutterwave()
// against Flutterwave's API afterward, per Flutterwave's own
// recommended practice, before crediting anything.
// ------------------------------------------------------
function isValidWebhookSignature(signatureHeader) {

    const expectedHash = process.env.FLW_WEBHOOK_SECRET_HASH;

    if (!signatureHeader || !expectedHash) return false;

    const expectedBuffer = Buffer.from(expectedHash, "utf8");
    const receivedBuffer = Buffer.from(signatureHeader, "utf8");

    // Constant-time compare — a plain === comparison would leak timing
    // information an attacker could use to guess the hash.
    if (expectedBuffer.length !== receivedBuffer.length) return false;

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

}

module.exports = { verifyWithFlutterwave, isValidWebhookSignature };
