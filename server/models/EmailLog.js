const mongoose = require('mongoose');

// Remembers which deadline emails were already sent, so nobody gets the same one twice.
// `key` is the due date, so moving the due date later allows a new email.
const emailLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    card: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
    kind: { type: String, required: true },
    key: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

emailLogSchema.index({ user: 1, card: 1, kind: 1, key: 1 }, { unique: true });
emailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // tidy up after 30 days

module.exports = mongoose.model('EmailLog', emailLogSchema);