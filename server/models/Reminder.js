const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    card: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    remindAt: { type: Date, required: true },
    sent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reminder', reminderSchema);