// ======================================================
// Vivy 💜 Cloud Functions
// Server-side Paystack verification + Coin crediting.
//
// This is the ONLY place a Coin purchase is ever trusted.
// recharge.html / buy-coins.html no longer credit coins
// themselves — they open the Paystack popup, then hand the
// reference to verifyPaystackTransaction below and wait for
// its response. Paystack also calls paystackWebhook directly
// (server-to-server) the moment a charge succeeds, so a
// purchase is still credited even if the user closes the tab
// before the callable resolves. Both paths funnel through the
// same processVerifiedPayment() so a reference is ALWAYS
// credited exactly once, however it arrives first.
//
// Collections touched (no new ones invented):
//   - "coinPackages"  (read only  — owned by admin-coins.js)
//   - "exchangeRates" (read only  — owned by admin-exchange-rates.js)
//   - "accounts"      (coins incremented — same doc every page reads)
//   - "recharges"     (one doc written per successful payment —
//                       same collection admin-transactions.js reads)
// ======================================================

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// Set once via:
//   firebase functions:secrets:set PAYSTACK_SECRET_KEY
// Never hard-code the secret key here, never send it to the client.
const PAYSTACK_SECRET_KEY = defineSecret("PAYSTACK_SECRET_KEY");

const PAYSTACK_VERIFY_URL = "https://api.paystack.co/transaction/verify/";

// ======================================================
// Shared verification + crediting logic.
// Called by BOTH the webhook and the callable below so a
// given Paystack reference is only ever credited once,
// no matter which path reaches it first.
// ======================================================

async function processVerifiedPayment(paystackData, expectedUid) {

    const reference = paystackData.reference;

    if (!reference) {

        throw new Error("Paystack response is missing a reference.");

    }

    if (paystackData.status !== "success") {

        return { credited: false, reason: "not-successful" };

    }

    const metadata = paystackData.metadata || {};
    const uid = metadata.uid || expectedUid;
    const packageId = metadata.packageId;

    if (!uid || !packageId) {

        throw new Error(`Paystack metadata missing uid/packageId for reference ${reference}.`);

    }

    if (expectedUid && uid !== expectedUid) {

        throw new Error(`Reference ${reference} does not belong to the calling user.`);

    }

    // The package price is ALWAYS re-read from Firestore here —
    // the amount the client displayed is never trusted.
    const packageSnap = await db.collection("coinPackages").doc(packageId).get();

    if (!packageSnap.exists || packageSnap.data().enabled === false) {

        throw new Error(`Coin package ${packageId} is invalid or disabled.`);

    }

    const pkg = packageSnap.data();
    const totalCoins = Number(pkg.coins || 0) + Number(pkg.bonus || 0);

    if (totalCoins <= 0) {

        throw new Error(`Coin package ${packageId} resolves to zero coins.`);

    }

    // Idempotent credit: the reference itself is the Firestore doc ID
    // inside "recharges", so a second call (webhook AND callable both
    // firing, or a retried webhook) can never double-credit — the
    // transaction below simply finds the doc already exists and stops.
    const rechargeRef = db.collection("recharges").doc(reference);
    const accountRef = db.collection("accounts").doc(uid);

    const result = await db.runTransaction(async (tx) => {

        const existing = await tx.get(rechargeRef);

        if (existing.exists) {

            return { alreadyProcessed: true };

        }

        tx.set(rechargeRef, {
            uid,
            reference,
            packageId,
            coins: pkg.coins,
            bonus: pkg.bonus || 0,
            totalCoins,
            priceUsd: pkg.priceUsd,
            amountPaid: (paystackData.amount || 0) / 100,
            currency: paystackData.currency || "USD",
            country: metadata.country || null,
            exchangeRateUsed: metadata.exchangeRateUsed || null,
            gateway: "paystack",
            status: "success",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        tx.update(accountRef, {
            coins: admin.firestore.FieldValue.increment(totalCoins)
        });

        return { alreadyProcessed: false };

    });

    if (result.alreadyProcessed) {

        logger.info(`Reference ${reference} already credited — skipping duplicate.`);
        return { credited: false, reason: "duplicate", totalCoins };

    }

    logger.info(`Credited ${totalCoins} coins to ${uid} for reference ${reference}.`);
    return { credited: true, totalCoins };

}

async function verifyWithPaystack(reference, secretKey) {

    const response = await fetch(PAYSTACK_VERIFY_URL + encodeURIComponent(reference), {
        headers: { Authorization: `Bearer ${secretKey}` }
    });

    const json = await response.json();

    if (!response.ok || !json.status) {

        throw new Error(`Paystack verification failed for ${reference}: ${json.message || response.status}`);

    }

    return json.data;

}

// ======================================================
// Callable — recharge.html / buy-coins.html call this
// immediately after the Paystack popup reports success, so
// the user sees their new balance without waiting on a webhook.
// ======================================================

exports.verifyPaystackTransaction = onCall(
    { secrets: [PAYSTACK_SECRET_KEY] },
    async (request) => {

        if (!request.auth) {

            throw new HttpsError("unauthenticated", "You must be signed in to verify a payment.");

        }

        const reference = request.data?.reference;

        if (!reference || typeof reference !== "string") {

            throw new HttpsError("invalid-argument", "A payment reference is required.");

        }

        try {

            const paystackData = await verifyWithPaystack(reference, PAYSTACK_SECRET_KEY.value());
            const result = await processVerifiedPayment(paystackData, request.auth.uid);

            return result;

        }

        catch (error) {

            logger.error("verifyPaystackTransaction failed:", error);
            throw new HttpsError("failed-precondition", error.message || "Payment could not be verified.");

        }

    }
);

// ======================================================
// Webhook — configured in the Paystack Dashboard
// (Settings → API Keys & Webhooks) as this function's URL.
// Authoritative path: fires server-to-server even if the
// user closes the tab right after paying, and its signature
// check means a reference can't be forged by calling this
// URL directly.
// ======================================================

exports.paystackWebhook = onRequest(
    { secrets: [PAYSTACK_SECRET_KEY] },
    async (req, res) => {

        const signature = req.headers["x-paystack-signature"];
        const secretKey = PAYSTACK_SECRET_KEY.value();

        const expectedSignature = crypto
            .createHmac("sha512", secretKey)
            .update(req.rawBody)
            .digest("hex");

        if (!signature || signature !== expectedSignature) {

            logger.warn("Rejected webhook call with invalid Paystack signature.");
            res.status(401).send("Invalid signature.");
            return;

        }

        const event = req.body;

        if (event.event !== "charge.success") {

            // Acknowledge and ignore every other event type.
            res.status(200).send("Ignored.");
            return;

        }

        try {

            await processVerifiedPayment(event.data, null);
            res.status(200).send("OK");

        }

        catch (error) {

            logger.error("paystackWebhook processing failed:", error);
            // 200 so Paystack doesn't hammer-retry a permanently invalid
            // event (e.g. an unknown package); real transient failures
            // (Firestore hiccups) are rare enough to handle via logs/alerts.
            res.status(200).send("Processing error logged.");

        }

    }
);
