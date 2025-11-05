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
    return res.status(400).json({ message: 'Geçersiz kategori.' });
  }

  try {
    contentClean = cleanInput(content, { allowNewlines: true });
  } catch (err) {
    return res.status(400).json({ message: 'Geçersiz içerik.' });
  }

  if (!isValidCategory(categoryClean)) {
    return res.status(400).json({ message: 'Bilinmeyen kategori.' });
  }

  if (!isValidContent(contentClean)) {
    return res.status(400).json({ message: 'Sır metni 2 ile 2000 karakter arasında olmalı.' });
  }

  const now = Date.now();
  const lastPost = lastPostMap.get(req.user.id) || 0;
  if (now - lastPost < POST_WINDOW_MS) {
    return res.status(429).json({ message: 'Çok hızlı paylaşıyorsun, lütfen biraz bekle.' });
  }

  try {
    await insertSecret({
      user_id: req.user.id,
      category: categoryClean,
      content: contentClean
    });
    lastPostMap.set(req.user.id, now);
    return res.status(201).json({ message: 'Sır paylaşıldı.' });
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
      return res.status(400).json({ message: 'Geçersiz kategori filtresi.' });
    }

    if (!isValidCategory(categoryFilter)) {
      return res.status(400).json({ message: 'Bilinmeyen kategori.' });
    }
  }

  try {
    const secrets = await listSecrets({ category: categoryFilter });
    return res.json(secrets);
  } catch (err) {
    return res.status(500).json({ message: 'Sırlar getirilemedi.' });
  }
});

router.get('/random', async (req, res) => {
  try {
    const secret = await getRandomSecret();
    if (!secret) {
      return res.status(404).json({ message: 'Henüz paylaşım yok.' });
    }
    return res.json(secret);
  } catch (err) {
    return res.status(500).json({ message: 'Rastgele sır getirilemedi.' });
  }
});

module.exports = router;
