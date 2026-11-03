const express = require('express');
const {
  createBoard,
  getBoards,
  getBoard,
  createList,
  addMember,
} = require('../controllers/boardController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect); // every board route requires login

router.route('/').post(createBoard).get(getBoards);
router.get('/:id', getBoard);
router.post('/:id/lists', createList);
router.post('/:id/members', addMember);

module.exports = router;
