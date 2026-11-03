const mongoose = require('mongoose');
const Board = require('../models/Board');
const Message = require('../models/Message');

const PAGE = 50;
const MAX_TEXT = 2000;

const isId = (id) => mongoose.isValidObjectId(id);

// Everyone who shares at least one board with this user (only they can be messaged)
async function teammateIds(userId) {
  const boards = await Board.find({ members: userId }).select('members');
  const ids = new Set();
  boards.forEach((b) => b.members.forEach((m) => ids.add(String(m))));
  ids.delete(String(userId));
  return ids;
}

// The same shape is used for the saved response and for the live event
const shape = (m, kind) => ({
  _id: m._id,
  kind,
  board: m.board || null,
  recipient: m.recipient || null,
  text: m.text,
  createdAt: m.createdAt,
  sender: { _id: m.sender._id || m.sender, name: m.sender.name },
});

const preview = (m) =>
  m
    ? {
        text: m.text.length > 80 ? `${m.text.slice(0, 80)}...` : m.text,
        createdAt: m.createdAt,
        senderId: m.sender._id,
        senderName: m.sender.name,
      }
    : null;

const cleanText = (value) => String(value || '').trim();

// GET /api/chat/conversations  (your boards and your teammates, with the latest message of each)
exports.getConversations = async (req, res) => {
  try {
    const me = req.user._id;
    const boards = await Board.find({ members: me })
      .select('title members')
      .populate('members', 'name avatarImage status statusMessage statusUntil');

    const people = {};
    boards.forEach((b) =>
      b.members.forEach((m) => {
        if (String(m._id) === String(me)) return;
        people[m._id] = {
          _id: m._id,
          name: m.name,
          avatarImage: m.avatarImage || '',
          status: m.status,
          statusMessage: m.statusMessage,
          statusUntil: m.statusUntil,
        };
      })
    );

    const boardList = await Promise.all(
      boards.map(async (b) => {
        const last = await Message.findOne({ board: b._id }).sort('-createdAt').populate('sender', 'name');
        return { _id: b._id, title: b.title, memberCount: b.members.length, last: preview(last) };
      })
    );

    const personList = await Promise.all(
      Object.values(people).map(async (p) => {
        const pair = [
          { sender: me, recipient: p._id },
          { sender: p._id, recipient: me },
        ];
        const [last, unread] = await Promise.all([
          Message.findOne({ board: null, $or: pair }).sort('-createdAt').populate('sender', 'name'),
          Message.countDocuments({ board: null, sender: p._id, recipient: me, readAt: null }),
        ]);
        return { ...p, last: preview(last), unread };
      })
    );

    const time = (c) => (c.last ? new Date(c.last.createdAt).getTime() : 0);
    boardList.sort((a, b) => time(b) - time(a) || a.title.localeCompare(b.title));
    personList.sort((a, b) => time(b) - time(a) || a.name.localeCompare(b.name));

    res.json({ boards: boardList, people: personList });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Reads one page of messages, newest last. ?before=<ISO date> loads older ones.
async function loadPage(filter, before, kind) {
  const query = { ...filter };
  if (before && !Number.isNaN(Date.parse(before))) query.createdAt = { $lt: new Date(before) };
  const found = await Message.find(query).sort('-createdAt').limit(PAGE).populate('sender', 'name');
  return {
    messages: found.reverse().map((m) => shape(m, kind)),
    hasMore: found.length === PAGE,
  };
}

// GET /api/chat/board/:boardId/messages
exports.getBoardMessages = async (req, res) => {
  try {
    const { boardId } = req.params;
    if (!isId(boardId)) return res.status(400).json({ message: 'Invalid board' });
    const board = await Board.findOne({ _id: boardId, members: req.user._id }).select('_id');
    if (!board) return res.status(403).json({ message: 'Access denied' });

    res.json(await loadPage({ board: board._id }, req.query.before, 'board'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/chat/direct/:userId/messages  (opening the conversation marks their messages as read)
exports.getDirectMessages = async (req, res) => {
  try {
    const me = req.user._id;
    const { userId } = req.params;
    if (!isId(userId)) return res.status(400).json({ message: 'Invalid person' });
    if (!(await teammateIds(me)).has(String(userId))) {
      return res.status(403).json({ message: 'You can only message people you share a board with' });
    }

    const pair = [
      { sender: me, recipient: userId },
      { sender: userId, recipient: me },
    ];
    const page = await loadPage({ board: null, $or: pair }, req.query.before, 'direct');

    if (!req.query.before) {
      await Message.updateMany({ board: null, sender: userId, recipient: me, readAt: null }, { readAt: new Date() });
    }
    res.json(page);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/chat/board/:boardId  body: { text }
exports.sendBoardMessage = async (req, res) => {
  try {
    const { boardId } = req.params;
    const text = cleanText(req.body.text);
    if (!isId(boardId)) return res.status(400).json({ message: 'Invalid board' });
    if (!text) return res.status(400).json({ message: 'Write a message first' });
    if (text.length > MAX_TEXT) return res.status(400).json({ message: `Messages can be ${MAX_TEXT} characters at most` });

    const board = await Board.findOne({ _id: boardId, members: req.user._id }).select('members');
    if (!board) return res.status(403).json({ message: 'Access denied' });

    const saved = await Message.create({ board: board._id, sender: req.user._id, text });
    saved.sender = { _id: req.user._id, name: req.user.name };
    const payload = shape(saved, 'board');

    // Every member gets it on their personal channel, wherever they are in the app
    const io = req.app.get('io');
    board.members.forEach((id) => io.to(`user:${id}`).emit('chatMessage', payload));

    res.status(201).json(payload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/chat/direct/:userId  body: { text }
exports.sendDirectMessage = async (req, res) => {
  try {
    const me = req.user._id;
    const { userId } = req.params;
    const text = cleanText(req.body.text);
    if (!isId(userId)) return res.status(400).json({ message: 'Invalid person' });
    if (String(userId) === String(me)) return res.status(400).json({ message: 'You cannot message yourself' });
    if (!text) return res.status(400).json({ message: 'Write a message first' });
    if (text.length > MAX_TEXT) return res.status(400).json({ message: `Messages can be ${MAX_TEXT} characters at most` });
    if (!(await teammateIds(me)).has(String(userId))) {
      return res.status(403).json({ message: 'You can only message people you share a board with' });
    }

    const saved = await Message.create({ board: null, sender: me, recipient: userId, text });
    saved.sender = { _id: me, name: req.user.name };
    const payload = shape(saved, 'direct');

    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('chatMessage', payload);
    io.to(`user:${me}`).emit('chatMessage', payload); // your other tabs

    res.status(201).json(payload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/chat/direct/:userId/read  (a message arrived while you had the conversation open)
exports.markDirectRead = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isId(userId)) return res.status(400).json({ message: 'Invalid person' });
    await Message.updateMany(
      { board: null, sender: userId, recipient: req.user._id, readAt: null },
      { readAt: new Date() }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/chat/unread  (how many direct messages you have not opened)
exports.getUnread = async (req, res) => {
  try {
    const count = await Message.countDocuments({ board: null, recipient: req.user._id, readAt: null });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};