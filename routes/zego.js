// ======================================================
// Vivy 💜 Server — POST /zego-token
//
// Issues a short-lived ZEGOCLOUD room token for the calling
// screens (call.js, audio-call.js, video-call.js). The ZEGO
// userID is ALWAYS the caller's own Firebase UID, taken from
// the verified ID token (req.auth.uid) — never from the
// request body — so nobody can request a token impersonating
// another account.
// ======================================================

const express = require("express");
const { requireFirebaseAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { issueZegoToken } = require("../services/zegoToken");

const router = express.Router();

router.post("/zego-token", requireFirebaseAuth, asyncHandler(async (req, res) => {

    const roomId = req.body?.roomId;

    if (!roomId || typeof roomId !== "string") {

        return res.status(400).json({ error: "invalid-argument", message: "A roomId is required." });

    }

    try {

        const { token, appId, userId } = issueZegoToken(req.auth.uid);

        res.status(200).json({ token, appId, userId, roomId });

    }

    catch (error) {

        console.error("zego-token failed:", error);
        res.status(422).json({ error: "failed-precondition", message: error.message || "Could not issue a call token." });

    }

}));

module.exports = router;
