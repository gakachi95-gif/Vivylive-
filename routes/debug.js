// ======================================================
// Vivy 💜 Server — TEMPORARY debug route
//
// Diagnoses malformed FIREBASE_* env vars on Render without
// printing the actual secret values anywhere. Hit:
//
//   GET https://<your-render-service>.onrender.com/debug-env
//
// Delete this file and its require()/app.use() lines in
// server.js once your env vars check out — this should never
// ship in a real production deploy.
// ======================================================

const express = require("express");
const router = express.Router();

function inspectPlainVar(name) {

    const raw = process.env[name];

    if (raw === undefined) {

        return { name, present: false };

    }

    return {
        name,
        present: true,
        length: raw.length,
        hasLeadingOrTrailingWhitespace: raw !== raw.trim(),
        startsOrEndsWithQuote: raw.startsWith('"') || raw.endsWith('"'),
        looksLikeItIncludesTheJsonKeyName: raw.includes(":") || raw.includes("{"),
        value: raw // project_id + client_email aren't secret — already visible in firebase-config.js
    };

}

function inspectPrivateKey() {

    const raw = process.env.FIREBASE_PRIVATE_KEY;

    if (raw === undefined) {

        return { name: "FIREBASE_PRIVATE_KEY", present: false };

    }

    const converted = raw.replace(/\\n/g, "\n");

    return {
        name: "FIREBASE_PRIVATE_KEY",
        present: true,
        rawLength: raw.length,
        hasLeadingOrTrailingWhitespace: raw !== raw.trim(),
        startsOrEndsWithQuote: raw.startsWith('"') || raw.endsWith('"'),
        looksLikeItIncludesTheJsonKeyName: raw.trimStart().startsWith('"private_key"') || raw.trimStart().startsWith("private_key"),
        looksLikeWholeJsonFile: raw.trim().startsWith("{"),
        containsLiteralBackslashN: raw.includes("\\n"),
        containsRealNewlines: raw.includes("\n"),
        afterNewlineConversion_startsWithBeginMarker: converted.trimStart().startsWith("-----BEGIN PRIVATE KEY-----"),
        afterNewlineConversion_endsWithEndMarker: converted.trim().endsWith("-----END PRIVATE KEY-----"),
        // Boilerplate header/footer only — never the key body itself.
        first40Chars: raw.slice(0, 40),
        last40Chars: raw.slice(-40)
    };

}

router.get("/debug-env", (req, res) => {

    res.status(200).json({
        note: "TEMPORARY diagnostic route — remove before going live.",
        FIREBASE_PROJECT_ID: inspectPlainVar("FIREBASE_PROJECT_ID"),
        FIREBASE_CLIENT_EMAIL: inspectPlainVar("FIREBASE_CLIENT_EMAIL"),
        FIREBASE_PRIVATE_KEY: inspectPrivateKey(),
        FLW_SECRET_KEY_present: !!process.env.FLW_SECRET_KEY,
        FLW_WEBHOOK_SECRET_HASH_present: !!process.env.FLW_WEBHOOK_SECRET_HASH
    });

});

module.exports = router;
