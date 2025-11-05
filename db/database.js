const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'secrets.db');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY,
      nickname TEXT UNIQUE NOT NULL,
      nickname_raw TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      gender TEXT NOT NULL CHECK (gender IN ('male','female','other')),
      is_admin INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS secrets(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_secrets_created_at
    ON secrets(created_at DESC)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_secrets_category
    ON secrets(category)
  `);
  db.run(
    'ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0',
    (err) => {
      if (err && !/duplicate column name/i.test(err.message || '')) {
        console.error('Failed to add is_admin column:', err.message);
      }
    }
  );
});

function normalizeNickname(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.trim().toLowerCase();
}

function getUserByNicknameNormalized(nickNorm) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM users WHERE nickname = ?',
      [nickNorm],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        return resolve(row || null);
      }
    );
  });
}

function createUser({
  id,
  nickname_raw,
  nickname_norm,
  gender,
  password_hash,
  is_admin = 0
}) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        INSERT INTO users (id, nickname, nickname_raw, password_hash, gender, is_admin)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, nickname_norm, nickname_raw, password_hash, gender, is_admin ? 1 : 0],
      (err) => {
        if (err) {
          return reject(err);
        }
        resolve(true);
      }
    );
  });
}

function insertSecret({ user_id, category, content }) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        INSERT INTO secrets (user_id, category, content)
        VALUES (?, ?, ?)
      `,
      [user_id, category, content],
      function onComplete(err) {
        if (err) {
          return reject(err);
        }
        resolve(this.lastID);
      }
    );
  });
}

function listSecrets({ category } = {}) {
  const params = [];
  let query = `
    SELECT
      secrets.id,
      secrets.category,
      secrets.content,
      secrets.created_at,
      users.nickname_raw AS nickname,
      users.gender
    FROM secrets
    JOIN users ON users.id = secrets.user_id
  `;

  if (category) {
    query += ' WHERE secrets.category = ?';
    params.push(category);
  }

  query += ' ORDER BY secrets.created_at DESC LIMIT 100';

  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows || []);
    });
  });
}

function getRandomSecret() {
  return new Promise((resolve, reject) => {
    db.get(
      `
        SELECT
          secrets.id,
          secrets.category,
          secrets.content,
          secrets.created_at,
          users.nickname_raw AS nickname,
          users.gender
        FROM secrets
        JOIN users ON users.id = secrets.user_id
        ORDER BY RANDOM()
        LIMIT 1
      `,
      [],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row || null);
      }
    );
  });
}

function setUserAdmin(userId, isAdmin) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET is_admin = ? WHERE id = ?',
      [isAdmin ? 1 : 0, userId],
      function onComplete(err) {
        if (err) {
          return reject(err);
        }
        resolve(this.changes > 0);
      }
    );
  });
}

function updateUserPassword(userId, password_hash) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [password_hash, userId],
      function onComplete(err) {
        if (err) {
          return reject(err);
        }
        resolve(this.changes > 0);
      }
    );
  });
}

function listUsersWithStats() {
  return new Promise((resolve, reject) => {
    db.all(
      `
        SELECT
          u.id,
          u.nickname_raw AS nickname,
          u.gender,
          u.is_admin AS isAdmin,
          COUNT(s.id) AS secretCount
        FROM users u
        LEFT JOIN secrets s ON s.user_id = u.id
        GROUP BY u.id
        ORDER BY u.nickname_raw COLLATE NOCASE
      `,
      [],
      (err, rows) => {
        if (err) {
          return reject(err);
        }
        resolve(rows || []);
      }
    );
  });
}

function deleteUserById(userId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM secrets WHERE user_id = ?', [userId], (secretErr) => {
      if (secretErr) {
        return reject(secretErr);
      }
      db.run(
        'DELETE FROM users WHERE id = ?',
        [userId],
        function onComplete(userErr) {
          if (userErr) {
            return reject(userErr);
          }
          resolve(this.changes > 0);
        }
      );
    });
  });
}

function deleteSecretById(secretId) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM secrets WHERE id = ?',
      [secretId],
      function onComplete(err) {
        if (err) {
          return reject(err);
        }
        resolve(this.changes > 0);
      }
    );
  });
}

function listAllSecrets(limit = 200) {
  return new Promise((resolve, reject) => {
    db.all(
      `
        SELECT
          secrets.id,
          secrets.category,
          secrets.content,
          secrets.created_at,
          users.nickname_raw AS nickname,
          users.gender
        FROM secrets
        JOIN users ON users.id = secrets.user_id
        ORDER BY secrets.created_at DESC
        LIMIT ?
      `,
      [limit],
      (err, rows) => {
        if (err) {
          return reject(err);
        }
        resolve(rows || []);
      }
    );
  });
}

module.exports = {
  db,
  normalizeNickname,
  getUserByNicknameNormalized,
  createUser,
  insertSecret,
  listSecrets,
  getRandomSecret,
  setUserAdmin,
  updateUserPassword,
  listUsersWithStats,
  deleteUserById,
  deleteSecretById,
  listAllSecrets
};
