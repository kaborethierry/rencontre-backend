const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { protect, admin } = require('../middlewares/authMiddleware');

// Routes publiques
router.get('/', postController.getPosts);
router.get('/user/:userId', postController.getUserPosts);

// Routes protégées
router.post('/', protect, postController.createPost);
router.delete('/:id', protect, postController.deletePost);

// Routes admin
router.get('/pending', protect, admin, postController.getPendingPosts);
router.put('/:id/approve', protect, admin, postController.approvePost);

module.exports = router;