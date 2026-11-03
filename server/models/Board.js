const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // For a board in a workspace, `members` always equals the workspace members
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Board', boardSchema);