const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const postController = require('../controllers/postController'); // ← AJOUTER CETTE LIGNE
const { protect, admin } = require('../middlewares/authMiddleware');

// Toutes les routes admin nécessitent authentification ET rôle admin
router.use(protect, admin);

// Tableau de bord
router.get('/dashboard', adminController.getDashboardStats);

// Gestion des utilisateurs
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/toggle', adminController.toggleUserStatus);
router.delete('/users/:id', adminController.deleteUser);

// Gestion des posts
router.get('/posts', adminController.getAllPosts);
router.delete('/posts/:id', adminController.deletePost);

// ✅ NOUVELLE ROUTE POUR LES POSTS EN ATTENTE
router.get('/posts/pending', postController.getPendingPosts);

// Gestion des signalements
router.get('/reports', adminController.getReports);
router.put('/reports/:id/resolve', adminController.resolveReport);

// Gestion des conversations
router.get('/conversations', adminController.getAllConversations);
router.get('/conversations/:id/messages', adminController.getConversationMessages);

// Messages de contact
router.get('/contact-messages', adminController.getContactMessages);

module.exports = router;