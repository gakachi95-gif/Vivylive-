// ======================================================
// Vivy 💜 Server — POST /flutterwave-webhook
//
// Replaces the old /paystack-webhook route. Flutterwave signs
// webhook calls differently than Paystack: instead of an HMAC
// of the body, it echoes back a static "Secret Hash" (that you
// set once in the Flutterwave Dashboard) in the "verif-hash"
// header. This route checks that header, then — per
// Flutterwave's own recommended practice — calls
// verifyWithFlutterwave() against their API using the
// transaction id from the payload before trusting anything in
// it, exactly like routes/verify.js does. Same
// "always 200 back to the gateway so it doesn't hammer-retry a
// permanently invalid event" behavior as before.
//
// Configure this exact URL in the Flutterwave Dashboard under
// Settings → Webhooks:
//   https://<your-render-service>.onrender.com/flutterwave-webhook
//
// NOTE: this route needs the RAW request body (Buffer) — see
// the express.raw() wiring for this path in server.js. Do not
// put express.json() in front of this route.
// ======================================================

const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { verifyWithFlutterwave, isValidWebhookSignature } = require("../services/flutterwave");
const { processVerifiedPayment } = require("../services/firestore");

const router = express.Router();

router.post("/flutterwave-webhook", asyncHandler(async (req, res) => {

    const signature = req.headers["verif-hash"];

    if (!isValidWebhookSignature(signature)) {

        console.warn("Rejected webhook call with invalid Flutterwave verif-hash.");
        return res.status(401).send("Invalid signature.");

    }

    const rawBody = req.body; // Buffer — see express.raw() in server.js
    const event = JSON.parse(rawBody.toString("utf8"));

    if (event.event !== "charge.completed") {

        // Acknowledge and ignore every other event type.
        return res.status(200).send("Ignored.");

    }

    try {

        // Don't trust the webhook payload's amount/status directly —
        // re-verify against Flutterwave's API using its transaction id,
        // same as the /verify-payment path does.
        const verifiedData = await verifyWithFlutterwave(event.data.id);

        await processVerifiedPayment(verifiedData, null);
        res.status(200).send("OK");

    }

    catch (error) {

        console.error("flutterwave-webhook processing failed:", error);
        // 200 so Flutterwave doesn't hammer-retry a permanently invalid
        // event (e.g. an unknown package); real transient failures
        // (Firestore hiccups) are rare enough to handle via logs/alerts.
        res.status(200).send("Processing error logged.");

    }

}));

module.exports = router;
