// ======================================================
// Vivy 💜 Server — Paystack service
// Same verifyWithPaystack() logic the Cloud Function used,
// plus the webhook signature check that lived inline in
// paystackWebhook — pulled out here so routes/webhook.js can
// call it directly.
// ======================================================

const crypto = require("crypto");

const PAYSTACK_VERIFY_URL = "https://api.paystack.co/transaction/verify/";

async function verifyWithPaystack(reference) {

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    const response = await fetch(PAYSTACK_VERIFY_URL + encodeURIComponent(reference), {
        headers: { Authorization: `Bearer ${secretKey}` }
    });

    const json = await response.json();

    if (!response.ok || !json.status) {

        throw new Error(`Paystack verification failed for ${reference}: ${json.message || response.status}`);

    }

    return json.data;

}

// Paystack signs webhook payloads with an HMAC SHA512 of the raw
// request body. It signs using the account's secret key — Paystack
// has no separate "webhook secret" concept, but PAYSTACK_WEBHOOK_SECRET
// is supported here too in case the account is later switched to a
// distinct signing secret, so nothing else has to change.
function isValidWebhookSignature(rawBody, signatureHeader) {

    const secretKey = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;

    if (!signatureHeader || !secretKey) return false;

    const expectedSignature = crypto
        .createHmac("sha512", secretKey)
        .update(rawBody)
        .digest("hex");

    // Constant-time compare — a plain === comparison would leak timing
    // information an attacker could use to forge a valid signature.
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(signatureHeader, "utf8");

    if (expectedBuffer.length !== receivedBuffer.length) return false;

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

}

module.exports = { verifyWithPaystack, isValidWebhookSignature };
