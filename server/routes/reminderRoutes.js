const express = require('express');
const {
  createReminder,
  getReminders,
  deleteReminder,
} = require('../controllers/reminderController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/').post(createReminder).get(getReminders);
router.delete('/:id', deleteReminder);

module.exports = router;