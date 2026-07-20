// ======================================================
// Vivy 💜 Server — server.js
// Express replacement for the Firebase Cloud Functions
// runtime. Business logic is unchanged (see services/firestore.js
// and services/flutterwave.js) — this file only wires HTTP routing,
// CORS, and body parsing.
// ======================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const debugRoute = require("./routes/debug");

const app = express();

// ------------------------------------------------------
// CORS — GitHub Pages is a cross-origin caller of this API.
// Set ALLOWED_ORIGIN to your Pages URL (e.g.
// https://your-username.github.io) in Render's environment
// variables to lock this down; left unset, every origin is
// allowed so local development / previewing keeps working.
// ------------------------------------------------------
const allowedOrigin = process.env.ALLOWED_ORIGIN;

app.use(cors({
    origin: allowedOrigin || true,
    methods: ["GET", "POST"]
}));

// ------------------------------------------------------
// Body parsing.
// /flutterwave-webhook needs the RAW bytes to check Flutterwave's
// verif-hash header, so it gets express.raw() instead of
// express.json() and is wired up BEFORE the global json parser —
// Express body parsers only run for routes that haven't already
// been consumed, so ordering here matters.
// ------------------------------------------------------
app.use("/flutterwave-webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// ------------------------------------------------------
// Routes
// ------------------------------------------------------
app.get("/health", (req, res) => {

    res.status(200).json({ status: "ok", service: "vivy-payment-server", time: new Date().toISOString() });

});

// TEMPORARY — see routes/debug.js. Delete this line + the file
// once your Render env vars are confirmed correct.
app.use(debugRoute);

// ------------------------------------------------------
// /verify-payment and /flutterwave-webhook both need Firebase
// Admin (via services/firestore.js), which throws immediately
// if FIREBASE_* env vars are missing/malformed. That require()
// is wrapped here so a bad credential disables ONLY these two
// routes with a clear 503 message, instead of crashing the
// entire process before Express can even start listening —
// which is what previously made /health and /debug-env
// unreachable exactly when you needed them to diagnose this.
// ------------------------------------------------------
try {

    const verifyRoute = require("./routes/verify");
    const webhookRoute = require("./routes/webhook");

    app.use(verifyRoute);
    app.use(webhookRoute);

}

catch (error) {

    console.error("Payment routes disabled — Firebase Admin failed to initialize:", error.message);

    const unavailable = (req, res) => {

        res.status(503).json({
            error: "server-misconfigured",
            message: "Payment routes are unavailable: " + error.message
        });

    };

    app.post("/verify-payment", unavailable);
    app.post("/flutterwave-webhook", unavailable);

}

// ------------------------------------------------------
// /zego-token needs Firebase Admin (for requireFirebaseAuth)
// same as the payment routes above, so it gets the same
// try/catch treatment — a missing/bad Firebase credential
// disables just this route with a clear 503 instead of
// crashing the whole process.
// ------------------------------------------------------
try {

    const zegoRoute = require("./routes/zego");
    app.use(zegoRoute);

}

catch (error) {

    console.error("Zego route disabled:", error.message);

    app.post("/zego-token", (req, res) => {

        res.status(503).json({
            error: "server-misconfigured",
            message: "Call token issuing is unavailable: " + error.message
        });

    });

}

// ------------------------------------------------------
// 404 + error handling
// ------------------------------------------------------
app.use((req, res) => {

    res.status(404).json({ error: "not-found", message: `No route for ${req.method} ${req.path}` });

});

app.use((error, req, res, next) => {

    console.error("Unhandled server error:", error);
    res.status(500).json({ error: "internal", message: "Something went wrong." });

});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {

    console.log(`Vivy payment server listening on port ${PORT}`);

});

module.exports = app;
