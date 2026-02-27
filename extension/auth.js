// StreamSync Authentication Logic

let currentUser = null;

// Initialize Auth safely
let auth;
let db;
try {
    auth = firebase.auth();
    db = firebase.firestore();
} catch (e) {
    console.error("Firebase not initialized properly. Check your config.", e);
}

// References to UI elements (from sidepanel.html)
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const verificationView = document.getElementById('verification-view');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');

// Settings Elements
const settingsView = document.getElementById('settings-view');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const newUsernameInput = document.getElementById('new-username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const usernameCooldownText = document.getElementById('username-cooldown-text');

// Form Actions
const loginBtn = document.getElementById('auth-login-btn');
const signupBtn = document.getElementById('auth-signup-btn');
const logoutBtn = document.getElementById('auth-logout-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const googleSignupBtn = document.getElementById('google-signup-btn');

// Verification Actions
const resendVerificationBtn = document.getElementById('resend-verification-btn');
const checkVerificationBtn = document.getElementById('check-verification-btn');
const switchAccountBtn = document.getElementById('switch-account-btn');

// Inputs
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const displayNameInput = document.getElementById('auth-display-name');

// Toggle Views
if (showSignupBtn && showLoginBtn) {
    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });
}

// Authentication Functions
async function handleLogin() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        if (typeof showToast === 'function') showToast('Please fill in both fields', 'error');
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        if (typeof showToast === 'function') showToast('Successfully logged in!', 'success');
    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
        console.error("Login error:", error);
    }
}

async function handleSignup() {
    const email = document.getElementById('auth-signup-email').value.trim();
    const password = document.getElementById('auth-signup-password').value.trim();
    const displayName = displayNameInput.value.trim();

    if (!email || !password || !displayName) {
        if (typeof showToast === 'function') showToast('Please fill in all fields', 'error');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        // Update user profile with display name
        await userCredential.user.updateProfile({
            displayName: displayName
        });

        // Send verification email
        await userCredential.user.sendEmailVerification();

        if (typeof showToast === 'function') showToast('Successfully signed up! Please check your email.', 'success');

        // Force refresh user state
        await auth.currentUser.reload();

    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
        console.error("Signup error:", error);
    }
}

async function handleGoogleAuth() {
    try {
        if (typeof showToast === 'function') showToast('Authenticating with Google...', 'info');

        // Request an OAuth token from Chrome
        const token = await new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    reject(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Auth interrupted');
                } else {
                    resolve(token);
                }
            });
        });

        // Use the token to sign into Firebase
        const credential = firebase.auth.GoogleAuthProvider.credential(null, token);
        await auth.signInWithCredential(credential);

        if (typeof showToast === 'function') showToast('Successfully logged in with Google!', 'success');

    } catch (error) {
        if (typeof showToast === 'function') showToast(error, 'error');
        console.error("Google Auth error:", error);
    }
}

async function handleResendVerification() {
    if (auth.currentUser) {
        try {
            await auth.currentUser.sendEmailVerification();
            if (typeof showToast === 'function') showToast('Verification email sent again. Check spam!', 'success');
        } catch (error) {
            if (typeof showToast === 'function') showToast(error.message, 'error');
        }
    }
}

async function handleCheckVerification() {
    if (auth.currentUser) {
        await auth.currentUser.reload();

        // Trigger the auth state listener manually to re-evaluate UI
        const isVerified = auth.currentUser.emailVerified;
        if (isVerified) {
            if (typeof showToast === 'function') showToast('Verification successful!', 'success');
            // The observer will catch the reload, but we can force UI update just in case
            evalAuthState(auth.currentUser);
        } else {
            if (typeof showToast === 'function') showToast('Email is not verified yet.', 'error');
        }
    }
}

// --- User Document Management ---
async function ensureUserDocument(user) {
    if (!user) return;

    const userRef = db.collection('users').doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        await userRef.set({
            email: user.email,
            lastUsernameChange: 0 // Allow immediate change
        });
    }
}

// --- Settings & Username Logic ---
if (openSettingsBtn && closeSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
        settingsView.classList.remove('hidden');
        checkUsernameCooldown();
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsView.classList.add('hidden');
    });
}

