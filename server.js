// ======================================================
// Vivy 💜 Server — server.js
// Express replacement for the Firebase Cloud Functions
// runtime. Business logic is unchanged (see services/firestore.js
// and services/paystack.js) — this file only wires HTTP routing,
// CORS, and body parsing.
// ======================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const verifyRoute = require("./routes/verify");
const webhookRoute = require("./routes/webhook");
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
// /paystack-webhook needs the RAW bytes to verify Paystack's
// signature, so it gets express.raw() instead of express.json()
// and is wired up BEFORE the global json parser — Express body
// parsers only run for routes that haven't already been
// consumed, so ordering here matters.
// ------------------------------------------------------
app.use("/paystack-webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// ------------------------------------------------------
// Routes
// ------------------------------------------------------
app.get("/health", (req, res) => {

    res.status(200).json({ status: "ok", service: "vivy-payment-server", time: new Date().toISOString() });

});

app.use(verifyRoute);
app.use(webhookRoute);

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
