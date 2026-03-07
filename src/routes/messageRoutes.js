const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middlewares/authMiddleware');

// Toutes les routes nécessitent une authentification
router.use(protect);

router.get('/conversations', messageController.getConversations);
router.get('/unread-count', messageController.getUnreadCount);
router.get('/:userId', messageController.getMessages);
router.post('/', messageController.sendMessage);
router.put('/read', messageController.markAsRead);
router.delete('/conversation/:id', messageController.deleteConversation);

module.exports = router;