// RUN GUIDE:
// 1) npm install
// 2) Create .env (sample below) or rely on defaults
// 3) npm start
// 4) Open http://localhost:5000
// Sample .env:
// PORT=5000
// JWT_SECRET=change_this_in_production
// NODE_ENV=development

/**
 * Environment variables:
 * - PORT: Port number for the HTTP server (defaults to 5000)
 * - JWT_SECRET: Secret key used to sign JWT tokens (defaults to a development fallback)
 * - NODE_ENV: Execution environment (development/production/etc.)
 */
require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const privacy = require('./middleware/privacy');
const { issueToken, requireAuth } = require('./middleware/auth');
const {
  getUserByNicknameNormalized,
  createUser,
  normalizeNickname
} = require('./db/database');
const { cleanInput } = require('./utils/sanitize');
const {
  isValidNickname,
  isValidPassword,
  isValidGender
} = require('./utils/validate');
const secretsRouter = require('./routes/secrets');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '100kb' }));
app.use(privacy);

app.use(express.static(path.join(__dirname, 'public')));

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ message });
}

app.post('/api/register', async (req, res) => {
  const { nickname, password, gender } = req.body || {};

  let nicknameClean;
  let passwordClean;
  let genderClean;

  try {
    nicknameClean = cleanInput(nickname);
  } catch (err) {
    return sendError(res, 400, 'Invalid nickname.');
  }

  try {
    passwordClean = cleanInput(password);
  } catch (err) {
    return sendError(res, 400, 'Invalid password.');
  }

  try {
    genderClean = cleanInput(gender);
  } catch (err) {
    return sendError(res, 400, 'Invalid gender.');
  }

  if (!isValidNickname(nicknameClean)) {
    return sendError(res, 400, 'Nickname must be 2-32 characters.');
  }

  if (!isValidPassword(passwordClean)) {
    return sendError(res, 400, 'Password must be 6-128 characters.');
  }

  if (!isValidGender(genderClean)) {
    return sendError(res, 400, 'Invalid gender selection.');
  }

  const nicknameNormalized = normalizeNickname(nicknameClean);

  try {
    const existing = await getUserByNicknameNormalized(nicknameNormalized);
    if (existing) {
      return sendError(res, 409, 'Nickname already taken.');
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(passwordClean, 12);

    await createUser({
      id: userId,
      nickname_raw: nicknameClean,
      nickname_norm: nicknameNormalized,
      gender: genderClean,
      password_hash: passwordHash
    });

    const userPayload = {
      id: userId,
      nickname: nicknameClean,
      gender: genderClean
    };
    const token = issueToken(userPayload);

    return res.status(201).json({
      token,
      user: userPayload
    });
  } catch (err) {
    return sendError(res, 500, 'Failed to register user.');
  }
});

app.post('/api/login', async (req, res) => {
  const { nickname, password } = req.body || {};

  let nicknameClean;
  let passwordClean;
  try {
    nicknameClean = cleanInput(nickname);
  } catch (err) {
    return sendError(res, 400, 'Invalid nickname.');
  }

  try {
    passwordClean = cleanInput(password);
  } catch (err) {
    return sendError(res, 400, 'Invalid password.');
  }

  if (!isValidNickname(nicknameClean) || !isValidPassword(passwordClean)) {
    return sendError(res, 400, 'Invalid credentials.');
  }

  const nicknameNormalized = normalizeNickname(nicknameClean);

  try {
    const user = await getUserByNicknameNormalized(nicknameNormalized);
    if (!user) {
      return sendError(res, 401, 'Invalid credentials.');
    }

    const passwordMatch = await bcrypt.compare(passwordClean, user.password_hash);
    if (!passwordMatch) {
      return sendError(res, 401, 'Invalid credentials.');
    }

    const userPayload = {
      id: user.id,
      nickname: user.nickname_raw,
      gender: user.gender
    };
    const token = issueToken(userPayload);

    return res.json({
      token,
      user: userPayload
    });
  } catch (err) {
    return sendError(res, 500, 'Failed to process login.');
  }
});

app.get('/api/me', requireAuth, (req, res) => {
  return res.json({
    id: req.user.id,
    nickname: req.user.nickname,
    gender: req.user.gender
  });
});

app.use('/api', secretsRouter);

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return sendError(res, 404, 'Not found.');
  }
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  return sendError(res, err.statusCode || 500, err.message || 'Internal server error.');
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log('Server running on http://localhost:5000');
});
