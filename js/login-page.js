(function () {
  const screens = {
    signin: document.getElementById('signin-form'),
    signup: document.getElementById('signup-form'),
    mfaEnroll: document.getElementById('mfa-enroll-screen'),
    mfaChallenge: document.getElementById('mfa-challenge-screen'),
    signupNotice: document.getElementById('signup-notice-screen'),
    loggedIn: document.getElementById('logged-in-screen')
  };
  const tabs = document.querySelectorAll('.auth-tab');
  const tabBar = document.querySelector('.auth-tabs');

  function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || 'home.html';
  }

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].style.display = key === name ? 'block' : 'none';
    });
    tabBar.style.display = (name === 'signin' || name === 'signup') ? 'flex' : 'none';
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      showScreen(tab.dataset.tab);
    });
  });

  function showLoggedIn(email) {
    document.getElementById('logged-in-email').textContent = 'Signed in as ' + email + '.';
    document.getElementById('continue-link').href = getRedirectTarget();
    showScreen('loggedIn');
  }

  let pendingFactorId = null;

  async function startMfaEnrollment() {
    try {
      const data = await enrollMfa();
      pendingFactorId = data.id;
      const qrContainer = document.getElementById('mfa-qr-container');
      qrContainer.innerHTML = '';
      const qrImg = document.createElement('img');
      // Set as a property, not an HTML attribute string — the SVG data URI
      // contains literal double-quote characters that would otherwise break
      // out of a src="..." attribute built via string concatenation.
      qrImg.src = data.totp.qr_code;
      qrImg.alt = 'Scan with your authenticator app';
      qrImg.width = 200;
      qrImg.height = 200;
      qrContainer.appendChild(qrImg);
      document.getElementById('mfa-secret-text').textContent = data.totp.secret;
      showScreen('mfaEnroll');
    } catch (err) {
      alert('Could not start 2FA setup: ' + err.message);
    }
  }

  async function startMfaChallenge(factorId) {
    pendingFactorId = factorId;
    showScreen('mfaChallenge');
  }

  async function handlePostSignIn() {
    const session = await getAuthSession();
    const status = await getAssuranceStatus();

    if (status.hasMfaFactor && status.currentLevel !== 'aal2') {
      const factors = await listMfaFactors();
      await startMfaChallenge(factors[0].id);
      return;
    }

    if (!status.hasMfaFactor) {
      await startMfaEnrollment();
      return;
    }

    showLoggedIn(session.user.email);
  }

  document.getElementById('signin-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('signin-error');
    errorEl.textContent = '';

    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    const formError = validateAuthForm({ email: email, password: password, mode: 'signin' });
    if (formError) {
      errorEl.textContent = formError;
      return;
    }

    try {
      await authSignIn(email, password);
      await handlePostSignIn();
    } catch (err) {
      errorEl.textContent = err.code === 'NOT_CONFIGURED' ? err.message : 'Incorrect email or password.';
    }
  });

  document.getElementById('signup-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('signup-error');
    errorEl.textContent = '';

    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;
    const consent = document.getElementById('signup-consent').checked;
    const formError = validateAuthForm({ email: email, password: password, confirmPassword: confirmPassword, consent: consent, mode: 'signup' });
    if (formError) {
      errorEl.textContent = formError;
      return;
    }

    try {
      const data = await authSignUp(email, password);
      if (data.session) {
        await startMfaEnrollment();
      } else {
        document.getElementById('signup-notice-text').textContent =
          'We sent a confirmation link to ' + email + '. Click it, then come back here and sign in.';
        showScreen('signupNotice');
      }
    } catch (err) {
      errorEl.textContent = err.code === 'NOT_CONFIGURED' ? err.message : err.message;
    }
  });

  document.getElementById('mfa-enroll-submit').addEventListener('click', async function () {
    const errorEl = document.getElementById('mfa-enroll-error');
    errorEl.textContent = '';
    const code = document.getElementById('mfa-enroll-code').value;
    const codeError = validateMfaCode(code);
    if (codeError) {
      errorEl.textContent = codeError;
      return;
    }
    try {
      await verifyMfaEnrollment(pendingFactorId, code.trim());
      const session = await getAuthSession();
      showLoggedIn(session.user.email);
    } catch (err) {
      errorEl.textContent = 'That code didn\'t work — check your app and try again.';
    }
  });

  document.getElementById('mfa-challenge-submit').addEventListener('click', async function () {
    const errorEl = document.getElementById('mfa-challenge-error');
    errorEl.textContent = '';
    const code = document.getElementById('mfa-challenge-code').value;
    const codeError = validateMfaCode(code);
    if (codeError) {
      errorEl.textContent = codeError;
      return;
    }
    try {
      await challengeAndVerifyMfa(pendingFactorId, code.trim());
      const session = await getAuthSession();
      showLoggedIn(session.user.email);
    } catch (err) {
      errorEl.textContent = 'That code didn\'t work — check your app and try again.';
    }
  });

  (async function init() {
    const fullyAuthed = await isFullyAuthenticated();
    if (fullyAuthed) {
      const session = await getAuthSession();
      showLoggedIn(session.user.email);
    } else {
      showScreen('signin');
    }
  })();
})();
