const express = require('express');

const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
  listUsersWithStats,
  listAllSecrets,
  deleteUserById,
  deleteSecretById
} = require('../db/database');

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/users', async (req, res) => {
  try {
    const users = await listUsersWithStats();
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ message: 'Kullanıcılar getirilemedi.' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ message: 'Kendi hesabını silemezsin.' });
  }
  try {
    const removed = await deleteUserById(id);
    if (!removed) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }
    return res.json({ message: 'Kullanıcı silindi.' });
  } catch (err) {
    return res.status(500).json({ message: 'Kullanıcı silinemedi.' });
  }
});

router.get('/secrets', async (req, res) => {
  try {
    const secrets = await listAllSecrets();
    return res.json(secrets);
  } catch (err) {
    return res.status(500).json({ message: 'Sırlar getirilemedi.' });
  }
});

router.delete('/secrets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const removed = await deleteSecretById(Number(id));
    if (!removed) {
      return res.status(404).json({ message: 'Sır bulunamadı.' });
    }
    return res.json({ message: 'Sır silindi.' });
  } catch (err) {
    return res.status(500).json({ message: 'Sır silinemedi.' });
  }
});

module.exports = router;
