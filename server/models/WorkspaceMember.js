const mongoose = require('mongoose');

// One person in one workspace. Only three roles are stored:
//   manager = the workspace owner, lead = Team Lead (workspace admin), member = everyone else.
// "Board Owner" is not stored. A member who owns at least one board is shown as a Board Owner.
const workspaceMemberSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['manager', 'lead', 'member'], default: 'member' },
  },
  { timestamps: true }
);

workspaceMemberSchema.index({ workspace: 1, user: 1 }, { unique: true });
workspaceMemberSchema.index({ user: 1 });

module.exports = mongoose.model('WorkspaceMember', workspaceMemberSchema);