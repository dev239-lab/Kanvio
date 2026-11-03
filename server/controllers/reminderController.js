const Card = require('../models/Card');
const Board = require('../models/Board');
const Reminder = require('../models/Reminder');

const isBoardMember = async (boardId, userId) => {
  const board = await Board.findById(boardId);
  if (!board) return false;
  return board.members.some((m) => m.toString() === userId.toString());
};

// POST /api/reminders
exports.createReminder = async (req, res) => {
  try {
    const { cardId, remindAt } = req.body;
    if (!cardId || !remindAt) {
      return res.status(400).json({ message: 'cardId and remindAt are required' });
    }

    const date = new Date(remindAt);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: 'remindAt is not a valid date' });
    }
    if (date <= new Date()) {
      return res.status(400).json({ message: 'remindAt must be in the future' });
    }

    const card = await Card.findById(cardId);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    if (!(await isBoardMember(card.board, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const reminder = await Reminder.create({
      card: card._id,
      user: req.user._id,
      remindAt: date,
    });
    res.status(201).json(reminder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/reminders  (the logged-in user's upcoming reminders)
exports.getReminders = async (req, res) => {
  try {
    const reminders = await Reminder.find({ user: req.user._id, sent: false })
      .populate('card', 'title')
      .sort('remindAt');
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/reminders/:id  (only the owner)
exports.deleteReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });

    if (reminder.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await reminder.deleteOne();
    res.json({ message: 'Reminder deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};