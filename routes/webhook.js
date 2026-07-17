// ======================================================
// Vivy 💜 Server — POST /paystack-webhook
//
// Direct Express equivalent of the original
// exports.paystackWebhook onRequest() handler. Same signature
// check, same "only react to charge.success", same
// processVerifiedPayment() call, same "always 200 back to
// Paystack so it doesn't hammer-retry a permanently invalid
// event" behavior.
//
// Configure this exact URL in the Paystack Dashboard under
// Settings → API Keys & Webhooks:
//   https://<your-render-service>.onrender.com/paystack-webhook
//
// NOTE: this route needs the RAW request body (Buffer) to
// check the signature, not the parsed JSON body — see the
// express.raw() wiring for this path in server.js. Do not put
// express.json() in front of this route.
// ======================================================

const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { isValidWebhookSignature } = require("../services/paystack");
const { processVerifiedPayment } = require("../services/firestore");

const router = express.Router();

router.post("/paystack-webhook", asyncHandler(async (req, res) => {

    const signature = req.headers["x-paystack-signature"];
    const rawBody = req.body; // Buffer — see express.raw() in server.js

    if (!isValidWebhookSignature(rawBody, signature)) {

        console.warn("Rejected webhook call with invalid Paystack signature.");
        return res.status(401).send("Invalid signature.");

    }

    const event = JSON.parse(rawBody.toString("utf8"));

    if (event.event !== "charge.success") {

        // Acknowledge and ignore every other event type.
        return res.status(200).send("Ignored.");

    }

    try {

        await processVerifiedPayment(event.data, null);
        res.status(200).send("OK");

    }

    catch (error) {

        console.error("paystack-webhook processing failed:", error);
        // 200 so Paystack doesn't hammer-retry a permanently invalid
        // event (e.g. an unknown package); real transient failures
        // (Firestore hiccups) are rare enough to handle via logs/alerts.
        res.status(200).send("Processing error logged.");

    }

}));

module.exports = router;
