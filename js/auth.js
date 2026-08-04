function validateAuthForm(form) {
  const email = (form.email || '').trim();
  const password = form.password || '';

  if (!email) return 'Please enter your email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
  if (!password) return 'Please enter a password.';
  if (password.length < 8) return 'Password must be at least 8 characters.';

  if (form.mode === 'signup') {
    if (form.confirmPassword === undefined) return 'Please confirm your password.';
    if (password !== form.confirmPassword) return 'Passwords do not match.';
  }

  return null;
}

function validateMfaCode(code) {
  const trimmed = (code || '').trim();
  if (!/^\d{6}$/.test(trimmed)) return 'Enter the 6-digit code from your authenticator app.';
  return null;
}

async function authSignUp(email, password) {
  const client = getSupabaseClient();
  if (!client) {
    const err = new Error('Login isn\'t set up yet. Please check back soon.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const { data, error } = await client.auth.signUp({ email: email, password: password });
  if (error) throw error;
  return data;
}

async function authSignIn(email, password) {
  const client = getSupabaseClient();
  if (!client) {
    const err = new Error('Login isn\'t set up yet. Please check back soon.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const { data, error } = await client.auth.signInWithPassword({ email: email, password: password });
  if (error) throw error;
  return data;
}

async function authSignOut() {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}

async function getAuthSession() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

// Returns 'aal1' (password only) or 'aal2' (password + MFA verified) for the
// current session, and whether an MFA factor exists at all.
async function getAssuranceStatus() {
  const client = getSupabaseClient();
  if (!client) return { currentLevel: null, nextLevel: null, hasMfaFactor: false };
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return { currentLevel: null, nextLevel: null, hasMfaFactor: false };
  return {
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
    hasMfaFactor: data.nextLevel === 'aal2'
  };
}

// True only when the user is logged in AND, if they have MFA enrolled,
// has actually completed the MFA challenge for this session.
async function isFullyAuthenticated() {
  const session = await getAuthSession();
  if (!session) return false;
  const status = await getAssuranceStatus();
  if (status.nextLevel === 'aal2' && status.currentLevel !== 'aal2') return false;
  return true;
}

async function listMfaFactors() {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) return [];
  return data.totp || [];
}

async function enrollMfa() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  return data; // { id, totp: { qr_code, secret, uri } }
}

async function verifyMfaEnrollment(factorId, code) {
  const client = getSupabaseClient();
  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: factorId });
  if (challengeError) throw challengeError;
  const { data, error } = await client.auth.mfa.verify({
    factorId: factorId,
    challengeId: challenge.id,
    code: code
  });
  if (error) throw error;
  return data;
}

async function challengeAndVerifyMfa(factorId, code) {
  const client = getSupabaseClient();
  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: factorId });
  if (challengeError) throw challengeError;
  const { data, error } = await client.auth.mfa.verify({
    factorId: factorId,
    challengeId: challenge.id,
    code: code
  });
  if (error) throw error;
  return data;
}

// ---- Homepage login gate ----
// Currently only called from index.html (viewing the homepage requires
// login; other pages stay reachable via direct link without it). Redirects
// to login.html (preserving the current URL to return to) if the visitor
// isn't fully authenticated, and returns false so the caller can bail out
// of the rest of its init/render logic instead of doing wasted work.
async function requireAuthOrRedirect() {
  if (await isFullyAuthenticated()) return true;
  window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
  return false;
}

// ---- Shared header auth-status widget (used on every page) ----

async function renderAuthStatus(container) {
  if (!container) return;
  const session = await getAuthSession();

  if (!session) {
    container.innerHTML = '<a class="auth-status-link" href="login.html">Log in</a>';
    return;
  }

  const email = session.user.email;
  container.innerHTML =
    '<span class="auth-status-email">' + email + '</span>' +
    '<button type="button" class="auth-status-logout">Log out</button>';

  container.querySelector('.auth-status-logout').addEventListener('click', async function () {
    await authSignOut();
    window.location.reload();
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateAuthForm: validateAuthForm,
    validateMfaCode: validateMfaCode
  };
}
