const mongoose = require('mongoose');
const Board = require('../models/Board');
const List = require('../models/List');
const Card = require('../models/Card');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Activity = require('../models/Activity');
const WorkspaceMember = require('../models/WorkspaceMember');
const { logActivity } = require('../utils/activity');
const { emailUsers } = require('../utils/notify');
const { inviteEmail } = require('../utils/emailTemplates');
const { memberIds, ensureDefaultWorkspace, addUserToWorkspace } = require('../utils/WorkspaceAccess');

// POST /api/boards   body: { title, workspaceId }
// Without a workspaceId the board goes into your oldest workspace.
exports.createBoard = async (req, res) => {
  try {
    const { title, workspaceId } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    let wsId = workspaceId;
    if (wsId) {
      if (!mongoose.isValidObjectId(wsId)) return res.status(400).json({ message: 'Invalid workspace' });
      const mine = await WorkspaceMember.findOne({ workspace: wsId, user: req.user._id });
      if (!mine) return res.status(403).json({ message: 'You are not a member of that workspace' });
    } else {
      await ensureDefaultWorkspace(req.user);
      const first = await WorkspaceMember.findOne({ user: req.user._id }).sort('createdAt');
      wsId = first.workspace;
    }

    // Automatic access: the board starts with everyone who is in the workspace
    const members = await memberIds(wsId);
    const board = await Board.create({
      title,
      owner: req.user._id,
      workspace: wsId,
      members,
    });

    const io = req.app.get('io');
    members.forEach((id) => {
      if (String(id) !== String(req.user._id)) {
        io.to(`user:${id}`).emit('workspaceChanged', { workspaceId: wsId });
      }
    });

    res.status(201).json(board);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/boards?workspace=ID  (all boards the user belongs to, with dashboard details)
// `members` stays a list of ids. The names for the avatars are in `memberList`.
exports.getBoards = async (req, res) => {
  try {
    const filter = { members: req.user._id };
    if (req.query.workspace) {
      if (!mongoose.isValidObjectId(req.query.workspace)) {
        return res.status(400).json({ message: 'Invalid workspace' });
      }
      filter.workspace = req.query.workspace;
    }

    const [boards, me] = await Promise.all([
      Board.find(filter).sort('-createdAt').populate('members', 'name'),
      User.findById(req.user._id).select('starredBoards'),
    ]);
    const starred = new Set((me?.starredBoards || []).map(String));

    const withCounts = await Promise.all(
      boards.map(async (b) => {
        const [listCount, cardCount, doneCount, firstList, lastLog] = await Promise.all([
          List.countDocuments({ board: b._id }),
          Card.countDocuments({ board: b._id }),
          Card.countDocuments({ board: b._id, completed: true }),
          List.findOne({ board: b._id }).sort('position').select('_id'),
          Activity.findOne({ board: b._id }).sort('-createdAt').select('createdAt'),
        ]);

        const obj = b.toObject();
        return {
          ...obj,
          members: obj.members.map((m) => m._id),
          memberList: obj.members.map((m) => ({ _id: m._id, name: m.name })),
          listCount,
          cardCount,
          doneCount,
          firstListId: firstList ? firstList._id : null,
          lastActivity: lastLog ? lastLog.createdAt : b.updatedAt,
          starred: starred.has(String(b._id)),
        };
      })
    );

    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/boards/:id  (board + its lists + their cards)
exports.getBoard = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id).populate(
      'members',
      'name email avatarImage status statusMessage statusUntil'
    );
    if (!board) return res.status(404).json({ message: 'Board not found' });

    const isMember = board.members.some(
      (m) => m._id.toString() === req.user._id.toString()
    );
    if (!isMember) return res.status(403).json({ message: 'Access denied' });

    const lists = await List.find({ board: board._id }).sort('position');
    const cards = await Card.find({ board: board._id }).sort('position');

    // How many comments each card has
    const counts = await Comment.aggregate([
      { $match: { card: { $in: cards.map((c) => c._id) } } },
      { $group: { _id: '$card', n: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.n]));

    const listsWithCards = lists.map((list) => ({
      ...list.toObject(),
      cards: cards
        .filter((c) => c.list.toString() === list._id.toString())
        .map((c) => ({ ...c.toObject(), commentCount: countMap[c._id.toString()] || 0 })),
    }));

    res.json({ board, lists: listsWithCards });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/boards/:id/lists
exports.createList = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const board = await Board.findById(req.params.id);
    if (!board) return res.status(404).json({ message: 'Board not found' });

    const isMember = board.members.some(
      (m) => m.toString() === req.user._id.toString()
    );
    if (!isMember) return res.status(403).json({ message: 'Access denied' });

    const position = await List.countDocuments({ board: board._id });
    const list = await List.create({ title, board: board._id, position });
    req.app.get('io').to(`board:${board._id}`).emit('listCreated', list);
    res.status(201).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/boards/:id/members  (body: { email })
// On a board in a workspace this adds the person to the whole workspace, because
// everyone in a workspace sees all of its boards. Only the manager and team leads can do that.
exports.addMember = async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const board = await Board.findById(req.params.id);
    if (!board) return res.status(404).json({ message: 'Board not found' });

    const isMember = board.members.some(
      (m) => m.toString() === req.user._id.toString()
    );
    if (!isMember) return res.status(403).json({ message: 'Access denied' });

    if (board.workspace) {
      const mine = await WorkspaceMember.findOne({ workspace: board.workspace, user: req.user._id });
      if (!mine || mine.role === 'member') {
        return res
          .status(403)
          .json({ message: 'Only the workspace manager and team leads can add people' });
      }
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No Kanvio account uses that email' });
    }

    if (board.workspace) {
      const { already } = await addUserToWorkspace(board.workspace, user, 'member');
      if (already) return res.status(400).json({ message: `${user.name} is already in this workspace` });
    } else {
      if (board.members.some((m) => m.toString() === user._id.toString())) {
        return res.status(400).json({ message: `${user.name} is already on this board` });
      }
      board.members.push(user._id);
      await board.save();
    }

    logActivity({
      board: board._id,
      actor: req.user._id,
      type: 'member',
      text: `added ${user.name} to the board`,
    });

    const member = { _id: user._id, name: user.name, email: user.email };
    const io = req.app.get('io');
    io.to(`board:${board._id}`).emit('memberAdded', { boardId: board._id, member });
    io.to(`user:${user._id}`).emit('addedToBoard', {
      boardId: board._id,
      title: board.title,
      by: req.user.name,
    });
    emailUsers([user._id], 'invite', () =>
      inviteEmail({ by: req.user.name, boardTitle: board.title, boardId: board._id })
    );
    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};