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
  getRandomSecret
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
    return res.status(400).json({ message: 'Content must be between 2 and 2000 characters.' });
  }

  const now = Date.now();
  const lastPost = lastPostMap.get(req.user.id) || 0;
  if (now - lastPost < POST_WINDOW_MS) {
    return res.status(429).json({ message: 'You are sharing too quickly. Please wait a moment.' });
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
    return res.status(500).json({ message: 'Failed to fetch secrets.' });
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
    return res.status(500).json({ message: 'Failed to fetch random secret.' });
  }
});

module.exports = router;
