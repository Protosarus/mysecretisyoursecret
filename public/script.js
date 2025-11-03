const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

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
    window.location.href = redirectIfMissing;
    throw new Error('Redirecting to login.');
  }
}

function renderNav() {
  const navRight = document.querySelector('[data-nav-auth]');
  if (!navRight) {
    return;
  }

  const user = getUser();
  if (user) {
    navRight.innerHTML = `
      <span class="user-badge" data-user-badge>
        <span>${escapeHTML(user.nickname)}</span>
        <span>${genderIcon(user.gender)}</span>
      </span>
      <button type="button" class="link-button" data-logout>
        Log out
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
      <a class="nav-link" href="/login.html">Login</a>
      <a class="nav-link" href="/register.html">Register</a>
    `;
  }
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
            </div>
          `;
          randomContainer.classList.remove('hidden');
        } catch (err) {
          randomOutput.innerHTML = `<p class="muted-text">No secrets yet.</p>`;
        } finally {
          randomBtn.disabled = false;
          randomBtn.textContent = 'Show Random Secret';
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
      setAuth(payload.token, payload.user);
      window.location.href = '/share.html';
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Registration failed.';
      }
    }
  });
}

function initLoginPage() {
  if (getToken()) {
    window.location.href = '/read.html';
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
      window.location.href = '/read.html';
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Login failed.';
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
  guardLoggedIn();
  const categorySelect = document.querySelector('select[name="category"]');
  const form = document.querySelector('form');
  const statusEl = document.querySelector('[data-share-status]');

  fetchJSON('/api/categories')
    .then((categories) => {
      populateCategoryOptions(categorySelect, categories);
    })
    .catch(() => {
      if (statusEl) {
        statusEl.textContent = 'Failed to load categories.';
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

    const category = categorySelect.value;
    const content = form.content.value.trim();

    if (!category) {
      if (statusEl) {
        statusEl.textContent = 'Choose a category.';
        statusEl.classList.add('form-error');
      }
      return;
    }

    if (content.length < 2) {
      if (statusEl) {
        statusEl.textContent = 'Secret is too short.';
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
      if (statusEl) {
        statusEl.textContent = 'Secret shared! Read what others say.';
        statusEl.classList.add('form-success');
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = err.message || 'Failed to share.';
        statusEl.classList.add('form-error');
      }
    }
  });
}

function renderSecrets(listEl, secrets) {
  if (!listEl) {
    return;
  }

  if (!secrets || secrets.length === 0) {
    listEl.innerHTML = '<p class="muted-text">No secrets yet. Be the first to share one.</p>';
    return;
  }

  listEl.innerHTML = secrets
    .map(
      (secret) => `
        <article class="secret-card">
          <div class="secret-meta">
            <span>${escapeHTML(secret.nickname)} ${genderIcon(secret.gender)}</span>
            <span>${escapeHTML(secret.category)}</span>
          </div>
          <div class="secret-content">${escapeHTML(secret.content)}</div>
        </article>
      `
    )
    .join('');
}

function initReadPage() {
  guardLoggedIn();

  const filterSelect = document.querySelector('[data-filter]');
  const listEl = document.querySelector('[data-secrets-list]');
  const randomBtn = document.querySelector('[data-random-btn]');
  const randomArea = document.querySelector('[data-random-area]');

  fetchJSON('/api/categories')
    .then((categories) => {
      populateCategoryOptions(filterSelect, categories, true);
      loadSecrets();
    })
    .catch(() => {
      renderSecrets(listEl, []);
    });

  function loadSecrets() {
    const selected = filterSelect && filterSelect.value ? filterSelect.value : '';
    const query = selected ? `?category=${encodeURIComponent(selected)}` : '';
    fetchJSON(`/api/secrets${query}`)
      .then((secrets) => {
        renderSecrets(listEl, secrets);
      })
      .catch((err) => {
        if (listEl) {
          listEl.innerHTML = `<p class="muted-text">${err.message || 'Failed to fetch secrets.'}</p>`;
        }
      });
  }

  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      loadSecrets();
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
          </article>
        `;
      } catch (err) {
        randomArea.innerHTML = `<p class="muted-text">${err.message || 'No secrets yet.'}</p>`;
      } finally {
        randomBtn.disabled = false;
        randomBtn.textContent = 'Show Random Secret';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  updateUserContext();

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
  guardLoggedIn
};
