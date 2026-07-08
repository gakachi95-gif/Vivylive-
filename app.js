console.log('%cVivyLive 💜 initialized', 'color:#5B2EFF;font-size:16px;font-weight:bold');

let currentUser = null;

window.onload = function() {
    setTimeout(() => {
        const splash = document.getElementById('splash');
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 800);
        initFirebaseAuth();
    }, 2200);
};

function initFirebaseAuth() {
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            document.getElementById('nav-username').textContent = user.displayName || user.email.split('@')[0];
        }
    });
}

function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    let target = document.getElementById(page + '-page');
    if (!target) {
        target = document.createElement('div');
        target.id = page + '-page';
        target.className = 'page active';
        target.innerHTML = `<h2>${page.charAt(0).toUpperCase() + page.slice(1)} Page</h2><p>Content loading... (Firebase connected)</p>`;
        document.getElementById('app').appendChild(target);
    } else {
        target.classList.add('active');
    }
}

function showProfileMenu() {
    alert('Profile menu - Full UI in production version');
    // Expand to modal with logout, settings etc.
          }
