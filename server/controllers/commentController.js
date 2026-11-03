const Card = require('../models/Card');
const Board = require('../models/Board');
const Comment = require('../models/Comment');
const { emailUsers } = require('../utils/notify');
const { mentionEmail, commentEmail } = require('../utils/emailTemplates');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isBoardMember = async (boardId, userId) => {
  const board = await Board.findById(boardId);
  if (!board) return false;
  return board.members.some((m) => m.toString() === userId.toString());
};

// POST /api/cards/:id/comments
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Text is required' });

    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    if (!(await isBoardMember(card.board, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comment = await Comment.create({
      text,
      card: card._id,
      author: req.user._id,
    });
    await comment.populate('author', 'name email');

    req.app.get('io').to(`board:${card.board}`).emit('commentAdded', {
      ...comment.toObject(),
      cardTitle: card.title,
      boardId: card.board,
    });

    // Tell the board members who were @mentioned (not yourself)
    const board = await Board.findById(card.board).populate('members', 'name');
    if (board) {
      const firstCount = {};
      board.members.forEach((m) => {
        const first = m.name.split(' ')[0].toLowerCase();
        firstCount[first] = (firstCount[first] || 0) + 1;
      });

      const mentionedIds = [];

      board.members.forEach((m) => {
        if (String(m._id) === String(req.user._id)) return;
        const full = m.name.toLowerCase();
        const first = full.split(' ')[0];
        // A first name only counts when no other member shares it
        const names = firstCount[first] === 1 ? [full, first] : [full];
        const mentioned = names.some((n) =>
          new RegExp(`(^|\\s)@${escapeRegExp(n)}(?![\\w])`, 'i').test(text)
        );
        if (mentioned) {
          mentionedIds.push(String(m._id));
          req.app.get('io').to(`user:${m._id}`).emit('mentioned', {
            cardId: card._id,
            cardTitle: card.title,
            boardId: card.board,
            by: req.user.name,
          });
        }
      });

      // Emails for people who turned them on. Someone who was mentioned gets the mention email only.
      const mail = { by: req.user.name, cardTitle: card.title, boardId: card.board, text };
      emailUsers(mentionedIds, 'mention', () => mentionEmail(mail), { except: req.user._id });
      emailUsers(
        board.members.map((m) => m._id).filter((id) => !mentionedIds.includes(String(id))),
        'comment',
        () => commentEmail(mail),
        { except: req.user._id }
      );
    }

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/cards/:id/comments
exports.getComments = async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    if (!(await isBoardMember(card.board, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comments = await Comment.find({ card: card._id })
      .populate('author', 'name email')
      .sort('createdAt');

    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/cards/comments/:commentId  (only the author)
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    const card = await Card.findById(comment.card);
    await comment.deleteOne();

    if (card) {
      req.app.get('io').to(`board:${card.board}`).emit('commentDeleted', {
        commentId: comment._id,
        cardId: comment.card,
      });
    }
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};