const mongoose = require('mongoose');

// A workspace groups boards and the people who work on them.
// Everyone in a workspace sees all of its boards (automatic access).
const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: '', trim: true, maxlength: 200 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Workspace', workspaceSchema);