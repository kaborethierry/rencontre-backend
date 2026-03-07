const express = require('express');
const router = express.Router({ mergeParams: true });
const commentController = require('../controllers/commentController');
const { protect } = require('../middlewares/authMiddleware');

// Routes protégées
router.use(protect);

router.post('/:postId', commentController.addComment);
router.get('/:postId', commentController.getPostComments);
router.delete('/:id', commentController.deleteComment);

module.exports = router;