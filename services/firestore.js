// ======================================================
// Vivy 💜 Server — Firestore service
//
// The Coin-crediting logic here — package lookup, idempotent
// crediting, recharge history shape — is UNCHANGED across the
// Paystack → Flutterwave migration; only the gateway-specific
// field names processVerifiedPayment() reads from were updated
// to Flutterwave's response shape (see the mapping comments
// inside that function). Firebase Admin still authenticates
// with a service account loaded from env vars, same as before.
//
// Collections touched (same as before, nothing new invented):
//   - "coinPackages"  (read only  — owned by admin-coins.js)
//   - "exchangeRates" (read only  — owned by admin-exchange-rates.js)
//   - "accounts"      (coins incremented — same doc every page reads)
//   - "recharges"     (one doc written per successful payment —
//                       same collection admin-transactions.js reads)
// ======================================================

const admin = require("firebase-admin");

// ------------------------------------------------------
// Reads + validates the three service-account env vars before
// ever handing them to admin.credential.cert(). Cloud Functions
// used to get these for free; on Render they're plain env vars,
// and the #1 deploy failure is one of them being missing or a
// mangled private key — which otherwise surfaces as a useless
// "Service account object must contain a string 'project_id'
// property" error deep inside google-auth-library. This throws
// a message that actually says what to fix instead.
// ------------------------------------------------------
function loadServiceAccount() {

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    // Render (like most hosts) stores env vars as single-line
    // strings, so literal "\n" sequences replace real newlines
    // in the private key — this restores them.
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

    const missing = [];
    if (!projectId) missing.push("FIREBASE_PROJECT_ID");
    if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
    if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");

    if (missing.length > 0) {

        throw new Error(
            `Missing Firebase Admin env var(s): ${missing.join(", ")}. ` +
            "Set these on the Render service under Settings → Environment, using the " +
            "values from Firebase Console → Project Settings → Service Accounts → " +
            "Generate new private key."
        );

    }

    if (!privateKey.includes("BEGIN PRIVATE KEY")) {

        throw new Error(
            "FIREBASE_PRIVATE_KEY doesn't look like a PEM key (no 'BEGIN PRIVATE KEY' marker). " +
            "Paste the FULL private_key value from the service account JSON, quotes and all " +
            "— it should start with -----BEGIN PRIVATE KEY-----."
        );

    }

    return { projectId, clientEmail, privateKey };

}

if (!admin.apps.length) {

    admin.initializeApp({
        credential: admin.credential.cert(loadServiceAccount())
    });

}

const db = admin.firestore();

// ======================================================
// Shared verification + crediting logic — SAME idempotent
// transaction, SAME Firestore fields, SAME collections as
// before. Only the shape of the incoming gateway data changed
// (Flutterwave's verify response instead of Paystack's) —
// mapped to the same normalized fields this function has
// always expected.
// Called by both routes/verify.js and routes/webhook.js so a
// given payment is only ever credited once, no matter which
// path reaches it first.
// ======================================================

async function processVerifiedPayment(flutterwaveData, expectedUid) {

    // Flutterwave's own transaction id (flutterwaveData.id) is only
    // used to call the verify API — tx_ref is OUR client-generated
    // reference, and (like Paystack's "reference" before it) doubles
    // as the idempotency key / "recharges" doc ID.
    const reference = flutterwaveData.tx_ref;

    if (!reference) {

        throw new Error("Flutterwave response is missing a tx_ref.");

    }

    if (flutterwaveData.status !== "successful") {

        return { credited: false, reason: "not-successful" };

    }

    const metadata = flutterwaveData.meta || {};
    const uid = metadata.uid || expectedUid;
    const packageId = metadata.packageId;

    if (!uid || !packageId) {

        throw new Error(`Flutterwave meta missing uid/packageId for tx_ref ${reference}.`);

    }

    if (expectedUid && uid !== expectedUid) {

        throw new Error(`Reference ${reference} does not belong to the calling user.`);

    }

    // The package price is ALWAYS re-read from Firestore here —
    // the amount the client displayed is never trusted.
    const packageSnap = await db.collection("coinPackages").doc(packageId).get();

    if (!packageSnap.exists || packageSnap.data().enabled === false) {

        throw new Error(`Coin package ${packageId} is invalid or disabled.`);

    }

    const pkg = packageSnap.data();
    const totalCoins = Number(pkg.coins || 0) + Number(pkg.bonus || 0);

    if (totalCoins <= 0) {

        throw new Error(`Coin package ${packageId} resolves to zero coins.`);

    }

    // Idempotent credit: the reference itself is the Firestore doc ID
    // inside "recharges", so a second call (webhook AND /verify-payment
    // both firing, or a retried webhook) can never double-credit — the
    // transaction below simply finds the doc already exists and stops.
    const rechargeRef = db.collection("recharges").doc(reference);
    const accountRef = db.collection("accounts").doc(uid);

    const result = await db.runTransaction(async (tx) => {

        const existing = await tx.get(rechargeRef);

        if (existing.exists) {

            return { alreadyProcessed: true };

        }

        tx.set(rechargeRef, {
            uid,
            reference,
            packageId,
            coins: pkg.coins,
            bonus: pkg.bonus || 0,
            totalCoins,
            priceUsd: pkg.priceUsd,
            // Flutterwave reports amount in whole currency units already
            // (Paystack reported kobo/cents, hence the old "/ 100") —
            // this field's meaning ("amount actually paid") is unchanged.
            amountPaid: flutterwaveData.amount || 0,
            currency: flutterwaveData.currency || "USD",
            country: metadata.country || null,
            exchangeRateUsed: metadata.exchangeRateUsed || null,
            gateway: "flutterwave",
            status: "success",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        tx.update(accountRef, {
            coins: admin.firestore.FieldValue.increment(totalCoins)
        });

        return { alreadyProcessed: false };

    });

    if (result.alreadyProcessed) {

        console.log(`Reference ${reference} already credited — skipping duplicate.`);
        return { credited: false, reason: "duplicate", totalCoins };

    }

    console.log(`Credited ${totalCoins} coins to ${uid} for reference ${reference}.`);
    return { credited: true, totalCoins };

}

module.exports = { admin, db, processVerifiedPayment };
