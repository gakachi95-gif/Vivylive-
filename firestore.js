// ======================================================
// Vivy 💜 Server — Firestore service
//
// This is a direct port of processVerifiedPayment() from the
// original functions/index.js. The business logic — package
// lookup, idempotent crediting, recharge history shape — is
// UNCHANGED. Only the runtime around it changed: Firebase Admin
// now authenticates with a service account loaded from env vars
// instead of Cloud Functions' automatic credentials.
//
// Collections touched (same as before, nothing new invented):
//   - "coinPackages"  (read only  — owned by admin-coins.js)
//   - "exchangeRates" (read only  — owned by admin-exchange-rates.js)
//   - "accounts"      (coins incremented — same doc every page reads)
//   - "recharges"     (one doc written per successful payment —
//                       same collection admin-transactions.js reads)
// ======================================================

const admin = require("firebase-admin");

if (!admin.apps.length) {

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Render (like most hosts) stores env vars as single-line
            // strings, so literal "\n" sequences replace real newlines
            // in the private key — this restores them.
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
        })
    });

}

const db = admin.firestore();

// ======================================================
// Shared verification + crediting logic — SAME function,
// SAME behavior as the original Cloud Functions version.
// Called by both routes/verify.js and routes/webhook.js so a
// given Paystack reference is only ever credited once, no
// matter which path reaches it first.
// ======================================================

async function processVerifiedPayment(paystackData, expectedUid) {

    const reference = paystackData.reference;

    if (!reference) {

        throw new Error("Paystack response is missing a reference.");

    }

    if (paystackData.status !== "success") {

        return { credited: false, reason: "not-successful" };

    }

    const metadata = paystackData.metadata || {};
    const uid = metadata.uid || expectedUid;
    const packageId = metadata.packageId;

    if (!uid || !packageId) {

        throw new Error(`Paystack metadata missing uid/packageId for reference ${reference}.`);

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
            amountPaid: (paystackData.amount || 0) / 100,
            currency: paystackData.currency || "USD",
            country: metadata.country || null,
            exchangeRateUsed: metadata.exchangeRateUsed || null,
            gateway: "paystack",
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
