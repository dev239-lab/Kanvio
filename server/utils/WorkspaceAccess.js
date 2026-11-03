const mongoose = require('mongoose');
const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');
const Board = require('../models/Board');

const isId = (id) => mongoose.isValidObjectId(id);

// Shown role: a plain member who owns boards is a Board Owner
const displayRole = (role, ownedBoards) =>
  role === 'member' && ownedBoards > 0 ? 'board_owner' : role;

// The people of a workspace, as a list of user ids
async function memberIds(workspaceId) {
  const rows = await WorkspaceMember.find({ workspace: workspaceId }).select('user');
  return rows.map((r) => r.user);
}

// Automatic access: every board of the workspace lists exactly the workspace members.
// All the existing "is this person a member of the board" checks keep working because of this.
async function syncBoards(workspaceId) {
  const ids = await memberIds(workspaceId);
  await Board.updateMany({ workspace: workspaceId }, { $set: { members: ids } });
}

// Everyone belongs to at least one workspace. A new person gets their own.
async function ensureDefaultWorkspace(user) {
  const existing = await WorkspaceMember.findOne({ user: user._id });
  if (existing) return;
  const first = String(user.name || 'My').split(' ')[0];
  const ws = await Workspace.create({ name: `${first}'s workspace`, owner: user._id });
  await WorkspaceMember.create({ workspace: ws._id, user: user._id, role: 'manager' });
}

async function getMembership(workspaceId, userId) {
  if (!isId(workspaceId)) return null;
  return WorkspaceMember.findOne({ workspace: workspaceId, user: userId });
}

// Adds a person and gives them access to every board. Returns { already: true } if they were in.
async function addUserToWorkspace(workspaceId, user, role = 'member') {
  const existing = await WorkspaceMember.findOne({ workspace: workspaceId, user: user._id });
  if (existing) return { already: true };
  await WorkspaceMember.create({ workspace: workspaceId, user: user._id, role });
  await syncBoards(workspaceId);
  return { already: false };
}

module.exports = {
  isId,
  displayRole,
  memberIds,
  syncBoards,
  ensureDefaultWorkspace,
  getMembership,
  addUserToWorkspace,
};