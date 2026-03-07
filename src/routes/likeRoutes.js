const express = require('express');
const router = express.Router();
const likeController = require('../controllers/likeController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/:postId/toggle', likeController.toggleLike);
router.get('/:postId', likeController.getPostLikes);

module.exports = router;