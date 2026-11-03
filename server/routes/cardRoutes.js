const express = require('express');
const {
  createCard,
  updateCard,
  moveCard,
  deleteCard,
} = require('../controllers/cardController');
const {
  addComment,
  getComments,
  deleteComment,
} = require('../controllers/commentController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', createCard);
router.put('/:id', updateCard);
router.put('/:id/move', moveCard);
router.delete('/:id', deleteCard);

router.route('/:id/comments').post(addComment).get(getComments);
router.delete('/comments/:commentId', deleteComment);

module.exports = router;