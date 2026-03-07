const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, admin } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Routes protégées (nécessitent authentification)
router.use(protect);

router.get('/profile', userController.getProfile);
router.put('/profile', upload.single('photo'), userController.updateProfile);
router.delete('/profile', userController.deleteAccount);
router.get('/search', userController.searchUsers);
router.get('/:id', userController.getUserById);

// Route admin pour modifier le rôle (protégée par admin)
router.put('/:id/role', admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }

    await pool.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );

    res.json({ message: 'Rôle mis à jour avec succès', role });
  } catch (error) {
    console.error('❌ Erreur mise à jour rôle:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;