function getCooldownMs() {
    return 3 * 24 * 60 * 60 * 1000; // 3 Days
}

async function checkUsernameCooldown() {
    if (!currentUser) return;

    usernameCooldownText.style.display = 'none';

    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            const lastChange = data.lastUsernameChange || 0;
            const now = Date.now();
            const timeSince = now - lastChange;

            if (timeSince < getCooldownMs()) {
                const msLeft = getCooldownMs() - timeSince;
                const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
                usernameCooldownText.textContent = `You can change your username in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`;
                usernameCooldownText.style.display = 'block';
                saveUsernameBtn.disabled = true;
                newUsernameInput.disabled = true;
            } else {
                saveUsernameBtn.disabled = false;
                newUsernameInput.disabled = false;
            }
        } else {
            // First time, doc will be created
            saveUsernameBtn.disabled = false;
            newUsernameInput.disabled = false;
        }
    } catch (e) {
        console.error("Error fetching rules:", e);
    }
}

if (saveUsernameBtn) {
    saveUsernameBtn.addEventListener('click', async () => {
        const newName = newUsernameInput.value.trim();
        if (!newName || !currentUser) return;

        saveUsernameBtn.disabled = true;
        saveUsernameBtn.textContent = 'Saving...';

        try {
            await ensureUserDocument(currentUser);

            // Double check cooldown just in case
            const doc = await db.collection('users').doc(currentUser.uid).get();
            const timeSince = Date.now() - (doc.data().lastUsernameChange || 0);

            if (timeSince < getCooldownMs()) {
                if (typeof showToast === 'function') showToast('Cooldown active. Try again later.', 'error');
                return;
            }

            // Update Auth
            await currentUser.updateProfile({ displayName: newName });

            // Update Firestore
            await db.collection('users').doc(currentUser.uid).update({
                lastUsernameChange: Date.now()
            });

            if (typeof showToast === 'function') showToast('Username updated successfully!', 'success');

            // Update UI
            document.getElementById('display-username').textContent = newName;
            authenticatedUsername = newName; // from sidepanel.js

            settingsView.classList.add('hidden');
            newUsernameInput.value = '';

        } catch (error) {
            if (typeof showToast === 'function') showToast(error.message, 'error');
        } finally {
            saveUsernameBtn.textContent = 'Save Content';
        }
    });
}


// Event Listeners
if (loginBtn) loginBtn.addEventListener('click', handleLogin);
if (signupBtn) signupBtn.addEventListener('click', handleSignup);
if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());
if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleAuth);
if (googleSignupBtn) googleSignupBtn.addEventListener('click', handleGoogleAuth);
if (resendVerificationBtn) resendVerificationBtn.addEventListener('click', handleResendVerification);
if (checkVerificationBtn) checkVerificationBtn.addEventListener('click', handleCheckVerification);
if (switchAccountBtn) switchAccountBtn.addEventListener('click', () => auth.signOut());

// Auth State Observer
function evalAuthState(user) {
    currentUser = user;

    if (user) {
        // User is signed in. Check verification.
        if (!user.emailVerified) {
            if (authView) authView.classList.add('hidden');
            if (appView) appView.classList.add('hidden');
            if (verificationView) verificationView.classList.remove('hidden');
            return;
        }

        // User is Verified
        if (authView) authView.classList.add('hidden');
        if (verificationView) verificationView.classList.add('hidden');
        if (appView) appView.classList.remove('hidden');

        // Ensure Firestore doc exists
        ensureUserDocument(user);

        // Provide the display name to the main application
        if (typeof onUserAuthenticated === 'function') {
            const name = user.displayName || user.email.split('@')[0];
            onUserAuthenticated(name, user.uid);
        }
    } else {
        // No user is signed in.
        if (authView) authView.classList.remove('hidden');
        if (appView) appView.classList.add('hidden');
        if (verificationView) verificationView.classList.add('hidden');

        if (typeof onUserLoggedOut === 'function') {
            onUserLoggedOut();
        }
    }
}

if (auth) {
    auth.onAuthStateChanged(evalAuthState);
}
