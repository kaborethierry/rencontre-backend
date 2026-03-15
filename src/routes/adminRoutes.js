const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const postController = require('../controllers/postController');
const { protect, admin } = require('../middlewares/authMiddleware');

// Appliquer les middlewares à toutes les routes
router.use(protect);
router.use(admin);

// Tableau de bord
router.get('/dashboard', adminController.getDashboardStats);

// Gestion des utilisateurs
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/toggle', adminController.toggleUserStatus);
router.delete('/users/:id', adminController.deleteUser);

// Gestion des posts - avec log explicite
router.get('/posts', (req, res, next) => {
  console.log('📌 Route /admin/posts appelée');
  next();
}, adminController.getAllPosts);

router.get('/posts/pending', (req, res, next) => {
  console.log('📌 Route /admin/posts/pending appelée');
  console.log('👤 User:', req.user?.id, req.user?.role);
  next();
}, postController.getPendingPosts);

router.put('/posts/:id/approve', postController.approvePost);
router.delete('/posts/:id', adminController.deletePost);

// Gestion des signalements
router.get('/reports', adminController.getReports);
router.put('/reports/:id/resolve', adminController.resolveReport);

// Gestion des conversations
router.get('/conversations', adminController.getAllConversations);
router.get('/conversations/:id/messages', adminController.getConversationMessages);

// Messages de contact
router.get('/contact-messages', adminController.getContactMessages);

module.exports = router;