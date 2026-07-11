// ======================================================
// Vivy 💜 Shared UI helpers
// Small utilities reused across the lightweight pages
// (profile, wallet, buy-coins, recharge, messages, etc.)
// ======================================================

let toastTimer = null;

export function showToast(message, duration = 2200) {

    let toastEl = document.querySelector(".vivy-toast");

    if (!toastEl) {

        toastEl = document.createElement("div");
        toastEl.className = "vivy-toast";
        document.body.appendChild(toastEl);

    }

    toastEl.textContent = message;

    // Force reflow so re-triggering the animation works on repeat calls.
    void toastEl.offsetWidth;

    toastEl.classList.add("show");

    if (toastTimer) {

        clearTimeout(toastTimer);

    }

    toastTimer = setTimeout(() => {

        toastEl.classList.remove("show");

    }, duration);

}

export function formatNumber(value) {

    return Number(value ?? 0).toLocaleString();

}

export function formatCoins(value) {

    return `${formatNumber(value)} coins`;

}

export function getUrlParam(name) {

    return new URLSearchParams(window.location.search).get(name);

}

export function goBack(fallbackUrl = "user-dashboard.html") {

    if (window.history.length > 1) {

        window.history.back();

    }

    else {

        window.location.href = fallbackUrl;

    }

}
