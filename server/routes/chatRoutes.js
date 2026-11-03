const express = require('express');
const {
  getConversations,
  getBoardMessages,
  getDirectMessages,
  sendBoardMessage,
  sendDirectMessage,
  markDirectRead,
  getUnread,
} = require('../controllers/chatController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/conversations', getConversations);
router.get('/unread', getUnread);
router.route('/board/:boardId').post(sendBoardMessage);
router.get('/board/:boardId/messages', getBoardMessages);
router.route('/direct/:userId').post(sendDirectMessage);
router.get('/direct/:userId/messages', getDirectMessages);
router.put('/direct/:userId/read', markDirectRead);

module.exports = router;