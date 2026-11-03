const mongoose = require('mongoose');

// One line of the "Recent activity" feed, for example: Dev moved "Design logo" to Doing
const activitySchema = new mongoose.Schema(
  {
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true }, // created, moved, completed, member
    text: { type: String, required: true }, // written without the name: moved "Design logo" to Doing
    card: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ board: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);