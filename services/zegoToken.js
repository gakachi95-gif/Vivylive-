// ======================================================
// Vivy 💜 Server — ZEGOCLOUD token issuing
//
// This is the ONLY place a call token is ever minted. The
// Server Secret lives here (env var) and never reaches the
// browser — the frontend only ever receives the short-lived
// token this returns.
// ======================================================

const { generateToken04 } = require("./zegoServerAssistant");

const ZEGO_APP_ID = Number(process.env.ZEGO_APP_ID || 1736781522);
const TOKEN_EFFECTIVE_SECONDS = 3600; // 1 hour — plenty for any single call

function issueZegoToken(userId) {

    const secret = process.env.ZEGO_SERVER_SECRET;

    if (!secret) {

        throw new Error(
            "Missing ZEGO_SERVER_SECRET env var. Set it on the Render service under " +
            "Settings → Environment, using the Server Secret from the ZEGOCLOUD Admin Console " +
            "(Project Management → your project → Basic Configuration)."
        );

    }

    if (secret.length !== 32) {

        throw new Error(`ZEGO_SERVER_SECRET must be exactly 32 characters — got ${secret.length}.`);

    }

    // Basic identity token — no room/privilege payload needed for a
    // straightforward 1:1 call room. If you later want to restrict which
    // room a token can join, pass a payload object with room_id +
    // privilege here (see ZEGOCLOUD's token04 docs) instead of "".
    const result = generateToken04(ZEGO_APP_ID, userId, secret, TOKEN_EFFECTIVE_SECONDS, "");

    if (!result || result.code !== 0 || !result.token) {

        throw new Error(`ZEGOCLOUD token generation failed: ${result?.message || "unknown error"}`);

    }

    return { token: result.token, appId: ZEGO_APP_ID, userId };

}

module.exports = { issueZegoToken, ZEGO_APP_ID };
