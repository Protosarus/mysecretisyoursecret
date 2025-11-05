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
      ? `<a class="nav-btn" href="/admin.html" data-requires-auth="true" data-redirect="/admin.html">Admin Panel</a>`
      : '';
    navRight.innerHTML = `
      ${adminLink}
      <span class="user-badge" data-user-badge>
        <span>${escapeHTML(user.nickname)}</span>
        <span>${genderIcon(user.gender)}</span>
      </span>
      <button type="button" class="nav-btn" data-logout>
        Çıkış
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
      <a class="nav-btn" href="/login.html">Giriş</a>
      <a class="nav-btn primary" href="/register.html">Kayıt Ol</a>
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
      welcome.innerHTML = `Hoş geldin, ${escapeHTML(user.nickname)} ${genderIcon(user.gender)}`;
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
        randomBtn.textContent = 'Yükleniyor...';
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
          randomOutput.innerHTML = `<p class="muted-text">Henüz sır yok.</p>`;
        } finally {
          randomBtn.disabled = false;
          randomBtn.textContent = 'Rastgele Sır Göster';
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
        errorEl.textContent = 'Takma ad 2-32 karakter arasında olmalı.';
      }
      return;
    }

    if (password.length < 6) {
      if (errorEl) {
        errorEl.textContent = 'Şifre en az 6 karakter olmalı.';
      }
      return;
    }

    try {
      const payload = await fetchJSON('/api/register', {
        method: 'POST',
        body: { nickname, password, gender }
      });
      if (successEl) {
        successEl.textContent = 'Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz.';
      }
      setTimeout(() => {
        window.location.href = loginRedirect;
      }, 1600);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Kayıt başarısız.';
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
        errorEl.textContent = 'Takma ad ve şifre gerekli.';
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
        errorEl.textContent = err.message || 'Giriş başarısız.';
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
        return '<option value="">Tüm kategoriler</option>';
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

  fetchJSON('/api/categories')
    .then((categories) => {
      populateCategoryOptions(categorySelect, categories);
    })
    .catch(() => {
      if (statusEl) {
        statusEl.textContent = 'Kategoriler yüklenemedi.';
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
        statusEl.textContent = 'Lütfen bir kategori seç.';
        statusEl.classList.add('form-error');
      }
      return;
    }

    if (content.length < 2) {
      if (statusEl) {
        statusEl.textContent = 'Sır metni çok kısa.';
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
        statusEl.textContent = 'Sır başarıyla paylaşıldı!';
        statusEl.classList.add('form-success');
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = err.message || 'Paylaşım başarısız.';
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
    listEl.innerHTML = '<p class="muted-text">Henüz paylaşım yok. İlk fısıltıyı sen bırak.</p>';
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

function renderAdminUsers(container, users, currentUserId) {
  if (!container) {
    return;
  }
  if (!users || users.length === 0) {
    container.innerHTML = '<p class="muted-text">Kayıtlı kullanıcı yok.</p>';
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Kullanıcı</th>
            <th>Rol</th>
            <th>Cinsiyet</th>
            <th>Sır Sayısı</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map((user) => {
            const roleLabel = user.isAdmin ? 'Admin' : 'Üye';
            const disableDelete = user.isAdmin || user.id === currentUserId;
            const actionCell = disableDelete
              ? '<span class="admin-muted">—</span>'
              : `<button type="button" class="admin-btn danger" data-admin-delete-user="${user.id}">Sil</button>`;
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
      if (!window.confirm('Bu kullanıcı silinsin mi? Buna ait tüm sırlar da silinecek.')) {
        return;
      }
      try {
        await fetchJSON(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE'
        });
        btn.dispatchEvent(new CustomEvent('admin:user-deleted', { bubbles: true, detail: { userId } }));
      } catch (err) {
        alert(err.message || 'Kullanıcı silinemedi.');
      }
    });
  });
}

function renderAdminSecrets(container, secrets) {
  if (!container) {
    return;
  }
  if (!secrets || secrets.length === 0) {
    container.innerHTML = '<p class="muted-text">Henüz sır paylaşılmamış.</p>';
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Takma Ad</th>
            <th>Kategori</th>
            <th>İçerik</th>
            <th>İşlem</th>
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
                <td><button type="button" class="admin-btn danger" data-admin-delete-secret="${secret.id}">Sil</button></td>
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
      if (!window.confirm('Bu sır silinsin mi?')) {
        return;
      }
      try {
        await fetchJSON(`/api/admin/secrets/${encodeURIComponent(secretId)}`, {
          method: 'DELETE'
        });
        btn.dispatchEvent(new CustomEvent('admin:secret-deleted', { bubbles: true, detail: { secretId } }));
      } catch (err) {
        alert(err.message || 'Sır silinemedi.');
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
      usersStatus.textContent = 'Kullanıcılar yükleniyor...';
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
        usersStatus.textContent = err.message || 'Kullanıcılar yüklenemedi.';
      }
    }
  };

  const loadSecrets = async () => {
    if (secretsStatus) {
      secretsStatus.textContent = 'Sırlar yükleniyor...';
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
        secretsStatus.textContent = err.message || 'Sırlar yüklenemedi.';
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

  function loadCategories() {
    return fetchJSON('/api/categories')
      .then((categories) => {
        populateCategoryOptions(filterSelect, categories, true);
      })
      .catch(() => {
        renderSecrets(listEl, []);
      });
  }

  loadCategories().then(() => loadSecrets());

  function loadSecrets() {
    const selected = filterSelect && filterSelect.value ? filterSelect.value : '';
    const query = selected ? `?category=${encodeURIComponent(selected)}` : '';
    fetchJSON(`/api/secrets${query}`)
      .then((secrets) => {
        renderSecrets(listEl, secrets);
      })
      .catch((err) => {
        if (listEl) {
          listEl.innerHTML = `<p class="muted-text">${err.message || 'Sırlar getirilemedi.'}</p>`;
        }
      });
  }

  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      loadSecrets();
    });
  }

  const refreshBtn = document.querySelector('[data-refresh]');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadSecrets();
    });
  }

  if (randomBtn && randomArea) {
    randomBtn.addEventListener('click', async () => {
      randomBtn.disabled = true;
      randomBtn.textContent = 'Yükleniyor...';
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
        randomArea.innerHTML = `<p class="muted-text">${err.message || 'Henüz sır yok.'}</p>`;
      } finally {
        randomBtn.disabled = false;
        randomBtn.textContent = 'Rastgele Sır Göster';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  updateUserContext();
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
