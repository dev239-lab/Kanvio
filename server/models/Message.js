const mongoose = require('mongoose');

// One chat message. It is either a board message (board is set) or a direct message (recipient is set).
const messageSchema = new mongoose.Schema(
  {
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', default: null },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    readAt: { type: Date, default: null }, // direct messages: when the recipient opened it
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ board: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, readAt: 1 });

module.exports = mongoose.model('Message', messageSchema);