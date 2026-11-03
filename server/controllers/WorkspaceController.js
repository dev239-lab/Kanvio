const mongoose = require('mongoose');
const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');
const Board = require('../models/Board');
const Card = require('../models/Card');
const User = require('../models/User');
const {
  isId,
  displayRole,
  memberIds,
  syncBoards,
  ensureDefaultWorkspace,
  addUserToWorkspace,
} = require('../utils/WorkspaceAccess');

const canManage = (m) => m.role === 'manager' || m.role === 'lead';
const RANK = { manager: 0, lead: 1, board_owner: 2, member: 3 };
const USER_FIELDS = 'name email avatarImage status statusMessage statusUntil';

// Lets every member's open pages know that something changed in the workspace
async function announce(req, workspaceId) {
  const io = req.app.get('io');
  (await memberIds(workspaceId)).forEach((id) =>
    io.to(`user:${id}`).emit('workspaceChanged', { workspaceId })
  );
}

// Loads the workspace and the signed-in person's place in it, or answers with an error
async function load(req, res) {
  const { id } = req.params;
  if (!isId(id)) {
    res.status(400).json({ message: 'Invalid workspace' });
    return null;
  }
  const [workspace, me] = await Promise.all([
    Workspace.findById(id),
    WorkspaceMember.findOne({ workspace: id, user: req.user._id }),
  ]);
  if (!workspace) {
    res.status(404).json({ message: 'Workspace not found' });
    return null;
  }
  if (!me) {
    res.status(403).json({ message: 'You are not a member of this workspace' });
    return null;
  }
  return { workspace, me };
}

async function summary(workspace, me) {
  const [memberCount, boardCount, owns] = await Promise.all([
    WorkspaceMember.countDocuments({ workspace: workspace._id }),
    Board.countDocuments({ workspace: workspace._id }),
    Board.countDocuments({ workspace: workspace._id, owner: me.user }),
  ]);
  return {
    _id: workspace._id,
    name: workspace.name,
    description: workspace.description,
    owner: workspace.owner,
    role: displayRole(me.role, owns),
    baseRole: me.role,
    memberCount,
    boardCount,
    createdAt: workspace.createdAt,
  };
}

