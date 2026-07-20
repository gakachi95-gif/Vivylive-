// ======================================================
// Vivy 💜 Server — POST /verify-payment
//
// Same route, same job as before the Flutterwave migration:
// take a client-supplied transaction reference, verify it
// server-side against the gateway's own API, then credit Coins
// only if that verification succeeds. Only the gateway changed —
// Flutterwave verifies by numeric transaction_id (not the
// tx_ref string), so that's what the frontend now sends here.
//
//   invalid-argument     -> 400
//   failed-precondition  -> 422
//   unauthenticated       -> 401 (handled by requireFirebaseAuth)
// ======================================================

const express = require("express");
const { requireFirebaseAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { verifyWithFlutterwave } = require("../services/flutterwave");
const { processVerifiedPayment } = require("../services/firestore");

const router = express.Router();

router.post("/verify-payment", requireFirebaseAuth, asyncHandler(async (req, res) => {

    const transactionId = req.body?.transactionId;

    if (!transactionId) {

        return res.status(400).json({ error: "invalid-argument", message: "A transactionId is required." });

    }

    try {

        const flutterwaveData = await verifyWithFlutterwave(transactionId);
        const result = await processVerifiedPayment(flutterwaveData, req.auth.uid);

        res.status(200).json(result);

    }

    catch (error) {

        console.error("verify-payment failed:", error);
        res.status(422).json({ error: "failed-precondition", message: error.message || "Payment could not be verified." });

    }

}));

module.exports = router;
