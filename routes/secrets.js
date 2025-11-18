const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { cleanInput } = require('../utils/sanitize');
const {
  CATEGORIES,
  isValidCategory,
  isValidContent
} = require('../utils/validate');
const {
  insertSecret,
  listSecrets,
  getRandomSecret,
  incrementTruthinessVote
} = require('../db/database');

const router = express.Router();

const POST_WINDOW_MS = 15000;
const lastPostMap = new Map();

router.use(requireAuth);

router.get('/categories', (req, res) => {
  return res.json(CATEGORIES);
});

router.post('/secrets', async (req, res) => {
  const { category, content } = req.body || {};

  let categoryClean;
  let contentClean;

  try {
    categoryClean = cleanInput(category);
  } catch (err) {
    return res.status(400).json({ message: 'Invalid category.' });
  }

  try {
    contentClean = cleanInput(content, { allowNewlines: true });
  } catch (err) {
    return res.status(400).json({ message: 'Invalid content.' });
  }

  if (!isValidCategory(categoryClean)) {
    return res.status(400).json({ message: 'Unknown category.' });
  }

  if (!isValidContent(contentClean)) {
    return res.status(400).json({ message: 'Secret must be between 2 and 2000 characters.' });
  }

  const now = Date.now();
  const lastPost = lastPostMap.get(req.user.id) || 0;
  if (now - lastPost < POST_WINDOW_MS) {
    return res.status(429).json({ message: 'You are whispering too quickly—please wait a moment.' });
  }

  try {
    await insertSecret({
      user_id: req.user.id,
      category: categoryClean,
      content: contentClean
    });
    lastPostMap.set(req.user.id, now);
    return res.status(201).json({ message: 'Secret shared.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to share secret.' });
  }
});

router.get('/secrets', async (req, res) => {
  const categoryParam = req.query.category;
  let categoryFilter;

  if (categoryParam) {
    try {
      categoryFilter = cleanInput(categoryParam);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid category filter.' });
    }

    if (!isValidCategory(categoryFilter)) {
      return res.status(400).json({ message: 'Unknown category.' });
    }
  }

  try {
    const secrets = await listSecrets({ category: categoryFilter });
    return res.json(secrets);
  } catch (err) {
    return res.status(500).json({ message: 'Secrets could not be retrieved.' });
  }
});

router.get('/random', async (req, res) => {
  try {
    const secret = await getRandomSecret();
    if (!secret) {
      return res.status(404).json({ message: 'No secrets yet.' });
    }
    return res.json(secret);
  } catch (err) {
    return res.status(500).json({ message: 'Random secret could not be retrieved.' });
  }
});

async function handleTruthMeterVote(secretIdRaw, voteRaw, res) {
  const secretId = Number.parseInt(secretIdRaw, 10);
  if (!Number.isInteger(secretId) || secretId <= 0) {
    return res.status(400).json({ message: 'Invalid secret.' });
  }

  const vote = typeof voteRaw === 'string' ? voteRaw.toLowerCase() : '';
  if (vote !== 'truth' && vote !== 'lie') {
    return res.status(400).json({ message: 'Invalid vote.' });
  }

  try {
    const tallies = await incrementTruthinessVote(secretId, vote);
    if (!tallies) {
      return res.status(404).json({ message: 'Secret not found.' });
    }

    const truthVotes = Number(tallies.truthVotes) || 0;
    const lieVotes = Number(tallies.lieVotes) || 0;
    const total = truthVotes + lieVotes;
    const truthPercent = total === 0 ? 0 : Math.round((truthVotes / total) * 1000) / 10;
    const liePercent = total === 0 ? 0 : Math.round((lieVotes / total) * 1000) / 10;

    return res.json({
      secretId,
      vote,
      truthVotes,
      lieVotes,
      truthPercent,
      liePercent
    });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to record vote.' });
  }
}

router.post('/secrets/:id/truth-meter', async (req, res) => {
  return handleTruthMeterVote(req.params.id, req.body && req.body.vote, res);
});

router.post('/truth-meter', async (req, res) => {
  const { secretId, vote } = req.body || {};
  return handleTruthMeterVote(secretId, vote, res);
});

module.exports = router;