// GET /api/workspaces  (the workspaces you belong to; a new person gets one automatically)
exports.listWorkspaces = async (req, res) => {
  try {
    await ensureDefaultWorkspace(req.user);
    const mine = await WorkspaceMember.find({ user: req.user._id }).populate('workspace');
    const list = await Promise.all(
      mine.filter((m) => m.workspace).map((m) => summary(m.workspace, m))
    );
    list.sort((a, b) => a.name.localeCompare(b.name));
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/workspaces  body: { name, description }
exports.createWorkspace = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!name) return res.status(400).json({ message: 'Give the workspace a name' });
    if (name.length > 60) return res.status(400).json({ message: 'The name can be 60 characters at most' });
    if (description.length > 200) {
      return res.status(400).json({ message: 'The description can be 200 characters at most' });
    }

    const workspace = await Workspace.create({ name, description, owner: req.user._id });
    const me = await WorkspaceMember.create({ workspace: workspace._id, user: req.user._id, role: 'manager' });
    res.status(201).json(await summary(workspace, me));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/workspaces/:id
exports.getWorkspace = async (req, res) => {
  try {
    const ctx = await load(req, res);
    if (!ctx) return;
    res.json(await summary(ctx.workspace, ctx.me));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/workspaces/:id  body: { name, description }  (manager and team lead)
exports.updateWorkspace = async (req, res) => {
  try {
    const ctx = await load(req, res);
    if (!ctx) return;
    if (!canManage(ctx.me)) {
      return res.status(403).json({ message: 'Only the manager and team leads can edit the workspace' });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name || name.length > 60) {
        return res.status(400).json({ message: 'The name must be 1 to 60 characters' });
      }
      ctx.workspace.name = name;
    }
    if (req.body.description !== undefined) {
      const description = String(req.body.description).trim();
      if (description.length > 200) {
        return res.status(400).json({ message: 'The description can be 200 characters at most' });
      }
      ctx.workspace.description = description;
    }
    await ctx.workspace.save();
    announce(req, ctx.workspace._id);
    res.json(await summary(ctx.workspace, ctx.me));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/workspaces/:id  (manager only, and only when it has no boards)
exports.deleteWorkspace = async (req, res) => {
  try {
    const ctx = await load(req, res);
    if (!ctx) return;
    if (ctx.me.role !== 'manager') {
      return res.status(403).json({ message: 'Only the manager can delete the workspace' });
    }
    if ((await Board.countDocuments({ workspace: ctx.workspace._id })) > 0) {
      return res.status(400).json({ message: 'Move or delete the boards in this workspace first' });
    }

    const ids = await memberIds(ctx.workspace._id);
    await WorkspaceMember.deleteMany({ workspace: ctx.workspace._id });
    await ctx.workspace.deleteOne();
    const io = req.app.get('io');
    ids.forEach((uid) => io.to(`user:${uid}`).emit('workspaceChanged', { workspaceId: ctx.workspace._id }));
    res.json({ message: 'Workspace deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/workspaces/:id/members?search=text&role=manager|lead|board_owner|member
exports.listMembers = async (req, res) => {
  try {
    const ctx = await load(req, res);
    if (!ctx) return;
    const id = ctx.workspace._id;

    const [rows, owned, boardCount] = await Promise.all([
      WorkspaceMember.find({ workspace: id }).populate('user', USER_FIELDS),
      Board.aggregate([
        { $match: { workspace: new mongoose.Types.ObjectId(String(id)) } },
        { $group: { _id: '$owner', n: { $sum: 1 } } },
      ]),
      Board.countDocuments({ workspace: id }),
    ]);
    const ownedBy = Object.fromEntries(owned.map((o) => [String(o._id), o.n]));

    const search = String(req.query.search || '').trim().toLowerCase();
    const wanted = String(req.query.role || '');

    const members = rows
      .filter((r) => r.user)
      .map((r) => {
        const owns = ownedBy[String(r.user._id)] || 0;
        return {
          _id: r.user._id,
          name: r.user.name,
          email: r.user.email,
          avatarImage: r.user.avatarImage || '',
          status: r.user.status,
          statusMessage: r.user.statusMessage,
          statusUntil: r.user.statusUntil,
          role: displayRole(r.role, owns),
          baseRole: r.role,
          ownsBoards: owns,
          joinedAt: r.createdAt,
        };
      })
      .filter((m) => !wanted || m.role === wanted)
      .filter((m) => !search || m.name.toLowerCase().includes(search) || m.email.toLowerCase().includes(search))
      .sort((a, b) => RANK[a.role] - RANK[b.role] || a.name.localeCompare(b.name));

    res.json({ members, total: rows.length, boardCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/workspaces/:id/members  body: { email, role }  (manager and team lead)
exports.addWorkspaceMember = async (req, res) => {
  try {
    const ctx = await load(req, res);
    if (!ctx) return;
    if (!canManage(ctx.me)) {
      return res.status(403).json({ message: 'Only the manager and team leads can add people' });
    }

    const email = String(req.body.email || '').trim().toLowerCase();
    const role = req.body.role === 'lead' ? 'lead' : 'member';
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (role === 'lead' && ctx.me.role !== 'manager') {
      return res.status(403).json({ message: 'Only the manager can make someone a team lead' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No Kanvio account uses that email' });

    const { already } = await addUserToWorkspace(ctx.workspace._id, user, role);
    if (already) return res.status(400).json({ message: `${user.name} is already in this workspace` });

    const io = req.app.get('io');
    io.to(`user:${user._id}`).emit('addedToWorkspace', {
      workspaceId: ctx.workspace._id,
      name: ctx.workspace.name,
      by: req.user.name,
    });
    announce(req, ctx.workspace._id);

    res.status(201).json({ _id: user._id, name: user.name, email: user.email, role, baseRole: role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/workspaces/:id/members/:userId  body: { role: 'lead' | 'member' }  (manager only)
exports.changeMemberRole = async (req, res) => {
  try {
    const ctx = await load(req, res);
    if (!ctx) return;
    if (ctx.me.role !== 'manager') {
      return res.status(403).json({ message: 'Only the manager can change roles' });
    }

    const { userId } = req.params;
    const role = req.body.role;
    if (!isId(userId)) return res.status(400).json({ message: 'Invalid person' });
    if (!['lead', 'member'].includes(role)) {
      return res.status(400).json({ message: 'Choose Team Lead or Member' });
    }

    const target = await WorkspaceMember.findOne({ workspace: ctx.workspace._id, user: userId });
    if (!target) return res.status(404).json({ message: 'That person is not in this workspace' });
    if (target.role === 'manager') {
      return res.status(400).json({ message: "The manager's role cannot be changed" });
    }

    target.role = role;
    await target.save();
    announce(req, ctx.workspace._id);
    res.json({ _id: target.user, role, baseRole: role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/workspaces/:id/members/:userId
// The manager can remove anyone, a team lead can remove members, and anyone can leave.
exports.removeWorkspaceMember = async (req, res) => {
  try {
    const ctx = await load(req, res);
    if (!ctx) return;

    const { userId } = req.params;
    if (!isId(userId)) return res.status(400).json({ message: 'Invalid person' });

    const target = await WorkspaceMember.findOne({ workspace: ctx.workspace._id, user: userId });
    if (!target) return res.status(404).json({ message: 'That person is not in this workspace' });
    if (target.role === 'manager') {
      return res.status(400).json({ message: 'The manager cannot be removed. Delete the workspace instead.' });
    }

    const self = String(userId) === String(req.user._id);
    const allowed = self || ctx.me.role === 'manager' || (ctx.me.role === 'lead' && target.role === 'member');
    if (!allowed) {
      return res.status(403).json({ message: 'You do not have permission to remove this person' });
    }

    const workspaceId = ctx.workspace._id;
    const boards = await Board.find({ workspace: workspaceId }).select('_id');
    const boardIds = boards.map((b) => b._id);

    await WorkspaceMember.deleteOne({ _id: target._id });
    await Board.updateMany({ workspace: workspaceId }, { $pull: { members: userId } });
    // Boards they owned go to the workspace manager, and their cards become unassigned
    await Board.updateMany({ workspace: workspaceId, owner: userId }, { $set: { owner: ctx.workspace.owner } });
    await Card.updateMany({ board: { $in: boardIds } }, { $pull: { assignedTo: userId } });

    // Stop live updates from the boards they can no longer see
    const io = req.app.get('io');
    boardIds.forEach((b) => io.in(`user:${userId}`).socketsLeave(`board:${b}`));
    io.to(`user:${userId}`).emit('removedFromWorkspace', { workspaceId, name: ctx.workspace.name });
    announce(req, workspaceId);

    res.json({ message: self ? 'You left the workspace' : 'Person removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Used by the board code
exports.syncBoards = syncBoards;