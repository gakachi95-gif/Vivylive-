// ======================================================
// Vivy 💜 Agency Settings
// Editable: Logo, Agency Name, WhatsApp Number. Read-only:
// Agency UID, Invitation Code, Invitation Link — only Vivy
// Admin can change those. Change Password, Logout.
// ======================================================

import { agencySessionReady } from "./agency-guard.js";
import { auth, db, storage } from "./firebase-config.js";
import { sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";
import { goBack, showToast } from "./ui-helpers.js";

let currentUser = null;
let currentAgency = null;

const logoPhotoEl = document.getElementById("logoPhoto");
const saveBtn = document.getElementById("saveBtn");

document.getElementById("backBtn").addEventListener("click", () => goBack("agency-dashboard.html"));

document.getElementById("logoEditBtn").addEventListener("click", () => document.getElementById("logoInput").click());

document.getElementById("logoInput").addEventListener("change", (e) => {

    const file = e.target.files[0];
    if (file) uploadLogo(file);
    e.target.value = "";

});

document.getElementById("profileForm").addEventListener("submit", saveProfile);
document.getElementById("changePasswordRow").addEventListener("click", changePassword);
document.getElementById("logoutRow").addEventListener("click", logout);

init();

async function init() {

    const session = await agencySessionReady;
    if (!session) return;

    currentUser = session.user;
    currentAgency = session.agency;

    const snap = await getDoc(doc(db, "agencies", currentUser.uid));
    if (snap.exists()) currentAgency = snap.data();

    render(currentAgency);

}

function render(agency) {

    logoPhotoEl.src = agency.logoURL || "assets/default-avatar.png";
    logoPhotoEl.classList.remove("skeleton");

    document.getElementById("agencyNameInput").value = agency.agencyName || "";
    document.getElementById("whatsappInput").value = agency.whatsapp || "";

    document.getElementById("agencyUidVal").textContent = agency.agencyUID || "—";
    document.getElementById("invitationCodeVal").textContent = agency.invitationCode || "—";
    document.getElementById("invitationLinkVal").textContent = agency.invitationLink || "—";

}

async function uploadLogo(file) {

    if (!file.type.startsWith("image/")) {

        showToast("Please choose an image file.");
        return;

    }

    const previousSrc = logoPhotoEl.src;

    try {

        const compressedBlob = await compressImage(file, 400, 400, 0.85);

        const localPreviewUrl = URL.createObjectURL(compressedBlob);
        logoPhotoEl.src = localPreviewUrl;
        logoPhotoEl.classList.remove("skeleton");

        const filePath = `agencies/${currentUser.uid}/logo_${Date.now()}.jpg`;
        const storageRef = ref(storage, filePath);

        const uploadTask = uploadBytesResumable(storageRef, compressedBlob, { contentType: "image/jpeg" });

        await new Promise((resolve, reject) => {

            uploadTask.on("state_changed", null, reject, resolve);

        });

        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

        await updateDoc(doc(db, "agencies", currentUser.uid), { logoURL: downloadUrl });

        logoPhotoEl.src = downloadUrl;
        URL.revokeObjectURL(localPreviewUrl);

        showToast("Logo updated 💜");

    }

    catch (error) {

        console.error("Failed to upload logo:", error);
        logoPhotoEl.src = previousSrc;
        showToast("Upload failed — please try again.");

    }

}

async function saveProfile(e) {

    e.preventDefault();

    const agencyName = document.getElementById("agencyNameInput").value.trim();
    const whatsapp = document.getElementById("whatsappInput").value.trim();

    if (!agencyName || !whatsapp) {

        showToast("Agency name and WhatsApp number are required.");
        return;

    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {

        await updateDoc(doc(db, "agencies", currentUser.uid), {
            agencyName,
            whatsapp
        });

        showToast("Agency profile saved 💜");

    }

    catch (error) {

        console.error("Failed to save agency profile:", error);
        showToast("Couldn't save changes — please try again.");

    }

    finally {

        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";

    }

}

async function changePassword() {

    if (!currentUser?.email) return;

    if (!confirm(`Send a password reset link to ${currentUser.email}?`)) return;

    try {

        await sendPasswordResetEmail(auth, currentUser.email);
        showToast("Password reset link sent to your email 💜");

    }

    catch (error) {

        console.error("Failed to send password reset:", error);
        showToast("Couldn't send the reset link — please try again.");

    }

}

async function logout() {

    if (!confirm("Log out of Vivy?")) return;

    await signOut(auth);
    window.location.href = "agency-login.html";

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
