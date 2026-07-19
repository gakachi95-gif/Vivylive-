// ======================================================
// Vivy 💜 call-billing.js
//
// Single source of truth for Vivy's call economy, used by
// call.js, audio-call.js, and video-call.js so the three
// screens can never drift out of sync on rates or on how a
// billing tick is written to Firestore.
//
// Rates (per 30-second tick):
//   Audio call → 100 coins from the caller, 50 Diamonds to the host
//   Video call → 150 coins from the caller, 50 Diamonds to the host
//
// Hosts are paid in Diamonds, never raw coins — Diamonds convert
// to money through the weekly agency payroll (admin-payroll.js),
// not spendable directly the way a user's coins are.
// ======================================================

import { db } from "./firebase-config.js";
import {
    doc,
    runTransaction,
    increment,
    collection,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

export const BILLING_RATES = {
    audio: { coins: 100, diamonds: 50 },
    video: { coins: 150, diamonds: 50 }
};

export function getBillingRate(callType) {

    return BILLING_RATES[callType] || BILLING_RATES.audio;

}

// ------------------------------------------------------
// Runs exactly one 30-second billing tick as a single Firestore
// transaction:
//   1. Reads the caller's live coin balance.
//   2. If it's short for this tick, writes NOTHING and reports
//      back so the caller-side screen can end the call.
//   3. Otherwise, atomically: debits the caller, credits the host
//      in Diamonds, updates the call doc's running totals, and
//      writes a dedicated per-tick log entry to "callBillingLogs" —
//      all four in the same transaction, so a crash mid-tick can
//      never debit without crediting (or vice versa).
//
// Returns { charged: true, callerBalanceAfter } or
//         { charged: false, reason: "insufficient-coins" | "caller-not-found" }
// ------------------------------------------------------
export async function runBillingTick({ callId, callerUid, hostUid, callType }) {

    const rate = getBillingRate(callType);

    const callerRef = doc(db, "accounts", callerUid);
    const hostRef = doc(db, "hosts", hostUid);
    const callRef = doc(db, "calls", callId);
    const logRef = doc(collection(db, "callBillingLogs"));

    return runTransaction(db, async (tx) => {

        const callerSnap = await tx.get(callerRef);

        if (!callerSnap.exists()) {

            return { charged: false, reason: "caller-not-found" };

        }

        const currentCoins = Number(callerSnap.data().coins || 0);

        if (currentCoins < rate.coins) {

            return { charged: false, reason: "insufficient-coins", currentCoins };

        }

        const callerBalanceAfter = currentCoins - rate.coins;

        tx.update(callerRef, { coins: callerBalanceAfter });

        tx.update(hostRef, {
            diamonds: increment(rate.diamonds),
            weeklyDiamonds: increment(rate.diamonds),
            todayEarnings: increment(rate.diamonds),
            totalDiamondsEarned: increment(rate.diamonds)
        });

        tx.update(callRef, {
            coinsSpent: increment(rate.coins),
            diamondsEarned: increment(rate.diamonds),
            lastBilling: serverTimestamp()
        });

        tx.set(logRef, {

            callId,
            callerUid,
            hostUid,
            callType,
            coinsDeducted: rate.coins,
            diamondsCredited: rate.diamonds,
            callerBalanceAfter,
            createdAt: serverTimestamp()

        });

        return { charged: true, callerBalanceAfter };

    });

}
