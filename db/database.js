const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'secrets.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY,
    nickname TEXT UNIQUE NOT NULL,
    nickname_raw TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    gender TEXT NOT NULL CHECK(gender IN ('male','female','other')),
    is_admin INTEGER NOT NULL DEFAULT 0
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS secrets(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    truthVotes INTEGER NOT NULL DEFAULT 0,
    lieVotes INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_secrets_created_at ON secrets(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_secrets_category ON secrets(category);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS truth_meter_votes(
    secret_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK(vote_type IN ('truth','lie')),
    PRIMARY KEY(secret_id, user_id),
    FOREIGN KEY(secret_id) REFERENCES secrets(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

function safeAddColumn(sql, label) {
  try {
    db.exec(sql);
  } catch (err) {
    if (!/duplicate column name/i.test(err.message || '')) {
      console.error(`Failed to add ${label}:`, err.message);
    }
  }
}

safeAddColumn('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0', 'is_admin column');
safeAddColumn('ALTER TABLE secrets ADD COLUMN truthVotes INTEGER NOT NULL DEFAULT 0', 'truthVotes column');
safeAddColumn('ALTER TABLE secrets ADD COLUMN lieVotes INTEGER NOT NULL DEFAULT 0', 'lieVotes column');

const getUserByNicknameStmt = db.prepare('SELECT * FROM users WHERE nickname = ?');
const insertUserStmt = db.prepare(`
  INSERT INTO users (id, nickname, nickname_raw, password_hash, gender, is_admin)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertSecretStmt = db.prepare(`
  INSERT INTO secrets (user_id, category, content)
  VALUES (?, ?, ?)
`);
const listSecretsAllStmt = db.prepare(`
  SELECT
    secrets.id,
    secrets.category,
    secrets.content,
    secrets.truthVotes,
    secrets.lieVotes,
    secrets.created_at,
    users.nickname_raw AS nickname,
    users.gender
  FROM secrets
  JOIN users ON users.id = secrets.user_id
  ORDER BY secrets.created_at DESC
  LIMIT 100
`);
const listSecretsByCategoryStmt = db.prepare(`
  SELECT
    secrets.id,
    secrets.category,
    secrets.content,
    secrets.truthVotes,
    secrets.lieVotes,
    secrets.created_at,
    users.nickname_raw AS nickname,
    users.gender
  FROM secrets
  JOIN users ON users.id = secrets.user_id
  WHERE secrets.category = ?
  ORDER BY secrets.created_at DESC
  LIMIT 100
`);
const randomSecretStmt = db.prepare(`
  SELECT
    secrets.id,
    secrets.category,
    secrets.content,
    secrets.truthVotes,
    secrets.lieVotes,
    secrets.created_at,
    users.nickname_raw AS nickname,
    users.gender
  FROM secrets
  JOIN users ON users.id = secrets.user_id
  ORDER BY RANDOM()
  LIMIT 1
`);
const setUserAdminStmt = db.prepare('UPDATE users SET is_admin = ? WHERE id = ?');
const updatePasswordStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
const listUsersWithStatsStmt = db.prepare(`
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
`);
const deleteSecretsByUserStmt = db.prepare('DELETE FROM secrets WHERE user_id = ?');
const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');
const deleteSecretStmt = db.prepare('DELETE FROM secrets WHERE id = ?');
const listAllSecretsStmt = db.prepare(`
  SELECT
    secrets.id,
    secrets.category,
    secrets.content,
    secrets.truthVotes,
    secrets.lieVotes,
    secrets.created_at,
    users.nickname_raw AS nickname,
    users.gender
  FROM secrets
  JOIN users ON users.id = secrets.user_id
  ORDER BY secrets.created_at DESC
  LIMIT ?
`);
const selectVoteTalliesStmt = db.prepare('SELECT truthVotes, lieVotes FROM secrets WHERE id = ?');
const updateVoteTalliesStmt = db.prepare(
  'UPDATE secrets SET truthVotes = ?, lieVotes = ? WHERE id = ?'
);

const deleteUserTx = db.transaction((userId) => {
  deleteSecretsByUserStmt.run(userId);
  const result = deleteUserStmt.run(userId);
  return result.changes > 0;
});

function wrapSync(fn) {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err);
  }
}

function normalizeNickname(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.trim().toLowerCase();
}

function getUserByNicknameNormalized(nickNorm) {
  return wrapSync(() => getUserByNicknameStmt.get(nickNorm) || null);
}

function createUser({
  id,
  nickname_raw,
  nickname_norm,
  gender,
  password_hash,
  is_admin = 0
}) {
  return wrapSync(() => {
    insertUserStmt.run(id, nickname_norm, nickname_raw, password_hash, gender, is_admin ? 1 : 0);
    return true;
  });
}

function insertSecret({ user_id, category, content }) {
  return wrapSync(() => {
    const info = insertSecretStmt.run(user_id, category, content);
    return info.lastInsertRowid;
  });
}

function listSecrets({ category } = {}) {
  return wrapSync(() => {
    if (category) {
      return listSecretsByCategoryStmt.all(category);
    }
    return listSecretsAllStmt.all();
  });
}

function getRandomSecret() {
  return wrapSync(() => randomSecretStmt.get() || null);
}

function setUserAdmin(userId, isAdmin) {
  return wrapSync(() => {
    const result = setUserAdminStmt.run(isAdmin ? 1 : 0, userId);
    return result.changes > 0;
  });
}

function updateUserPassword(userId, password_hash) {
  return wrapSync(() => {
    const result = updatePasswordStmt.run(password_hash, userId);
    return result.changes > 0;
  });
}

function listUsersWithStats() {
  return wrapSync(() => listUsersWithStatsStmt.all());
}

function deleteUserById(userId) {
  return wrapSync(() => deleteUserTx(userId));
}

function deleteSecretById(secretId) {
  return wrapSync(() => {
    const result = deleteSecretStmt.run(secretId);
    return result.changes > 0;
  });
}

function listAllSecrets(limit = 200) {
  return wrapSync(() => listAllSecretsStmt.all(limit));
}

function incrementTruthinessVote(secretId, voteType, userId) {
  return wrapSync(() => {
    const tallies = selectVoteTalliesStmt.get(secretId);
    if (!tallies) {
      return null;
    }
    
    // Check if user already voted (userId provided)
    if (userId) {
      const existingVote = db.prepare(
        'SELECT * FROM truth_meter_votes WHERE secret_id = ? AND user_id = ?'
      ).get(secretId, userId);
      
      if (existingVote) {
        // User already voted, don't count again
        return { truthVotes: tallies.truthVotes, lieVotes: tallies.lieVotes };
      }
    }
    
    let truthVotes = Number(tallies.truthVotes) || 0;
    let lieVotes = Number(tallies.lieVotes) || 0;
    if (voteType === 'truth') {
      truthVotes += 1;
    } else {
      lieVotes += 1;
    }
    
    // Record user vote if userId provided
    if (userId) {
      db.prepare(
        'INSERT OR IGNORE INTO truth_meter_votes (secret_id, user_id, vote_type) VALUES (?, ?, ?)'
      ).run(secretId, userId, voteType);
    }
    
    const result = updateVoteTalliesStmt.run(truthVotes, lieVotes, secretId);
    if (!result.changes) {
      return null;
    }
    return { truthVotes, lieVotes };
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
  listAllSecrets,
  incrementTruthinessVote
};
