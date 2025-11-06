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
    return res.status(500).json({ message: 'Members could not be retrieved.' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete your own account.' });
  }
  try {
    const removed = await deleteUserById(id);
    if (!removed) {
      return res.status(404).json({ message: 'Member not found.' });
    }
    return res.json({ message: 'Member deleted.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete member.' });
  }
});

router.get('/secrets', async (req, res) => {
  try {
    const secrets = await listAllSecrets();
    return res.json(secrets);
  } catch (err) {
    return res.status(500).json({ message: 'Secrets could not be retrieved.' });
  }
});

router.delete('/secrets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const removed = await deleteSecretById(Number(id));
    if (!removed) {
      return res.status(404).json({ message: 'Secret not found.' });
    }
    return res.json({ message: 'Secret deleted.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete secret.' });
  }
});

module.exports = router;
