const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const TRUTH_METER_KEY = 'truth_meter_votes';
const INTRO_SESSION_KEY = 'intro_intro_shown';

function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getTruthMeterVotesStore() {
  try {
    const raw = localStorage.getItem(TRUTH_METER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function saveTruthMeterVote(secretId, vote) {
  const current = getTruthMeterVotesStore();
  current[secretId] = vote;
  try {
    localStorage.setItem(TRUTH_METER_KEY, JSON.stringify(current));
  } catch (err) {
    // ignore quota issues
  }
}

function hasSeenIntro() {
  try {
    return sessionStorage.getItem(INTRO_SESSION_KEY) === 'true';
  } catch (err) {
    return false;
  }
}

function setIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_SESSION_KEY, 'true');
  } catch (err) {
    // ignore storage issues
  }
}

function formatPercentLabel(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const rounded = Math.round(safeValue * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded}%`;
  }
  return `${rounded.toFixed(1)}%`;
}

function getTruthMeterStats(truthVotes = 0, lieVotes = 0) {
  const truth = Number(truthVotes) || 0;
  const lie = Number(lieVotes) || 0;
  const totalVotes = truth + lie;
  const truthPercentRaw = totalVotes === 0 ? 0 : (truth / totalVotes) * 100;
  const liePercentRaw = totalVotes === 0 ? 0 : (lie / totalVotes) * 100;
  const truthPercent = Math.round(truthPercentRaw * 10) / 10;
  const liePercent = Math.round(liePercentRaw * 10) / 10;
  return {
    truthVotes: truth,
    lieVotes: lie,
    totalVotes,
    truthPercent,
    liePercent,
    truthLabel: `${formatPercentLabel(truthPercent)} True`,
    lieLabel: `${formatPercentLabel(liePercent)} Lie`
  };
}

function truthMeterStatusMessage(vote) {
  if (vote === 'truth') {
    return 'You marked this as true.';
  }
  if (vote === 'lie') {
    return 'You marked this as a lie.';
  }
  return 'Trust your gut. One vote per secret.';
}

function initIntroOverlay() {
  const overlay = document.getElementById('intro-overlay');
  const video = document.getElementById('intro-video');
  const skipButton = document.getElementById('intro-skip');

  if (!overlay || !video || !skipButton) {
    return;
  }

  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const teardownInstantly = () => {
    overlay.classList.add('intro-hide');
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-intro-playing');
  };

  if (prefersReducedMotion || hasSeenIntro()) {
    setIntroSeen();
    teardownInstantly();
    return;
  }

  let fallbackTimer;

  const hideOverlay = () => {
    if (!overlay || overlay.classList.contains('intro-hide')) {
      return;
    }
    overlay.classList.add('intro-hide');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-intro-playing');
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    try {
      video.pause();
    } catch (err) {
      // ignore media pause errors
    }
    setIntroSeen();
    window.setTimeout(() => {
      overlay.style.display = 'none';
    }, 900);
  };

  overlay.classList.remove('intro-hide');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-intro-playing');

  const attemptPlay = () => {
    try {
      const result = video.play();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          hideOverlay();
        });
      }
    } catch (err) {
      hideOverlay();
    }
  };

  if (video.readyState >= 2) {
    attemptPlay();
  } else {
    video.addEventListener(
      'loadeddata',
      () => {
        attemptPlay();
      },
      { once: true }
    );
  }

  fallbackTimer = window.setTimeout(() => {
    hideOverlay();
  }, 8000);

  video.addEventListener('ended', hideOverlay, { once: true });
  video.addEventListener('error', hideOverlay);
  skipButton.addEventListener('click', hideOverlay);

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        hideOverlay();
      }
    },
    { once: true }
  );
}

function safeRedirectPath(target, fallback = '/') {
  if (!target) {
    return fallback;
  }

  if (typeof target === 'string' && target.startsWith('/')) {
    return target;
  }

  try {
    const url = new URL(target, window.location.origin);
    if (url.origin === window.location.origin) {
      const composed = `${url.pathname}${url.search}${url.hash}`;
      return composed || fallback;
    }
  } catch (err) {
    // ignore parsing issues and fall back
  }

  return fallback;
}

function getNextParam(fallback = '/read.html') {
  try {
    const params = new URLSearchParams(window.location.search);
    const nextParam = params.get('next');
    return safeRedirectPath(nextParam, fallback);
  } catch (err) {
    return fallback;
  }
}

function escapeHTML(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#47;');
}

function genderIcon(gender) {
  if (gender === 'male') {
    return '♂';
  }
  if (gender === 'female') {
    return '♀';
  }
  return '⚧';
}

function truthMeterTotalLabel(totalVotes) {
  if (!totalVotes) {
    return 'Awaiting first vote';
  }
  return `${totalVotes} vote${totalVotes === 1 ? '' : 's'}`;
}

function truthMeterMarkup(secret, storedVotes = null) {
  const stats = getTruthMeterStats(secret.truthVotes, secret.lieVotes);
  const voteMap = storedVotes || getTruthMeterVotesStore();
  const recordedVote = voteMap ? voteMap[secret.id] : null;
  const truthSelected = recordedVote === 'truth' ? ' is-selected' : '';
  const lieSelected = recordedVote === 'lie' ? ' is-selected' : '';
  const disableAttr = recordedVote ? 'disabled' : '';
  const blockOpenClass = recordedVote ? ' is-open' : '';
  const ariaExpanded = recordedVote ? 'true' : 'false';
  return `
    <div class="truth-meter-block${blockOpenClass}" data-truth-block>
      <button
        type="button"
        class="truth-meter-toggle"
        data-truth-toggle
        aria-expanded="${ariaExpanded}"
      >
        <span class="truth-meter-toggle__label">Truth Meter</span>
        <span class="truth-meter-toggle__chevron" aria-hidden="true"></span>
      </button>
      <div class="truth-meter" data-truth-meter data-secret-id="${secret.id}">
        <div class="truth-meter__header">
          <span>Truth Meter</span>
          <span class="truth-meter__total" data-truth-total>${escapeHTML(truthMeterTotalLabel(stats.totalVotes))}</span>
        </div>
        <div class="truth-meter__bar" aria-hidden="true">
          <div class="truth-meter__fill truth" style="width: ${stats.truthPercent}%;"></div>
          <div class="truth-meter__fill lie" style="width: ${stats.liePercent}%;"></div>
        </div>
        <div class="truth-meter__stats">
          <span data-truth-value>${escapeHTML(stats.truthLabel)}</span>
          <span class="truth-meter__divider">/</span>
          <span data-lie-value>${escapeHTML(stats.lieLabel)}</span>
        </div>
        <div class="truth-meter__actions">
          <button type="button" class="truth-button truth${truthSelected}" data-truth-vote="truth" ${disableAttr}>Feels True</button>
          <button type="button" class="truth-button lie${lieSelected}" data-truth-vote="lie" ${disableAttr}>Feels Like A Lie</button>
        </div>
        <p class="truth-meter__hint" data-truth-hint>${escapeHTML(truthMeterStatusMessage(recordedVote))}</p>
      </div>
    </div>
  `;
}

function updateTruthMeterDisplay(meter, stats) {
  if (!meter || !stats) {
    return;
  }
  const truthFill = meter.querySelector('.truth-meter__fill.truth');
  const lieFill = meter.querySelector('.truth-meter__fill.lie');
  const truthValue = meter.querySelector('[data-truth-value]');
  const lieValue = meter.querySelector('[data-lie-value]');
  const total = meter.querySelector('[data-truth-total]');

  if (truthFill) {
    truthFill.style.width = `${stats.truthPercent}%`;
  }
  if (lieFill) {
    lieFill.style.width = `${stats.liePercent}%`;
  }
  if (truthValue) {
    truthValue.textContent = stats.truthLabel;
  }
  if (lieValue) {
    lieValue.textContent = stats.lieLabel;
  }
  if (total) {
    total.textContent = truthMeterTotalLabel(stats.totalVotes);
  }
}

function initTruthMeterToggle(block) {
  if (!block || block.dataset.truthToggleBound === 'true') {
    return;
  }
  const toggle = block.querySelector('[data-truth-toggle]');
  if (!toggle) {
    return;
  }
  block.dataset.truthToggleBound = 'true';
  const syncState = () => {
    const expanded = block.classList.contains('is-open');
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  };
  syncState();
  toggle.addEventListener('click', () => {
    block.classList.toggle('is-open');
    syncState();
  });
}

function initTruthMeter(container) {
  if (!container || container.dataset.truthBound === 'true') {
    return;
  }
  container.dataset.truthBound = 'true';
  const secretId = container.dataset.secretId;
  if (!secretId) {
    return;
  }
  const buttons = Array.from(container.querySelectorAll('[data-truth-vote]'));
  const hintNode = container.querySelector('[data-truth-hint]');
  let lockedVote = (getTruthMeterVotesStore()[secretId] || '').toLowerCase();

  const setHint = (message) => {
    if (hintNode) {
      hintNode.textContent = message;
    }
  };

  const highlightVote = (vote) => {
    buttons.forEach((btn) => {
      btn.classList.toggle('is-selected', Boolean(vote) && btn.dataset.truthVote === vote);
    });
  };

  const setButtonsDisabled = (disabled) => {
    buttons.forEach((btn) => {
      btn.disabled = disabled;
    });
  };

  if (lockedVote) {
    highlightVote(lockedVote);
    setButtonsDisabled(true);
    setHint(truthMeterStatusMessage(lockedVote));
  }

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      if (lockedVote || button.disabled) {
        return;
      }
      const vote = button.dataset.truthVote;
      if (!vote) {
        return;
      }
      setButtonsDisabled(true);
      setHint('Sending your vibe...');
      try {
        const payload = await fetchJSON('/api/truth-meter', {
          method: 'POST',
          body: { secretId, vote }
        });
        const stats = getTruthMeterStats(payload.truthVotes, payload.lieVotes);
        updateTruthMeterDisplay(container, stats);
        saveTruthMeterVote(secretId, vote);
        lockedVote = vote;
        highlightVote(vote);
        setHint(truthMeterStatusMessage(vote));
      } catch (err) {
        if (!lockedVote) {
          setButtonsDisabled(false);
        }
        setHint((err && err.message) || 'Vote failed. Try again.');
      }
    });
  });
}

function initTruthMeters(root) {
  if (!root) {
    return;
  }
  root.querySelectorAll('[data-truth-block]').forEach(initTruthMeterToggle);
  root.querySelectorAll('[data-truth-meter]').forEach(initTruthMeter);
}

async function fetchJSON(url, options = {}) {
  const opts = { ...options };
  opts.headers = { ...(options.headers || {}) };

  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }

  const token = getToken();
  if (token) {
    opts.headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, opts);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = null;
    }
  }

  if (!response.ok) {
    const error = new Error((data && data.message) || 'Request failed.');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function guardLoggedIn(redirectIfMissing = '/login.html') {
  if (!getToken()) {
    window.location.replace(redirectIfMissing);
    throw new Error('Redirecting to login.');
  }
}

function guardAdmin(redirectIfMissing = '/login.html?next=/admin.html') {
  const user = getUser();
  if (!user) {
    window.location.replace(redirectIfMissing);
    throw new Error('Redirecting to login.');
  }
  if (!user.isAdmin) {
    window.location.replace('/index.html');
    throw new Error('Redirecting to home.');
  }
}

function enforceAuthLinks() {
  const links = document.querySelectorAll('[data-requires-auth]');
  links.forEach((link) => {
    if (link.dataset.authBound === 'true') {
      return;
    }
    link.dataset.authBound = 'true';

    link.addEventListener('click', (event) => {
      if (getToken()) {
        return;
      }

      event.preventDefault();
      const href = link.getAttribute('href') || '/read.html';
      const preferred = link.dataset.redirect
        ? safeRedirectPath(link.dataset.redirect, href)
        : href;
      const redirectTarget = safeRedirectPath(preferred, '/read.html');
      window.location.href = `/login.html?next=${encodeURIComponent(redirectTarget)}`;
    });
  });
}

function renderNav() {
  const navRight = document.querySelector('[data-nav-auth]');
  if (!navRight) {
    return;
  }

  const user = getUser();
  if (user) {
    const adminLink = user.isAdmin
      ? `<a class="nav-btn" href="/admin.html" data-requires-auth="true" data-redirect="/admin.html" data-gothic>Admin Sanctum</a>`
      : '';
    navRight.innerHTML = `
      ${adminLink}
      <span class="user-badge" data-user-badge>
        <span>${escapeHTML(user.nickname)}</span>
        <span>${genderIcon(user.gender)}</span>
      </span>
      <button type="button" class="nav-btn" data-logout data-gothic>
        Depart
      </button>
    `;
    const logoutBtn = navRight.querySelector('[data-logout]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        clearAuth();
        window.location.href = '/login.html';
      });
    }
  } else {
    navRight.innerHTML = `
      <a class="nav-btn" href="/login.html" data-gothic>Enter</a>
      <a class="nav-btn primary" href="/register.html" data-gothic>Join Us</a>
    `;
  }

  enforceAuthLinks();
}

function updateUserContext() {
  const user = getUser();
  const nameNodes = document.querySelectorAll('[data-user-name]');
  const genderNodes = document.querySelectorAll('[data-user-gender-icon]');

  nameNodes.forEach((node) => {
    node.textContent = user ? user.nickname : '';
  });

  genderNodes.forEach((node) => {
    node.textContent = user ? genderIcon(user.gender) : '';
  });
}

function initIndexPage() {
  const user = getUser();
  const loggedInSection = document.querySelector('[data-logged-in]');
  const loggedOutSection = document.querySelector('[data-logged-out]');
  const welcome = document.querySelector('[data-welcome]');
  const randomBtn = document.querySelector('[data-random-btn]');
  const randomOutput = document.querySelector('[data-random-output]');
  const randomContainer = document.querySelector('[data-random-container]');

  if (user) {
    if (welcome) {
      welcome.innerHTML = `Welcome back, ${escapeHTML(user.nickname)} ${genderIcon(user.gender)}`;
    }
    if (loggedInSection) {
      loggedInSection.classList.remove('hidden');
    }
    if (loggedOutSection) {
      loggedOutSection.classList.add('hidden');
    }
    if (randomBtn && randomOutput && randomContainer) {
      randomBtn.addEventListener('click', async () => {
        randomBtn.disabled = true;
        randomBtn.textContent = 'Loading...';
        randomOutput.textContent = '';
        randomContainer.classList.add('hidden');
        try {
          const secret = await fetchJSON('/api/random');
          randomOutput.innerHTML = `
            <div class="secret-card">
              <div class="secret-meta">
                <span>${escapeHTML(secret.nickname)} ${genderIcon(secret.gender)}</span>
                <span>${escapeHTML(secret.category)}</span>
              </div>
              <div class="secret-content">${escapeHTML(secret.content)}</div>
              ${truthMeterMarkup(secret, getTruthMeterVotesStore())}
            </div>
          `;
          initTruthMeters(randomOutput);
          randomContainer.classList.remove('hidden');
        } catch (err) {
          randomOutput.innerHTML = `<p class="muted-text">No secrets yet.</p>`;
        } finally {
          randomBtn.disabled = false;
          randomBtn.textContent = 'Show A Random Secret';
        }
      });
    }
  } else {
    if (loggedInSection) {
      loggedInSection.classList.add('hidden');
    }
    if (loggedOutSection) {
      loggedOutSection.classList.remove('hidden');
    }
  }
}

function initRegisterPage() {
  if (getToken()) {
    window.location.href = '/share.html';
    return;
  }
  let loginRedirect = '/login.html';
  try {
    const params = new URLSearchParams(window.location.search);
    const nextParam = params.get('next');
    if (nextParam) {
      const safeNext = safeRedirectPath(nextParam, '/read.html');
      loginRedirect = `/login.html?next=${encodeURIComponent(safeNext)}`;
    }
  } catch (err) {
    // ignore malformed query
  }
  const form = document.querySelector('form');
  const errorEl = document.querySelector('[data-form-error]');
  const successEl = document.querySelector('[data-form-success]');

  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (errorEl) {
      errorEl.textContent = '';
    }
    if (successEl) {
      successEl.textContent = '';
    }

    const nickname = form.nickname.value.trim();
    const password = form.password.value.trim();
    const gender = form.gender.value;

    if (nickname.length < 2 || nickname.length > 32) {
      if (errorEl) {
        errorEl.textContent = 'Nickname must be between 2 and 32 characters.';
      }
      return;
    }

    if (password.length < 6) {
      if (errorEl) {
        errorEl.textContent = 'Password must be at least 6 characters.';
      }
      return;
    }

    try {
      const payload = await fetchJSON('/api/register', {
        method: 'POST',
        body: { nickname, password, gender }
      });
      if (successEl) {
        successEl.textContent = 'Registration successful! Redirecting to the gate...';
      }
      setTimeout(() => {
        window.location.href = loginRedirect;
      }, 1600);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Registration failed.';
      }
    }
  });
}

function initLoginPage() {
  const redirectTarget = getNextParam('/read.html');

  if (getToken()) {
    window.location.replace(redirectTarget);
    return;
  }

  const form = document.querySelector('form');
  const errorEl = document.querySelector('[data-form-error]');

  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (errorEl) {
      errorEl.textContent = '';
    }

    const nickname = form.nickname.value.trim();
    const password = form.password.value.trim();

    if (!nickname || !password) {
      if (errorEl) {
        errorEl.textContent = 'Nickname and password are required.';
      }
      return;
    }

    try {
      const payload = await fetchJSON('/api/login', {
        method: 'POST',
        body: { nickname, password }
      });
      setAuth(payload.token, payload.user);
      window.location.replace(redirectTarget);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Sign in failed.';
      }
    }
  });
}

function populateCategoryOptions(selectEl, categories, includeAll = false) {
  if (!selectEl) {
    return;
  }
  const options = includeAll ? ['__all__', ...categories] : categories;
  selectEl.innerHTML = options
    .map((cat) => {
      if (cat === '__all__') {
        return '<option value="">All categories</option>';
      }
      return `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`;
    })
    .join('');
}

function initSharePage() {
  guardLoggedIn('/login.html?next=/share.html');
  const categorySelect = document.querySelector('select[name="category"]');
  const form = document.querySelector('form');
  const statusEl = document.querySelector('[data-share-status]');
  let preselectedCategory = '';
  try {
    const params = new URLSearchParams(window.location.search);
    preselectedCategory = params.get('category') || '';
  } catch (err) {
    preselectedCategory = '';
  }

  fetchJSON('/api/categories')
    .then((categories) => {
      populateCategoryOptions(categorySelect, categories);
      if (preselectedCategory && categories.includes(preselectedCategory) && categorySelect) {
        categorySelect.value = preselectedCategory;
      }
    })
    .catch(() => {
      if (statusEl) {
      statusEl.textContent = 'Categories could not be loaded.';
        statusEl.classList.remove('form-success');
        statusEl.classList.add('form-error');
      }
    });

  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.classList.remove('form-success', 'form-error');
    }

    if (!getToken()) {
      if (statusEl) {
        statusEl.textContent = 'Please sign in to share a secret.';
        statusEl.classList.add('form-error');
      }
      window.location.replace('/login.html?next=/share.html');
      return;
    }

    const category = categorySelect.value;
    const content = form.content.value.trim();

    if (!category) {
      if (statusEl) {
      statusEl.textContent = 'Please choose a category.';
        statusEl.classList.add('form-error');
      }
      return;
    }

    if (content.length < 2) {
      if (statusEl) {
      statusEl.textContent = 'Secret message is too short.';
        statusEl.classList.add('form-error');
      }
      return;
    }

    try {
      await fetchJSON('/api/secrets', {
        method: 'POST',
        body: { category, content }
      });
      form.reset();
      window.location.replace('/read.html');
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = err.message || 'Secret could not be shared.';
        statusEl.classList.add('form-error');
      }
    }
  });
}

function renderSecrets(listEl, secrets, emptyState = null, categoryValue = '') {
  if (!listEl) {
    return;
  }

  // Use emptyState.categoryValue if passed, otherwise use the parameter
  const activeCategoryValue = (emptyState && emptyState.categoryValue) || categoryValue || '';

  if (!secrets || secrets.length === 0) {
    const message =
      (emptyState && emptyState.message) || 'No whispers yet. Be the first to leave one.';
    listEl.innerHTML = `<p class="muted-text">${escapeHTML(message)}</p>`;
    return;
  }

  const storedVotes = getTruthMeterVotesStore();
  listEl.innerHTML = secrets
    .map(
      (secret) => `
        <article class="secret-card">
          <div class="secret-meta">
            <span>${escapeHTML(secret.nickname)} ${genderIcon(secret.gender)}</span>
            <span>${escapeHTML(secret.category)}</span>
          </div>
          <div class="secret-content">${escapeHTML(secret.content)}</div>
          ${truthMeterMarkup(secret, storedVotes)}
        </article>
      `
    )
    .join('');
  initTruthMeters(listEl);

}

function renderAdminUsers(container, users, currentUserId) {
  if (!container) {
    return;
  }
  if (!users || users.length === 0) {
    container.innerHTML = '<p class="muted-text">No members yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Gender</th>
            <th>Secret Count</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map((user) => {
            const roleLabel = user.isAdmin ? 'Circle Master' : 'Member';
            const disableDelete = user.isAdmin || user.id === currentUserId;
            const actionCell = disableDelete
              ? '<span class="admin-muted">—</span>'
              : `<button type="button" class="admin-btn danger" data-admin-delete-user="${user.id}">Delete</button>`;
            return `
              <tr>
                <td>${escapeHTML(user.nickname)}</td>
                <td>${roleLabel}</td>
                <td>${escapeHTML(user.gender)}</td>
                <td>${user.secretCount}</td>
                <td>${actionCell}</td>
              </tr>
            `;
          })
          .join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('[data-admin-delete-user]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.adminDeleteUser;
      if (!userId) {
        return;
      }
      if (!window.confirm('Delete this member? All of their secrets will vanish.')) {
        return;
      }
      try {
        await fetchJSON(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE'
        });
        btn.dispatchEvent(new CustomEvent('admin:user-deleted', { bubbles: true, detail: { userId } }));
      } catch (err) {
        alert(err.message || 'Failed to delete member.');
      }
    });
  });
}

function renderAdminSecrets(container, secrets) {
  if (!container) {
    return;
  }
  if (!secrets || secrets.length === 0) {
    container.innerHTML = '<p class="muted-text">No secrets have been shared yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Alias</th>
            <th>Category</th>
            <th>Content</th>
            <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${secrets
          .map((secret) => {
            const preview = secret.content.length > 140
              ? `${secret.content.slice(0, 137)}...`
              : secret.content;
            return `
              <tr>
                <td>${secret.id}</td>
                <td>${escapeHTML(secret.nickname)}</td>
                <td>${escapeHTML(secret.category)}</td>
                <td>${escapeHTML(preview)}</td>
                <td><button type="button" class="admin-btn danger" data-admin-delete-secret="${secret.id}">Delete</button></td>
              </tr>
            `;
          })
          .join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('[data-admin-delete-secret]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const secretId = btn.dataset.adminDeleteSecret;
      if (!secretId) {
        return;
      }
      if (!window.confirm('Delete this secret?')) {
        return;
      }
      try {
        await fetchJSON(`/api/admin/secrets/${encodeURIComponent(secretId)}`, {
          method: 'DELETE'
        });
        btn.dispatchEvent(new CustomEvent('admin:secret-deleted', { bubbles: true, detail: { secretId } }));
      } catch (err) {
        alert(err.message || 'Failed to delete secret.');
      }
    });
  });
}

function initAdminPage() {
  try {
    guardAdmin();
  } catch (err) {
    return;
  }

  const currentUser = getUser();
  const usersContainer = document.querySelector('[data-admin-users]');
  const secretsContainer = document.querySelector('[data-admin-secrets]');
  const usersStatus = document.querySelector('[data-admin-users-status]');
  const secretsStatus = document.querySelector('[data-admin-secrets-status]');
  const refreshUsersBtn = document.querySelector('[data-admin-refresh-users]');
  const refreshSecretsBtn = document.querySelector('[data-admin-refresh-secrets]');

  const handleAuthError = (err) => {
    if (err && (err.status === 401 || err.status === 403)) {
      clearAuth();
      window.location.replace('/login.html?next=/admin.html');
      return true;
    }
    return false;
  };

  const loadUsers = async () => {
    if (usersStatus) {
      usersStatus.textContent = 'Loading members...';
    }
    try {
      const users = await fetchJSON('/api/admin/users');
      renderAdminUsers(usersContainer, users, currentUser ? currentUser.id : null);
      if (usersStatus) {
        usersStatus.textContent = '';
      }
    } catch (err) {
      if (handleAuthError(err)) {
        return;
      }
      if (usersStatus) {
        usersStatus.textContent = err.message || 'Unable to load members.';
      }
    }
  };

  const loadSecrets = async () => {
    if (secretsStatus) {
      secretsStatus.textContent = 'Loading secrets...';
    }
    try {
      const secrets = await fetchJSON('/api/admin/secrets');
      renderAdminSecrets(secretsContainer, secrets);
      if (secretsStatus) {
        secretsStatus.textContent = '';
      }
    } catch (err) {
      if (handleAuthError(err)) {
        return;
      }
      if (secretsStatus) {
        secretsStatus.textContent = err.message || 'Unable to load secrets.';
      }
    }
  };

  if (refreshUsersBtn) {
    refreshUsersBtn.addEventListener('click', loadUsers);
  }
  if (refreshSecretsBtn) {
    refreshSecretsBtn.addEventListener('click', loadSecrets);
  }

  if (usersContainer) {
    usersContainer.addEventListener('admin:user-deleted', () => {
      loadUsers();
      loadSecrets();
    });
  }

  if (secretsContainer) {
    secretsContainer.addEventListener('admin:secret-deleted', () => {
      loadSecrets();
    });
  }

  loadUsers();
  loadSecrets();
}

function initReadPage() {
  guardLoggedIn('/login.html?next=/read.html');

  const filterSelect = document.querySelector('[data-filter]');
  const listEl = document.querySelector('[data-secrets-list]');
  const randomBtn = document.querySelector('[data-random-btn]');
  const randomArea = document.querySelector('[data-random-area]');
  const legacyRefreshBtn = document.querySelector('[data-refresh]');
  if (legacyRefreshBtn && legacyRefreshBtn.parentElement) {
    legacyRefreshBtn.parentElement.removeChild(legacyRefreshBtn);
  }
  let dropYoursBtn = document.querySelector('[data-drop-btn]');

  const getSelectedCategoryValue = () => {
    if (!filterSelect) {
      return '';
    }
    return filterSelect.value || '';
  };

  const buildShareTarget = (value = getSelectedCategoryValue()) => {
    return value ? `/share.html?category=${encodeURIComponent(value)}` : '/share.html';
  };

  const getSelectedCategoryLabel = () => {
    if (!filterSelect) {
      return '';
    }
    const option = filterSelect.selectedOptions && filterSelect.selectedOptions[0];
    if (option && option.value) {
      return option.textContent || option.value;
    }
    return '';
  };

  const ensureDropYoursCta = () => {
    if (dropYoursBtn) {
      return dropYoursBtn;
    }
    const section = document.querySelector('.read-list-section');
    if (!section) {
      return null;
    }
    const container = document.createElement('div');
    container.className = 'read-drop-cta';
    const link = document.createElement('a');
    link.className = 'btn drop-btn';
    link.setAttribute('data-drop-btn', '');
    link.setAttribute('aria-label', 'Drop your own secret');
    link.textContent = 'Drop Yours…';
    link.href = buildShareTarget();
    container.appendChild(link);
    section.appendChild(container);
    dropYoursBtn = link;
    return dropYoursBtn;
  };

  const syncDropYoursBtn = (value = getSelectedCategoryValue()) => {
    dropYoursBtn = dropYoursBtn || ensureDropYoursCta();
    if (!dropYoursBtn) {
      return;
    }
    const target = buildShareTarget(value);
    dropYoursBtn.href = target;
    dropYoursBtn.dataset.category = value || '';
  };
  syncDropYoursBtn();

  const buildEmptyState = () => {
    const value = getSelectedCategoryValue();
    const label = getSelectedCategoryLabel();
    const message = label
      ? `No whispers echo within the "${label}" circle yet. Will yours break the silence?`
      : 'No whispers echo within this realm yet. Will yours break the silence?';
    return {
      message,
      buttonText: 'Whisper Into The Void',
      categoryValue: value
    };
  };

  // No list-level click handlers needed without CTA buttons

  function loadCategories() {
    return fetchJSON('/api/categories')
      .then((categories) => {
        populateCategoryOptions(filterSelect, categories, true);
        syncDropYoursBtn();
      })
      .catch(() => {
        renderSecrets(listEl, [], {
          message: 'Categories could not be loaded.',
          buttonText: 'Whisper Into The Void'
        }, getSelectedCategoryValue());
        syncDropYoursBtn();
      });
  }

  loadCategories().then(() => {
    loadSecrets();
    syncDropYoursBtn();
  });

  function loadSecrets() {
    const selected = filterSelect && filterSelect.value ? filterSelect.value : '';
    const query = selected ? `?category=${encodeURIComponent(selected)}` : '';
    fetchJSON(`/api/secrets${query}`)
      .then((secrets) => {
        renderSecrets(listEl, secrets, buildEmptyState(), getSelectedCategoryValue());
      })
      .catch((err) => {
        if (listEl) {
        listEl.innerHTML = `<p class="muted-text">${err.message || 'Secrets could not be retrieved.'}</p>`;
        }
      });
  }

  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      loadSecrets();
      syncDropYoursBtn();
    });
  }

  if (randomBtn && randomArea) {
    randomBtn.addEventListener('click', async () => {
      randomBtn.disabled = true;
      randomBtn.textContent = 'Loading...';
      randomArea.innerHTML = '';
      try {
        const secret = await fetchJSON('/api/random');
        randomArea.innerHTML = `
          <article class="secret-card">
            <div class="secret-meta">
              <span>${escapeHTML(secret.nickname)} ${genderIcon(secret.gender)}</span>
              <span>${escapeHTML(secret.category)}</span>
            </div>
            <div class="secret-content">${escapeHTML(secret.content)}</div>
            ${truthMeterMarkup(secret, getTruthMeterVotesStore())}
          </article>
        `;
        initTruthMeters(randomArea);
      } catch (err) {
        randomArea.innerHTML = `<p class="muted-text">${err.message || 'No secrets yet.'}</p>`;
      } finally {
        randomBtn.disabled = false;
        randomBtn.textContent = 'Show A Random Secret';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initIntroOverlay();
  renderNav();
  updateUserContext();
  initTruthMeters(document.body);
  enforceAuthLinks();

  const page = document.body.dataset.page;
  switch (page) {
    case 'index':
      initIndexPage();
      break;
    case 'register':
      initRegisterPage();
      break;
    case 'login':
      initLoginPage();
      break;
    case 'share':
      initSharePage();
      break;
    case 'read':
      initReadPage();
      break;
    case 'admin':
      initAdminPage();
      break;
    default:
      break;
  }
});

window.mySecretApp = {
  setAuth,
  getToken,
  getUser,
  clearAuth,
  fetchJSON,
  genderIcon,
  escapeHTML,
  guardLoggedIn,
  guardAdmin
};
