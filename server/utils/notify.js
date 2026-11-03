const User = require('../models/User');
const { sendMail, emailEnabled } = require('./mailer');

// Emails each person who turned on email for this kind of event (Settings, Notifications).
// `build` receives the person and returns { subject, html, text }.
// `except` is the person who caused the event, who never gets an email about their own action.
exports.emailUsers = async (userIds, type, build, { except } = {}) => {
  try {
    if (!emailEnabled()) return;
    const ids = [...new Set(userIds.map(String))].filter((id) => id !== String(except));
    if (ids.length === 0) return;

    const users = await User.find({ _id: { $in: ids }, [`emailPrefs.${type}`]: true }).select('name email');
    await Promise.all(users.map((u) => sendMail({ to: u.email, ...build(u) })));
  } catch (err) {
    console.error('Email notification failed:', err.message);
  }
};