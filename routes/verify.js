// ======================================================
// Vivy 💜 Server — POST /verify-payment
//
// Direct Express equivalent of the original
// exports.verifyPaystackTransaction onCall() handler. Same
// steps, same order, same error semantics — just returned as
// HTTP status codes instead of thrown HttpsError codes:
//   unauthenticated      -> 401 (handled by requireFirebaseAuth)
//   invalid-argument     -> 400
//   failed-precondition  -> 422
// ======================================================

const express = require("express");
const { requireFirebaseAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { verifyWithPaystack } = require("../services/paystack");
const { processVerifiedPayment } = require("../services/firestore");

const router = express.Router();

router.post("/verify-payment", requireFirebaseAuth, asyncHandler(async (req, res) => {

    const reference = req.body?.reference;

    if (!reference || typeof reference !== "string") {

        return res.status(400).json({ error: "invalid-argument", message: "A payment reference is required." });

    }

    try {

        const paystackData = await verifyWithPaystack(reference);
        const result = await processVerifiedPayment(paystackData, req.auth.uid);

        res.status(200).json(result);

    }

    catch (error) {

        console.error("verify-payment failed:", error);
        res.status(422).json({ error: "failed-precondition", message: error.message || "Payment could not be verified." });

    }

}));

module.exports = router;
