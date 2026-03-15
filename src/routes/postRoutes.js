const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { protect } = require('../middlewares/authMiddleware');

// Routes publiques (ne nécessitent pas d'authentification)
router.get('/', postController.getPosts);
router.get('/user/:userId', postController.getUserPosts);

// Routes protégées (nécessitent une authentification)
router.post('/', protect, postController.createPost);
router.delete('/:id', protect, postController.deletePost);

module.exports = router;