const Activity = require('../models/Activity');

// Saves an activity line without making the request wait for it.
// A failure here must never break the real action, so it is only logged.
exports.logActivity = (data) => {
  Activity.create(data).catch((err) => console.error('Activity log failed:', err.message));
};