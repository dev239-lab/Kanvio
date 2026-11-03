// One-time move of the boards you already have into workspaces.
//   node scripts/migrateWorkspaces.js --dry     shows what would happen, changes nothing
//   node scripts/migrateWorkspaces.js           does it
// Safe to run again: it only touches boards that have no workspace yet.
//
// Boards are grouped by their owner. Each owner's boards go into one workspace that they manage,
// and everyone who was on any of those boards becomes a member. Because every member of a
// workspace sees all of its boards, people may now see boards they were not on before.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Board = require('../models/Board');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');
const { syncBoards } = require('../utils/WorkspaceAccess');

const dry = process.argv.includes('--dry');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(dry ? 'DRY RUN: nothing will be changed\n' : 'Moving boards into workspaces\n');

  const loose = await Board.find({ $or: [{ workspace: null }, { workspace: { $exists: false } }] });
  if (loose.length === 0) {
    console.log('Every board already has a workspace. Nothing to do.');
    return;
  }

  const byOwner = new Map();
  loose.forEach((b) => {
    const key = String(b.owner);
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key).push(b);
  });

  for (const [ownerId, boards] of byOwner) {
    const owner = await User.findById(ownerId).select('name');
    if (!owner) {
      console.log(`Skipping ${boards.length} board(s): the owner no longer exists`);
      continue;
    }

    const people = new Set([ownerId]);
    boards.forEach((b) => b.members.forEach((m) => people.add(String(m))));

    // Reuse a workspace this person already manages, otherwise make one
    let managed = await WorkspaceMember.findOne({ user: ownerId, role: 'manager' }).sort('createdAt');
    let workspaceId = managed ? managed.workspace : null;
    const label = workspaceId
      ? 'existing workspace'
      : `new workspace "${owner.name.split(' ')[0]}'s workspace"`;

    console.log(`${owner.name}: ${boards.length} board(s), ${people.size} people -> ${label}`);
    if (dry) continue;

    if (!workspaceId) {
      const ws = await Workspace.create({ name: `${owner.name.split(' ')[0]}'s workspace`, owner: ownerId });
      workspaceId = ws._id;
      await WorkspaceMember.create({ workspace: workspaceId, user: ownerId, role: 'manager' });
    }

    for (const personId of people) {
      const exists = await WorkspaceMember.findOne({ workspace: workspaceId, user: personId });
      if (!exists) await WorkspaceMember.create({ workspace: workspaceId, user: personId, role: 'member' });
    }

    await Board.updateMany({ _id: { $in: boards.map((b) => b._id) } }, { $set: { workspace: workspaceId } });
    await syncBoards(workspaceId);
  }

  console.log(dry ? '\nDry run finished. Run again without --dry to apply.' : '\nDone.');
}

run()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());