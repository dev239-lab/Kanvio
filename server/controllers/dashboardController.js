const Board = require('../models/Board');
const List = require('../models/List');
const Card = require('../models/Card');
const User = require('../models/User');
const Activity = require('../models/Activity');

// GET /api/dashboard
// Everything the Home dashboard needs about the signed-in user in one request
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const boards = await Board.find({ members: userId }).select('title');
    const boardIds = boards.map((b) => b._id);
    const titleOf = Object.fromEntries(boards.map((b) => [String(b._id), b.title]));

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [cards, logs, doneThisWeek] = await Promise.all([
      Card.find({ assignedTo: userId, board: { $in: boardIds } }).limit(300),
      Activity.find({ board: { $in: boardIds } })
        .sort('-createdAt')
        .limit(10)
        .populate('actor', 'name'),
      Card.countDocuments({
        assignedTo: userId,
        board: { $in: boardIds },
        completed: true,
        completedAt: { $gte: weekAgo },
      }),
    ]);

    const lists = await List.find({ _id: { $in: [...new Set(cards.map((c) => String(c.list)))] } })
      .select('title');
    const listTitle = Object.fromEntries(lists.map((l) => [String(l._id), l.title]));

    // Open tasks first, then the earliest due date first, cards without a date last
    const dueValue = (c) => (c.dueDate ? new Date(c.dueDate).getTime() : Infinity);
    const myTasks = cards
      .sort((a, b) => Number(a.completed) - Number(b.completed) || dueValue(a) - dueValue(b))
      .slice(0, 50)
      .map((c) => ({
        _id: c._id,
        title: c.title,
        dueDate: c.dueDate || null,
        priority: c.priority,
        completed: c.completed,
        boardId: c.board,
        boardTitle: titleOf[String(c.board)] || '',
        listTitle: listTitle[String(c.list)] || '',
      }));

    const activity = logs.map((a) => ({
      _id: a._id,
      type: a.type,
      text: a.text,
      actorName: a.actor ? a.actor.name : 'Someone',
      boardId: a.board,
      boardTitle: titleOf[String(a.board)] || '',
      createdAt: a.createdAt,
    }));

    res.json({ myTasks, activity, doneThisWeek });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/dashboard/star/:boardId  (star or unstar a board for the signed-in user)
exports.toggleStar = async (req, res) => {
  try {
    const board = await Board.findOne({ _id: req.params.boardId, members: req.user._id });
    if (!board) return res.status(404).json({ message: 'Board not found' });

    const me = await User.findById(req.user._id).select('starredBoards');
    const isStarred = me.starredBoards.some((id) => String(id) === String(board._id));

    await User.updateOne(
      { _id: me._id },
      isStarred ? { $pull: { starredBoards: board._id } } : { $addToSet: { starredBoards: board._id } }
    );

    res.json({ boardId: board._id, starred: !isStarred });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/dashboard/team
// Everyone who shares a board with you, with basic info, live status and task counts
exports.getTeam = async (req, res) => {
  try {
    const myId = String(req.user._id);
    const boards = await Board.find({ members: req.user._id })
      .select('title members')
      .populate('members', 'name email createdAt');

    const people = {};
    boards.forEach((b) => {
      b.members.forEach((m) => {
        if (String(m._id) === myId) return;
        if (!people[m._id]) {
          people[m._id] = { _id: m._id, name: m.name, email: m.email, joinedAt: m.createdAt, boards: [] };
        }
        people[m._id].boards.push({ _id: b._id, title: b.title });
      });
    });

    // A person is online while they have a live connection to their personal socket room
    const io = req.app.get('io');
    const rooms = io && io.sockets && io.sockets.adapter ? io.sockets.adapter.rooms : null;

    const list = await Promise.all(
      Object.values(people).map(async (p) => {
        const shared = p.boards.map((b) => b._id);
        const [openTasks, doneTasks, last] = await Promise.all([
          Card.countDocuments({ assignedTo: p._id, board: { $in: shared }, completed: false }),
          Card.countDocuments({ assignedTo: p._id, board: { $in: shared }, completed: true }),
          Activity.findOne({ actor: p._id, board: { $in: shared } }).sort('-createdAt').select('createdAt'),
        ]);
        const room = rooms ? rooms.get(`user:${p._id}`) : null;
        return {
          ...p,
          openTasks,
          doneTasks,
          lastActive: last ? last.createdAt : null,
          online: !!(room && room.size > 0),
        };
      })
    );

    res.json(list.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};