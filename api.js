/* =========================================================================
   OPEN JOBS GHANA — SHARED DATA LAYER (api.js)
   ---------------------------------------------------------------------
   Every page (add.html, ads.html, home.html, saved.html) loads this one
   file instead of repeating storage logic. Everything in here currently
   reads/writes localStorage + IndexedDB because there's no live server
   yet — but every function returns a Promise and is called with
   await/.then(), exactly like a real network request would be. So when
   a real backend is ready, only the INSIDE of these functions needs to
   change (swap the localStorage lines for fetch() calls) — nothing in
   the individual pages has to change at all.
   ========================================================================= */

const OpenAPI = (function () {

    // -------------------------------------------------------------------
    // SHARED CONSTANTS — the single source of truth for categories/regions.
    // Every page must use these exact same lists so filtering/matching
    // always lines up, whether an ad was posted from add.html or is being
    // browsed on home.html.
    // -------------------------------------------------------------------

    const CATEGORIES = {
        "Agriculture & Environment": ["Agronomy", "Animal Husbandry", "Horticulture", "Environmental Science", "Farm Management"],
        "Business, Finance & Administration": ["Accounting", "Human Resources", "Banking", "Auditing", "Administrative Assistant", "Business Strategy"],
        "Creative & Media": ["Graphic Design", "UI/UX Design", "Copywriting", "Video Editing", "Photography", "Journalism"],
        "Education & Training": ["Teaching", "Curriculum Design", "Tutoring", "Educational Consulting"],
        "Engineering": ["Civil Engineering", "Mechanical Engineering", "Electrical Engineering", "Chemical Engineering"],
        "Entertainment": ["Acting", "Music Production", "Event Management", "Choreography"],
        "Healthcare": ["Nursing", "General Medicine", "Pharmacy", "Medical Lab Tech", "Public Health"],
        "Information Technology": ["Frontend Development", "Backend Development", "Full Stack Development", "Mobile App Development", "DevOps", "Cybersecurity", "Data Science"],
        "Legal & Government": ["Criminal Law", "Corporate Law", "Paralegal Services", "Public Policy", "Litigation"],
        "Manufacturing, Production & Factory": ["Operations Management", "Quality Assurance", "Machinery Operation", "Assembly Line Tech"],
        "Sales & Marketing": ["Digital Marketing", "SEO Optimization", "Social Media Management", "Sales Strategy", "Brand Management"],
        "Science, Research & Biotechnology": ["Laboratory Analysis", "Biochemistry", "Clinical Research", "Data Analytics"],
        "Security & Protective Services": ["Risk Assessment", "Corporate Guarding", "Cyber Threat Intelligence"],
        "Transport & Logistics": ["Supply Chain Management", "Fleet Logistics", "Warehouse Operations", "Distribution Operations"],
        "Travel & Tour": ["Tour Operations", "Hospitality Management", "Travel Consulting"]
    };

    // Icon file names match exactly what's in /icons/categories/
    const CATEGORY_ICON_PATH = "icons/categories/";
    function getCategoryIcon(categoryName) {
        return `${CATEGORY_ICON_PATH}${categoryName}.png`;
    }

    // Phosphor icon (already loaded via unpkg on every page) for each category —
    // no image files needed. Uses the "ph-<name>" class with the ph.js kit.
    const CATEGORY_ICON_CLASSES = {
        "Agriculture & Environment": "plant",
        "Business, Finance & Administration": "briefcase",
        "Creative & Media": "palette",
        "Education & Training": "graduation-cap",
        "Engineering": "gear-six",
        "Entertainment": "film-slate",
        "Healthcare": "heartbeat",
        "Information Technology": "code",
        "Legal & Government": "scales",
        "Manufacturing, Production & Factory": "factory",
        "Sales & Marketing": "megaphone",
        "Science, Research & Biotechnology": "flask",
        "Security & Protective Services": "shield-check",
        "Transport & Logistics": "truck",
        "Travel & Tour": "airplane-tilt"
    };
    function getCategoryIconClass(categoryName) {
        return CATEGORY_ICON_CLASSES[categoryName] || "squares-four";
    }

    const REGIONS = {
        "Ahafo Region": ["Goaso", "Duayaw Nkwanta", "Mim", "Bechem"],
        "Ashanti Region": ["Kumasi", "Obuasi", "Ejisu", "Konongo", "Mampong", "Bekwai"],
        "Bono East Region": ["Techiman", "Kintampo", "Nkoranza", "Yeji"],
        "Bono Region": ["Sunyani", "Berekum", "Dormaa Ahenkro", "Sampa"],
        "Central Region": ["Cape Coast", "Winneba", "Kasoa", "Elmina", "Agona Swedru"],
        "Eastern Region": ["Koforidua", "Nkawkaw", "Nsawam", "Asamankese", "Somanya"],
        "Greater Accra Region": ["Accra", "Abeka", "Abelemkpe", "Abokobi", "Accra Newtown", "Achimota", "Adenta", "Airport Residential Area", "Amasaman", "Ashaiman", "Ashaley Botwe", "Afienya", "Bortianor", "Burma Camp", "Baatsona", "Cantonments", "Chorkor", "Dansoman", "Dawhennya", "Dodowa", "Dzorwulu", "Darkuman", "Dome", "Gbawe", "Haatso", "Tema", "Sakumono"],
        "North East Region": ["Nalerigu", "Gambaga", "Walewale"],
        "Northern Region": ["Tamale", "Yendi", "Savelugu"],
        "Oti Region": ["Dambai", "Jasikan", "Kete Krachi", "Nkwanta"],
        "Savannah Region": ["Damongo", "Bole", "Salaga"],
        "Upper East Region": ["Bolgatanga", "Navrongo", "Bawku"],
        "Upper West Region": ["Wa", "Lawra", "Tumu"],
        "Volta Region": ["Ho", "Hohoe", "Keta", "Aflao", "Anloga"],
        "Western North Region": ["Sefwi Wiawso", "Bibiani", "Enchi"],
        "Western Region": ["Sekondi-Takoradi", "Tarkwa", "Axim", "Elubo"]
    };

    // -------------------------------------------------------------------
    // USERS & AUTH — single source of truth for the "OPEN_USER_RECORDS"
    // and "OPEN_ACTIVE_SESSION" storage keys. Every page that deals with
    // accounts (login, signup, account, settings, logout) should go
    // through these instead of reading/writing localStorage directly, so
    // there's exactly one place that knows the user-record shape and one
    // place that knows what "logged in" means.
    // -------------------------------------------------------------------

    const USERS_KEY = 'OPEN_USER_RECORDS';
    const SESSION_KEY = 'OPEN_ACTIVE_SESSION';
    const LAST_LOGIN_KEY = 'OPEN_LAST_LOGIN_EMAIL';

    function getAllUsers() {
        return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    }

    function saveAllUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function getSession() {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    }

    function setSession(email) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ email }));
        // Remembered on THIS device only, so the login page can offer a
        // biometric quick sign-in for the person who last actually signed
        // in on it — never used to grant access by itself.
        localStorage.setItem(LAST_LOGIN_KEY, email);
    }

    // Clears the active session. This is the ONLY place that should ever
    // remove OPEN_ACTIVE_SESSION — call this from every "log out" action
    // so a user can never end up redirected to login.html while their old
    // session is still sitting in storage.
    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    async function getCurrentUser() {
        const session = getSession();
        if (!session || !session.email) return null;
        return getAllUsers().find(u => u.email === session.email) || null;
    }

    function getUserByEmail(email) {
        if (!email) return null;
        return getAllUsers().find(u => u.email === email) || null;
    }

    // Builds a circular "first letter of the name" avatar as an inline SVG
    // data URI — usable directly as any <img src="...">, no file needed.
    // This is what shows up whenever someone hasn't uploaded a profile
    // photo, instead of a broken image icon or a placeholder stock photo.
    function getInitialsAvatarDataUri(name) {
        const letter = ((name || '').trim().charAt(0) || '?').toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
            `<circle cx="50" cy="50" r="50" fill="#500E8C"/>` +
            `<text x="50" y="50" font-family="-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" ` +
            `font-size="46" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${letter}</text>` +
            `</svg>`;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    // Convenience wrapper: real photo if they have one, otherwise a
    // letter-avatar built from their name (falls back to username/email
    // if name is missing).
    function getAvatarUrl(user) {
        if (user && user.profilePic) return user.profilePic;
        const name = (user && (user.name || user.username || user.email)) || '?';
        return getInitialsAvatarDataUri(name);
    }

    // Shared password rule used at signup and when changing a password on
    // the account page — one definition means both places can never drift
    // out of sync with each other.
    function validatePassword(password) {
        return (
            /[A-Z]/.test(password) &&
            /[@#$%!&*]/.test(password) &&
            /[0-9]/.test(password) &&
            (password || '').length >= 8
        );
    }

    // Creates a new user record. Returns { ok: true, user } on success, or
    //   { ok: false, reason: 'email_exists' }
    //   { ok: false, reason: 'username_exists' }
    //
    // SECURITY NOTE: this deliberately does NOT call setSession(). Signing
    // up must not itself count as being signed in — the person still has
    // to prove their credentials on login.html once onboarding is done.
    // That extra login step is intentional (per the security review), not
    // a bug.
    function registerUser({ name, email, username, password }) {
        const users = getAllUsers();
        const normalizedEmail = (email || '').trim().toLowerCase();
        const trimmedUsername = (username || '').trim();
        const normalizedUsername = trimmedUsername.toLowerCase();

        if (users.some(u => u.email === normalizedEmail)) {
            return { ok: false, reason: 'email_exists' };
        }
        if (normalizedUsername && users.some(u => (u.username || '').toLowerCase() === normalizedUsername)) {
            return { ok: false, reason: 'username_exists' };
        }

        const newUser = {
            name: (name || '').trim(),
            email: normalizedEmail,
            username: trimmedUsername,
            password: password,
            profilePic: null
        };

        users.push(newUser);
        saveAllUsers(users);

        return { ok: true, user: newUser };
    }

    // Checks credentials against stored users. `identifier` may be either
    // the account's email OR its username — whichever matches wins.
    // Returns:
    //   { ok: true, user }
    //   { ok: false, reason: 'not_found' }
    //   { ok: false, reason: 'wrong_password' }
    function validateLogin(identifier, password) {
        const normalizedIdentifier = (identifier || '').trim().toLowerCase();
        const user = getAllUsers().find(u =>
            u.email === normalizedIdentifier ||
            (u.username && u.username.toLowerCase() === normalizedIdentifier)
        );

        if (!user) return { ok: false, reason: 'not_found' };
        if (user.authProvider === 'google' && !user.password) return { ok: false, reason: 'google_only' };
        if (user.password !== password) return { ok: false, reason: 'wrong_password' };

        setSession(user.email);
        return { ok: true, user };
    }

    // Merges `updates` into the current user's record (e.g. name, username,
    // phone, profilePic, password) and persists it. Returns the updated
    // user, or null if nobody is logged in.
    function updateUser(email, updates) {
        const users = getAllUsers();
        const index = users.findIndex(u => u.email === email);
        if (index === -1) return null;

        users[index] = { ...users[index], ...updates };
        saveAllUsers(users);
        return users[index];
    }

    // Handles "Continue with Google": looks up the account by the email
    // Google gave us; logs in if it exists, creates it if it doesn't.
    // Unlike manual signup (registerUser), this DOES grant a session
    // immediately on creation — the Google popup the person just went
    // through is itself real-time proof of identity, which is exactly
    // the thing the extra "log in again after signup" step exists to
    // require for the password path. There's nothing left to re-prove.
    // Returns { ok: true, user, isNewUser }.
    function loginOrRegisterWithGoogle(profile) {
        const normalizedEmail = (profile.email || '').trim().toLowerCase();
        const users = getAllUsers();
        const existing = users.find(u => u.email === normalizedEmail);

        if (existing) {
            setSession(existing.email);
            return { ok: true, user: existing, isNewUser: false };
        }

        const newUser = {
            name: profile.name || normalizedEmail,
            email: normalizedEmail,
            username: '',
            password: null,
            profilePic: profile.picture || null,
            authProvider: 'google'
        };

        users.push(newUser);
        saveAllUsers(users);
        setSession(normalizedEmail);

        return { ok: true, user: newUser, isNewUser: true };
    }

    // -------------------------------------------------------------------
    // SEARCH HISTORY — up to 5 most-recent searches per user, shown on
    // Home instead of leaving stale text sitting in the search box.
    // -------------------------------------------------------------------

    function getSearchHistoryKey(email) {
        return `OPEN_SEARCH_HISTORY_${email}`;
    }

    function getSearchHistory(email) {
        if (!email) return [];
        return JSON.parse(localStorage.getItem(getSearchHistoryKey(email)) || '[]');
    }

    function addSearchHistoryEntry(email, term) {
        if (!email) return;
        const trimmed = (term || '').trim();
        if (!trimmed) return;
        let history = getSearchHistory(email);
        // Re-searching the same term (any case) bumps it to the top
        // instead of creating a duplicate entry.
        history = history.filter(h => h.toLowerCase() !== trimmed.toLowerCase());
        history.unshift(trimmed);
        history = history.slice(0, 5);
        localStorage.setItem(getSearchHistoryKey(email), JSON.stringify(history));
    }

    function removeSearchHistoryEntry(email, term) {
        if (!email) return;
        let history = getSearchHistory(email);
        history = history.filter(h => h !== term);
        localStorage.setItem(getSearchHistoryKey(email), JSON.stringify(history));
    }

    // Permanently removes a user's account: the user record itself, their
    // active session (if it's them), the ads they've posted, and any
    // "marked as client" tags they created. Conversations they took part
    // in are left alone so the OTHER participant's thread isn't silently
    // broken, but their record is gone, so their name/contact details go
    // with it. Returns { ok: true } or { ok: false, reason: 'no_user' }.
    async function deleteUserAccount(email) {
        const users = getAllUsers();
        const index = users.findIndex(u => u.email === email);
        if (index === -1) return { ok: false, reason: 'no_user' };

        users.splice(index, 1);
        saveAllUsers(users);

        localStorage.removeItem(getAdsKeyForEmail(email));
        localStorage.removeItem(getClientTagsKey(email));

        const session = getSession();
        if (session && session.email === email) {
            clearSession();
        }

        return { ok: true };
    }

    // -------------------------------------------------------------------
    // NOTIFICATIONS — simple on/off preference, shown as a toggle in
    // Settings (replaces the old separate notification.html page).
    // -------------------------------------------------------------------

    const NOTIFICATIONS_KEY = 'OPEN_NOTIFICATIONS_ENABLED';

    function getNotificationsEnabled() {
        const stored = localStorage.getItem(NOTIFICATIONS_KEY);
        return stored === null ? true : stored === 'true'; // on by default
    }

    function setNotificationsEnabled(enabled) {
        localStorage.setItem(NOTIFICATIONS_KEY, enabled ? 'true' : 'false');
    }

    // -------------------------------------------------------------------
    // LANGUAGE — the selected display language preference.
    // -------------------------------------------------------------------

    const LANGUAGE_KEY = 'OPEN_LANGUAGE';

    function getLanguage() {
        return localStorage.getItem(LANGUAGE_KEY) || 'English';
    }

    function setLanguage(language) {
        localStorage.setItem(LANGUAGE_KEY, language);
    }

    // -------------------------------------------------------------------
    // UI DIALOGS — replaces the browser's native alert()/confirm() popups
    // (which look like the browser, not the app) with dialogs styled to
    // match Open's own design: rounded card, brand purple, and correct
    // dark-mode colors. Every page that shows one of these must already
    // load api.js, since that's also true of every page that currently
    // calls alert()/confirm().
    // -------------------------------------------------------------------

    function ensureUiStylesInjected() {
        if (document.getElementById('openui-styles')) return;
        const style = document.createElement('style');
        style.id = 'openui-styles';
        style.textContent = `
            .openui-overlay {
                --openui-bg: #ffffff;
                --openui-text: #1f2937;
                --openui-muted: #6B7280;
                --openui-primary: #500E8C;
                --openui-overlay-bg: rgba(17, 17, 17, 0.45);
                position: fixed;
                inset: 0;
                background: var(--openui-overlay-bg);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                padding: 20px;
                opacity: 0;
                transition: opacity 0.15s ease;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .dark-theme .openui-overlay {
                --openui-bg: #1e1e1e;
                --openui-text: #f5f5f5;
                --openui-muted: #a0a0a5;
                --openui-primary: #a362e6;
                --openui-overlay-bg: rgba(0, 0, 0, 0.65);
            }
            .openui-overlay.openui-visible { opacity: 1; }
            .openui-card {
                background: var(--openui-bg);
                color: var(--openui-text);
                border-radius: 18px;
                max-width: 360px;
                width: 100%;
                padding: 24px 22px 20px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.25);
                transform: translateY(8px) scale(0.98);
                transition: transform 0.15s ease;
            }
            .openui-overlay.openui-visible .openui-card { transform: translateY(0) scale(1); }
            .openui-title {
                font-size: 1.05rem;
                font-weight: 700;
                margin-bottom: 10px;
                color: var(--openui-text);
            }
            .openui-message {
                font-size: 0.92rem;
                line-height: 1.5;
                color: var(--openui-muted);
                margin-bottom: 20px;
                white-space: pre-line;
            }
            .openui-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .openui-btn {
                border: none;
                border-radius: 12px;
                padding: 10px 20px;
                font-size: 0.9rem;
                font-weight: 700;
                cursor: pointer;
                transition: transform 0.1s ease, opacity 0.15s ease;
                font-family: inherit;
            }
            .openui-btn:active { transform: scale(0.97); }
            .openui-btn-secondary {
                background: transparent;
                color: var(--openui-muted);
            }
            .openui-btn-primary {
                background: var(--openui-primary);
                color: #ffffff;
            }
            .openui-btn-danger {
                background: #b20000;
                color: #ffffff;
            }
            .dark-theme .openui-btn-danger { background: #ff5c5c; color: #2a0000; }
        `;
        document.head.appendChild(style);
    }

    function buildOpenUiModal(message, title) {
        ensureUiStylesInjected();

        const overlay = document.createElement('div');
        overlay.className = 'openui-overlay';

        const card = document.createElement('div');
        card.className = 'openui-card';

        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'openui-title';
            titleEl.textContent = title;
            card.appendChild(titleEl);
        }

        const messageEl = document.createElement('div');
        messageEl.className = 'openui-message';
        messageEl.textContent = message;
        card.appendChild(messageEl);

        const actions = document.createElement('div');
        actions.className = 'openui-actions';
        card.appendChild(actions);

        overlay.appendChild(card);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('openui-visible'));

        function close() {
            overlay.classList.remove('openui-visible');
            setTimeout(() => overlay.remove(), 150);
        }

        return { overlay, actions, close };
    }

    // Drop-in, theme-matching replacement for window.alert(). Resolves
    // (with no value) once the person dismisses it.
    function showAlert(message, options = {}) {
        return new Promise(resolve => {
            const { overlay, actions, close } = buildOpenUiModal(message, options.title);

            const okBtn = document.createElement('button');
            okBtn.className = 'openui-btn openui-btn-primary';
            okBtn.textContent = options.okText || 'OK';
            okBtn.addEventListener('click', () => { close(); resolve(); });
            actions.appendChild(okBtn);
            okBtn.focus();

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) { close(); resolve(); }
            });
        });
    }

    // Drop-in, theme-matching replacement for window.confirm(). Resolves
    // true if the person confirmed, false if they cancelled or dismissed
    // it by clicking outside the card. Pass { danger: true } to color the
    // confirm button red for destructive actions (e.g. deleting something).
    function showConfirm(message, options = {}) {
        return new Promise(resolve => {
            const { overlay, actions, close } = buildOpenUiModal(message, options.title);

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'openui-btn openui-btn-secondary';
            cancelBtn.textContent = options.cancelText || 'Cancel';
            cancelBtn.addEventListener('click', () => { close(); resolve(false); });

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'openui-btn ' + (options.danger ? 'openui-btn-danger' : 'openui-btn-primary');
            confirmBtn.textContent = options.confirmText || 'OK';
            confirmBtn.addEventListener('click', () => { close(); resolve(true); });

            actions.appendChild(cancelBtn);
            actions.appendChild(confirmBtn);
            confirmBtn.focus();

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) { close(); resolve(false); }
            });
        });
    }

    // -------------------------------------------------------------------
    // BIOMETRIC SIGN-IN (WebAuthn) — lets a user unlock with whatever
    // their device's OS already uses (Face ID, Touch ID, Windows Hello,
    // Android fingerprint) instead of typing a password every time.
    //
    // This uses the real browser WebAuthn API (navigator.credentials),
    // not a fake "pretend it worked" flag:
    //   - registerBiometric() asks the OS to create a platform credential
    //     (authenticatorAttachment: 'platform', userVerification:
    //     'required' — this is what forces the actual fingerprint/Face ID
    //     prompt rather than silently succeeding) and stores the
    //     credential's PUBLIC key against the user record.
    //   - loginWithBiometric() asks the OS to sign a fresh challenge with
    //     that credential, then verifies the signature in-browser with
    //     the stored public key via SubtleCrypto before granting a
    //     session. A stolen/copied localStorage file is USELESS on its
    //     own — only the original device's secure hardware can produce a
    //     signature the stored public key will verify.
    //
    // Caveats worth knowing (this is a client-only prototype, no server):
    //   - The credential is scoped to this browser/device, same as real
    //     WebAuthn — it will not appear on a different phone/laptop.
    //   - WebAuthn requires a secure context: serve the app over
    //     https:// or http://localhost — it will not work opened directly
    //     as a file:// page.
    //   - A real backend would also store its own copy of the public key
    //     and a per-session server-side challenge; here the "server" is
    //     just this same-origin localStorage, which is the appropriate
    //     stand-in until there's an actual API to move this logic to.
    // -------------------------------------------------------------------

    const RP_NAME = 'Open Jobs Ghana';

    function bufferToBase64url(buffer) {
        const bytes = new Uint8Array(buffer);
        let str = '';
        for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function base64urlToBuffer(base64url) {
        let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const str = atob(base64);
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
        return bytes.buffer;
    }

    // WebAuthn assertion signatures come back DER-encoded
    // (SEQUENCE { INTEGER r, INTEGER s }). crypto.subtle.verify for ECDSA
    // needs the raw, fixed-length r||s format instead, so this converts
    // between them.
    function derEcdsaSignatureToRaw(derBuffer, byteLen) {
        const der = new Uint8Array(derBuffer);
        let offset = 2; // skip SEQUENCE tag + length byte
        function readInt() {
            offset += 1; // skip INTEGER tag (0x02)
            let len = der[offset]; offset += 1;
            let bytes = der.slice(offset, offset + len);
            offset += len;
            // Strip a leading 0x00 sign-padding byte if present
            if (bytes.length > byteLen && bytes[0] === 0x00) bytes = bytes.slice(1);
            // Left-pad if shorter than expected
            if (bytes.length < byteLen) {
                const padded = new Uint8Array(byteLen);
                padded.set(bytes, byteLen - bytes.length);
                bytes = padded;
            }
            return bytes;
        }
        const r = readInt();
        const s = readInt();
        const raw = new Uint8Array(byteLen * 2);
        raw.set(r, 0);
        raw.set(s, byteLen);
        return raw.buffer;
    }

    function isWebAuthnSupported() {
        return typeof window !== 'undefined' &&
            typeof window.PublicKeyCredential !== 'undefined';
    }

    // Whether THIS device actually has a usable platform authenticator
    // (fingerprint sensor, Face ID, Windows Hello, etc.) available right
    // now — separate from just "does the browser support the API".
    async function isBiometricAvailableOnDevice() {
        if (!isWebAuthnSupported()) return false;
        if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
        try {
            return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch (e) {
            return false;
        }
    }

    function hasBiometricEnabled(email) {
        const user = getUserByEmail(email);
        return !!(user && user.webauthnCredential);
    }

    function getLastLoginEmail() {
        return localStorage.getItem(LAST_LOGIN_KEY) || null;
    }

    // Must be called from a click handler (WebAuthn requires a user
    // gesture) while the person is already logged in — this is meant to
    // be triggered from a "Enable biometric sign-in" toggle in Settings,
    // never from the login page itself.
    async function registerBiometric(email) {
        const user = getUserByEmail(email);
        if (!user) return { ok: false, reason: 'no_user' };
        if (!isWebAuthnSupported()) return { ok: false, reason: 'unsupported' };

        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const userId = new TextEncoder().encode(email);

        let credential;
        try {
            credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: { name: RP_NAME },
                    user: { id: userId, name: email, displayName: user.name || email },
                    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256 (P-256)
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required'
                    },
                    timeout: 60000,
                    attestation: 'none'
                }
            });
        } catch (err) {
            return { ok: false, reason: 'cancelled_or_failed', error: err };
        }

        if (!credential || typeof credential.response.getPublicKey !== 'function') {
            return { ok: false, reason: 'unsupported' };
        }

        const spki = credential.response.getPublicKey();
        const publicKey = await crypto.subtle.importKey(
            'spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']
        );
        const publicKeyJwk = await crypto.subtle.exportKey('jwk', publicKey);

        updateUser(email, {
            webauthnCredential: {
                credentialId: bufferToBase64url(credential.rawId),
                publicKeyJwk
            }
        });

        // Device-local convenience list so login.html can offer a quick
        // sign-in button for whoever last used this device without
        // needing them to type their email first.
        localStorage.setItem(LAST_LOGIN_KEY, email);

        return { ok: true };
    }

    function disableBiometric(email) {
        updateUser(email, { webauthnCredential: null });
    }

    // Prompts the OS biometric/PIN prompt, verifies the signature against
    // the stored public key, and — only if that verification passes —
    // grants a session via setSession(). Returns:
    //   { ok: true, user }
    //   { ok: false, reason: 'not_registered' | 'unsupported' | 'cancelled_or_failed' | 'verification_failed' }
    async function loginWithBiometric(email) {
        const user = getUserByEmail(email);
        if (!user || !user.webauthnCredential) return { ok: false, reason: 'not_registered' };
        if (!isWebAuthnSupported()) return { ok: false, reason: 'unsupported' };

        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const credentialId = base64urlToBuffer(user.webauthnCredential.credentialId);

        let assertion;
        try {
            assertion = await navigator.credentials.get({
                publicKey: {
                    challenge,
                    allowCredentials: [{ type: 'public-key', id: credentialId }],
                    userVerification: 'required',
                    timeout: 60000
                }
            });
        } catch (err) {
            return { ok: false, reason: 'cancelled_or_failed', error: err };
        }

        // Re-check the fundamentals a real relying party checks: the
        // assertion says "get" (not "create"), the challenge we just
        // generated is the one that got signed, and it's for this origin.
        const clientData = JSON.parse(new TextDecoder().decode(assertion.response.clientDataJSON));
        if (clientData.type !== 'webauthn.get') return { ok: false, reason: 'verification_failed' };
        if (clientData.origin !== window.location.origin) return { ok: false, reason: 'verification_failed' };
        const expectedChallenge = bufferToBase64url(challenge);
        if (clientData.challenge !== expectedChallenge) return { ok: false, reason: 'verification_failed' };

        const publicKey = await crypto.subtle.importKey(
            'jwk', user.webauthnCredential.publicKeyJwk,
            { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
        );

        const rawSignature = derEcdsaSignatureToRaw(assertion.response.signature, 32);
        const clientDataHash = await crypto.subtle.digest('SHA-256', assertion.response.clientDataJSON);
        const authenticatorDataBytes = new Uint8Array(assertion.response.authenticatorData);
        const clientDataHashBytes = new Uint8Array(clientDataHash);
        const signedData = new Uint8Array(authenticatorDataBytes.length + clientDataHashBytes.length);
        signedData.set(authenticatorDataBytes, 0);
        signedData.set(clientDataHashBytes, authenticatorDataBytes.length);

        const verified = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' }, publicKey, rawSignature, signedData
        );

        if (!verified) return { ok: false, reason: 'verification_failed' };

        setSession(email);
        return { ok: true, user };
    }

    function getAdsKeyForEmail(email) {
        return `openJobsAdvertisements_${email || 'guest'}`;
    }

    async function getCurrentUserAdsKey() {
        const session = getSession();
        return getAdsKeyForEmail(session && session.email);
    }

    // -------------------------------------------------------------------
    // ADS — reading/writing ad listings.
    // NOTE: Since there's no server yet, "every ad on the platform" is
    // simulated by scanning every openJobsAdvertisements_* key that exists
    // in THIS browser's storage. That means right now, ads are only
    // visible within the same browser/device they were posted from — true
    // cross-device visibility needs a real backend. Once that exists,
    // getAllAds() below is the only function that needs to change (to a
    // fetch() call), and every page using it keeps working unchanged.
    // -------------------------------------------------------------------

    async function getAllAds() {
        let allAds = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('openJobsAdvertisements_')) {
                const ownerEmail = key.replace('openJobsAdvertisements_', '');
                const ads = JSON.parse(localStorage.getItem(key) || '[]');
                ads.forEach(ad => {
                    if (!ad.postedBy) ad.postedBy = ownerEmail;
                });
                allAds = allAds.concat(ads);
            }
        }
        return allAds;
    }

    async function getAdsForUser(email) {
        const key = getAdsKeyForEmail(email);
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    async function getCurrentUserAds() {
        const session = getSession();
        return getAdsForUser(session && session.email);
    }

    async function saveAd(adObject, editingIndex) {
        const key = await getCurrentUserAdsKey();
        let storage = JSON.parse(localStorage.getItem(key) || '[]');
        if (editingIndex !== null && editingIndex !== undefined) {
            storage[editingIndex] = adObject;
        } else {
            storage.push(adObject);
        }
        localStorage.setItem(key, JSON.stringify(storage));
        return true;
    }

    async function deleteAd(index) {
        const key = await getCurrentUserAdsKey();
        let storage = JSON.parse(localStorage.getItem(key) || '[]');
        const removed = storage[index];
        storage.splice(index, 1);
        localStorage.setItem(key, JSON.stringify(storage));
        if (removed && removed.adId) {
            await deleteAdMedia(removed.adId);
        }
        return removed;
    }

    function generateAdId() {
        return 'ad_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    }

    // -------------------------------------------------------------------
    // MEDIA (IndexedDB) — images/videos are too large for localStorage,
    // so they live here instead. Same "swap this out for a server later"
    // idea applies — this would become upload-to-server calls.
    // -------------------------------------------------------------------

    const MEDIA_DB_NAME = 'OpenJobsMediaDB';
    const MEDIA_STORE_NAME = 'adMedia';
    const CHAT_ATTACH_STORE_NAME = 'chatAttachments';

    function openMediaDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(MEDIA_DB_NAME, 2);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
                    db.createObjectStore(MEDIA_STORE_NAME, { keyPath: 'adId' });
                }
                if (!db.objectStoreNames.contains(CHAT_ATTACH_STORE_NAME)) {
                    db.createObjectStore(CHAT_ATTACH_STORE_NAME, { keyPath: 'attachmentId' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function saveAdMedia(adId, images, videos) {
        const db = await openMediaDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
            tx.objectStore(MEDIA_STORE_NAME).put({ adId, images, videos });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    let mediaCache = {};
    async function getAdMedia(adId) {
        if (!adId) return { images: [], videos: [] };
        if (mediaCache[adId]) return mediaCache[adId];
        const db = await openMediaDB();
        const media = await new Promise((resolve, reject) => {
            const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
            const req = tx.objectStore(MEDIA_STORE_NAME).get(adId);
            req.onsuccess = () => resolve(req.result || { images: [], videos: [] });
            req.onerror = () => reject(req.error);
        });
        mediaCache[adId] = media;
        return media;
    }

    async function deleteAdMedia(adId) {
        if (!adId) return;
        delete mediaCache[adId];
        const db = await openMediaDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
            tx.objectStore(MEDIA_STORE_NAME).delete(adId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // Chat attachments (images, files, voice notes) — up to 100MB, stored in
    // IndexedDB rather than localStorage since they're far too large for that.
    function generateAttachmentId() {
        return 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    }

    async function saveChatAttachment(attachmentId, dataUrl, meta) {
        const db = await openMediaDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CHAT_ATTACH_STORE_NAME, 'readwrite');
            tx.objectStore(CHAT_ATTACH_STORE_NAME).put({ attachmentId, dataUrl, ...meta });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getChatAttachment(attachmentId) {
        if (!attachmentId) return null;
        const db = await openMediaDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CHAT_ATTACH_STORE_NAME, 'readonly');
            const req = tx.objectStore(CHAT_ATTACH_STORE_NAME).get(attachmentId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    // -------------------------------------------------------------------
    // MESSAGING — real, persistent, two-way conversations between real
    // logged-in users. Stored as one shared list of conversations (like a
    // simple server table would be) so both people in a conversation see
    // the same thread — not per-user copies that could go out of sync.
    // -------------------------------------------------------------------

    const MESSAGES_KEY = 'OPEN_MESSAGES';

    function getAllConversations() {
        return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
    }

    function saveAllConversations(list) {
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));
    }

    function makeConversationId(emailA, emailB) {
        return [emailA, emailB].sort().join('__');
    }

    async function getConversationsForUser(email) {
        const all = getAllConversations();
        return all
            .filter(c => c.participants.includes(email))
            .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    }

    function getConversationById(conversationId) {
        return getAllConversations().find(c => c.id === conversationId) || null;
    }

    // originAd (optional): { adId, title, thumb } — a light snapshot of the ad
    // that started the conversation, shown once at the top of the thread.
    async function findOrCreateConversation(emailA, emailB, originAd) {
        const all = getAllConversations();
        const id = makeConversationId(emailA, emailB);
        let convo = all.find(c => c.id === id);
        if (!convo) {
            convo = {
                id,
                participants: [emailA, emailB],
                originAd: originAd || null,
                reported: false,
                messages: [],
                lastUpdated: Date.now()
            };
            all.push(convo);
            saveAllConversations(all);
        }
        return convo;
    }

    // payload: { text, attachmentId, attachmentType ('image'|'file'|'audio'), attachmentName, attachmentSize }
    async function addMessageToConversation(conversationId, senderEmail, payload) {
        const all = getAllConversations();
        const convo = all.find(c => c.id === conversationId);
        if (!convo) return null;

        const msg = {
            msgId: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            sender: senderEmail,
            text: payload.text || '',
            attachmentId: payload.attachmentId || null,
            attachmentType: payload.attachmentType || null,
            attachmentName: payload.attachmentName || null,
            attachmentSize: payload.attachmentSize || null,
            replyTo: payload.replyTo || null,
            timestamp: Date.now(),
            edited: false,
            deleted: false,
            read: false
        };
        convo.messages.push(msg);
        convo.lastUpdated = Date.now();
        saveAllConversations(all);
        return msg;
    }

    async function editMessageInConversation(conversationId, msgId, newText) {
        const all = getAllConversations();
        const convo = all.find(c => c.id === conversationId);
        if (!convo) return;
        const msg = convo.messages.find(m => m.msgId === msgId);
        if (msg) {
            msg.text = newText;
            msg.edited = true;
            saveAllConversations(all);
        }
    }

    async function deleteMessageInConversation(conversationId, msgId) {
        const all = getAllConversations();
        const convo = all.find(c => c.id === conversationId);
        if (!convo) return;
        const msg = convo.messages.find(m => m.msgId === msgId);
        if (msg) {
            msg.deleted = true;
            saveAllConversations(all);
        }
    }

    // Marks every message NOT sent by "email" as read (called when that
    // person opens the thread).
    async function markConversationRead(conversationId, email) {
        const all = getAllConversations();
        const convo = all.find(c => c.id === conversationId);
        if (!convo) return;
        convo.messages.forEach(m => {
            if (m.sender !== email) m.read = true;
        });
        saveAllConversations(all);
    }

    function getUnreadCountForUser(convo, email) {
        return convo.messages.filter(m => m.sender !== email && !m.read && !m.deleted).length;
    }

    // Flags a conversation as reported (used by the Report button on a
    // user's profile). This is a separate concept from Spam — reporting
    // does NOT hide the conversation from view; it's just a record for
    // review. Spam (see setSpamTag below) is what actually hides things.
    async function reportConversation(conversationId) {
        const all = getAllConversations();
        const convo = all.find(c => c.id === conversationId);
        if (!convo) return;
        convo.reported = true;
        saveAllConversations(all);
    }

    // "Client" is a personal label one person gives another — it's not a
    // shared fact about the conversation, so it's stored per-viewer rather
    // than on the conversation itself (what you call your client, someone
    // else viewing the same thread wouldn't necessarily agree with).
    function getClientTagsKey(myEmail) {
        return `OPEN_CLIENT_TAGS_${myEmail}`;
    }

    function getClientTaggedEmails(myEmail) {
        return JSON.parse(localStorage.getItem(getClientTagsKey(myEmail)) || '[]');
    }

    function isMarkedAsClient(myEmail, partnerEmail) {
        return getClientTaggedEmails(myEmail).includes(partnerEmail);
    }

    function setClientTag(myEmail, partnerEmail, isClient) {
        let tags = getClientTaggedEmails(myEmail);
        const idx = tags.indexOf(partnerEmail);
        if (isClient && idx === -1) tags.push(partnerEmail);
        if (!isClient && idx > -1) tags.splice(idx, 1);
        localStorage.setItem(getClientTagsKey(myEmail), JSON.stringify(tags));
    }

    // "Spam" is also a personal, per-viewer label — same reasoning as
    // Client above, but more important here: if this were stored on the
    // shared conversation object (like the old .reported flag was), one
    // person marking someone as spam would also hide the conversation
    // for the OTHER participant, who never did anything. Keeping it
    // per-viewer means only the person who marked it is affected, and it
    // can be undone (unlike reporting, which is a one-way action).
    function getSpamTagsKey(myEmail) {
        return `OPEN_SPAM_TAGS_${myEmail}`;
    }

    function getSpamTaggedEmails(myEmail) {
        return JSON.parse(localStorage.getItem(getSpamTagsKey(myEmail)) || '[]');
    }

    function isMarkedAsSpam(myEmail, partnerEmail) {
        return getSpamTaggedEmails(myEmail).includes(partnerEmail);
    }

    function setSpamTag(myEmail, partnerEmail, isSpam) {
        let tags = getSpamTaggedEmails(myEmail);
        const idx = tags.indexOf(partnerEmail);
        if (isSpam && idx === -1) tags.push(partnerEmail);
        if (!isSpam && idx > -1) tags.splice(idx, 1);
        localStorage.setItem(getSpamTagsKey(myEmail), JSON.stringify(tags));
    }

    // Total unread messages across every non-spam conversation this
    // person has — used for the small badge on the Messages nav icon so
    // it's visible from any page, not just after opening Messages.
    async function getTotalUnreadCountForUser(email) {
        if (!email) return 0;
        const conversations = await getConversationsForUser(email);
        return conversations.reduce((sum, convo) => {
            const partnerEmail = convo.participants.find(p => p !== email);
            if (isMarkedAsSpam(email, partnerEmail)) return sum;
            return sum + getUnreadCountForUser(convo, email);
        }, 0);
    }

    function ensureNavBadgeStylesInjected() {
        if (document.getElementById('open-nav-badge-styles')) return;
        const style = document.createElement('style');
        style.id = 'open-nav-badge-styles';
        style.textContent = `
            .open-nav-unread-badge {
                display: none;
                position: absolute;
                top: 2px;
                right: 22%;
                min-width: 16px;
                height: 16px;
                padding: 0 4px;
                background: #500E8C;
                border-radius: 9px;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                font-size: 10px;
                font-weight: 700;
                line-height: 1;
                z-index: 5;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .dark-theme .open-nav-unread-badge { background: #a362e6; }
        `;
        document.head.appendChild(style);
    }

    // Finds the Messages item in whatever bottom nav is on the CURRENT
    // page and shows/updates/hides a small purple count badge on it.
    // Safe to call on any page — no-ops if there's no bottom nav or no
    // logged-in user.
    async function refreshMessagesNavBadge() {
        const session = getSession();
        if (!session) return;

        const navItems = document.querySelectorAll('.bottom-nav .nav-item');
        let messagesItem = null;
        navItems.forEach(item => {
            const onclickAttr = item.getAttribute('onclick') || '';
            if (item.dataset.route === 'messages' || onclickAttr.indexOf('message.html') !== -1) {
                messagesItem = item;
            }
        });
        if (!messagesItem) return;

        ensureNavBadgeStylesInjected();

        const count = await getTotalUnreadCountForUser(session.email);

        let badge = messagesItem.querySelector('.open-nav-unread-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'open-nav-unread-badge';
            const computedPosition = window.getComputedStyle(messagesItem).position;
            if (computedPosition === 'static') messagesItem.style.position = 'relative';
            messagesItem.appendChild(badge);
        }

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // -------------------------------------------------------------------
    // SAVED ITEMS — stores just the adId (not a full copy of the ad), so
    // saved ads always show the latest info instead of a stale snapshot.
    // -------------------------------------------------------------------

    function getSavedAdIds() {
        return JSON.parse(localStorage.getItem('OPEN_SAVED_ITEMS') || '[]');
    }

    function isAdSaved(adId) {
        return getSavedAdIds().includes(adId);
    }

    function toggleSavedAd(adId) {
        let saved = getSavedAdIds();
        const wasIndex = saved.indexOf(adId);
        let nowSaved;
        if (wasIndex > -1) {
            saved.splice(wasIndex, 1);
            nowSaved = false;
        } else {
            saved.push(adId);
            nowSaved = true;
        }
        localStorage.setItem('OPEN_SAVED_ITEMS', JSON.stringify(saved));
        return nowSaved;
    }

    async function getSavedAds() {
        const savedIds = getSavedAdIds();
        if (savedIds.length === 0) return [];
        const allAds = await getAllAds();
        return allAds.filter(ad => savedIds.includes(ad.adId));
    }

    // -------------------------------------------------------------------
    // METRICS — real click/view counts per ad, used to decide what's
    // "trending" (most viewed first) instead of guessing.
    // -------------------------------------------------------------------

    function recordAdView(adId) {
        if (!adId) return;
        let metrics = JSON.parse(localStorage.getItem('OPEN_AD_METRICS') || '{}');
        if (!metrics[adId]) metrics[adId] = { views: 0 };
        metrics[adId].views += 1;
        localStorage.setItem('OPEN_AD_METRICS', JSON.stringify(metrics));
        return metrics[adId].views;
    }

    function getAdViews(adId) {
        const metrics = JSON.parse(localStorage.getItem('OPEN_AD_METRICS') || '{}');
        return (metrics[adId] && metrics[adId].views) || 0;
    }

    // -------------------------------------------------------------------
    // AD TYPE BADGES — one consistent color/label per ad type, used
    // everywhere an ad card or detail view is shown (home, ads, saved).
    // -------------------------------------------------------------------

    function getAdTypeBadge(type) {
        switch (type) {
            case "Business": return { label: "Business", color: "#2563EB" };
            case "Jobseeker": return { label: "Jobseeker", color: "#16A34A" };
            case "Freelancer": return { label: "Freelancer", color: "#D97706" };
            case "Intern": return { label: "Intern", color: "#DB2777" };
            default: return { label: type || "Ad", color: "#500E8C" };
        }
    }

    // Returns the extra fields unique to each ad type — same info shown on
    // the poster's own ads.html dashboard, so anyone viewing the ad from
    // home.html sees the exact same details, not a stripped-down version.
    function buildTypeSpecificFields(ad) {
        const money = (val) => val ? `₵${val}` : "Not specified";
        const fields = [];

        if (ad.type === "Freelancer") {
            fields.push({ label: "Works", val: ad.locationModel === "Remote" ? "Remote / Online" : "In Person" });
            fields.push({ label: "Price", val: money(ad.financialScale) });
            fields.push({ label: "Pricing", val: ad.pricingStructure === "Hourly" ? "Hourly Rate" : "Fixed Price" });
            fields.push({ label: "Turnaround", val: ad.turnaround || "Not specified" });
            if (ad.inclusions) fields.push({ label: "What's Included", val: ad.inclusions });
            if (ad.portfolioUrl) fields.push({ label: "Portfolio", val: ad.portfolioUrl });
        } else if (ad.type === "Business") {
            fields.push({ label: "Job Type", val: ad.subTypeModel || "Full-Time" });
            fields.push({ label: "Monthly Salary", val: money(ad.financialScale) });
        } else if (ad.type === "Jobseeker") {
            fields.push({ label: "Experience Level", val: ad.exp || "Intermediate Level" });
            fields.push({ label: "Expected Monthly Pay", val: money(ad.financialScale) });
        } else if (ad.type === "Intern") {
            fields.push({ label: "Duration", val: ad.subTypeModel || "Short Term" });
            fields.push({ label: "Monthly Allowance", val: money(ad.financialScale) });
            if (ad.affiliation) fields.push({ label: "School / Institution", val: ad.affiliation });
        }
        return fields;
    }

    // -------------------------------------------------------------------
    // Public interface
    // -------------------------------------------------------------------

    return {
        CATEGORIES,
        REGIONS,
        getCategoryIcon,
        getCategoryIconClass,
        getSession,
        setSession,
        clearSession,
        getCurrentUser,
        getUserByEmail,
        getInitialsAvatarDataUri,
        getAvatarUrl,
        getAllUsers,
        validatePassword,
        registerUser,
        validateLogin,
        updateUser,
        loginOrRegisterWithGoogle,
        getSearchHistory,
        addSearchHistoryEntry,
        removeSearchHistoryEntry,
        deleteUserAccount,
        getNotificationsEnabled,
        setNotificationsEnabled,
        getLanguage,
        setLanguage,
        showAlert,
        showConfirm,
        getLastLoginEmail,
        isWebAuthnSupported,
        isBiometricAvailableOnDevice,
        hasBiometricEnabled,
        registerBiometric,
        disableBiometric,
        loginWithBiometric,
        getAdsKeyForEmail,
        getCurrentUserAdsKey,
        getAllAds,
        getAdsForUser,
        getCurrentUserAds,
        saveAd,
        deleteAd,
        generateAdId,
        saveAdMedia,
        getAdMedia,
        deleteAdMedia,
        generateAttachmentId,
        saveChatAttachment,
        getChatAttachment,
        getSavedAdIds,
        isAdSaved,
        toggleSavedAd,
        getSavedAds,
        getConversationsForUser,
        getConversationById,
        findOrCreateConversation,
        addMessageToConversation,
        editMessageInConversation,
        deleteMessageInConversation,
        markConversationRead,
        getUnreadCountForUser,
        reportConversation,
        isMarkedAsClient,
        setClientTag,
        getClientTaggedEmails,
        isMarkedAsSpam,
        setSpamTag,
        getSpamTaggedEmails,
        getTotalUnreadCountForUser,
        refreshMessagesNavBadge,
        recordAdView,
        getAdViews,
        getAdTypeBadge,
        buildTypeSpecificFields
    };

})();
