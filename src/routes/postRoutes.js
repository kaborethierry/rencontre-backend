const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { protect } = require('../middlewares/authMiddleware');

// Routes protégées (nécessitent authentification)
router.post('/', protect, postController.createPost);
router.get('/', postController.getPosts);
router.get('/user/:userId', postController.getUserPosts);
router.put('/:id', protect, postController.updatePost);
router.delete('/:id', protect, postController.deletePost);

module.exports = router;