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
    //
    // NOTE on the return shape: the official generateToken04 does NOT
    // return a { token, code, message } result object. On success it
    // returns the token as a plain string; on any validation failure it
    // THROWS a plain { errorCode, errorMessage } object (not an Error
    // instance). Both cases are handled explicitly below.
    let token;

    try {

        token = generateToken04(ZEGO_APP_ID, userId, secret, TOKEN_EFFECTIVE_SECONDS, "");

    }

    catch (rawError) {

        const message = rawError?.errorMessage || rawError?.message || "unknown error";
        throw new Error(`ZEGOCLOUD token generation failed: ${message}`);

    }

    if (!token || typeof token !== "string") {

        throw new Error("ZEGOCLOUD token generation failed: no token was returned.");

    }

    return { token, appId: ZEGO_APP_ID, userId };

}

module.exports = { issueZegoToken, ZEGO_APP_ID };
