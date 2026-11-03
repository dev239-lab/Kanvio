const Board = require('../models/Board');
const List = require('../models/List');
const Card = require('../models/Card');
const { logActivity } = require('../utils/activity');
const { emailUsers } = require('../utils/notify');
const { assignmentEmail, moveEmail } = require('../utils/emailTemplates');

const PRIORITIES = ['none', 'low', 'medium', 'high'];

// Helper: confirm the user belongs to the board
const isBoardMember = async (boardId, userId) => {
  const board = await Board.findById(boardId);
  if (!board) return false;
  return board.members.some((m) => m.toString() === userId.toString());
};

// POST /api/cards
exports.createCard = async (req, res) => {
  try {
    const { title, listId, description, dueDate, atTop, assignToMe, priority } = req.body;
    if (!title || !listId) {
      return res.status(400).json({ message: 'Title and listId are required' });
    }
    if (priority !== undefined && !PRIORITIES.includes(priority)) {
      return res.status(400).json({ message: 'Invalid priority' });
    }

    const list = await List.findById(listId);
    if (!list) return res.status(404).json({ message: 'List not found' });

    if (!(await isBoardMember(list.board, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let position = await Card.countDocuments({ list: list._id });
    if (atTop) {
      // Make room at the top of the list
      await Card.updateMany({ list: list._id }, { $inc: { position: 1 } });
      position = 0;
    }

    const card = await Card.create({
      title,
      description,
      dueDate,
      priority,
      list: list._id,
      board: list.board,
      position,
      assignedTo: assignToMe ? [req.user._id] : [],
    });

    logActivity({
      board: card.board,
      actor: req.user._id,
      type: 'created',
      text: `added "${card.title}" to ${list.title}`,
      card: card._id,
    });

    req.app.get('io').to(`board:${card.board}`).emit('cardCreated', card);
    res.status(201).json(card);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/cards/:id  (edit title, description, due date, assignees, priority, completed)
exports.updateCard = async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    if (!(await isBoardMember(card.board, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, description, dueDate, assignedTo, priority, completed } = req.body;
    const before = (card.assignedTo || []).map(String);
    const wasCompleted = card.completed;

    if (priority !== undefined && !PRIORITIES.includes(priority)) {
      return res.status(400).json({ message: 'Invalid priority' });
    }

    if (title !== undefined) card.title = title;
    if (description !== undefined) card.description = description;
    if (dueDate !== undefined) card.dueDate = dueDate;
    if (assignedTo !== undefined) card.assignedTo = assignedTo;
    if (priority !== undefined) card.priority = priority;
    if (completed !== undefined) {
      card.completed = !!completed;
      card.completedAt = completed ? new Date() : undefined;
    }

    await card.save();

    if (completed && !wasCompleted) {
      logActivity({
        board: card.board,
        actor: req.user._id,
        type: 'completed',
        text: `completed "${card.title}"`,
        card: card._id,
      });
    }

    const io = req.app.get('io');
    io.to(`board:${card.board}`).emit('cardUpdated', card);

    // Tell the people who were just assigned to this card (not yourself)
    if (assignedTo !== undefined) {
      const board = await Board.findById(card.board);
      const memberIds = board ? board.members.map(String) : [];
      (card.assignedTo || [])
        .map(String)
        .filter(
          (id) => !before.includes(id) && id !== String(req.user._id) && memberIds.includes(id)
        )
        .forEach((id) => {
          io.to(`user:${id}`).emit('assigned', {
            cardId: card._id,
            cardTitle: card.title,
            boardId: card.board,
            by: req.user.name,
          });
                    emailUsers([id], 'assignment', () =>
            assignmentEmail({ by: req.user.name, cardTitle: card.title, boardId: card.board })
          );
        });
    }

    res.json(card);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/cards/:id/move  (change list and/or position)
exports.moveCard = async (req, res) => {
  try {
    const { listId, position } = req.body;
    if (!listId || position === undefined) {
      return res.status(400).json({ message: 'listId and position are required' });
    }

    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    if (!(await isBoardMember(card.board, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const targetList = await List.findById(listId);
    if (!targetList || targetList.board.toString() !== card.board.toString()) {
      return res.status(400).json({ message: 'Invalid target list' });
    }

    const oldListId = card.list;
    const oldPosition = card.position;

    // Close the gap in the old list
    await Card.updateMany(
      { list: oldListId, position: { $gt: oldPosition } },
      { $inc: { position: -1 } }
    );

    // Make room in the new list
    await Card.updateMany(
      { list: targetList._id, position: { $gte: position }, _id: { $ne: card._id } },
      { $inc: { position: 1 } }
    );

    card.list = targetList._id;
    card.position = position;
    await card.save();

    // Only log a move to a different list, not a reorder inside the same list
    if (String(oldListId) !== String(targetList._id)) {
      logActivity({
        board: card.board,
        actor: req.user._id,
        type: 'moved',
        text: `moved "${card.title}" to ${targetList.title}`,
        card: card._id,
      });
            Board.findById(card.board)
        .select('members')
        .then((b) => {
          if (!b) return;
          emailUsers(
            b.members,
            'move',
            () => moveEmail({ by: req.user.name, cardTitle: card.title, listTitle: targetList.title, boardId: card.board }),
            { except: req.user._id }
          );
        });
    }

    req.app.get('io').to(`board:${card.board}`).emit('cardMoved', {
      ...card.toObject(),
      actor: req.user.name,
      actorId: req.user._id,
      listTitle: targetList.title,
    });
    res.json(card);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/cards/:id
exports.deleteCard = async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    if (!(await isBoardMember(card.board, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Card.updateMany(
      { list: card.list, position: { $gt: card.position } },
      { $inc: { position: -1 } }
    );
    await card.deleteOne();
    req.app.get('io').to(`board:${card.board}`).emit('cardDeleted', {
      cardId: card._id,
      listId: card.list,
    });
    res.json({ message: 'Card deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};