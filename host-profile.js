// ======================================================
// Vivy 💜 Host Edit Profile
// Editable: photo, cover photo, display name, bio,
// languages, country. Read-only: UID, Agency Name,
// Agency ID, Invitation Code — Hosts cannot change Agency.
// ======================================================

import { hostSessionReady } from "./host-guard.js";
import { db, storage } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";
import { goBack, showToast } from "./ui-helpers.js";

let currentUser = null;
let currentHost = null;

const avatarPhotoEl = document.getElementById("avatarPhoto");
const coverPhotoEl = document.getElementById("coverPhoto");
const saveBtn = document.getElementById("saveBtn");

document.getElementById("backBtn").addEventListener("click", () => goBack("host-dashboard.html"));

document.getElementById("avatarEditBtn").addEventListener("click", () => document.getElementById("avatarInput").click());
document.getElementById("coverEditBtn").addEventListener("click", () => document.getElementById("coverInput").click());

document.getElementById("avatarInput").addEventListener("change", (e) => {

    const file = e.target.files[0];
    if (file) uploadPhoto(file, "profilePhoto", avatarPhotoEl, 500, 500);
    e.target.value = "";

});

document.getElementById("coverInput").addEventListener("change", (e) => {

    const file = e.target.files[0];
    if (file) uploadPhoto(file, "coverPhoto", coverPhotoEl, 1200, 500);
    e.target.value = "";

});

document.getElementById("profileForm").addEventListener("submit", saveProfile);

init();

async function init() {

    const session = await hostSessionReady;
    if (!session) return;

    currentUser = session.user;
    currentHost = session.host;

    // Pull the freshest copy in case another tab/device changed it.
    const snap = await getDoc(doc(db, "hosts", currentUser.uid));
    if (snap.exists()) currentHost = snap.data();

    render(currentHost);

}

function render(host) {

    avatarPhotoEl.src = host.profilePhoto || "assets/default-avatar.png";
    avatarPhotoEl.classList.remove("skeleton");

    coverPhotoEl.src = host.coverPhoto || "assets/default-cover.jpg";
    coverPhotoEl.classList.remove("skeleton");

    document.getElementById("displayNameInput").value = host.username || "";
    document.getElementById("bioInput").value = host.bio || "";
    document.getElementById("languagesInput").value = (host.languages || []).join(", ");
    document.getElementById("countryInput").value = host.country || "";

    document.getElementById("hostUidVal").textContent = currentUser.uid.slice(0, 12) + "…";
    document.getElementById("agencyNameVal").textContent = host.agencyName || "—";
    document.getElementById("agencyIdVal").textContent = host.agencyId || "—";
    document.getElementById("invitationCodeVal").textContent = host.agencyInvitationCode || "—";

}

async function uploadPhoto(file, field, imgEl, maxWidth, maxHeight) {

    if (!file.type.startsWith("image/")) {

        showToast("Please choose an image file.");
        return;

    }

    const previousSrc = imgEl.src;

    try {

        const compressedBlob = await compressImage(file, maxWidth, maxHeight, 0.85);

        const localPreviewUrl = URL.createObjectURL(compressedBlob);
        imgEl.src = localPreviewUrl;
        imgEl.classList.remove("skeleton");

        const filePath = `hosts/${currentUser.uid}/${field}_${Date.now()}.jpg`;
        const storageRef = ref(storage, filePath);

        const uploadTask = uploadBytesResumable(storageRef, compressedBlob, { contentType: "image/jpeg" });

        await new Promise((resolve, reject) => {

            uploadTask.on("state_changed", null, reject, resolve);

        });

        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

        await updateDoc(doc(db, "hosts", currentUser.uid), { [field]: downloadUrl });

        imgEl.src = downloadUrl;
        URL.revokeObjectURL(localPreviewUrl);

        showToast("Photo updated 💜");

    }

    catch (error) {

        console.error(`Failed to upload ${field}:`, error);
        imgEl.src = previousSrc;
        showToast("Upload failed — please try again.");

    }

}

async function saveProfile(e) {

    e.preventDefault();

    const displayName = document.getElementById("displayNameInput").value.trim();
    const bio = document.getElementById("bioInput").value.trim();
    const country = document.getElementById("countryInput").value.trim();

    const languages = document.getElementById("languagesInput").value
        .split(",")
        .map((lang) => lang.trim())
        .filter(Boolean);

    if (!displayName || !country) {

        showToast("Display name and country are required.");
        return;

    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {

        await updateDoc(doc(db, "hosts", currentUser.uid), {
            username: displayName,
            bio,
            country,
            languages
        });

        showToast("Profile saved 💜");

    }

    catch (error) {

        console.error("Failed to save profile:", error);
        showToast("Couldn't save changes — please try again.");

    }

    finally {

        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";

    }

}

// Downscale + re-encode an image client-side before upload.
function compressImage(file, maxWidth, maxHeight, quality) {

    return new Promise((resolve, reject) => {

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {

            let { width, height } = img;

            if (width > maxWidth || height > maxHeight) {

                const scale = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);

            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {

                URL.revokeObjectURL(objectUrl);

                if (blob) resolve(blob);
                else reject(new Error("Image compression failed."));

            }, "image/jpeg", quality);

        };

        img.onerror = () => {

            URL.revokeObjectURL(objectUrl);
            reject(new Error("Could not read image file."));

        };

        img.src = objectUrl;

    });

}
