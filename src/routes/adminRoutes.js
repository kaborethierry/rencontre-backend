const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const postController = require('../controllers/postController');
const { protect, admin } = require('../middlewares/authMiddleware');

// Toutes les routes admin nécessitent authentification ET rôle admin
router.use(protect, admin);

// ✅ METTRE LA ROUTE PENDING EN PREMIER
router.get('/posts/pending', postController.getPendingPosts);

// Tableau de bord
router.get('/dashboard', adminController.getDashboardStats);

// Gestion des utilisateurs
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/toggle', adminController.toggleUserStatus);
router.delete('/users/:id', adminController.deleteUser);

// Gestion des posts
router.get('/posts', adminController.getAllPosts);
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