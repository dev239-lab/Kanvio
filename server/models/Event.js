const mongoose = require('mongoose');

// A calendar event: a reason on a date, optionally with a time and invited teammates.
// The date is stored as text (YYYY-MM-DD) so it never shifts between time zones.
const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    notes: { type: String, default: '', maxlength: 1000 },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    startTime: { type: String, default: '' }, // HH:MM, empty means all day
    endTime: { type: String, default: '' },
    color: { type: String, default: '#fcd34d' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

eventSchema.index({ date: 1 });

module.exports = mongoose.model('Event', eventSchema);