// ======================================================
// Vivy 💜 Server — Auth middleware
//
// onCall() used to hand handlers a ready-made request.auth.
// A plain Express route doesn't get that for free, so this
// verifies the same Firebase ID token the client already has
// (from currentUser.getIdToken() on the frontend) and attaches
// the decoded uid the exact same way request.auth.uid did.
// ======================================================

const { admin } = require("../services/firestore");

async function requireFirebaseAuth(req, res, next) {

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {

        return res.status(401).json({ error: "unauthenticated", message: "You must be signed in to verify a payment." });

    }

    try {

        const decoded = await admin.auth().verifyIdToken(idToken);
        req.auth = { uid: decoded.uid };
        next();

    }

    catch (error) {

        console.error("Failed to verify Firebase ID token:", error);
        res.status(401).json({ error: "unauthenticated", message: "Your session has expired — please sign in again." });

    }

}

module.exports = { requireFirebaseAuth };
